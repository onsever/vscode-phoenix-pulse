import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

type TreeSitterModule = {
  init(options?: { locateFile?: (name: string, scriptDirectory?: string) => string }): Promise<void>;
  Language: {
    load(file: string): Promise<any>;
  };
  Parser: new () => {
    setLanguage(language: any): void;
    parse(input: string): any;
    getLanguage(): any;
  };
};

let moduleLoadAttempted = false;
let moduleLoadSucceeded = false;
let webTreeSitter: TreeSitterModule | null = null;
let heexLanguage: any | null = null;
let parserInstance: any | null = null;
let initializationError: Error | null = null;

interface TreeCacheEntry {
  text: string;
  tree: any;
}

const treeCache = new Map<string, TreeCacheEntry>();

function dynamicRequire(moduleName: string): any | null {
  try {
    const runtimeRequire = createRequire(__filename);
    return runtimeRequire(moduleName);
  } catch {
    if (moduleName === 'web-tree-sitter') {
      try {
        const runtimeRequire = createRequire(__filename);
        const candidate = path.resolve(__dirname, '../../../vendor/web-tree-sitter/tree-sitter.js');
        if (fs.existsSync(candidate)) {
          return runtimeRequire(candidate);
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}

function logDebug(message: string): void {
  if (process.env.PHOENIX_LSP_DEBUG_TREE_SITTER === '1') {
    console.log(`[TreeSitter] ${message}`);
  }
}

export async function initializeTreeSitter(workspaceRoot: string): Promise<boolean> {
  if (moduleLoadAttempted) {
    return moduleLoadSucceeded;
  }

  moduleLoadAttempted = true;

  webTreeSitter = dynamicRequire('web-tree-sitter');
  if (!webTreeSitter) {
    initializationError = new Error(
      'web-tree-sitter module not found. Install it or bundle a compatible runtime to enable Tree-sitter.'
    );
    logDebug(initializationError.message);
    return false;
  }

  const locateFile = (name: string, scriptDirectory?: string) => {
    if (name === 'tree-sitter.wasm') {
      const runtimePath = path.join(workspaceRoot, 'syntaxes', 'tree-sitter.wasm');
      if (fs.existsSync(runtimePath)) {
        return runtimePath;
      }
      const vendorPath = path.resolve(__dirname, '../../../vendor/web-tree-sitter/tree-sitter.wasm');
      if (fs.existsSync(vendorPath)) {
        return vendorPath;
      }
    }
    if (scriptDirectory) {
      return path.join(scriptDirectory, name);
    }
    return name;
  };

  try {
    await webTreeSitter.init({ locateFile });
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    logDebug(`Failed to initialize web-tree-sitter: ${initializationError.message}`);
    return false;
  }

  const heexWasmPath = path.join(workspaceRoot, 'syntaxes', 'tree-sitter-heex.wasm');
  if (!fs.existsSync(heexWasmPath)) {
    const error = new Error(
      `tree-sitter-heex.wasm not found at ${heexWasmPath}. Bundle the compiled grammar to enable Tree-sitter.`
    );
    initializationError = error;
    logDebug(error.message);
    return false;
  }

  try {
    heexLanguage = await webTreeSitter.Language.load(heexWasmPath);
    parserInstance = new webTreeSitter.Parser();
    parserInstance.setLanguage(heexLanguage);
    moduleLoadSucceeded = true;
    logDebug('Tree-sitter HEEx grammar loaded successfully.');
    return true;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    logDebug(`Failed to load HEEx grammar: ${initializationError.message}`);
    return false;
  }
}

export function getTreeSitterError(): Error | null {
  return initializationError;
}

export function isTreeSitterReady(): boolean {
  return moduleLoadSucceeded && !!parserInstance;
}

export function getHeexTree(cacheKey: string, text: string): any | null {
  if (!parserInstance) {
    return null;
  }

  const cached = treeCache.get(cacheKey);
  if (cached && cached.text === text) {
    return cached.tree;
  }

  try {
    const tree = parserInstance.parse(text);
    treeCache.set(cacheKey, { text, tree });
    return tree;
  } catch (error) {
    logDebug(`Failed to parse HEEx content: ${error}`);
    return null;
  }
}

export function clearTreeCache(cacheKey?: string): void {
  if (cacheKey) {
    treeCache.delete(cacheKey);
  } else {
    treeCache.clear();
  }
}
