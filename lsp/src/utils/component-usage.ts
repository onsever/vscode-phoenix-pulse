import { TextDocument } from 'vscode-languageserver-textdocument';
import { Range } from 'vscode-languageserver/node';
import { getHeexTree, isTreeSitterReady } from '../parsers/tree-sitter';

export interface AttributeUsage {
  name: string;
  start: number;
  end: number;
  valueStart?: number;
  valueEnd?: number;
  valueText?: string;
}

export interface ComponentUsage {
  componentName: string;
  moduleContext?: string;
  isLocal: boolean;
  openTagStart: number;
  openTagEnd: number;
  nameStart: number;
  nameEnd: number;
  attributesStart: number;
  attributesEnd: number;
  attributes: AttributeUsage[];
  selfClosing: boolean;
  contentStart?: number;
  contentEnd?: number;
  blockEnd: number;
}

export const SPECIAL_TEMPLATE_ATTRIBUTES = new Set([':for', ':if', ':let', ':key']);

const KNOWN_HTML_ATTRIBUTES = new Set([
  'id',
  'class',
  'style',
  'title',
  'type',
  'value',
  'name',
  'disabled',
  'checked',
  'selected',
  'placeholder',
  'href',
  'src',
  'alt',
  'width',
  'height',
  'target',
  'rel',
  'method',
  'action',
  'role',
  'tabindex',
  'autocomplete',
  'autofocus',
  'required',
  'draggable',
  'download',
  'maxlength',
  'minlength',
  'rows',
  'cols',
  'wrap',
  'accept',
  'multiple',
  'pattern',
  'step',
  'max',
  'min',
  'readonly',
  'form',
  'for',
  'enctype',
  'novalidate',
  'spellcheck',
  'contenteditable',
  'referrerpolicy',
  'sizes',
  'srcset',
  'loading',
  'decoding',
  'poster',
  'controls',
  'loop',
  'muted',
  'playsinline',
  'preload',
  'datetime',
  'lang',
  'data',
  'cols',
  'rows',
]);

interface TreeComponentMatch {
  componentName: string;
  moduleContext?: string;
  isLocal: boolean;
}

function parseComponentTagName(tagName: string): TreeComponentMatch | null {
  if (!tagName) {
    return null;
  }

  if (tagName.startsWith('.')) {
    const componentName = tagName.slice(1);
    if (/^[a-z_][a-z0-9_]*$/i.test(componentName)) {
      return {
        componentName,
        isLocal: true,
      };
    }
    return null;
  }

  if (tagName.includes('.')) {
    const lastDot = tagName.lastIndexOf('.');
    const moduleContext = tagName.slice(0, lastDot);
    const componentName = tagName.slice(lastDot + 1);
    if (
      moduleContext.length > 0 &&
      componentName.length > 0 &&
      /^[A-Z]/.test(moduleContext) &&
      /^[a-z_][a-z0-9_]*$/i.test(componentName)
    ) {
      return {
        componentName,
        moduleContext,
        isLocal: false,
      };
    }
  }

  return null;
}

