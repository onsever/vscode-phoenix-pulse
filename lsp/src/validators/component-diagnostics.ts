import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ComponentsRegistry, PhoenixComponent } from '../components-registry';
import {
  collectComponentUsages,
  shouldIgnoreUnknownAttribute,
  createRange,
  isSlotProvided,
} from '../utils/component-usage';

/**
 * Validate component usage and imports in templates
 *
 * This validator checks:
 * 1. Whether components used in templates are imported in the HTML module
 * 2. Components from CoreComponents are auto-imported (no error)
 * 3. Components from other modules require explicit import
 */
export function validateComponentUsage(
  document: TextDocument,
  componentsRegistry: ComponentsRegistry,
  templatePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();
  const componentUsages = collectComponentUsages(text, templatePath);

  if (componentUsages.length === 0) {
    return diagnostics;
  }

  const htmlModuleFile = componentsRegistry.getHtmlModuleForTemplate(templatePath);
  const imports = htmlModuleFile ? componentsRegistry.parseImports(htmlModuleFile) : null;
  const componentCache = new Map<string, PhoenixComponent>();

  componentUsages.forEach((usage) => {
    const cacheKey = usage.moduleContext
      ? `${usage.moduleContext}::${usage.componentName}`
      : usage.componentName;

    let component = componentCache.get(cacheKey);
    if (!component) {
      component = componentsRegistry.resolveComponent(templatePath, usage.componentName, {
        moduleContext: usage.moduleContext,
        fileContent: text,
      });
      if (component) {
        componentCache.set(cacheKey, component);
      }
    }

    if (!component) {
      return;
    }

    if (usage.isLocal && imports) {
      const isImported = isComponentAvailable(
        component.moduleName,
        imports.importedModules,
        imports.aliasedModules
      );

      if (!isImported) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: createRange(document, usage.openTagStart, usage.nameEnd),
          message: `Component "${usage.componentName}" from "${component.moduleName}" is not imported. Add: import ${component.moduleName}`,
          source: 'phoenix-lsp',
          code: 'component-not-imported',
        });
      }
    }

    const attributeNames = new Set(usage.attributes.map(attr => attr.name));
    const componentDisplay = usage.moduleContext
      ? `${usage.moduleContext}.${usage.componentName}`
      : usage.componentName;
    const componentRange = createRange(document, usage.nameStart, usage.nameEnd);

    component.attributes
      .filter(attr => attr.required)
      .forEach(attr => {
        if (!attributeNames.has(attr.name)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: componentRange,
            message: `Component "${componentDisplay}" is missing required attribute "${attr.name}".`,
            source: 'phoenix-lsp',
            code: 'component-missing-attribute',
          });
        }
      });

    const allowsGlobalAttributes = component.attributes.some(attr => attr.type === 'global');
    if (!allowsGlobalAttributes) {
      usage.attributes.forEach(attrUsage => {
        const attrName = attrUsage.name;

        if (component.attributes.some(attr => attr.name === attrName)) {
          return;
        }
        if (shouldIgnoreUnknownAttribute(attrName)) {
          return;
        }

        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: createRange(document, attrUsage.start, attrUsage.end),
          message: `Unknown attribute "${attrName}" for component "${componentDisplay}".`,
          source: 'phoenix-lsp',
          code: 'component-unknown-attribute',
        });
      });
    }

    // Validate attribute values against allowed values
    usage.attributes.forEach(attrUsage => {
      const attrName = attrUsage.name;
      const componentAttr = component.attributes.find(attr => attr.name === attrName);

      if (!componentAttr || !componentAttr.values || componentAttr.values.length === 0) {
        return; // No validation needed if no values constraint
      }

      if (!attrUsage.valueText) {
        return; // Can't validate dynamic expressions
      }

      // Extract string literal value (remove quotes and handle atoms)
      const value = extractStringLiteral(attrUsage.valueText);
      if (!value) {
        return; // Not a string literal, skip validation
      }

      if (!componentAttr.values.includes(value)) {
        const allowedValues = componentAttr.values.map(v => `"${v}"`).join(', ');
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: createRange(document, attrUsage.valueStart || attrUsage.start, attrUsage.valueEnd || attrUsage.end),
          message: `Invalid value "${value}" for attribute "${attrName}". Expected one of: ${allowedValues}.`,
          source: 'phoenix-lsp',
          code: 'component-invalid-attribute-value',
        });
      }
    });

    component.slots
      .filter(slot => slot.required)
      .forEach(slot => {
        if (isSlotProvided(slot.name, usage, text)) {
          return;
        }

        const slotLabel = slot.name === 'inner_block' ? 'inner content' : `slot ":${slot.name}"`;
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: componentRange,
          message: `Component "${componentDisplay}" is missing required ${slotLabel}.`,
          source: 'phoenix-lsp',
          code: 'component-missing-slot',
        });
      });

    const knownSlots = new Set(component.slots.map(slot => slot.name));
    usage.slots.forEach(slotUsage => {
      if (slotUsage.name === 'inner_block') {
        return;
      }
      if (knownSlots.has(slotUsage.name)) {
        return;
      }

      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: createRange(document, slotUsage.start, slotUsage.end),
        message: `Component "${componentDisplay}" does not declare slot ":${slotUsage.name}".`,
        source: 'phoenix-lsp',
        code: 'component-unknown-slot',
      });
    });
  });

  return diagnostics;
}

/**
 * Check if a component module is available in the current context
 *
 * A component is available if:
 * - It's from CoreComponents (auto-imported via `use AppWeb, :html`)
 * - It's explicitly imported
 * - It's aliased
 */
function isComponentAvailable(
  moduleName: string,
  importedModules: string[],
  aliasedModules: Map<string, string>
): boolean {
  // CoreComponents are auto-imported in Phoenix apps
  if (moduleName.includes('CoreComponents')) {
    return true;
  }

  if (moduleName === 'Phoenix.Component' || moduleName.startsWith('Phoenix.Component.')) {
    return true;
  }

  // Check explicit imports
  if (importedModules.includes(moduleName)) {
    return true;
  }

  // Check aliases
  const aliasedModulesList = Array.from(aliasedModules.values());
  if (aliasedModulesList.includes(moduleName)) {
    return true;
  }

  return false;
}

/**
 * Extract string literal value from attribute value text
 * Handles both quoted strings ("value", 'value') and atom literals (:value)
 *
 * @param text Raw attribute value text
 * @returns Extracted value or null if not a literal
 */
function extractStringLiteral(text: string): string | null {
  const trimmed = text.trim();

  // Match quoted strings: "value" or 'value'
  const quotedMatch = trimmed.match(/^["'](.*)["']$/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Match atom literals: :value
  const atomMatch = trimmed.match(/^:(\w+)$/);
  if (atomMatch) {
    return atomMatch[1];
  }

  return null;
}
