import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

interface SchemaInfo {
  name: string;
  filePath: string;
  location: { line: number; character: number };
  fieldsCount: number;
  fields: Array<{ name: string; type: string; elixirType?: string }>;
}

interface ComponentInfo {
  name: string;
  filePath: string;
  location: { line: number; character: number };
  attributesCount: number;
}

interface RouteInfo {
  verb: string;
  path: string;
  controller: string;
  action: string;
  filePath: string;
  location: { line: number; character: number };
}

interface TemplateInfo {
  name: string;
  format: string;
  filePath: string;
  location: { line: number; character: number };
  module: string;
}

interface EventInfo {
  name: string;
  type: string;
  filePath: string;
  location: { line: number; character: number };
}

export class PhoenixPulseTreeProvider implements vscode.TreeDataProvider<PhoenixTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PhoenixTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Cache data for hierarchical display
  private schemasCache: SchemaInfo[] = [];
  private componentsCache: ComponentInfo[] = [];
  private templatesCache: TemplateInfo[] = [];
  private eventsCache: EventInfo[] = [];

  constructor(private client: LanguageClient) {}

  refresh(): void {
    // Clear caches on refresh
    this.schemasCache = [];
    this.componentsCache = [];
    this.templatesCache = [];
    this.eventsCache = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: PhoenixTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PhoenixTreeItem): Promise<PhoenixTreeItem[]> {
    if (!this.client) {
      return [];
    }

    try {
      if (!element) {
        // Root level - show categories
        return [
          new PhoenixTreeItem(
            'Schemas',
            'category-schemas',
            vscode.TreeItemCollapsibleState.Collapsed,
            '$(database)'
          ),
          new PhoenixTreeItem(
            'Components',
            'category-components',
            vscode.TreeItemCollapsibleState.Collapsed,
            '$(symbol-class)'
          ),
          new PhoenixTreeItem(
            'Routes',
            'category-routes',
            vscode.TreeItemCollapsibleState.Collapsed,
            '$(link)'
          ),
          new PhoenixTreeItem(
            'Templates',
            'category-templates',
            vscode.TreeItemCollapsibleState.Collapsed,
            '$(file-code)'
          ),
          new PhoenixTreeItem(
            'Events',
            'category-events',
            vscode.TreeItemCollapsibleState.Collapsed,
            '$(zap)'
          ),
        ];
      }

      // Get data based on category or file
      switch (element.contextValue) {
        case 'category-schemas':
          return this.getSchemas();
        case 'schema-expandable':
          return this.getSchemaFields(element.data);
        case 'category-components':
          return this.getComponentFiles();
        case 'component-file':
          return this.getComponentsInFile(element.data);
        case 'category-routes':
          return this.getRoutes();
        case 'category-templates':
          return this.getTemplateFiles();
        case 'template-file':
          return this.getTemplatesInFile(element.data);
        case 'category-events':
          return this.getEventFiles();
        case 'event-file':
          return this.getEventsInFile(element.data);
        default:
          return [];
      }
    } catch (error) {
      console.error('[PhoenixPulse] Error getting tree children:', error);
      return [];
    }
  }

  private async getSchemas(): Promise<PhoenixTreeItem[]> {
    try {
      const schemas: SchemaInfo[] = await this.client.sendRequest('phoenix/listSchemas', {});
      this.schemasCache = schemas;

      return schemas.map(schema => {
        const item = new PhoenixTreeItem(
          schema.name,
          'schema-expandable',
          vscode.TreeItemCollapsibleState.Collapsed,
          '$(database)'
        );
        item.description = `${schema.fieldsCount} fields`;
        item.tooltip = `${schema.name} schema\n${schema.fieldsCount} fields\n${schema.filePath}`;
        item.data = schema.name; // Store schema name for field lookup
        return item;
      });
    } catch (error) {
      console.error('[PhoenixPulse] Error fetching schemas:', error);
      return [];
    }
  }

  private getSchemaFields(schemaName: string): PhoenixTreeItem[] {
    const schema = this.schemasCache.find(s => s.name === schemaName);
    if (!schema) {
      return [];
    }

    return schema.fields.map(field => {
      const label = `${field.name}: ${field.type}`;
      const item = new PhoenixTreeItem(
        label,
        'schema-field',
        vscode.TreeItemCollapsibleState.None,
        '$(symbol-field)'
      );
      item.description = field.elixirType || '';
      item.tooltip = `${field.name}\nType: ${field.type}${field.elixirType ? `\nElixir Type: ${field.elixirType}` : ''}`;
      item.command = {
        command: 'phoenixPulse.goToItem',
        title: 'Go to Schema',
        arguments: [schema.filePath, schema.location]
      };
      return item;
    });
  }

  private async getComponentFiles(): Promise<PhoenixTreeItem[]> {
    try {
      const components: ComponentInfo[] = await this.client.sendRequest('phoenix/listComponents', {});
      this.componentsCache = components;

      // Group components by file
      const fileMap = new Map<string, ComponentInfo[]>();
      for (const component of components) {
        const fileName = component.filePath.split('/').pop() || component.filePath;
        if (!fileMap.has(fileName)) {
          fileMap.set(fileName, []);
        }
        fileMap.get(fileName)!.push(component);
      }

      // Create file nodes
      return Array.from(fileMap.entries()).map(([fileName, fileComponents]) => {
        const item = new PhoenixTreeItem(
          fileName,
          'component-file',
          vscode.TreeItemCollapsibleState.Collapsed,
          '$(file-code)'
        );
        item.description = `${fileComponents.length} components`;
        item.tooltip = `${fileName}\n${fileComponents.length} components\n${fileComponents[0].filePath}`;
        item.data = fileName; // Store filename for later lookup
        return item;
      });
    } catch (error) {
      console.error('[PhoenixPulse] Error fetching components:', error);
      return [];
    }
  }

  private getComponentsInFile(fileName: string): PhoenixTreeItem[] {
    const components = this.componentsCache.filter(c =>
      c.filePath.split('/').pop() === fileName
    );

    return components.map(component => {
      const item = new PhoenixTreeItem(
        component.name,
        'component',
        vscode.TreeItemCollapsibleState.None,
        '$(symbol-class)'
      );
      item.description = `${component.attributesCount} attrs`;
      item.tooltip = `${component.name} component\n${component.attributesCount} attributes\n${component.filePath}`;
      item.command = {
        command: 'phoenixPulse.goToItem',
        title: 'Go to Component',
        arguments: [component.filePath, component.location]
      };
      return item;
    });
  }

  private async getRoutes(): Promise<PhoenixTreeItem[]> {
    try {
      const routes: RouteInfo[] = await this.client.sendRequest('phoenix/listRoutes', {});

      return routes.map(route => {
        const label = `${route.verb} ${route.path}`;
        const item = new PhoenixTreeItem(
          label,
          'route',
          vscode.TreeItemCollapsibleState.None,
          this.getRouteIcon(route.verb)
        );
        item.description = `→ ${route.controller}.${route.action}`;
        item.tooltip = `${route.verb} ${route.path}\n→ ${route.controller}.${route.action}\n${route.filePath}`;
        item.command = {
          command: 'phoenixPulse.goToItem',
          title: 'Go to Route',
          arguments: [route.filePath, route.location]
        };
        return item;
      });
    } catch (error) {
      console.error('[PhoenixPulse] Error fetching routes:', error);
      return [];
    }
  }

  private async getTemplateFiles(): Promise<PhoenixTreeItem[]> {
    try {
      const templates: TemplateInfo[] = await this.client.sendRequest('phoenix/listTemplates', {});
      this.templatesCache = templates;

      // Group templates by file
      const fileMap = new Map<string, TemplateInfo[]>();
      for (const template of templates) {
        const fileName = template.filePath.split('/').pop() || template.filePath;
        if (!fileMap.has(fileName)) {
          fileMap.set(fileName, []);
        }
        fileMap.get(fileName)!.push(template);
      }

      // Create file nodes
      return Array.from(fileMap.entries()).map(([fileName, fileTemplates]) => {
        const item = new PhoenixTreeItem(
          fileName,
          'template-file',
          vscode.TreeItemCollapsibleState.Collapsed,
          '$(file-code)'
        );
        item.description = `${fileTemplates.length} templates`;
        item.tooltip = `${fileName}\n${fileTemplates.length} templates\n${fileTemplates[0].filePath}`;
        item.data = fileName;
        return item;
      });
    } catch (error) {
      console.error('[PhoenixPulse] Error fetching templates:', error);
      return [];
    }
  }

  private getTemplatesInFile(fileName: string): PhoenixTreeItem[] {
    const templates = this.templatesCache.filter(t =>
      t.filePath.split('/').pop() === fileName
    );

    return templates.map(template => {
      const label = `${template.name}.${template.format}`;
      const item = new PhoenixTreeItem(
        label,
        'template',
        vscode.TreeItemCollapsibleState.None,
        '$(file-code)'
      );
      item.description = template.module;
      item.tooltip = `${label}\nModule: ${template.module}\n${template.filePath}`;
      item.command = {
        command: 'phoenixPulse.goToItem',
        title: 'Go to Template',
        arguments: [template.filePath, template.location]
      };
      return item;
    });
  }

  private async getEventFiles(): Promise<PhoenixTreeItem[]> {
    try {
      const events: EventInfo[] = await this.client.sendRequest('phoenix/listEvents', {});
      this.eventsCache = events;

      // Group events by file
      const fileMap = new Map<string, EventInfo[]>();
      for (const event of events) {
        const fileName = event.filePath.split('/').pop() || event.filePath;
        if (!fileMap.has(fileName)) {
          fileMap.set(fileName, []);
        }
        fileMap.get(fileName)!.push(event);
      }

      // Create file nodes
      return Array.from(fileMap.entries()).map(([fileName, fileEvents]) => {
        const item = new PhoenixTreeItem(
          fileName,
          'event-file',
          vscode.TreeItemCollapsibleState.Collapsed,
          '$(file-code)'
        );
        item.description = `${fileEvents.length} events`;
        item.tooltip = `${fileName}\n${fileEvents.length} events\n${fileEvents[0].filePath}`;
        item.data = fileName;
        return item;
      });
    } catch (error) {
      console.error('[PhoenixPulse] Error fetching events:', error);
      return [];
    }
  }

  private getEventsInFile(fileName: string): PhoenixTreeItem[] {
    const events = this.eventsCache.filter(e =>
      e.filePath.split('/').pop() === fileName
    );

    return events.map(event => {
      const item = new PhoenixTreeItem(
        event.name,
        'event',
        vscode.TreeItemCollapsibleState.None,
        '$(zap)'
      );
      item.description = event.type;
      item.tooltip = `${event.name} (${event.type})\n${event.filePath}`;
      item.command = {
        command: 'phoenixPulse.goToItem',
        title: 'Go to Event',
        arguments: [event.filePath, event.location]
      };
      return item;
    });
  }

  private getRouteIcon(verb: string): string {
    switch (verb.toUpperCase()) {
      case 'GET':
        return '$(arrow-down)';
      case 'POST':
        return '$(add)';
      case 'PUT':
      case 'PATCH':
        return '$(edit)';
      case 'DELETE':
        return '$(trash)';
      default:
        return '$(link)';
    }
  }
}

class PhoenixTreeItem extends vscode.TreeItem {
  public data?: any; // Store additional data for hierarchical nodes

  constructor(
    public readonly label: string,
    public readonly contextValue: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    iconPath?: string
  ) {
    super(label, collapsibleState);

    if (iconPath) {
      this.iconPath = new vscode.ThemeIcon(iconPath.replace('$(', '').replace(')', ''));
    }
  }
}
