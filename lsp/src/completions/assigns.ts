import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';
import {
  ComponentsRegistry,
  ComponentAttribute,
  getAttributeTypeDisplay
} from '../components-registry';
import { SchemaRegistry } from '../schema-registry';
import { ControllersRegistry } from '../controllers-registry';

/**
 * Check if cursor is in an @ context (e.g., @█ or @var█ or @user.profile.█)
 * Must exclude module attributes like @doc, @moduledoc, @type, etc.
 * Supports nested property access like @user.profile.address
 */
export function isAtSignContext(linePrefix: string): boolean {
  // Match @ followed by optional property chain (e.g., @user.profile.name)
  // Pattern: @ + identifier + optional (.identifier)* + optional trailing dot
  const atSignPattern = /@([a-z_][a-z0-9_]*)?(?:\.([a-z_][a-z0-9_.]*))?\.?\s*$/;
  const match = atSignPattern.exec(linePrefix);

  if (!match) {
    return false;
  }

  const word = match[1] || '';

  // Exclude known module attributes
  const moduleAttributes = [
    'doc', 'moduledoc', 'type', 'spec', 'callback', 'impl',
    'behaviour', 'typedoc', 'dialyzer', 'deprecated', 'since',
    'vsn', 'on_load', 'on_definition', 'before_compile', 'after_compile',
    'external_resource', 'file', 'compile', 'derive'
  ];

  if (!word) {
    return true; // Allow completion immediately after typing @
  }

  return !moduleAttributes.includes(word);
}

/**
 * Check if cursor is in an assigns. context (e.g., assigns.█ or assigns.user.profile.█)
 * Supports nested property access like assigns.user.profile.address
 */
export function isAssignsContext(linePrefix: string): boolean {
  // Match assigns. followed by optional property chain
  // Pattern: assigns. + identifier + optional (.identifier)* + optional trailing dot
  return /assigns\.([a-z_][a-z0-9_.]*)?\.?\s*$/.test(linePrefix);
}

/**
 * Extract the property path from @ or assigns. context
 * Examples:
 *   "@user" -> { base: "user", path: [] }
 *   "@user.profile" -> { base: "user", path: ["profile"] }
 *   "@user.profile.address." -> { base: "user", path: ["profile", "address"] }
 *   "assigns.user.profile" -> { base: "user", path: ["profile"] }
 */
export function extractPropertyPath(linePrefix: string): { base: string; path: string[] } | null {
  // Try @ pattern first
  const atPattern = /@([a-z_][a-z0-9_]*)?(?:\.([a-z_][a-z0-9_.]*))?\.?\s*$/;
  const atMatch = atPattern.exec(linePrefix);

  if (atMatch) {
    const base = atMatch[1] || '';
    const rest = atMatch[2] || '';
    const path = rest ? rest.split('.').filter(p => p.length > 0) : [];
    return { base, path };
  }

  // Try assigns. pattern
  const assignsPattern = /assigns\.([a-z_][a-z0-9_.]*)?\.?\s*$/;
  const assignsMatch = assignsPattern.exec(linePrefix);

  if (assignsMatch) {
    const rest = assignsMatch[1] || '';
    if (!rest) {
      return { base: '', path: [] };
    }
    const parts = rest.split('.').filter(p => p.length > 0);
    const base = parts[0] || '';
    const path = parts.slice(1);
    return { base, path };
  }

  return null;
}

/**
 * Get assign completions for @ and assigns. contexts
 * Supports nested property access using schema registry
 *
 * @param componentsRegistry - The components registry
 * @param schemaRegistry - The schema registry
 * @param filePath - Path to current file
 * @param offset - Character offset in the file
 * @param text - Full document text
 * @param linePrefix - Text before cursor on current line
 * @returns Array of completion items for component attributes or schema fields
 */