function getNodeText(node: any, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

function collectUsagesFromTree(text: string, cacheKey: string): ComponentUsage[] | null {
  try {
    const tree = getHeexTree(cacheKey, text);
    if (!tree) {
      return null;
    }

    const usages: ComponentUsage[] = [];
    const visit = (node: any) => {
      if (!node || typeof node.type !== 'string') {
        return;
      }

      if (node.type === 'element' || node.type === 'component' || node.type === 'component_block') {
        const openTag =
          node.childForFieldName?.('start_tag') ??
          node.childForFieldName?.('open_tag') ??
          node.namedChildren?.find((child: any) => child.type === 'start_tag' || child.type === 'open_tag');
        if (!openTag) {
          node.namedChildren?.forEach(visit);
          return;
        }

        const tagNameNode =
          openTag.childForFieldName?.('name') ??
          openTag.childForFieldName?.('tag_name') ??
          openTag.namedChildren?.find((child: any) => child.type === 'tag_name' || child.type === 'component_name');

        const tagNameText = tagNameNode ? getNodeText(tagNameNode, text) : '';
        const componentMatch = parseComponentTagName(tagNameText);
        if (!componentMatch) {
          node.namedChildren?.forEach(visit);
          return;
        }

        const closeTag =
          node.childForFieldName?.('end_tag') ??
          node.childForFieldName?.('close_tag') ??
          node.namedChildren?.find((child: any) => child.type === 'end_tag' || child.type === 'close_tag');

        const attributes: AttributeUsage[] = [];
        const attributeNodes = openTag.namedChildren?.filter((child: any) => child.type === 'attribute') ?? [];
        for (const attrNode of attributeNodes) {
          const nameNode = attrNode.childForFieldName?.('name') ?? attrNode.namedChildren?.find((child: any) => child.type === 'attribute_name');
          if (!nameNode) {
            continue;
          }

          const nameText = getNodeText(nameNode, text);
          const attr: AttributeUsage = {
            name: nameText,
            start: nameNode.startIndex,
            end: nameNode.endIndex,
          };

          const valueNode = attrNode.childForFieldName?.('value') ?? attrNode.namedChildren?.find((child: any) => child.type.includes('value'));
          if (valueNode) {
            attr.valueStart = valueNode.startIndex;
            attr.valueEnd = valueNode.endIndex;
            attr.valueText = getNodeText(valueNode, text);
          }

          attributes.push(attr);
        }

        const selfClosing = !closeTag;
        const componentUsage: ComponentUsage = {
          componentName: componentMatch.componentName,
          moduleContext: componentMatch.moduleContext,
          isLocal: componentMatch.isLocal,
          openTagStart: openTag.startIndex,
          openTagEnd: openTag.endIndex,
          nameStart: tagNameNode ? tagNameNode.startIndex : openTag.startIndex,
          nameEnd: tagNameNode ? tagNameNode.endIndex : openTag.endIndex,
          attributesStart: openTag.startIndex,
          attributesEnd: openTag.endIndex,
          attributes,
          selfClosing,
          blockEnd: node.endIndex,
        };

        if (!selfClosing && closeTag) {
          componentUsage.contentStart = openTag.endIndex;
          componentUsage.contentEnd = closeTag.startIndex;
        }

        usages.push(componentUsage);
      }

      const children = node.namedChildren ?? [];
      for (const child of children) {
        visit(child);
      }
    };

    visit(tree.rootNode);
    usages.sort((a, b) => a.openTagStart - b.openTagStart);
    return usages;
  } catch (error) {
    if (process.env.PHOENIX_LSP_DEBUG_TREE_SITTER === '1') {
      console.log(`[TreeSitter] Unable to derive component usages from tree: ${error}`);
    }
    return null;
  }
}

export function collectComponentUsages(text: string, cacheKey = '__anonymous__'): ComponentUsage[] {
  if (isTreeSitterReady()) {
    const treeBased = collectUsagesFromTree(text, cacheKey);
    if (treeBased) {
      return treeBased;
    }
  }

  const usages: ComponentUsage[] = [];
  usages.push(...collectUsages(text, /<\.([a-z_][a-z0-9_]*)\b/g, true));
  usages.push(...collectUsages(text, /<([A-Z][\w]*(?:\.[A-Z][\w]*)*)\.([a-z_][a-z0-9_]*)\b/g, false));
  usages.sort((a, b) => a.openTagStart - b.openTagStart);
  return usages;
}

export function shouldIgnoreUnknownAttribute(name: string): boolean {
  if (SPECIAL_TEMPLATE_ATTRIBUTES.has(name)) {
    return true;
  }
  if (name.startsWith('phx-') || name.startsWith('data-') || name.startsWith('aria-')) {
    return true;
  }
  if (name.startsWith('on-')) {
    return true;
  }
  if (KNOWN_HTML_ATTRIBUTES.has(name)) {
    return true;
  }
  return false;
}

export function createRange(document: TextDocument, start: number, end: number): Range {
  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  };
}

