import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TemplatesRegistry, TemplateInfo } from './templates-registry';
import { PerfTimer } from './utils/perf';

export interface ControllerRenderInfo {
  controllerModule: string;
  controllerFile: string;
  action?: string;
  viewModule?: string;
  templateName: string;
  templateFormat?: string;
  templatePath?: string;
  assigns: string[];
  line: number;
}

export interface TemplateUsageSummary {
  templatePath: string;
  assignSources: Map<string, ControllerRenderInfo[]>;
  controllers: ControllerRenderInfo[];
}

export class ControllersRegistry {
  private templatesRegistry: TemplatesRegistry;
  private workspaceRoot = '';
  private fileHashes = new Map<string, string>();
  private rendersByFile = new Map<string, ControllerRenderInfo[]>();
  private templateSummaries = new Map<string, TemplateUsageSummary>();

  constructor(templatesRegistry: TemplatesRegistry) {
    this.templatesRegistry = templatesRegistry;
  }

  setWorkspaceRoot(root: string) {
    this.workspaceRoot = root;
  }

  getTemplateSummary(templatePath: string): TemplateUsageSummary | null {
    return this.templateSummaries.get(templatePath) || null;
  }

  refreshTemplateSummaries() {
    this.rebuildTemplateSummaries();
  }

  getAssignsForTemplate(templatePath: string): string[] {
    const summary = this.templateSummaries.get(templatePath);
    if (!summary) {
      return [];
    }
    return Array.from(summary.assignSources.keys());
  }

