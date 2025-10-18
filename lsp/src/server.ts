import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  Definition,
  Location,
  Position,
  Range,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Hover,
  MarkupKind,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { getPhoenixCompletions } from './completions/phoenix';
import { getHtmlCompletions } from './completions/html';
// import { getEmmetCompletions } from './completions/emmet'; // Disabled for now
import {
  getJSCommandCompletions,
  getChainableJSCompletions,
  isJSCommandContext,
  isPipeChainContext
} from './completions/js-commands';
import { EventsRegistry } from './events-registry';
import type { PhoenixEvent } from './events-registry';
import { ComponentsRegistry, PhoenixComponent, ComponentSlot, getAttributeTypeDisplay } from './components-registry';
import { SchemaRegistry } from './schema-registry';
import {
  getLocalComponentCompletions,
  getComponentAttributeCompletions,
  getComponentSlotCompletions,
  isLocalComponentContext,
  getComponentNameFromContext,
  getModuleNameFromContext,
  buildComponentHoverDocumentation,
  buildAttributeHoverDocumentation,
} from './completions/components';
import {
  getAssignCompletions,
  isAtSignContext,
  isAssignsContext,
} from './completions/assigns';
import { getSpecialAttributeCompletions } from './completions/special-attributes';
import { validatePhoenixAttributes, getUnusedEventDiagnostics } from './validators/phoenix-diagnostics';
import { validateComponentUsage } from './validators/component-diagnostics';
import { validateNavigationComponents, validateJsPushUsage } from './validators/navigation-diagnostics';
import { getFormFieldCompletions } from './completions/form-fields';
import { getRouteHelperCompletions, getVerifiedRouteCompletions } from './completions/routes';
import { RouterRegistry } from './router-registry';
import { getHandleInfoEventCompletions } from './completions/events';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';
import {
  initializeTreeSitter,
  isTreeSitterReady,
  getTreeSitterError,
  clearTreeCache,
} from './parsers/tree-sitter';
import { TemplatesRegistry } from './templates-registry';
import { ControllersRegistry } from './controllers-registry';
import { filterDiagnosticsInsideComments } from './utils/comments';
import { getComponentUsageStack, ComponentUsage } from './utils/component-usage';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

const debugFlagString = process.env.PHOENIX_PULSE_DEBUG ?? '';
const debugFlags = new Set(
  debugFlagString
    .split(',')
    .map(flag => flag.trim().toLowerCase())
    .filter(Boolean)
);

const definitionCache = new Map<string, Location>();
const DEFINITION_CACHE_LIMIT = 200;

function cacheDefinition(key: string, location: Location) {
  if (definitionCache.has(key)) {
    definitionCache.set(key, location);
    return;
  }
  if (definitionCache.size >= DEFINITION_CACHE_LIMIT) {
    const firstKey = definitionCache.keys().next().value;
    if (firstKey) {
      definitionCache.delete(firstKey);
    }
  }
  definitionCache.set(key, location);
}

function getCachedDefinition(key: string): Location | null {
  return definitionCache.get(key) || null;
}