export function isSlotProvided(slotName: string, usage: ComponentUsage, text: string): boolean {
  if (usage.selfClosing || usage.contentStart == null || usage.contentEnd == null) {
    return false;
  }

  const content = text.slice(usage.contentStart, usage.contentEnd);

  if (slotName === 'inner_block') {
    return content.trim().length > 0;
  }

  const slotTagPattern = new RegExp(`<:${slotName}\\b`);
  if (slotTagPattern.test(content)) {
    return true;
  }

  const renderSlotPattern = new RegExp(`render_slot\\(\\s*@${slotName}`);
  if (renderSlotPattern.test(content)) {
    return true;
  }

  return false;
}

function collectUsages(text: string, pattern: RegExp, isLocal: boolean): ComponentUsage[] {
  const usages: ComponentUsage[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const openTagStart = match.index;
    const componentName = isLocal ? match[1] : match[2];
    const moduleContext = isLocal ? undefined : match[1];
    const matchText = match[0];
    const rawAttrStart = openTagStart + matchText.length;

    const tagEnd = findTagEnd(text, rawAttrStart);
    if (tagEnd === -1) {
      pattern.lastIndex = openTagStart + 1;
      continue;
    }

    let attrEnd = tagEnd;
    let cursor = tagEnd - 1;
    while (cursor >= rawAttrStart && /\s/.test(text[cursor])) {
      cursor--;
    }
    const selfClosing = cursor >= rawAttrStart && text[cursor] === '/';
    if (selfClosing) {
      attrEnd = cursor;
    }

    const attributes = parseAttributes(text.slice(rawAttrStart, attrEnd), rawAttrStart);

    let contentStart: number | undefined;
    let contentEnd: number | undefined;
    let blockEnd = tagEnd + 1;
    if (!selfClosing) {
      const closing = findMatchingClosingTag(
        text,
        tagEnd + 1,
        componentName,
        moduleContext,
        isLocal
      );
      if (closing) {
        contentStart = tagEnd + 1;
        contentEnd = closing.closeStart;
        blockEnd = closing.closeEnd;
      }
    }

    const nameStart = isLocal
      ? openTagStart + 2
      : openTagStart + 1 + (moduleContext ? moduleContext.length : 0) + 1;
    const nameEnd = nameStart + componentName.length;

    usages.push({
      componentName,
      moduleContext,
      isLocal,
      openTagStart,
      openTagEnd: tagEnd + 1,
      nameStart,
      nameEnd,
      attributesStart: rawAttrStart,
      attributesEnd: attrEnd,
      attributes,
      selfClosing,
      contentStart,
      contentEnd,
      blockEnd,
    });

    pattern.lastIndex = tagEnd + 1;
  }

  return usages;
}