  updateFile(filePath: string, content: string) {
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    const previous = this.fileHashes.get(filePath);
    if (previous === hash) {
      return;
    }

    const timer = new PerfTimer('controllers.updateFile');
    const renders = this.parseControllerFile(filePath, content);
    this.rendersByFile.set(filePath, renders);
    this.fileHashes.set(filePath, hash);
    this.rebuildTemplateSummaries();
    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), renders: renders.length });
  }

  removeFile(filePath: string) {
    this.rendersByFile.delete(filePath);
    this.fileHashes.delete(filePath);
    this.rebuildTemplateSummaries();
  }

  async scanWorkspace(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (this.shouldSkipDir(entry.name)) {
              continue;
            }
            scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('_controller.ex')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              this.updateFile(fullPath, content);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    };

    const timer = new PerfTimer('controllers.scanWorkspace');
    scan(workspaceRoot);
    timer.stop({ templates: this.templateSummaries.size });
  }

  private shouldSkipDir(name: string): boolean {
    return ['deps', '_build', 'node_modules', '.git', 'priv', 'assets'].includes(name);
  }

  private rebuildTemplateSummaries() {
    this.templateSummaries.clear();

    for (const renderList of this.rendersByFile.values()) {
      for (const render of renderList) {
        const templatePath = this.resolveTemplatePath(render);
        if (!templatePath) {
          continue;
        }
        render.templatePath = templatePath;

        let summary = this.templateSummaries.get(templatePath);
        if (!summary) {
          summary = {
            templatePath,
            assignSources: new Map<string, ControllerRenderInfo[]>(),
            controllers: [],
          };
          this.templateSummaries.set(templatePath, summary);
        }

        for (const assign of render.assigns) {
          const sources = summary.assignSources.get(assign) ?? [];
          sources.push(render);
          summary.assignSources.set(assign, sources);
        }
        summary.controllers.push(render);
      }
    }
  }

  private parseControllerFile(filePath: string, content: string): ControllerRenderInfo[] {
    const moduleName = this.extractModuleName(content);
    if (!moduleName) {
      return [];
    }

    const lines = content.split('\n');
    const functionDefs = this.collectFunctionDefinitions(lines);
    const renderMatches = this.collectRenderCalls(content);
    const renders: ControllerRenderInfo[] = [];

    for (const renderMatch of renderMatches) {
      const args = this.splitArguments(renderMatch.args);
      if (args.length < 2) {
        continue;
      }

      const parsed = this.parseRenderArguments(args);
      if (!parsed) {
        continue;
      }

      const lineNumber = this.calculateLineNumber(content, renderMatch.start);
      const action = this.resolveActionForLine(functionDefs, lineNumber);

      renders.push({
        controllerModule: moduleName,
        controllerFile: filePath,
        action,
        viewModule: parsed.viewModule,
        templateName: parsed.templateName,
        templateFormat: parsed.templateFormat,
        assigns: parsed.assigns,
        line: lineNumber,
      });
    }

    return renders;
  }

  private extractModuleName(content: string): string | null {
    const match = content.match(/defmodule\s+([\w.]+)\s+do/);
    return match ? match[1] : null;
  }

  private collectFunctionDefinitions(lines: string[]): Array<{ line: number; name: string }> {
    const defs: Array<{ line: number; name: string }> = [];

    lines.forEach((line, index) => {
      const match = line.match(/^\s*defp?\s+([a-z_][a-z0-9_!?]*)/);
      if (match) {
        defs.push({ line: index + 1, name: match[1] });
      }
    });

    return defs;
  }

  private resolveActionForLine(
    defs: Array<{ line: number; name: string }>,
    lineNumber: number
  ): string | undefined {
    let action: string | undefined;
    for (const def of defs) {
      if (def.line <= lineNumber) {
        action = def.name;
      } else {
        break;
      }
    }
    return action;
  }

  private collectRenderCalls(content: string): Array<{ start: number; args: string }> {
    const matches: Array<{ start: number; args: string }> = [];
    let index = content.indexOf('render(');

    while (index !== -1) {
      const { args, endIndex } = this.extractParenthesesContent(content, index + 'render'.length);
      if (args != null) {
        matches.push({ start: index, args });
        index = content.indexOf('render(', endIndex);
      } else {
        index = content.indexOf('render(', index + 1);
      }
    }

    return matches;
  }

  private extractParenthesesContent(text: string, startIndex: number): { args: string | null; endIndex: number } {
    const openParenIndex = text.indexOf('(', startIndex);
    if (openParenIndex === -1) {
      return { args: null, endIndex: startIndex };
    }

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let prev = '';

    for (let i = openParenIndex; i < text.length; i++) {
      const ch = text[i];

      if (inSingle) {
        if (ch === '\'' && prev !== '\\') {
          inSingle = false;
        }
      } else if (inDouble) {
        if (ch === '"' && prev !== '\\') {
          inDouble = false;
        }
      } else {
        if (ch === '\'') {
          inSingle = true;
        } else if (ch === '"') {
          inDouble = true;
        } else if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0) {
            const args = text.slice(openParenIndex + 1, i);
            return { args, endIndex: i + 1 };
          }
        }
      }

      prev = ch;
    }

    return { args: null, endIndex: startIndex };
  }

  private splitArguments(argString: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let prev = '';

    for (let i = 0; i < argString.length; i++) {
      const ch = argString[i];

      if (inSingle) {
        current += ch;
        if (ch === '\'' && prev !== '\\') {
          inSingle = false;
        }
      } else if (inDouble) {
        current += ch;
        if (ch === '"' && prev !== '\\') {
          inDouble = false;
        }
      } else {
        if (ch === '\'') {
          inSingle = true;
          current += ch;
        } else if (ch === '"') {
          inDouble = true;
          current += ch;
        } else if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
          current += ch;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          depth = Math.max(depth - 1, 0);
          current += ch;
        } else if (ch === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      prev = ch;
    }

    if (current.trim().length > 0) {
      args.push(current.trim());
    }

    return args;
  }

  private parseRenderArguments(args: string[]): {
    viewModule?: string;
    templateName: string;
    templateFormat?: string;
    assigns: string[];
  } | null {
    if (args.length < 2) {
      return null;
    }

    let index = 1;
    let viewModule: string | undefined;
    let templateArg: string | undefined;

    const secondArg = args[index];
    if (this.looksLikeModule(secondArg)) {
      viewModule = secondArg;
      index++;
    }

    templateArg = args[index];
    if (!templateArg) {
      return null;
    }

    const { templateName, format } = this.normalizeTemplateArg(templateArg);
    const assigns = this.extractAssignKeys(args.slice(index + 1));

    return {
      viewModule,
      templateName,
      templateFormat: format,
      assigns,
    };
  }

  private looksLikeModule(value: string): boolean {
    return /^[A-Z][\w]*(?:\.[A-Z][\w]*)*$/.test(value);
  }

  private normalizeTemplateArg(arg: string): { templateName: string; format?: string } {
    let cleaned = arg.trim();
    let format: string | undefined;

    if (cleaned.startsWith(':')) {
      cleaned = cleaned.slice(1);
    } else if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('\'') && cleaned.endsWith('\''))) {
      cleaned = cleaned.slice(1, -1);
    }

    const parts = cleaned.split('/');
    const lastPart = parts[parts.length - 1];

    if (lastPart.includes('.')) {
      const segments = lastPart.split('.');
      if (segments.length > 1) {
        format = segments.pop();
        cleaned = segments.join('.');
      } else {
        cleaned = segments[0];
      }
    }

    return { templateName: cleaned, format };
  }

  private extractAssignKeys(assignArgs: string[]): string[] {
    const keys = new Set<string>();

    for (const entry of assignArgs) {
      const match = entry.match(/^\s*:?([a-z_][a-z0-9_]*)\s*:/i);
      if (match) {
        const key = match[1];
        if (key) {
          keys.add(key);
        }
      }
    }

    return Array.from(keys);
  }

  private calculateLineNumber(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (text[i] === '\n') {
        line++;
      }
    }
    return line;
  }

  private resolveTemplatePath(render: ControllerRenderInfo): string | null {
    const templateCandidates: TemplateInfo[] = [];

    const candidateViewModules = this.collectCandidateViewModules(render);
    for (const viewModule of candidateViewModules) {
      const template = this.templatesRegistry.getTemplateByModule(
        viewModule,
        render.templateName,
        render.templateFormat
      );
      if (template) {
        templateCandidates.push(template);
      }
    }

    if (templateCandidates.length > 0) {
      return templateCandidates[0].filePath;
    }

    const guessed = this.guessTemplatePathFromController(render);
    if (guessed && fs.existsSync(guessed)) {
      return guessed;
    }

    return null;
  }

  private collectCandidateViewModules(render: ControllerRenderInfo): string[] {
    const candidates: string[] = [];
    if (render.viewModule) {
      candidates.push(render.viewModule);
    }

    if (render.controllerModule) {
      const parts = render.controllerModule.split('.');
      const moduleName = parts.pop() || '';
      const prefix = parts.join('.');
      const base = moduleName.replace(/Controller$/, '');
      if (base) {
        const htmlModule = `${prefix ? `${prefix}.` : ''}${base}HTML`;
        const viewModule = `${prefix ? `${prefix}.` : ''}${base}View`;
        if (!render.viewModule || render.viewModule !== htmlModule) {
          candidates.push(htmlModule);
        }
        if (!render.viewModule || render.viewModule !== viewModule) {
          candidates.push(viewModule);
        }
      }
    }

    return Array.from(new Set(candidates));
  }

  private guessTemplatePathFromController(render: ControllerRenderInfo): string | null {
    const controllerFile = render.controllerFile;
    const baseName = path.basename(controllerFile, path.extname(controllerFile)).replace(/_controller$/, '');
    if (!baseName) {
      return null;
    }

    const controllerDir = path.dirname(controllerFile);
    const templateName = render.templateName;
    const formats = render.templateFormat ? [render.templateFormat] : ['html'];
    const extensions = ['heex', 'leex', 'eex'];

    const pathsToTry: string[] = [];

    // Phoenix <= 1.6 style: lib/.../templates/<resource>/<template>.<format>.heex
    const templatesDir = path.join(path.dirname(controllerDir), 'templates', baseName);
    for (const format of formats) {
      for (const ext of extensions) {
        pathsToTry.push(path.join(templatesDir, `${templateName}.${format}.${ext}`));
      }
    }

    // Phoenix 1.7+ embed style: lib/.../controllers/<resource>_html/<template>.<format>.heex
    const embedDir = path.join(controllerDir, `${baseName}_html`);
    for (const format of formats) {
      for (const ext of extensions) {
        pathsToTry.push(path.join(embedDir, `${templateName}.${format}.${ext}`));
      }
    }

    for (const candidate of pathsToTry) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}