function clearDefinitionCacheForFile(filePath: string) {
  const keysToDelete: string[] = [];
  definitionCache.forEach((_, key) => {
    if (key.startsWith(`${filePath}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => definitionCache.delete(key));
}

function clearDefinitionCacheReferencingTarget(targetFilePath: string) {
  const targetUri = URI.file(targetFilePath).toString();
  const keysToDelete: string[] = [];
  definitionCache.forEach((location, key) => {
    if (location.uri === targetUri) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => definitionCache.delete(key));
}

function debugLog(flag: string, message: string) {
  if (debugFlags.has('all') || debugFlags.has(flag)) {
    connection.console.log(`[debug:${flag}] ${message}`);
  }
}

connection.console.log(
  debugFlags.size > 0
    ? `[Phoenix Pulse] Debug flags enabled: ${Array.from(debugFlags).join(', ')}`
    : '[Phoenix Pulse] Debug flags disabled (set PHOENIX_PULSE_DEBUG to enable)'
);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Create events registry
const eventsRegistry = new EventsRegistry();

// Create components registry
const componentsRegistry = new ComponentsRegistry();

// Create schema registry
const schemaRegistry = new SchemaRegistry();

// Create router registry
const routerRegistry = new RouterRegistry();

// Create template registry
const templatesRegistry = new TemplatesRegistry();

// Create controller registry
const controllersRegistry = new ControllersRegistry(templatesRegistry);

connection.onInitialize((params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['<', ' ', '-', ':', '"', '=', '{', '.', '#', '@'],
      },
      hoverProvider: true,
      definitionProvider: true,
      // Using push diagnostics (connection.sendDiagnostics) instead of pull diagnostics
    },
  };
  return result;
});

connection.onInitialized(async () => {
  connection.console.log('Phoenix LiveView LSP initialized!');

  // Scan workspace for handle_event definitions, components, and schemas
  const workspaceFolders = await connection.workspace.getWorkspaceFolders();
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0].uri.replace('file://', '');

    // Scan for events
    connection.console.log(`Scanning workspace for Phoenix events: ${workspaceRoot}`);
    await eventsRegistry.scanWorkspace(workspaceRoot);
    const eventCount = eventsRegistry.getAllEvents().length;
    connection.console.log(`Found ${eventCount} Phoenix events`);

    // Scan for components
    connection.console.log(`Scanning workspace for Phoenix components: ${workspaceRoot}`);
    componentsRegistry.setWorkspaceRoot(workspaceRoot); // Ensure workspaceRoot is set before scanning
    await componentsRegistry.scanWorkspace(workspaceRoot);
    const componentCount = componentsRegistry.getAllComponents().length;
    connection.console.log(`Found ${componentCount} Phoenix components`);

    // Scan for Ecto schemas
    connection.console.log(`Scanning workspace for Ecto schemas: ${workspaceRoot}`);
    await schemaRegistry.scanWorkspace(workspaceRoot);
    const schemaCount = schemaRegistry.getAllSchemas().length;
    connection.console.log(`Found ${schemaCount} Ecto schemas`);

    // Scan for routes
    connection.console.log(`Scanning workspace for Phoenix routes: ${workspaceRoot}`);
    await routerRegistry.scanWorkspace(workspaceRoot);
    const routeCount = routerRegistry.getRoutes().length;
    connection.console.log(`Found ${routeCount} Phoenix routes`);

    templatesRegistry.setWorkspaceRoot(workspaceRoot);
    await templatesRegistry.scanWorkspace(workspaceRoot);
    controllersRegistry.setWorkspaceRoot(workspaceRoot);
    await controllersRegistry.scanWorkspace(workspaceRoot);

    const treeSitterEnabled = await initializeTreeSitter(workspaceRoot);
    if (treeSitterEnabled && isTreeSitterReady()) {
      connection.console.log('Tree-sitter HEEx parser initialized.');
    } else {
      const error = getTreeSitterError();
      if (error) {
        connection.console.warn(`Tree-sitter unavailable: ${error.message}`);
      } else {
        connection.console.warn('Tree-sitter unavailable: HEEx grammar not bundled.');
      }
    }
  }
});

// Watch for file changes to update event registry and components registry
documents.onDidChangeContent((change) => {
  const doc = change.document;
  const uri = doc.uri;
  const filePath = path.normalize(uri.replace('file://', ''));
  const isElixirFile = uri.endsWith('.ex') || uri.endsWith('.exs');
  const isHeexFile = uri.endsWith('.heex');

  // Process .ex and .exs files for event, component, and schema registries
  if (isElixirFile) {
    const content = doc.getText();
    templatesRegistry.updateFile(filePath, content);
    eventsRegistry.updateFile(filePath, content);
    componentsRegistry.updateFile(filePath, content);
    // Update schema registry if file contains schema definition
    if (content.includes('schema ') || content.includes('embedded_schema')) {
      schemaRegistry.updateFile(filePath, content);
    }
    if (filePath.includes('router.ex')) {
       routerRegistry.updateFile(filePath, content);
    }
    if (filePath.endsWith('_controller.ex')) {
      controllersRegistry.updateFile(filePath, content);
    } else {
      controllersRegistry.refreshTemplateSummaries();
    }
  }

  // Validate .heex files and .ex/.exs files (with ~H sigils)
  if (isHeexFile || isElixirFile) {
    validateDocument(doc);
  }

  if (isElixirFile || isHeexFile) {
    clearTreeCache(filePath);
    clearDefinitionCacheForFile(filePath);
    clearDefinitionCacheReferencingTarget(filePath);
  }
});

documents.onDidOpen((e) => {
  const doc = e.document;
  const uri = doc.uri;

  // Validate on open for .heex and .ex/.exs files
  if (uri.endsWith('.heex') || uri.endsWith('.ex') || uri.endsWith('.exs')) {
    validateDocument(doc);
  }
});

documents.onDidClose((e) => {
  const uri = e.document.uri;
  const filePath = path.normalize(uri.replace('file://', ''));
  if (uri.endsWith('.ex') || uri.endsWith('.exs')) {
    eventsRegistry.removeFile(filePath);
    componentsRegistry.removeFile(filePath);
    schemaRegistry.removeFile(filePath);
    routerRegistry.removeFile(filePath);
    templatesRegistry.removeFile(filePath);
    if (filePath.endsWith('_controller.ex')) {
      controllersRegistry.removeFile(filePath);
    } else {
      controllersRegistry.refreshTemplateSummaries();
    }
  }

  if (uri.endsWith('.ex') || uri.endsWith('.exs') || uri.endsWith('.heex')) {
    eventsRegistry.removeTemplateEventUsage(filePath);
    clearTreeCache(filePath);
    clearDefinitionCacheForFile(filePath);
    clearDefinitionCacheReferencingTarget(filePath);
  }

  // Clear diagnostics when document closes
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// Debounce timer for validation
let validationTimer: NodeJS.Timeout | null = null;

/**
 * Validate a document and send diagnostics
 */
function validateDocument(document: TextDocument) {
  // Debounce validation to avoid excessive checks while typing
  if (validationTimer) {
    clearTimeout(validationTimer);
  }

  validationTimer = setTimeout(() => {
    const uri = document.uri;
    const filePath = path.normalize(uri.replace('file://', ''));
    const text = document.getText();

    // Run Phoenix attribute validation
    const phoenixDiagnostics = validatePhoenixAttributes(document, eventsRegistry, filePath);
    const unusedEventDiagnostics = getUnusedEventDiagnostics(document, eventsRegistry, templatesRegistry);

    // Run component usage validation
    const componentDiagnostics = validateComponentUsage(document, componentsRegistry, filePath);
    const navigationDiagnostics = validateNavigationComponents(document, componentsRegistry, filePath);
    const jsDiagnostics = validateJsPushUsage(document, text);

    // Combine all diagnostics
    const allDiagnostics = [
      ...phoenixDiagnostics,
      ...unusedEventDiagnostics,
      ...componentDiagnostics,
      ...navigationDiagnostics,
      ...jsDiagnostics,
    ];

    const filteredDiagnostics = filterDiagnosticsInsideComments(document, allDiagnostics);

    // Send diagnostics to client
    connection.sendDiagnostics({ uri, diagnostics: filteredDiagnostics });
  }, 500); // 500ms debounce
}

// Helper function to check if cursor is inside a ~H sigil
function isInsideHEExSigil(text: string, offset: number): boolean {
  // Find all ~H sigil blocks in the document
  const sigilPattern = /~H("""|''')/g;
  let match;
  const sigils: Array<{ start: number; end: number }> = [];

  while ((match = sigilPattern.exec(text)) !== null) {
    const sigilStart = match.index;
    const delimiter = match[1];
    const contentStart = sigilStart + match[0].length;

    // Find the closing delimiter
    const closingDelimiter = text.indexOf(delimiter, contentStart);
    if (closingDelimiter !== -1) {
      sigils.push({
        start: sigilStart,
        end: closingDelimiter + delimiter.length,
      });
    }
  }

  // Check if current offset is inside any sigil block
  return sigils.some((sigil) => offset >= sigil.start && offset <= sigil.end);
}

function getLastRegexMatch(text: string, regex: RegExp): RegExpExecArray | null {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const globalRegex = new RegExp(regex.source, flags);
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = globalRegex.exec(text)) !== null) {
    lastMatch = match;
    if (globalRegex.lastIndex === match.index) {
      globalRegex.lastIndex++;
    }
  }

  return lastMatch;
}

interface ComponentUsageContext {
  componentName: string;
  moduleContext?: string;
}

function isInsideTagContext(text: string, offset: number): boolean {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '>') {
      return false;
    }
    if (ch === '<') {
      if (i + 1 < text.length && text[i + 1] === '%') {
        return false;
      }
      return true;
    }
  }
  return false;
}

function findEnclosingComponentUsage(text: string, offset: number): ComponentUsageContext | null {
  const before = text.slice(0, offset);
  let pos = before.length;
  let depth = 0;

  while (pos > 0) {
    const lt = before.lastIndexOf('<', pos - 1);
    if (lt === -1) {
      break;
    }

    const gt = before.indexOf('>', lt);
    if (gt === -1 || gt >= before.length) {
      pos = lt;
      continue;
    }

    const tag = before.slice(lt, gt + 1);
    pos = lt;

    // Skip HEEx comments and slot tags
    if (tag.startsWith('<%') || tag.startsWith('<:') || tag.startsWith('</:')) {
      continue;
    }

    const localClose = tag.match(/^<\/\.([a-z_][a-z0-9_]*)\s*>$/);
    if (localClose) {
      depth++;
      continue;
    }

    const remoteClose = tag.match(/^<\/([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)*)\.([a-z_][a-z0-9_]*)\s*>$/);
    if (remoteClose) {
      depth++;
      continue;
    }

    const localOpen = tag.match(/^<\.([a-z_][a-z0-9_]*)\b[^>]*?>$/);
    if (localOpen) {
      const selfClosing = /\/>\s*$/.test(tag);
      if (selfClosing) {
        continue;
      }

      if (depth === 0) {
        return { componentName: localOpen[1] };
      }

      depth--;
      continue;
    }

    const remoteOpen = tag.match(/^<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)*)\.([a-z_][a-z0-9_]*)\b[^>]*?>$/);
    if (remoteOpen) {
      const selfClosing = /\/>\s*$/.test(tag);
      if (selfClosing) {
        continue;
      }

      if (depth === 0) {
        return { componentName: remoteOpen[2], moduleContext: remoteOpen[1] };
      }

      depth--;
      continue;
    }
  }

  return null;
}

function isInsideJsPushEvent(linePrefix: string): boolean {
  return /JS\.push\(\s*(["'])[^"']*$/.test(linePrefix);
}

function formatEventClauseHeader(event: PhoenixEvent): string {
  const fallback = `def handle_event("${event.name}", ${event.params}, socket) do`;
  const clause = (event.clause ?? fallback).trim();
  if (/do:\s*/.test(clause)) {
    return clause.replace(/do:\s*.+$/, 'do');
  }
  if (/\bdo\b/.test(clause)) {
    return clause;
  }
  return clause.endsWith('do') ? clause : `${clause} do`;
}

function buildEventMarkdown(event: PhoenixEvent, includeHeading = true): string {
  const fileName = path.basename(event.filePath);
  const lines: string[] = [];

  if (includeHeading) {
    lines.push(`**Event \`${event.name}\`**`);
  }

  if (event.doc) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(event.doc.trim());
  }

  const clauseHeader = formatEventClauseHeader(event);
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push('```elixir', clauseHeader, '  # ...', 'end', '```');

  const locationParts: string[] = [];
  if (event.moduleName) {
    locationParts.push(`\`${event.moduleName}\``);
  }
  locationParts.push(`\`${fileName}:${event.line}\``);
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push(`Defined in ${locationParts.join(' · ')}`);
  return lines.join('\n');
}

function createEventCompletionItem(event: PhoenixEvent, sortGroup: string, index: number): CompletionItem {
  const fileName = path.basename(event.filePath);
  return {
    label: event.name,
    kind: CompletionItemKind.Event,
    detail: `handle_event · ${event.moduleName || fileName}`,
    documentation: {
      kind: MarkupKind.Markdown,
      value: buildEventMarkdown(event, false),
    },
    insertText: event.name,
    sortText: `${sortGroup}${index.toString().padStart(3, '0')}`,
  };
}

function getJsPushEventCompletions(
  filePath: string,
  eventsRegistry: EventsRegistry
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  const { primary, secondary } = eventsRegistry.getEventsForTemplate(filePath);

  primary.forEach((event, index) => {
    completions.push(createEventCompletionItem(event, '0', index));
  });

  secondary.forEach((event, index) => {
    completions.push(createEventCompletionItem(event, '1', index));
  });

  return completions;
}

function createComponentLocation(component: PhoenixComponent): Location | null {
  try {
    const fileContent = fs.readFileSync(component.filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const zeroBasedLine = Math.max(0, component.line - 1);
    const lineText = lines[zeroBasedLine] ?? '';

    let startChar = lineText.indexOf(component.name);
    if (startChar === -1) {
      const defIndex = lineText.indexOf('def');
      if (defIndex !== -1) {
        startChar = defIndex;
      } else {
        const firstNonWhitespace = lineText.search(/\S/);
        startChar = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;
      }
    }

    const endChar = Math.max(startChar + component.name.length, startChar);

    return {
      uri: URI.file(component.filePath).toString(),
      range: {
        start: { line: zeroBasedLine, character: startChar },
        end: { line: zeroBasedLine, character: endChar },
      },
    };
  } catch (error) {
    connection.console.error(`[Definition] Failed to create location for ${component.moduleName}.${component.name}: ${error}`);
    return null;
  }
}

function createSlotLocation(component: PhoenixComponent, slotName: string): Location | null {
  try {
    const fileContent = fs.readFileSync(component.filePath, 'utf-8');
    const lines = fileContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const slotIndex = line.indexOf(`slot :${slotName}`);
      if (slotIndex !== -1) {
        return {
          uri: URI.file(component.filePath).toString(),
          range: {
            start: { line: i, character: slotIndex },
            end: { line: i, character: slotIndex + `slot :${slotName}`.length },
          },
        };
      }
    }
    return null;
  } catch (error) {
    connection.console.error(`[Definition] Failed to create slot location for ${component.moduleName}.${slotName}: ${error}`);
    return null;
  }
}

function getComponentContextAtPosition(line: string, charInLine: number): ComponentUsageContext | null {
  const tagStart = line.lastIndexOf('<', charInLine);
  if (tagStart === -1) {
    return null;
  }

  const after = line.slice(tagStart + 1);

  if (after.startsWith('/') || after.startsWith(':') || after.startsWith('%')) {
    return null;
  }

  if (after.startsWith('.')) {
    const nameMatch = after.slice(1).match(/^([a-z_][a-z0-9_]*)/);
    if (!nameMatch) {
      return null;
    }
    const nameStart = tagStart + 2;
    const nameEnd = nameStart + nameMatch[1].length;

    if (charInLine < nameStart || charInLine >= nameEnd) {
      return null;
    }

    return { componentName: nameMatch[1] };
  }

  const remoteMatch = after.match(/^([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)*)\.([a-z_][a-z0-9_]*)/);
  if (remoteMatch) {
    const moduleName = remoteMatch[1];
    const componentName = remoteMatch[2];
    const moduleStart = tagStart + 1;
    const moduleEnd = moduleStart + moduleName.length;
    const componentStart = moduleEnd + 1; // skip the dot
    const componentEnd = componentStart + componentName.length;

    if (charInLine >= componentStart && charInLine < componentEnd) {
      return {
        componentName,
        moduleContext: moduleName,
      };
    }

    return null;
  }

  return null;
}

interface SlotDetection {
  slotName: string;
  closing: boolean;
}

function detectSlotAtPosition(line: string, charInLine: number): SlotDetection | null {
  const openRegex = /<:([a-z_][a-z0-9_-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = openRegex.exec(line)) !== null) {
    const tagStart = match.index;
    const nameStart = tagStart + 2;
    const nameEnd = nameStart + match[1].length;
    if (charInLine >= tagStart + 1 && charInLine <= nameEnd) {
      return { slotName: match[1], closing: false };
    }
  }

  const closeRegex = /<\/:([a-z_][a-z0-9_-]*)/g;
  while ((match = closeRegex.exec(line)) !== null) {
    const tagStart = match.index;
    const nameStart = tagStart + 3;
    const nameEnd = nameStart + match[1].length;
    if (charInLine >= tagStart + 1 && charInLine <= nameEnd) {
      return { slotName: match[1], closing: true };
    }
  }

  return null;
}

function buildSlotHoverDocumentation(
  component: PhoenixComponent,
  slotName: string,
  slot?: ComponentSlot
): string {
  let doc = `**Slot: \`<:${slotName}>\`**\n\n`;
  doc += `Provided by component \`<.${component.name}>\` (\`${component.moduleName}\`).\n\n`;

  if (slot) {
    doc += `- **Required:** ${slot.required ? 'Yes' : 'No'}\n`;

    if (slot.attributes && slot.attributes.length > 0) {
      doc += '- **Slot assigns:**\n';
      slot.attributes.forEach(attr => {
        const typeDisplay = getAttributeTypeDisplay(attr);
        doc += `  - \`@${attr.name}\`: \`${typeDisplay}\``;
        if (attr.required) {
          doc += ' (required)';
        }
        if (attr.default) {
          doc += ` (default: \`${attr.default}\`)`;
        }
        doc += '\n';
      });
    }

    if (slot.doc) {
      doc += `\n${slot.doc}\n`;
    }
  } else if (slotName === 'inner_block') {
    doc += 'Default slot for inner content passed between the opening and closing component tags.\n\n';
  } else {
    doc += 'This slot is accepted by the component, but additional metadata was not found in the registry.\n\n';
  }

  const fileName = component.filePath.split('/').pop();
  doc += `**Module:** \`${component.moduleName}\`\n`;
  doc += `**File:** \`${fileName}\` (line ${component.line})\n`;

  return doc;
}

function findComponentUsageAtName(usageStack: ComponentUsage[], offset: number): ComponentUsage | null {
  for (let i = usageStack.length - 1; i >= 0; i--) {
    const usage = usageStack[i];
    const nameStart = usage.nameStart;
    const nameEnd = usage.nameEnd;
    if (offset >= nameStart && offset <= nameEnd) {
      return usage;
    }
    if (offset === nameStart - 1) {
      return usage;
    }
  }
  return null;
}

function findFallbackComponentLocation(currentFilePath: string, componentName: string): Location | null {
  const workspaceRoot = componentsRegistry.getWorkspaceRoot();
  if (!workspaceRoot) {
    return null;
  }

  const parts = currentFilePath.split(path.sep);
  const libIndex = parts.indexOf('lib');
  if (libIndex === -1 || libIndex + 1 >= parts.length) {
    return null;
  }

  const appWeb = parts[libIndex + 1];
  const componentsRoot = path.join(workspaceRoot, 'lib', appWeb, 'components');
  const candidates = new Set<string>();

  const visitStack: string[] = [componentsRoot];
  while (visitStack.length > 0) {
    const dir = visitStack.pop()!;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visitStack.push(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ex')) {
          candidates.add(path.normalize(fullPath));
        }
      }
    } catch {
      // ignore
    }
  }

  const singleFile = path.normalize(path.join(workspaceRoot, 'lib', appWeb, 'components.ex'));
  if (fs.existsSync(singleFile)) {
    candidates.add(singleFile);
  }

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const regex = new RegExp(`^\s*defp?\s+${componentName}\b`, 'm');
      const match = regex.exec(content);
      if (!match) {
        continue;
      }

      const preceding = content.slice(0, match.index);
      const line = preceding.split('\n').length - 1;
      const lines = content.split('\n');
      const lineText = lines[line] ?? '';
      const character = Math.max(0, lineText.indexOf(componentName));

      debugLog('definition', `Fallback found component <.${componentName}> in ${filePath}:${line + 1}`);

      return {
        uri: URI.file(filePath).toString(),
        range: {
          start: { line, character },
          end: { line, character: character + componentName.length },
        },
      };
    } catch {
      // ignore errors reading file
    }
  }

  return null;
}

