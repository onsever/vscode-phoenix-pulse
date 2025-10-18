import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PerfTimer } from './utils/perf';

export interface TemplateInfo {
  moduleName: string;
  name: string;
  format: string;
  filePath: string;
}

export class TemplatesRegistry {
  private templatesByModule = new Map<string, TemplateInfo[]>();
  private templatesByPath = new Map<string, TemplateInfo>();
  private moduleByFile = new Map<string, string>();
  private fileHashes = new Map<string, string>();
  private workspaceRoot = '';

  setWorkspaceRoot(root: string) {
    this.workspaceRoot = root;
  }

  getTemplateByModule(moduleName: string, name: string, format?: string): TemplateInfo | null {
    const templates = this.templatesByModule.get(moduleName);
    if (!templates) {
      return null;
    }

    const normalizedName = name.trim();
    const preferredFormat = format ? format.trim() : undefined;

    let candidate: TemplateInfo | null = null;

    for (const template of templates) {
      if (template.name !== normalizedName) {
        continue;
      }

      if (preferredFormat) {
        if (template.format === preferredFormat) {
          return template;
        }
        // Keep track of the first candidate if exact format not found yet
        candidate = candidate ?? template;
      } else {
        // Prefer html when format unspecified
        if (template.format === 'html') {
          return template;
        }
        candidate = candidate ?? template;
      }
    }

    return candidate;
  }

  getTemplateByPath(filePath: string): TemplateInfo | null {
    return this.templatesByPath.get(filePath) || null;
  }

  getTemplatesForModule(moduleName: string): TemplateInfo[] {
    return this.templatesByModule.get(moduleName) ?? [];
  }

  getModuleNameForFile(filePath: string): string | null {
    const normalized = path.normalize(filePath);
    return this.moduleByFile.get(normalized) ?? null;
  }

  getAllTemplates(): TemplateInfo[] {
    return Array.from(this.templatesByPath.values());
  }

  updateFile(filePath: string, content: string) {
    const normalizedPath = path.normalize(filePath);
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    const previousHash = this.fileHashes.get(normalizedPath);
    if (previousHash === hash) {
      return;
    }

    const timer = new PerfTimer('templates.updateFile');

    this.removeFile(normalizedPath);

    const moduleName = this.extractModuleName(content);
    if (!moduleName) {
      timer.stop({ file: path.relative(this.workspaceRoot || '', normalizedPath), templates: 0 });
      return;
    }

    const embeddedTemplates = this.extractEmbeddedTemplates(normalizedPath, content, moduleName);
    const viewTemplates = this.extractViewTemplates(normalizedPath, content, moduleName);
    const templates = [...embeddedTemplates, ...viewTemplates];

    if (templates.length > 0) {
      this.templatesByModule.set(moduleName, templates);
      for (const template of templates) {
        this.templatesByPath.set(template.filePath, template);
      }
      this.moduleByFile.set(normalizedPath, moduleName);
    }

    this.fileHashes.set(normalizedPath, hash);
    timer.stop({ file: path.relative(this.workspaceRoot || '', normalizedPath), templates: templates.length });
  }

  removeFile(filePath: string) {
    const normalizedPath = path.normalize(filePath);
    const moduleName = this.moduleByFile.get(normalizedPath);
    if (!moduleName) {
      this.fileHashes.delete(normalizedPath);
      return;
    }

    const templates = this.templatesByModule.get(moduleName) ?? [];
    for (const template of templates) {
      this.templatesByPath.delete(template.filePath);
    }
    this.templatesByModule.delete(moduleName);
    this.moduleByFile.delete(normalizedPath);

    this.fileHashes.delete(normalizedPath);
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
          } else if (entry.isFile() && entry.name.endsWith('.ex')) {
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

    const timer = new PerfTimer('templates.scanWorkspace');
    scan(workspaceRoot);
    timer.stop({ templates: this.templatesByPath.size });
  }

  private shouldSkipDir(name: string): boolean {
    return ['deps', '_build', 'node_modules', '.git', 'priv', 'assets'].includes(name);
  }

  private extractModuleName(content: string): string | null {
    const match = content.match(/defmodule\s+([\w.]+)\s+do/);
    return match ? match[1] : null;
  }

  private extractEmbeddedTemplates(filePath: string, content: string, moduleName: string): TemplateInfo[] {
    const templates: TemplateInfo[] = [];
    const embedPattern = /embed_templates\s+"([^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = embedPattern.exec(content)) !== null) {
      const pattern = match[1];
      const templateDir = this.resolvePatternDirectory(filePath, pattern);
      if (!templateDir) {
        continue;
      }

      const files = this.readTemplateFiles(templateDir);
      for (const file of files) {
        const info = this.buildTemplateInfo(moduleName, file);
        if (info) {
          templates.push(info);
        }
      }
    }

    return templates;
  }

  private extractViewTemplates(filePath: string, content: string, moduleName: string): TemplateInfo[] {
    // Only attempt for modules using ... :view
    if (!/:view\b/.test(content)) {
      return [];
    }

    const templatesDir = this.resolveViewTemplatesDirectory(filePath);
    if (!templatesDir || !fs.existsSync(templatesDir)) {
      return [];
    }

    const files = this.readTemplateFiles(templatesDir);
    const templates: TemplateInfo[] = [];
    for (const file of files) {
      const info = this.buildTemplateInfo(moduleName, file);
      if (info) {
        templates.push(info);
      }
    }

    return templates;
  }

  private resolvePatternDirectory(filePath: string, pattern: string): string | null {
    const dirName = path.dirname(filePath);

    if (!pattern.includes('*')) {
      const fullPath = path.resolve(dirName, pattern);
      return fs.existsSync(fullPath) ? fullPath : null;
    }

    const starIndex = pattern.indexOf('*');
    const base = pattern.slice(0, starIndex);
    const fullBase = path.resolve(dirName, base);
    return fs.existsSync(fullBase) ? fullBase : null;
  }

  private resolveViewTemplatesDirectory(filePath: string): string | null {
    const dir = path.dirname(filePath);
    const parentDir = path.dirname(dir);
    const baseName = path.basename(filePath, path.extname(filePath)); // e.g., user_view
    const viewName = baseName.replace(/_view$/, '');
    if (!viewName) {
      return null;
    }

    const candidate = path.join(parentDir, 'templates', viewName);
    return candidate;
  }

  private readTemplateFiles(dir: string): string[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          if (this.isTemplateFile(entry.name)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          files.push(...this.readTemplateFiles(fullPath));
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  private isTemplateFile(fileName: string): boolean {
    return /\.(heex|leex|eex)$/.test(fileName);
  }

  private buildTemplateInfo(moduleName: string, filePath: string): TemplateInfo | null {
    const baseName = path.basename(filePath);
    const withoutExt = baseName.replace(/\.(heex|leex|eex)$/, '');
    if (!withoutExt) {
      return null;
    }

    let format = 'html';
    let name = withoutExt;

    const parts = withoutExt.split('.');
    if (parts.length > 1) {
      format = parts.pop() || 'html';
      name = parts.join('.');
    }

    return {
      moduleName,
      name,
      format,
      filePath,
    };
  }
}