export function getAssignCompletions(
  componentsRegistry: ComponentsRegistry,
  schemaRegistry: SchemaRegistry,
  controllersRegistry: ControllersRegistry,
  filePath: string,
  offset: number,
  text: string,
  linePrefix: string
): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Extract the property path from the linePrefix
  const propertyPath = extractPropertyPath(linePrefix);

  if (!propertyPath) {
    console.log('[Assigns] No property path extracted from:', linePrefix);
    return completions;
  }

  const { base, path } = propertyPath;

  // Check if user is requesting nested completions (has trailing dot)
  const trimmedPrefix = linePrefix.trimEnd();
  const requestingNested = trimmedPrefix.endsWith('.') && (base.length > 0 || path.length > 0);

  console.log('[Assigns] Property path:', { base, path, requestingNested, linePrefix: linePrefix.slice(-50) });

  // Get attributes for the current component scope
  const component = componentsRegistry.getCurrentComponent(filePath, offset, text);

  if (component) {
    const attributes = component.attributes;
    const slots = component.slots;

    console.log('[Assigns] Found', attributes.length, 'component attributes:', attributes.map(a => `${a.name}:${a.type}`).join(', '));
    console.log('[Assigns] Found', slots.length, 'component slots:', slots.map(s => s.name).join(', '));

    if (path.length === 0 && !requestingNested) {
      attributes.forEach((attr, index) => {
        const typeDisplay = getAttributeTypeDisplay(attr);
        const item: CompletionItem = {
          label: attr.name,
          kind: CompletionItemKind.Property,
          detail: `${typeDisplay}${attr.required ? ' (required)' : ''}${attr.default ? ` = ${attr.default}` : ''}`,
          documentation: buildAttributeDocumentation(attr),
          insertText: attr.name,
          sortText: `0${index.toString().padStart(3, '0')}`,
        };
        completions.push(item);
      });

      slots.forEach((slot, index) => {
        const item: CompletionItem = {
          label: slot.name,
          kind: CompletionItemKind.Interface,
          detail: `Slot${slot.required ? ' (required)' : ''}`,
          documentation: slot.doc
            ? `${slot.doc}\n\nUse with \`render_slot(@${slot.name})\` or \`<:${slot.name}>\`.`
            : `Slot for component <.${component.name}>. Use with \`render_slot(@${slot.name})\` or \`<:${slot.name}>\`.`,
          insertText: slot.name,
          sortText: `2${index.toString().padStart(3, '0')}`,
        };
        completions.push(item);
      });

      return completions;
    }

    const baseAttr = attributes.find(attr => attr.name === base);

    if (!baseAttr) {
      return completions;
    }

    let baseTypeName: string | null = null;

    console.log('[Assigns] Base attribute found:', baseAttr.name, 'type:', baseAttr.type);

    if (baseAttr.type.match(/^[A-Z]/)) {
      baseTypeName = schemaRegistry.resolveTypeName(baseAttr.type);
      console.log('[Assigns] Resolved type from attr.type:', baseAttr.type, '->', baseTypeName);
    }

    if (!baseTypeName) {
      const guessedType = base.split('_').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join('');
      baseTypeName = schemaRegistry.resolveTypeName(guessedType);
      console.log('[Assigns] Resolved type from attribute name:', guessedType, '->', baseTypeName);
    }

    if (!baseTypeName) {
      console.log('[Assigns] Could not resolve type for base attribute:', base);
      console.log('[Assigns] Available schemas:', schemaRegistry.getAllSchemas().map(s => s.moduleName).join(', '));
      return completions;
    }

    const fields = schemaRegistry.getFieldsForPath(baseTypeName, path);
    console.log('[Assigns] Found', fields.length, 'fields for path:', path, 'in schema:', baseTypeName);

    fields.forEach((field, index) => {
      const item: CompletionItem = {
        label: field.name,
        kind: field.elixirType ? CompletionItemKind.Reference : CompletionItemKind.Field,
        detail: field.elixirType || `:${field.type}`,
        documentation: field.elixirType
          ? `Association: ${field.elixirType}`
          : `Field type: :${field.type}`,
        insertText: field.name,
        sortText: `0${index.toString().padStart(3, '0')}`,
      };
      completions.push(item);
    });

    return completions;
  }

  const templateSummary = controllersRegistry.getTemplateSummary(filePath);
  if (!templateSummary) {
    return completions;
  }

  const assignNames = Array.from(templateSummary.assignSources.keys()).sort();
  if (assignNames.length === 0) {
    return completions;
  }

  if (path.length === 0 && !requestingNested) {
    assignNames.forEach((assignName, index) => {
      const sources = templateSummary.assignSources.get(assignName) || [];
      const sourceDocs = sources
        .map(source => {
          if (source.action) {
            return `${source.controllerModule}.${source.action}`;
          }
          return source.controllerModule;
        })
        .filter((value, idx, arr) => arr.indexOf(value) === idx)
        .join('\n');

      const item: CompletionItem = {
        label: assignName,
        kind: CompletionItemKind.Property,
        detail: 'Controller assign',
        documentation: sourceDocs
          ? `Assigned in:\n${sourceDocs}`
          : 'Assigned via controller render call.',
        insertText: assignName,
        sortText: `0${index.toString().padStart(3, '0')}`,
      };
      completions.push(item);
    });

    return completions;
  }

  if (!base || !assignNames.includes(base)) {
    return completions;
  }

  const schemaModule = resolveSchemaFromAssignName(schemaRegistry, base);
  if (!schemaModule) {
    return completions;
  }

  let fields = [];
  if (path.length === 0) {
    const schema = schemaRegistry.getSchema(schemaModule);
    fields = schema ? schema.fields : [];
  } else {
    fields = schemaRegistry.getFieldsForPath(schemaModule, path);
  }

  fields.forEach((field, index) => {
    const item: CompletionItem = {
      label: field.name,
      kind: field.elixirType ? CompletionItemKind.Reference : CompletionItemKind.Field,
      detail: field.elixirType || `:${field.type}`,
      documentation: field.elixirType
        ? `Association: ${field.elixirType}`
        : `Field type: :${field.type}`,
      insertText: field.name,
      sortText: `0${index.toString().padStart(3, '0')}`,
    };
    completions.push(item);
  });

  return completions;
}

/**
 * Build markdown documentation for an attribute
 */
function buildAttributeDocumentation(attr: ComponentAttribute): string {
  let doc = `**Attribute: \`${attr.name}\`**\n\n`;

  const typeDisplay = getAttributeTypeDisplay(attr);
  doc += `- **Type:** \`${typeDisplay}\`\n`;
  doc += `- **Required:** ${attr.required ? 'Yes' : 'No'}\n`;

  if (attr.default) {
    doc += `- **Default:** \`${attr.default}\`\n`;
  }

  if (attr.values && attr.values.length > 0) {
    doc += `- **Values:** ${attr.values.map(v => `\`:${v}\``).join(', ')}\n`;
  }

  if (attr.doc) {
    doc += `\n${attr.doc}\n`;
  }

  return doc;
}

function resolveSchemaFromAssignName(schemaRegistry: SchemaRegistry, assignName: string): string | null {
  if (!assignName) {
    return null;
  }

  const candidates = new Set<string>();
  candidates.add(toCamel(assignName));

  if (assignName.endsWith('s')) {
    const singular = assignName.slice(0, -1);
    if (singular.length > 0) {
      candidates.add(toCamel(singular));
    }
  }

  for (const candidate of candidates) {
    const resolved = schemaRegistry.resolveTypeName(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function toCamel(value: string): string {
  return value
    .split('_')
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