// Provide completions
connection.onCompletion(
  async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const offset = document.offsetAt(textDocumentPosition.position);
    const uri = textDocumentPosition.textDocument.uri;
    const filePath = path.normalize(uri.replace('file://', ''));

    // Check if we're in an Elixir file
    const isElixirFile = uri.endsWith('.ex') || uri.endsWith('.exs');
    const insideSigil = isElixirFile ? isInsideHEExSigil(text, offset) : false;
    const insideTagContext = isInsideTagContext(text, offset);

    const linePrefix = text.substring(
      Math.max(0, offset - 100),
      offset
    );

    const completions: CompletionItem[] = [];

    if (isInsideJsPushEvent(linePrefix)) {
      const jsEventCompletions = getJsPushEventCompletions(filePath, eventsRegistry);
      if (jsEventCompletions.length > 0) {
        return jsEventCompletions;
      }
    }

    // Check for @ and assigns. contexts (works both inside and outside ~H sigils for .ex files)
    if (isElixirFile && (isAtSignContext(linePrefix) || isAssignsContext(linePrefix))) {
      const assignCompletions = getAssignCompletions(
        componentsRegistry,
        schemaRegistry,
        controllersRegistry,
        filePath,
        offset,
        text,
        linePrefix
      );
      return assignCompletions; // Early return - only show component attributes or nested properties
    }

    if (isElixirFile) {
      const handleInfoCompletions = getHandleInfoEventCompletions(
        linePrefix,
        textDocumentPosition.position,
        filePath,
        eventsRegistry
      );
      if (handleInfoCompletions && handleInfoCompletions.length > 0) {
        return handleInfoCompletions;
      }
    }

    const routeHelperCompletions = getRouteHelperCompletions(
      document,
      textDocumentPosition.position,
      linePrefix,
      routerRegistry
    );
    if (routeHelperCompletions && routeHelperCompletions.length > 0) {
      return routeHelperCompletions;
    }

    // For Elixir files, only provide other completions inside ~H sigils
    // This applies to: Phoenix attributes, HTML attributes, components, and Emmet
    if (isElixirFile && !insideSigil) {
      return []; // Early return prevents all other completions outside sigils
    }

    // Check if we're in a local component context (e.g., <.█)
    if (isLocalComponentContext(linePrefix)) {
      connection.console.log(`[Server] Component context detected! linePrefix: "${linePrefix.slice(-20)}"`);
      const componentCompletions = getLocalComponentCompletions(componentsRegistry, filePath);
      connection.console.log(`[Server] Returning ${componentCompletions.length} component completions`);
      completions.push(...componentCompletions);
      return completions; // Early return - only show component names
    }

    // Check if we're inside a component tag and need attribute completions
    const componentName = getComponentNameFromContext(linePrefix);
    if (componentName && insideTagContext) {
      const moduleContext = getModuleNameFromContext(linePrefix);
      const component = componentsRegistry.resolveComponent(filePath, componentName, {
        moduleContext: moduleContext || undefined,
        fileContent: isElixirFile ? text : undefined,
      });
      if (component) {
        const attrCompletions = getComponentAttributeCompletions(component);
        completions.push(...attrCompletions);
        // Also add special template attributes to components
        completions.push(...getSpecialAttributeCompletions(document, textDocumentPosition.position, linePrefix));
        // Continue to also add HTML/Phoenix attributes (no early return)
      }
    }

    const formFieldCompletions = getFormFieldCompletions(
      document,
      text,
      offset,
      linePrefix,
      schemaRegistry,
      componentsRegistry,
      filePath
    );
    if (formFieldCompletions && formFieldCompletions.length > 0) {
      return formFieldCompletions;
    }

    const routeCompletions = getVerifiedRouteCompletions(
      document,
      textDocumentPosition.position,
      linePrefix,
      routerRegistry
    );
    if (routeCompletions && routeCompletions.length > 0) {
      return routeCompletions;
    }

    // Check if we're in a slot context (<:slot_name)
    const slotContext = /<:([a-z_][a-z0-9_]*)?$/.exec(linePrefix);
    if (slotContext && insideTagContext) {
      const usageContext = findEnclosingComponentUsage(text, offset);
      if (usageContext) {
        const component = componentsRegistry.resolveComponent(filePath, usageContext.componentName, {
          moduleContext: usageContext.moduleContext,
          fileContent: isElixirFile ? text : undefined,
        });

        if (component && component.slots.length > 0) {
          const slotCompletions = getComponentSlotCompletions(component);
          completions.push(...slotCompletions);
          return completions;
        }
      }
    }

    // Check if we're in a pipe chain context (e.g., JS.show(...) |> █)
    if (isPipeChainContext(linePrefix)) {
      // Provide chainable JS command completions
      completions.push(...getChainableJSCompletions());
      return completions; // Early return - only show chainable commands
    }

    // Check if we're in a JS command context (e.g., phx-click={JS.█ or phx-click="JS.█)
    if (isJSCommandContext(linePrefix)) {
      // Provide JS command completions
      completions.push(...getJSCommandCompletions());
      return completions; // Early return - only show JS commands
    }

    // Check if cursor is inside a phx-* attribute value (e.g., phx-click="█")
    // This regex finds: phx-click="text_before_cursor█
    const insidePhxAttribute = /phx-(?:click|submit|change|blur|focus|key|keydown|keyup|window-keydown|window-keyup|capture-click|click-away)=["']([^"']*)$/.test(linePrefix);

    if (insidePhxAttribute) {
      // Check if already typing JS. - if so, provide JS completions
      if (/phx-[a-z-]+\s*=\s*["']\s*JS\./.test(linePrefix)) {
        completions.push(...getJSCommandCompletions());
        return completions;
      }

      // Provide event name suggestions from handle_event definitions
      const filePath = uri.replace('file://', '');
      const { primary } = eventsRegistry.getEventsForTemplate(filePath);

      // Add primary events (from same module) with higher priority
      primary.forEach((event, index) => {
        completions.push(createEventCompletionItem(event, '0', index));
      });

      // Early return - only show events for phx-* attribute string values
      return completions;
    }

    // Check if we're in an HTML tag context (for attribute name suggestions)
    const inTag = /<[a-zA-Z][a-zA-Z0-9]*\s+[^>]*$/.test(linePrefix);
    const inAttribute = /\s[a-zA-Z-_:]*$/.test(linePrefix);

    if (insideTagContext && (inTag || inAttribute)) {
      // Special template attributes (:for, :if, :let, :key)
      completions.push(...getSpecialAttributeCompletions(document, textDocumentPosition.position, linePrefix));

      // Phoenix attribute completions
      completions.push(...getPhoenixCompletions());

      // HTML attribute completions
      completions.push(...getHtmlCompletions());
    }

    // Emmet completions (for element names and shortcuts)
    // DISABLED: Emmet support temporarily removed due to dependency issues
    // const emmetCompletions = await getEmmetCompletions(
    //   document,
    //   textDocumentPosition.position,
    //   linePrefix
    // );
    // completions.push(...emmetCompletions);

    return completions;
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

// Hover provider for documentation
connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(textDocumentPosition.position);
  const uri = textDocumentPosition.textDocument.uri;
  const filePath = uri.replace('file://', '');

  // Check if we're in an Elixir file
  const isElixirFile = uri.endsWith('.ex') || uri.endsWith('.exs');

  // Get word at cursor position
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const charInLine = offset - lineStart;

  // Find word boundaries
  let wordStart = charInLine;
  let wordEnd = charInLine;

  while (wordStart > 0 && /[a-zA-Z0-9_-]/.test(line[wordStart - 1])) {
    wordStart--;
  }
  while (wordEnd < line.length && /[a-zA-Z0-9_-]/.test(line[wordEnd])) {
    wordEnd++;
  }

  const word = line.substring(wordStart, wordEnd);

  // Get context around cursor (needed for multiple checks)
  const contextBefore = text.substring(Math.max(0, offset - 50), offset);
  const contextAfter = text.substring(offset, Math.min(text.length, offset + 10));
  const templateFileContent = isElixirFile ? text : undefined;

  const usageStack = getComponentUsageStack(text, offset, filePath);

  const slotContext = detectSlotAtPosition(line, charInLine);
  if (slotContext && usageStack.length > 0) {
    const parentUsage = usageStack[usageStack.length - 1];
    const parentComponent = componentsRegistry.resolveComponent(filePath, parentUsage.componentName, {
      moduleContext: parentUsage.moduleContext,
      fileContent: templateFileContent,
    });

    if (parentComponent) {
      const slotMeta = parentComponent.slots.find(slot => slot.name === slotContext.slotName);
      const slotDoc = buildSlotHoverDocumentation(parentComponent, slotContext.slotName, slotMeta);
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: slotDoc,
        },
      };
    }
  }

  // Check if hovering over @attribute (e.g., @variant, @size)
  // This works both inside and outside ~H sigils
  if (isElixirFile && contextBefore.match(/@([a-z_][a-z0-9_]*)$/)) {
    const attrName = word;
    const attributes = componentsRegistry.getCurrentComponentAttributes(filePath, offset, text);

    if (attributes) {
      const attribute = attributes.find(attr => attr.name === attrName);
      if (attribute) {
        let doc = `**Attribute: \`@${attribute.name}\`**\n\n`;
        doc += `- **Type:** \`:${attribute.type}\`\n`;
        doc += `- **Required:** ${attribute.required ? 'Yes' : 'No'}\n`;

        if (attribute.default) {
          doc += `- **Default:** \`${attribute.default}\`\n`;
        }

        if (attribute.values && attribute.values.length > 0) {
          doc += `- **Values:** ${attribute.values.map(v => `\`:${v}\``).join(', ')}\n`;
        }

        if (attribute.doc) {
          doc += `\n${attribute.doc}\n`;
        }

        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: doc,
          },
        };
      }
    }
  }

  // Check if hovering over assigns.attribute (e.g., assigns.variant)
  if (isElixirFile && contextBefore.match(/assigns\.([a-z_][a-z0-9_]*)$/)) {
    const attrName = word;
    const attributes = componentsRegistry.getCurrentComponentAttributes(filePath, offset, text);

    if (attributes) {
      const attribute = attributes.find(attr => attr.name === attrName);
      if (attribute) {
        let doc = `**Attribute: \`assigns.${attribute.name}\`**\n\n`;
        doc += `- **Type:** \`:${attribute.type}\`\n`;
        doc += `- **Required:** ${attribute.required ? 'Yes' : 'No'}\n`;

        if (attribute.default) {
          doc += `- **Default:** \`${attribute.default}\`\n`;
        }

        if (attribute.values && attribute.values.length > 0) {
          doc += `- **Values:** ${attribute.values.map(v => `\`:${v}\``).join(', ')}\n`;
        }

        if (attribute.doc) {
          doc += `\n${attribute.doc}\n`;
        }

        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: doc,
          },
        };
      }
    }
  }

  // For Elixir files, only provide other hover inside ~H sigils
  if (isElixirFile && !isInsideHEExSigil(text, offset)) {
    return null;
  }

  const componentUsage = getComponentContextAtPosition(line, charInLine) || findComponentUsageAtName(usageStack, offset);
  const effectiveUsage = componentUsage || (usageStack.length > 0 ? usageStack[usageStack.length - 1] : null) || findEnclosingComponentUsage(text, offset);
  if (effectiveUsage) {
    const component = componentsRegistry.resolveComponent(filePath, effectiveUsage.componentName, {
      moduleContext: effectiveUsage.moduleContext,
      fileContent: templateFileContent,
    });
    if (component) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: buildComponentHoverDocumentation(component),
        },
      };
    }
  }

  // Check if hovering over a component attribute
  // Pattern: <.component_name attribute_name=
  const componentAttrPattern = getLastRegexMatch(contextBefore, /<\.([a-z_][a-z0-9_]*)\s+[^>]*\b([a-z_][a-z0-9_]*)\s*=/g);
  if (componentAttrPattern && word === componentAttrPattern[2]) {
    const componentName = componentAttrPattern[1];
    const attributeName = word;
    const component = componentsRegistry.resolveComponent(filePath, componentName, {
      fileContent: templateFileContent,
    });
    if (component) {
      const attrDoc = buildAttributeHoverDocumentation(component, attributeName);
      if (attrDoc) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: attrDoc,
          },
        };
      }
    }
  } else {
    const remoteComponentAttrPattern = getLastRegexMatch(contextBefore, /<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)*)\.([a-z_][a-z0-9_]*)\s+[^>]*\b([a-z_][a-z0-9_]*)\s*=/g);
    if (remoteComponentAttrPattern && word === remoteComponentAttrPattern[3]) {
      const moduleContext = remoteComponentAttrPattern[1];
      const componentName = remoteComponentAttrPattern[2];
      const attributeName = remoteComponentAttrPattern[3];
      const component = componentsRegistry.resolveComponent(filePath, componentName, {
        moduleContext,
        fileContent: templateFileContent,
      });
      if (component) {
        const attrDoc = buildAttributeHoverDocumentation(component, attributeName);
        if (attrDoc) {
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: attrDoc,
            },
          };
        }
      }
    }
  }

  // Phoenix attribute documentation
  const phoenixAttrDocs: { [key: string]: string } = {
    'phx-click': '**Trigger an event on click**\n\nBinds a click event to send a message to the LiveView server.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#click-events)',
    'phx-submit': '**Trigger an event on form submit**\n\nBinds a submit event for forms. Automatically prevents default form submission.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#form-events)',
    'phx-change': '**Trigger an event on form input change**\n\nBinds a change event for form inputs. Useful for live validation.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#form-events)',
    'phx-blur': '**Trigger event when element loses focus**\n\nBinds a blur event.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#focus-events)',
    'phx-focus': '**Trigger event when element gains focus**\n\nBinds a focus event.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#focus-events)',
    'phx-target': '**Specify the event target**\n\nSpecifies which LiveView component should handle the event. Use `@myself` to target current component.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#targeting)',
    'phx-debounce': '**Debounce event frequency**\n\nDebounces events to reduce frequency (in milliseconds). Waits for typing to stop.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#rate-limiting)',
    'phx-throttle': '**Throttle event frequency**\n\nThrottles how often events are sent (in milliseconds). Limits max frequency.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#rate-limiting)',
    'phx-update': '**Control how content is updated**\n\nControls DOM update strategy: `replace`, `append`, `prepend`, `ignore`, `stream`.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/bindings.html#dom-patching)',
    'phx-hook': '**Attach a client-side hook**\n\nAttaches a JavaScript hook for client-side interactivity.\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/js-interop.html#client-hooks)',
    'phx-value-': '**Send custom value with event**\n\nAdds a custom value parameter to the event payload. Use `phx-value-keyname="value"`.',
  };

  // Check if hovering over a phx- attribute
  if (word.startsWith('phx-') || word === 'phx') {
    const attrKey = word.startsWith('phx-value-') ? 'phx-value-' : word;
    const doc = phoenixAttrDocs[attrKey];
    if (doc) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: doc,
        },
      };
    }
  }

  // Check if hovering over an event name in a phx attribute value
  // Check if we're inside a phx-* attribute value
  const insidePhxValue = /phx-(?:click|submit|change|blur|focus|key|keydown|keyup|window-keydown|window-keyup)=["']([^"']*)$/.test(contextBefore);

  if (insidePhxValue && word && !word.startsWith('phx-') && !word.startsWith('JS.')) {
    // Try to find this event in the registry
    const filePath = path.normalize(uri.replace('file://', ''));
    const { primary, secondary } = eventsRegistry.getEventsForTemplate(filePath);
    const allEvents = [...primary, ...secondary];

    const event = allEvents.find(e => e.name === word);
    if (event) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: buildEventMarkdown(event),
        },
      };
    }
  }

  // Check if hovering over JS command
  if (word.startsWith('JS.') || (contextBefore.includes('JS.') && word.match(/^[a-z_]+$/))) {
    const jsCommand = word.startsWith('JS.') ? word : `JS.${word}`;
    const jsCommandDocs: { [key: string]: string } = {
      'JS.show': '**Show element(s) with optional transitions**\n\n```elixir\nJS.show("#modal", transition: "fade-in", time: 300)\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#show/2)',
      'JS.hide': '**Hide element(s) with optional transitions**\n\n```elixir\nJS.hide("#modal", transition: "fade-out", time: 300)\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#hide/2)',
      'JS.toggle': '**Toggle element visibility**\n\n```elixir\nJS.toggle("#dropdown", in: "fade-in", out: "fade-out")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#toggle/2)',
      'JS.add_class': '**Add CSS class(es) to element(s)**\n\n```elixir\nJS.add_class("#button", "active")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#add_class/3)',
      'JS.remove_class': '**Remove CSS class(es) from element(s)**\n\n```elixir\nJS.remove_class("#button", "active")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#remove_class/3)',
      'JS.toggle_class': '**Toggle CSS class(es) on element(s)**\n\n```elixir\nJS.toggle_class("#menu", "open")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#toggle_class/3)',
      'JS.push': '**Push event to server**\n\n```elixir\nJS.push("save", value: %{id: 1})\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#push/2)',
      'JS.navigate': '**Navigate to URL (full page load)**\n\n```elixir\nJS.navigate("/users")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#navigate/2)',
      'JS.patch': '**Patch LiveView (no page reload)**\n\n```elixir\nJS.patch("/users?page=2")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#patch/2)',
      'JS.focus': '**Focus element**\n\n```elixir\nJS.focus("#search-input")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#focus/2)',
      'JS.dispatch': '**Dispatch custom DOM event**\n\n```elixir\nJS.dispatch("click", to: "#button")\n```\n\n[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html#dispatch/3)',
    };

    const doc = jsCommandDocs[jsCommand];
    if (doc) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: doc,
        },
      };
    }
  }

  return null;
});

