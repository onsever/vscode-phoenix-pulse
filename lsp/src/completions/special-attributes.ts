import { CompletionItem, CompletionItemKind, InsertTextFormat, TextEdit, Range, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Phoenix LiveView special template attributes
 * Introduced in LiveView 0.18
 *
 * These provide syntactic sugar for common template patterns:
 * - :for - Loop comprehensions (replaces <%= for ... do %>)
 * - :if - Conditional rendering (replaces <%= if ... do %>)
 * - :let - Yield values from components/slots back to caller
 * - :key - Efficient diffing for :for loops
 */
const specialAttributes = [
  {
    label: ':for',
    detail: 'Loop comprehension',
    documentation: {
      kind: 'markdown' as const,
      value: [
        '**Loop Comprehension**',
        '',
        'Provides a shorthand for iterating over collections directly on HTML elements.',
        '',
        '**Example:**',
        '```heex',
        '<div :for={item <- @items}>',
        '  <%= item.name %>',
        '</div>',
        '```',
        '',
        '**With pattern matching:**',
        '```heex',
        '<tr :for={{id, user} <- @users}>',
        '  <td><%= id %></td>',
        '  <td><%= user.name %></td>',
        '</tr>',
        '```',
        '',
        '[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#module-the-for-attribute)'
      ].join('\n')
    },
    insertText: ':for={${1:item} <- ${2:@items}}',
    sortText: '0001',
  },
  {
    label: ':if',
    detail: 'Conditional rendering',
    documentation: {
      kind: 'markdown' as const,
      value: [
        '**Conditional Rendering**',
        '',
        'Provides a shorthand for conditionally rendering elements.',
        '',
        '**Example:**',
        '```heex',
        '<div :if={@show_content}>',
        '  Content here',
        '</div>',
        '```',
        '',
        '**With negation:**',
        '```heex',
        '<div :if={!@is_hidden}>',
        '  Visible content',
        '</div>',
        '```',
        '',
        '**Note:** For "else" behavior, use `:if` again with inverted condition.',
        '',
        '[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#module-the-if-attribute)'
      ].join('\n')
    },
    insertText: ':if={${1:@condition}}',
    sortText: '0002',
  },
  {
    label: ':let',
    detail: 'Yield value from component/slot',
    documentation: {
      kind: 'markdown' as const,
      value: [
        '**Yield Value from Component**',
        '',
        'Used by components and slots that want to yield a value back to the caller.',
        '',
        '**Common with form components:**',
        '```heex',
        '<.form :let={f} for={@form} phx-change="validate">',
        '  <.input field={f[:email]} type="email" />',
        '  <.input field={f[:password]} type="password" />',
        '</.form>',
        '```',
        '',
        '**With custom components:**',
        '```heex',
        '<.modal :let={modal_id} id="confirm">',
        '  <p>Are you sure?</p>',
        '  <button phx-click={JS.hide("##{modal_id}")}>Cancel</button>',
        '</.modal>',
        '```',
        '',
        '[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#module-the-let-attribute)'
      ].join('\n')
    },
    insertText: ':let={${1:var}}',
    sortText: '0003',
  },
  {
    label: ':key',
    detail: 'Efficient diffing for :for loops',
    documentation: {
      kind: 'markdown' as const,
      value: [
        '**Efficient Diffing Key**',
        '',
        'Specifies a unique key for items in `:for` loops to make DOM diffing more efficient.',
        '',
        'By default, the index of each item is used. Providing a unique `:key` improves performance when items are reordered, added, or removed.',
        '',
        '**Example:**',
        '```heex',
        '<div :for={user <- @users} :key={user.id}>',
        '  <%= user.name %>',
        '</div>',
        '```',
        '',
        '**With tuple pattern:**',
        '```heex',
        '<tr :for={{id, product} <- @products} :key={id}>',
        '  <td><%= product.name %></td>',
        '</tr>',
        '```',
        '',
        '**Best Practice:** Always provide `:key` when items have unique identifiers.',
        '',
        '[HexDocs](https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#module-the-for-attribute)'
      ].join('\n')
    },
    insertText: ':key={${1:item.id}}',
    sortText: '0004',
  },
];

/**
 * Get completions for Phoenix LiveView special template attributes
 * These attributes work on both regular HTML elements and Phoenix components
 *
 * Handles the case where user has already typed ':' to avoid double colon (::if)
 *
 * @param document - The text document
 * @param position - The current cursor position
 * @param linePrefix - The text before the cursor on the current line
 */
export function getSpecialAttributeCompletions(
  document?: TextDocument,
  position?: Position,
  linePrefix?: string
): CompletionItem[] {
  const replacementRange =
    document && position ? findSpecialAttributeReplacementRange(document, position) : null;
  const typedSegment =
    replacementRange && document
      ? document.getText({
          start: replacementRange.start,
          end: replacementRange.end,
        })
      : '';

  return specialAttributes.map((attr, index) => {
    const item: CompletionItem = {
      label: attr.label, // Keep :for in label for display
      kind: CompletionItemKind.Property,
      detail: attr.detail,
      documentation: attr.documentation,
      insertTextFormat: InsertTextFormat.Snippet,
      sortText: `5${index.toString().padStart(3, '0')}`,
      filterText: typedSegment || attr.label,
    };

    if (replacementRange) {
      item.textEdit = TextEdit.replace(replacementRange, attr.insertText);
    } else {
      item.insertText = attr.insertText;
    }

    return item;
  });
}

function findSpecialAttributeReplacementRange(document: TextDocument, position: Position): Range | null {
  const text = document.getText();
  const offset = document.offsetAt(position);

  let i = offset - 1;
  while (i >= 0) {
    const ch = text[i];

    if (ch === ':') {
      return {
        start: document.positionAt(i),
        end: position,
      };
    }

    if (!/[a-zA-Z]/.test(ch)) {
      break;
    }

    i--;
  }

  return null;
}


/**
 * Check if we're in a context where special attributes should be suggested
 * Special attributes can be used on any HTML element or Phoenix component
 */
export function shouldShowSpecialAttributes(linePrefix: string): boolean {
  // Check if we're inside an opening tag (HTML or component)
  // Pattern: <tagname or <.component_name followed by whitespace and possibly other attributes
  const inHtmlTag = /<[a-zA-Z][a-zA-Z0-9]*\s+[^>]*$/.test(linePrefix);
  const inComponentTag = /<\.[a-z_][a-z0-9_]*\s+[^>]*$/.test(linePrefix);

  return inHtmlTag || inComponentTag;
}
