import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as emmet from 'vscode-emmet-helper';

export async function getEmmetCompletions(
  document: TextDocument,
  position: Position,
  linePrefix: string
): Promise<CompletionItem[]> {
  try {
    // Check if we should provide Emmet completions
    // Emmet works when typing element names or abbreviations
    // Matches patterns like: div, div.class, div#id, ul>li*3, etc.
    const emmetPattern = /(?:^|[\s>])([a-z][a-z0-9]*(?:[>.#+*][a-z0-9-_{}$]*)*)$/i;
    const match = linePrefix.match(emmetPattern);

    if (!match) {
      return [];
    }

    const abbreviation = match[1];

    // Don't expand very short abbreviations or single letters to avoid noise
    // But allow common single tags like 'p', 'a', 'h1', etc.
    const commonSingleTags = ['p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
    if (abbreviation.length < 2 && !commonSingleTags.includes(abbreviation.toLowerCase())) {
      return [];
    }

    // Use the emmet helper to expand abbreviations
    const emmetCompletions = emmet.doComplete(
      document,
      position,
      'html',
      {
        showExpandedAbbreviation: 'always',
        showAbbreviationSuggestions: true,
        showSuggestionsAsSnippets: true,
        preferences: {},
      }
    );

    if (!emmetCompletions || !emmetCompletions.items) {
      return [];
    }

    // Convert Emmet completions to our format
    return emmetCompletions.items.map((item, index) => {
      let insertText: string | undefined;
      if (typeof item.insertText === 'string') {
        insertText = item.insertText;
      } else if (item.insertText && typeof item.insertText === 'object' && 'value' in item.insertText) {
        insertText = (item.insertText as any).value;
      }

      return {
        label: item.label,
        kind: CompletionItemKind.Snippet,
        detail: 'Emmet abbreviation',
        documentation: item.documentation,
        insertText,
        insertTextFormat: 2, // Snippet format
        sortText: `2${index.toString().padStart(3, '0')}`, // Sort after HTML attrs
        filterText: item.filterText,
      };
    });
  } catch (error) {
    // Silently fail if Emmet expansion fails
    return [];
  }
}