let definitionRequestId = 0;

connection.onDefinition((params): Definition | null => {
  const requestId = ++definitionRequestId;
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    debugLog('definition', `[#${requestId}] Definition aborted: document not found`);
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const uri = params.textDocument.uri;
  const filePath = path.normalize(uri.replace('file://', ''));
  const isElixirFile = uri.endsWith('.ex') || uri.endsWith('.exs');

  debugLog(
    'definition',
    `[#${requestId}] Definition start: file=${filePath} pos=${params.position.line + 1}:${params.position.character + 1}`
  );

  if (isElixirFile && !isInsideHEExSigil(text, offset)) {
    return null;
  }

  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const charInLine = offset - lineStart;
  const usageStack = getComponentUsageStack(text, offset, filePath);

  const slotContext = detectSlotAtPosition(line, charInLine);
  if (slotContext && usageStack.length > 0) {
    const parentUsage = usageStack[usageStack.length - 1];
    const parentComponent = componentsRegistry.resolveComponent(filePath, parentUsage.componentName, {
      moduleContext: parentUsage.moduleContext,
      fileContent: isElixirFile ? text : undefined,
    });
    if (parentComponent) {
      const slotLocation = createSlotLocation(parentComponent, slotContext.slotName) || createComponentLocation(parentComponent);
      if (slotLocation) {
        debugLog(
          'definition',
          `[#${requestId}] Slot <:${slotContext.slotName}> resolved to ${slotLocation.uri}:${slotLocation.range.start.line + 1}`
        );
        debugLog('definition', `[#${requestId}] Definition returning slot location`);
        return [slotLocation];
      }
      debugLog(
        'definition',
        `Slot <:${slotContext.slotName}> missing explicit declaration; falling back to component ${parentComponent.moduleName}`
      );
    }
  }

  const componentUsage = getComponentContextAtPosition(line, charInLine) || findComponentUsageAtName(usageStack, offset) || findEnclosingComponentUsage(text, offset);
  if (!componentUsage) {
    debugLog('definition', `[#${requestId}] No component usage found for request in ${filePath}`);
    debugLog('definition', `[#${requestId}] Definition returning null (no usage)`);
    return null;
  }

  const cacheKey = `${filePath}:${componentUsage.componentName}`;
  const cached = getCachedDefinition(cacheKey);
  if (cached) {
    debugLog('definition', `[#${requestId}] Using cached definition for <.${componentUsage.componentName}> -> ${cached.uri}:${cached.range.start.line + 1}`);
    return [cached];
  }

  const component = componentsRegistry.resolveComponent(filePath, componentUsage.componentName, {
    moduleContext: componentUsage.moduleContext,
    fileContent: isElixirFile ? text : undefined,
  });

  if (!component) {
    const totalComponents = componentsRegistry.getAllComponents().length;
    const allComponentNames = componentsRegistry.getAllComponents().map(c => c.name).join(', ');
    debugLog(
      'definition',
      `[#${requestId}] Unable to resolve component <.${componentUsage.componentName}> (module context: ${componentUsage.moduleContext ?? 'n/a'}) from ${filePath}`
    );
    debugLog(
      'definition',
      `[#${requestId}] Registry contains ${totalComponents} total components: ${totalComponents > 0 ? allComponentNames : '<empty>'}`
    );
    const fallback = findFallbackComponentLocation(filePath, componentUsage.componentName);
    if (fallback) {
      debugLog('definition', `[#${requestId}] Fallback resolved <.${componentUsage.componentName}> to ${fallback.uri}:${fallback.range.start.line + 1}`);
      cacheDefinition(cacheKey, fallback);
      return [fallback];
    }
    debugLog('definition', `[#${requestId}] Definition returning null (component unresolved)`);
    return null;
  }

  const location = createComponentLocation(component);
  if (location) {
    debugLog(
      'definition',
      `[#${requestId}] Component <.${component.name}> resolved to ${location.uri}:${location.range.start.line + 1}`
    );
    debugLog('definition', `[#${requestId}] Definition returning component location`);
    cacheDefinition(cacheKey, location);
  } else {
    debugLog(
      'definition',
      `[#${requestId}] Component <.${component.name}> resolved but location could not be derived (module ${component.moduleName})`
    );
    const fallback = findFallbackComponentLocation(filePath, componentUsage.componentName);
    if (fallback) {
      debugLog('definition', `[#${requestId}] Fallback resolved <.${componentUsage.componentName}> to ${fallback.uri}:${fallback.range.start.line + 1}`);
      cacheDefinition(cacheKey, fallback);
      return [fallback];
    }
    debugLog('definition', `[#${requestId}] Definition returning null (no location)`);
  }
  return location ? [location] : null;
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
