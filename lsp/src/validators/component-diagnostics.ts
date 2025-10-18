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
 * Validate that component attributes are correctly used
 *
 * Future enhancement: Check for:
 * - Required attributes present
 * - Unknown attributes
 * - Attribute value types
 */
export function validateComponentAttributes(
  document: TextDocument,
  componentsRegistry: ComponentsRegistry
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // TODO: Implement in future
  // This could check:
  // - <.button variant="primary"> - variant is required? Check it's present
  // - <.button invalid_attr=""> - unknown attribute warning
  // - <.button variant={123}> - type mismatch (expects string)
  return diagnostics;
}
