import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import type {
  TreeSitter,
  Language,
  Parser,
  Tree,
  Edit as TreeEdit,
} from './tree-sitter-types';

let moduleLoadAttempted = false;
let moduleLoadSucceeded = false;
let webTreeSitter: TreeSitter | null = null;
let heexLanguage: Language | null = null;
let parserInstance: Parser | null = null;
let initializationError: Error | null = null;

interface TreeCacheEntry {
  text: string;
  tree: Tree;
}

/**
 * Simple LRU cache implementation for tree-sitter parse trees
 * Evicts least recently used entries when size limit is reached
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to re-insert at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  get size(): number {
    return this.cache.size;
  }
}

// LRU cache with 200 entry limit (prevents unbounded memory growth)
const treeCache = new LRUCache<string, TreeCacheEntry>(200);

function dynamicRequire(moduleName: string): any | null {
  try {
    const runtimeRequire = createRequire(__filename);
    return runtimeRequire(moduleName);
  } catch {
    if (moduleName === 'web-tree-sitter') {
      try {
        const runtimeRequire = createRequire(__filename);
        const candidate = path.resolve(__dirname, '../../vendor/web-tree-sitter/tree-sitter.js');
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
  logDebug('web-tree-sitter module resolved successfully.');

  const locateFile = (name: string, scriptDirectory?: string) => {
    if (name === 'tree-sitter.wasm') {
      const runtimePath = path.join(workspaceRoot, 'syntaxes', 'tree-sitter.wasm');
      if (fs.existsSync(runtimePath)) {
        return runtimePath;
      }
      const vendorPath = path.resolve(__dirname, '../../vendor/web-tree-sitter/tree-sitter.wasm');
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
    logDebug('web-tree-sitter runtime initialized.');
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    logDebug(`Failed to initialize web-tree-sitter: ${initializationError.message}`);
    return false;
  }

  const heexWasmCandidates = [
    path.join(workspaceRoot, 'syntaxes', 'tree-sitter-heex.wasm'),
    path.resolve(__dirname, '../../syntaxes/tree-sitter-heex.wasm'),
    path.resolve(__dirname, '../../vendor/web-tree-sitter/tree-sitter-heex.wasm'),
  ];

  const heexWasmPath = heexWasmCandidates.find(candidate => fs.existsSync(candidate));

  if (!heexWasmPath) {
    const error = new Error(
      `tree-sitter-heex.wasm not found. Checked: ${heexWasmCandidates.join(', ')}. Bundle the compiled grammar to enable Tree-sitter.`
    );
    initializationError = error;
    logDebug(error.message);
    return false;
  }
  logDebug(`Using HEEx grammar at: ${heexWasmPath}`);

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

export function getHeexTree(cacheKey: string, text: string): Tree | null {
  if (!parserInstance) {
    return null;
  }

  // Always fetch from cache to get latest version (avoid race conditions)
  const cached = treeCache.get(cacheKey);

  // If cache exists and text matches, we can safely reuse the tree
  if (cached && cached.text === text) {
    return cached.tree;
  }

  // Text doesn't match or no cache entry - parse fresh
  // Don't use incremental parsing with stale cache (race condition risk)
  return parseFresh(cacheKey, text);
}

export function clearTreeCache(cacheKey?: string): void {
  if (cacheKey) {
    treeCache.delete(cacheKey);
  } else {
    treeCache.clear();
  }
}

export function getTreeCacheKeys(): string[] {
  return Array.from(treeCache.keys());
}

function parseFresh(cacheKey: string, text: string): Tree | null {
  if (!parserInstance) {
    return null;
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

function performIncrementalParse(
  cacheKey: string,
  cached: TreeCacheEntry,
  newText: string
): Tree | null {
  if (!parserInstance) {
    return null;
  }

  const { text: oldText, tree } = cached;
  const edit = calculateEdit(oldText, newText);

  if (!edit) {
    // Text unchanged or edit could not be determined
    return parseFresh(cacheKey, newText);
  }

  try {
    tree.edit(edit);
    const newTree = parserInstance.parse(newText, tree);
    treeCache.set(cacheKey, { text: newText, tree: newTree });
    return newTree;
  } catch (error) {
    logDebug(`Incremental parse failed (falling back to full parse): ${error}`);
    return parseFresh(cacheKey, newText);
  }
}

function calculateEdit(oldText: string, newText: string): TreeEdit | null {
  if (oldText === newText) {
    return null;
  }

  const oldLen = oldText.length;
  const newLen = newText.length;

  let startIndex = 0;
  while (
    startIndex < oldLen &&
    startIndex < newLen &&
    oldText[startIndex] === newText[startIndex]
  ) {
    startIndex++;
  }

  let oldEndIndex = oldLen;
  let newEndIndex = newLen;

  while (
    oldEndIndex > startIndex &&
    newEndIndex > startIndex &&
    oldText[oldEndIndex - 1] === newText[newEndIndex - 1]
  ) {
    oldEndIndex--;
    newEndIndex--;
  }

  return {
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition: getPositionAt(oldText, startIndex),
    oldEndPosition: getPositionAt(oldText, oldEndIndex),
    newEndPosition: getPositionAt(newText, newEndIndex),
  };
}

/**
 * Convert byte index to LSP position (row, column)
 *
 * NOTE: This intentionally counts UTF-16 code units, not grapheme clusters.
 * This matches the LSP specification which requires UTF-16 positions.
 * Multi-byte characters (emojis, etc.) will count as multiple positions,
 * which is correct behavior for LSP compatibility with VS Code.
 *
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#position
 */
function getPositionAt(text: string, index: number): { row: number; column: number } {
  let row = 0;
  let column = 0;

  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      row++;
      column = 0;
    } else {
      column++;
    }
  }

  return { row, column };
}