function parseAttributes(text: string, baseOffset: number): AttributeUsage[] {
  const attributes: AttributeUsage[] = [];
  const length = text.length;
  let i = 0;

  while (i < length) {
    while (i < length && /\s/.test(text[i])) {
      i++;
    }
    if (i >= length) {
      break;
    }
    if (text[i] === '/') {
      break;
    }

    const nameStartIndex = i;
    while (i < length && /[A-Za-z0-9_.:-]/.test(text[i])) {
      i++;
    }

    if (nameStartIndex === i) {
      i++;
      continue;
    }

    const name = text.slice(nameStartIndex, i);
    const attrStart = baseOffset + nameStartIndex;
    const attrEnd = baseOffset + i;
    const attr: AttributeUsage = {
      name,
      start: attrStart,
      end: attrEnd,
    };
    attributes.push(attr);

    while (i < length && /\s/.test(text[i])) {
      i++;
    }

    if (i < length && text[i] === '=') {
      i++;
      while (i < length && /\s/.test(text[i])) {
        i++;
      }
      if (i >= length) {
        break;
      }

      const valueStartIndex = i;
      const ch = text[i];

      if (ch === '"' || ch === '\'') {
        const quote = ch;
        i++;
        while (i < length) {
          if (text[i] === quote && text[i - 1] !== '\\') {
            i++;
            break;
          }
          i++;
        }
      } else if (ch === '{') {
        i++;
        const stack: string[] = ['{'];
        while (i < length && stack.length > 0) {
          const current = text[i];
          if (current === '"' || current === '\'') {
            const quote = current;
            i++;
            while (i < length) {
              if (text[i] === quote && text[i - 1] !== '\\') {
                i++;
                break;
              }
              i++;
            }
            continue;
          }
          if (current === '{') {
            stack.push('{');
          } else if (current === '}') {
            stack.pop();
          }
          i++;
        }
      } else {
        while (i < length && !/\s/.test(text[i])) {
          i++;
        }
      }

      const valueEndIndex = i;
      attr.valueStart = baseOffset + valueStartIndex;
      attr.valueEnd = baseOffset + valueEndIndex;
      attr.valueText = text.slice(valueStartIndex, valueEndIndex);
    }
  }

  return attributes;
}

export function findEnclosingComponentUsage(
  text: string,
  offset: number,
  cacheKey = '__anonymous__'
): ComponentUsage | null {
  const usages = collectComponentUsages(text, cacheKey);
  for (let i = usages.length - 1; i >= 0; i--) {
    const usage = usages[i];
    if (offset >= usage.openTagStart && offset <= usage.blockEnd) {
      return usage;
    }
  }
  return null;
}

export function getComponentUsageStack(
  text: string,
  offset: number,
  cacheKey = '__anonymous__'
): ComponentUsage[] {
  const usages = collectComponentUsages(text, cacheKey);
  return usages
    .filter(usage => offset >= usage.openTagStart && offset <= usage.blockEnd)
    .sort((a, b) => a.openTagStart - b.openTagStart);
}

function findTagEnd(text: string, startIndex: number): number {
  const stack: string[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = startIndex;

  while (i < text.length) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';

    if (inSingleQuote) {
      if (ch === '\'' && prev !== '\\') {
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"' && prev !== '\\') {
        inDoubleQuote = false;
      }
      i++;
      continue;
    }

    if (ch === '\'') {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    if (ch === '{' || ch === '[' || ch === '(') {
      stack.push(ch);
      i++;
      continue;
    }

    if (ch === '}' || ch === ']' || ch === ')') {
      if (stack.length > 0) {
        stack.pop();
      }
      i++;
      continue;
    }

    if (ch === '>' && stack.length === 0) {
      return i;
    }

    i++;
  }

  return -1;
}

function findMatchingClosingTag(
  text: string,
  searchStart: number,
  componentName: string,
  moduleContext: string | undefined,
  isLocal: boolean
): { closeStart: number; closeEnd: number } | null {
  const openTag = isLocal ? `<.${componentName}` : `<${moduleContext}.${componentName}`;
  const closeTag = isLocal ? `</.${componentName}` : `</${moduleContext}.${componentName}`;

  let depth = 1;
  let index = searchStart;

  while (index < text.length) {
    const nextOpen = text.indexOf(openTag, index);
    const nextClose = text.indexOf(closeTag, index);

    if (nextClose === -1) {
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const openEnd = findTagEnd(text, nextOpen + openTag.length);
      if (openEnd === -1) {
        return null;
      }
      depth++;
      index = openEnd + 1;
      continue;
    }

    const closeHeadEnd = nextClose + closeTag.length;
    const closeTagEnd = findTagEnd(text, closeHeadEnd);
    if (closeTagEnd === -1) {
      return null;
    }

    depth--;
    if (depth === 0) {
      return { closeStart: nextClose, closeEnd: closeTagEnd + 1 };
    }

    index = closeTagEnd + 1;
  }

  return null;
}
