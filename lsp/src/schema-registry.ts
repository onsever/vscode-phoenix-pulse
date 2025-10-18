import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PerfTimer, time } from './utils/perf';

/**
 * Represents a field in an Ecto schema
 */
export interface SchemaField {
  name: string;
  type: string; // :string, :integer, :boolean, :map, etc.
  elixirType?: string; // For embedded_schema or belongs_to (e.g., "User", "Profile")
}

/**
 * Represents an Ecto schema
 */
export interface EctoSchema {
  moduleName: string; // Full module name (e.g., "MyApp.Accounts.User")
  tableName?: string; // Table name for regular schemas
  fields: SchemaField[];
  associations: Map<string, string>; // field name -> module name (e.g., "profile" -> "MyApp.Accounts.Profile")
  filePath: string;
  line: number;
}

/**
 * Registry for Ecto schemas to support type inference and nested property completion
 */
export class SchemaRegistry {
  private schemas: Map<string, EctoSchema> = new Map(); // moduleName -> schema
  private schemasByFile: Map<string, EctoSchema[]> = new Map(); // filePath -> schemas
  private workspaceRoot: string = '';
  private fileHashes: Map<string, string> = new Map();

  setWorkspaceRoot(root: string) {
    this.workspaceRoot = root;
  }

  /**
   * Parse an Elixir file and extract Ecto schema definitions
   */
  parseFile(filePath: string, content: string): EctoSchema[] {
    const timer = new PerfTimer('schemas.parseFile');
    const schemas: EctoSchema[] = [];
    const lines = content.split('\n');

    // Extract module name
    let moduleName = '';
    for (const line of lines) {
      const moduleMatch = /defmodule\s+([\w.]+)\s+do/.exec(line);
      if (moduleMatch) {
        moduleName = moduleMatch[1];
        break;
      }
    }

    if (!moduleName) {
      return schemas;
    }

    let currentSchema: EctoSchema | null = null;
    let inSchemaBlock = false;
    let schemaDepth = 0;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Pattern 1: Detect schema block
      // Match: schema "users" do or embedded_schema do
      const schemaPattern = /^(?:schema\s+["']([^"']+)["']|embedded_schema)\s+do$/;
      const schemaMatch = schemaPattern.exec(trimmedLine);

      if (schemaMatch) {
        inSchemaBlock = true;
        schemaDepth = 1;
        currentSchema = {
          moduleName,
          tableName: schemaMatch[1], // May be undefined for embedded_schema
          fields: [],
          associations: new Map(),
          filePath,
          line: index + 1,
        };
      }

      // Track do/end depth
      if (inSchemaBlock) {
        if (trimmedLine.match(/\bdo\b/) && !trimmedLine.match(/^(?:schema|embedded_schema)/)) {
          schemaDepth++;
        }
        if (trimmedLine === 'end') {
          schemaDepth--;
          if (schemaDepth === 0) {
            // End of schema block
            inSchemaBlock = false;
            if (currentSchema && currentSchema.fields.length > 0) {
              schemas.push(currentSchema);
            }
            currentSchema = null;
          }
        }
      }

      if (!inSchemaBlock || !currentSchema) {
        return;
      }

      // Pattern 2: Parse field definitions
      // Match: field :name, :string, default: "value"
      // Match: field :age, :integer
      // Match: field :metadata, :map
      const fieldPattern = /^field\s+:([a-z_][a-z0-9_]*)\s*,\s*:([a-z_]+)/;
      const fieldMatch = fieldPattern.exec(trimmedLine);

      if (fieldMatch) {
        currentSchema.fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
        });
        return;
      }

      // Pattern 3: Parse belongs_to associations
      // Match: belongs_to :user, User
      // Match: belongs_to :profile, MyApp.Accounts.Profile
      const belongsToPattern = /^belongs_to\s+:([a-z_][a-z0-9_]*)\s*,\s*([\w.]+)/;
      const belongsToMatch = belongsToPattern.exec(trimmedLine);

      if (belongsToMatch) {
        const fieldName = belongsToMatch[1];
        const associationType = belongsToMatch[2];

        // Resolve module name (handle both short and full names)
        const fullTypeName = associationType.includes('.')
          ? associationType
          : `${moduleName.split('.').slice(0, -1).join('.')}.${associationType}`;

        currentSchema.associations.set(fieldName, fullTypeName);
        currentSchema.fields.push({
          name: fieldName,
          type: 'assoc',
          elixirType: fullTypeName,
        });
        return;
      }

      // Pattern 4: Parse has_one associations
      // Match: has_one :profile, Profile
      const hasOnePattern = /^has_one\s+:([a-z_][a-z0-9_]*)\s*,\s*([\w.]+)/;
      const hasOneMatch = hasOnePattern.exec(trimmedLine);

      if (hasOneMatch) {
        const fieldName = hasOneMatch[1];
        const associationType = hasOneMatch[2];

        const fullTypeName = associationType.includes('.')
          ? associationType
          : `${moduleName.split('.').slice(0, -1).join('.')}.${associationType}`;

        currentSchema.associations.set(fieldName, fullTypeName);
        currentSchema.fields.push({
          name: fieldName,
          type: 'assoc',
          elixirType: fullTypeName,
        });
        return;
      }

      // Pattern 5: Parse has_many associations
      // Match: has_many :posts, Post
      const hasManyPattern = /^has_many\s+:([a-z_][a-z0-9_]*)\s*,\s*([\w.]+)/;
      const hasManyMatch = hasManyPattern.exec(trimmedLine);

      if (hasManyMatch) {
        const fieldName = hasManyMatch[1];
        const associationType = hasManyMatch[2];

        const fullTypeName = associationType.includes('.')
          ? associationType
          : `${moduleName.split('.').slice(0, -1).join('.')}.${associationType}`;

        currentSchema.associations.set(fieldName, fullTypeName);
        currentSchema.fields.push({
          name: fieldName,
          type: 'list',
          elixirType: fullTypeName,
        });
        return;
      }

      // Pattern 6: Parse embeds_one
      // Match: embeds_one :address, Address
      const embedsOnePattern = /^embeds_one\s+:([a-z_][a-z0-9_]*)\s*,\s*([\w.]+)/;
      const embedsOneMatch = embedsOnePattern.exec(trimmedLine);

      if (embedsOneMatch) {
        const fieldName = embedsOneMatch[1];
        const embedType = embedsOneMatch[2];

        const fullTypeName = embedType.includes('.')
          ? embedType
          : `${moduleName}.${embedType}`;

        currentSchema.associations.set(fieldName, fullTypeName);
        currentSchema.fields.push({
          name: fieldName,
          type: 'embed',
          elixirType: fullTypeName,
        });
        return;
      }

      // Pattern 7: Parse embeds_many
      // Match: embeds_many :addresses, Address
      const embedsManyPattern = /^embeds_many\s+:([a-z_][a-z0-9_]*)\s*,\s*([\w.]+)/;
      const embedsManyMatch = embedsManyPattern.exec(trimmedLine);

      if (embedsManyMatch) {
        const fieldName = embedsManyMatch[1];
        const embedType = embedsManyMatch[2];

        const fullTypeName = embedType.includes('.')
          ? embedType
          : `${moduleName}.${embedType}`;

        currentSchema.associations.set(fieldName, fullTypeName);
        currentSchema.fields.push({
          name: fieldName,
          type: 'list',
          elixirType: fullTypeName,
        });
        return;
      }
    });

    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), count: schemas.length });
    return schemas;
  }

  /**
   * Update schemas for a specific file
   */
  updateFile(filePath: string, content: string) {
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    const previousHash = this.fileHashes.get(filePath);

    if (previousHash === hash) {
      return;
    }

    const timer = new PerfTimer('schemas.updateFile');
    const schemas = this.parseFile(filePath, content);

    // Remove old schemas for this file
    const oldSchemas = this.schemasByFile.get(filePath) || [];
    oldSchemas.forEach(schema => {
      this.schemas.delete(schema.moduleName);
    });

    // Add new schemas
    if (schemas.length > 0) {
      this.schemasByFile.set(filePath, schemas);
      schemas.forEach(schema => {
        this.schemas.set(schema.moduleName, schema);
        console.log(`[SchemaRegistry] Found schema ${schema.moduleName} with ${schema.fields.length} fields`);
      });
      this.fileHashes.set(filePath, hash);
    } else {
      this.schemasByFile.delete(filePath);
      this.fileHashes.delete(filePath);
    }
    timer.stop({ file: path.relative(this.workspaceRoot || '', filePath), schemas: schemas.length });
  }

  /**
   * Remove a file from the registry
   */
  removeFile(filePath: string) {
    const schemas = this.schemasByFile.get(filePath) || [];
    schemas.forEach(schema => {
      this.schemas.delete(schema.moduleName);
    });
    this.schemasByFile.delete(filePath);
    this.fileHashes.delete(filePath);
  }

  /**
   * Get a schema by module name
   */
  getSchema(moduleName: string): EctoSchema | null {
    return this.schemas.get(moduleName) || null;
  }

  /**
   * Get all schemas
   */
  getAllSchemas(): EctoSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Resolve a type name to a module name
   * Handles both short names (User) and full names (MyApp.Accounts.User)
   */
  resolveTypeName(typeName: string, contextModule?: string): string | null {
    // If it's already a full module name and exists, return it
    if (this.schemas.has(typeName)) {
      return typeName;
    }

    // Try with context module prefix
    if (contextModule) {
      const contextParts = contextModule.split('.');
      // Try same namespace
      const sameNamespace = `${contextParts.slice(0, -1).join('.')}.${typeName}`;
      if (this.schemas.has(sameNamespace)) {
        return sameNamespace;
      }
    }

    // Search for any schema with matching last part
    for (const moduleName of this.schemas.keys()) {
      if (moduleName.endsWith(`.${typeName}`) || moduleName === typeName) {
        return moduleName;
      }
    }

    return null;
  }

  /**
   * Get fields for a nested property path
   * Example: "user.profile.address" -> returns fields for Address schema
   *
   * @param baseType - The base type module name (e.g., "MyApp.Accounts.User")
   * @param path - The property path (e.g., ["profile", "address"])
   * @returns Fields for the final type in the path
   */
  getFieldsForPath(baseType: string, path: string[]): SchemaField[] {
    let currentType = baseType;

    for (const prop of path) {
      const schema = this.getSchema(currentType);
      if (!schema) {
        return [];
      }

      // Find the field
      const field = schema.fields.find(f => f.name === prop);
      if (!field || !field.elixirType) {
        return [];
      }

      // Move to the next type
      const resolvedType = this.resolveTypeName(field.elixirType, currentType);
      if (!resolvedType) {
        return [];
      }
      currentType = resolvedType;
    }

    // Return fields for the final type
    const finalSchema = this.getSchema(currentType);
    return finalSchema ? finalSchema.fields : [];
  }

  /**
   * Scan workspace for schema files
   */
  async scanWorkspace(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;

    const scanDirectory = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip common excluded directories
          if (entry.isDirectory()) {
            const dirName = entry.name;
            if (
              dirName === 'node_modules' ||
              dirName === 'deps' ||
              dirName === '_build' ||
              dirName === '.git' ||
              dirName === 'assets' ||
              dirName === 'priv'
            ) {
              continue;
            }
            scanDirectory(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.ex') || entry.name.endsWith('.exs'))) {
            // Look for files that might contain schemas
            // Common patterns: lib/*/schemas/, lib/*/accounts/, lib/*_web/models/
            const isLikelySchemaFile =
              fullPath.includes('/schemas/') ||
              fullPath.includes('/accounts/') ||
              fullPath.includes('/models/') ||
              entry.name.endsWith('_schema.ex') ||
              entry.name.match(/_(?:user|profile|post|comment|product|order|item)\.ex$/i);

            if (isLikelySchemaFile) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                // Quick check if file contains schema definition
                if (content.includes('schema ') || content.includes('embedded_schema')) {
                  this.updateFile(fullPath, content);
                }
              } catch (err) {
                // Ignore files we can't read
              }
            }
          }
        }
      } catch (err) {
        // Ignore directories we can't read
      }
    };

    time('schemas.scanWorkspace', () => scanDirectory(workspaceRoot), { root: workspaceRoot });
  }
}
