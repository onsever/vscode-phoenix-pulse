import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';

/**
 * Phoenix.LiveView.JS command completions
 * These commands provide client-side JavaScript utilities for LiveView
 * Based on: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.JS.html
 */

export interface JSCommand {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
  isChainable: boolean; // Can be used in a pipe chain
}

const jsCommands: JSCommand[] = [
  // Visibility Commands
  {
    label: 'JS.show',
    detail: 'Show element(s) with optional transitions',
    documentation: `Shows element(s) selected by CSS selector with optional transition effects.

Example:
  JS.show("#modal")
  JS.show("#modal", transition: "fade-in", time: 300)

Options:
  - transition: CSS class for transition effect
  - time: Duration in milliseconds
  - display: CSS display value (default: "block")`,
    insertText: 'JS.show("${1:#selector}"${2:, transition: "${3:fade-in}", time: ${4:300}})',
    isChainable: true,
  },
  {
    label: 'JS.hide',
    detail: 'Hide element(s) with optional transitions',
    documentation: `Hides element(s) selected by CSS selector with optional transition effects.

Example:
  JS.hide("#modal")
  JS.hide("#modal", transition: "fade-out", time: 300)

Options:
  - transition: CSS class for transition effect
  - time: Duration in milliseconds`,
    insertText: 'JS.hide("${1:#selector}"${2:, transition: "${3:fade-out}", time: ${4:300}})',
    isChainable: true,
  },
  {
    label: 'JS.toggle',
    detail: 'Toggle element visibility',
    documentation: `Toggles visibility of element(s) selected by CSS selector.

Example:
  JS.toggle("#dropdown")
  JS.toggle("#dropdown", in: "fade-in", out: "fade-out", time: 300)

Options:
  - in: CSS class for showing transition
  - out: CSS class for hiding transition
  - time: Duration in milliseconds
  - display: CSS display value when shown`,
    insertText: 'JS.toggle("${1:#selector}"${2:, in: "${3:fade-in}", out: "${4:fade-out}", time: ${5:300}})',
    isChainable: true,
  },

  // Class Manipulation
  {
    label: 'JS.add_class',
    detail: 'Add CSS class(es) to element(s)',
    documentation: `Adds one or more CSS classes to element(s).

Example:
  JS.add_class("#button", "active")
  JS.add_class(".card", "highlight pulse")

Options:
  - transition: CSS class for transition effect
  - time: Duration in milliseconds`,
    insertText: 'JS.add_class("${1:#selector}", "${2:class-name}"${3:, transition: "${4:transition}", time: ${5:300}})',
    isChainable: true,
  },
  {
    label: 'JS.remove_class',
    detail: 'Remove CSS class(es) from element(s)',
    documentation: `Removes one or more CSS classes from element(s).

Example:
  JS.remove_class("#button", "active")
  JS.remove_class(".card", "highlight pulse")

Options:
  - transition: CSS class for transition effect
  - time: Duration in milliseconds`,
    insertText: 'JS.remove_class("${1:#selector}", "${2:class-name}"${3:, transition: "${4:transition}", time: ${5:300}})',
    isChainable: true,
  },
  {
    label: 'JS.toggle_class',
    detail: 'Toggle CSS class(es) on element(s)',
    documentation: `Toggles one or more CSS classes on element(s).

Example:
  JS.toggle_class("#menu", "open")
  JS.toggle_class(".theme-toggle", "dark-mode")

Options:
  - transition: CSS class for transition effect
  - time: Duration in milliseconds`,
    insertText: 'JS.toggle_class("${1:#selector}", "${2:class-name}"${3:, transition: "${4:transition}", time: ${5:300}})',
    isChainable: true,
  },

  // Attribute Manipulation
  {
    label: 'JS.set_attribute',
    detail: 'Set attribute on element(s)',
    documentation: `Sets an attribute value on element(s).

Example:
  JS.set_attribute("#input", {"disabled", "disabled"})
  JS.set_attribute(".tab", {"aria-selected", "true"})`,
    insertText: 'JS.set_attribute("${1:#selector}", {"${2:attribute}", "${3:value}"})',
    isChainable: true,
  },
  {
    label: 'JS.remove_attribute',
    detail: 'Remove attribute from element(s)',
    documentation: `Removes an attribute from element(s).

Example:
  JS.remove_attribute("#input", "disabled")
  JS.remove_attribute(".tab", "aria-selected")`,
    insertText: 'JS.remove_attribute("${1:#selector}", "${2:attribute}")',
    isChainable: true,
  },

  // Transition
  {
    label: 'JS.transition',
    detail: 'Apply CSS transition to element(s)',
    documentation: `Applies a CSS transition to element(s).

Example:
  JS.transition("#card", "fade-in-scale")
  JS.transition(".item", "slide-in", time: 500)

Options:
  - time: Duration in milliseconds`,
    insertText: 'JS.transition("${1:#selector}", "${2:transition-class}"${3:, time: ${4:300}})',
    isChainable: true,
  },

  // Focus
  {
    label: 'JS.focus',
    detail: 'Focus element',
    documentation: `Sets focus to the first element matching the selector.

Example:
  JS.focus("#search-input")
  JS.focus("#modal input[type='text']")`,
    insertText: 'JS.focus("${1:#selector}")',
    isChainable: true,
  },
  {
    label: 'JS.focus_first',
    detail: 'Focus first focusable element',
    documentation: `Sets focus to the first focusable element within the selector.

Example:
  JS.focus_first("#form")
  JS.focus_first("#modal")`,
    insertText: 'JS.focus_first("${1:#selector}")',
    isChainable: true,
  },

  // Server Communication
  {
    label: 'JS.push',
    detail: 'Push event to server',
    documentation: `Pushes an event to the server (handle_event callback).

Example:
  JS.push("save")
  JS.push("update", value: %{id: 1, name: "Item"})
  JS.push("delete", target: "#item-\#{id}")

Options:
  - value: Map of values to send
  - target: Component target (default: current LiveView)
  - loading: Element selector to disable during request
  - page_loading: Show page loading state`,
    insertText: 'JS.push("${1:event-name}"${2:, value: %{${3:key}: ${4:value}\\}})',
    isChainable: true,
  },

  // Navigation
  {
    label: 'JS.navigate',
    detail: 'Navigate to URL (full page load)',
    documentation: `Navigates to a URL with a full page reload.

Example:
  JS.navigate("/users")
  JS.navigate("/posts/1")
  JS.navigate(~p"/dashboard")

Use JS.patch for LiveView navigation without reload.`,
    insertText: 'JS.navigate("${1:/path}")',
    isChainable: true,
  },
  {
    label: 'JS.patch',
    detail: 'Patch LiveView (no page reload)',
    documentation: `Patches the current LiveView without a full page reload.

Example:
  JS.patch("/users?page=2")
  JS.patch(~p"/posts/\#{@post.id}/edit")

Use this for LiveView navigation to maintain state.`,
    insertText: 'JS.patch("${1:/path}")',
    isChainable: true,
  },

  // DOM Events
  {
    label: 'JS.dispatch',
    detail: 'Dispatch custom DOM event',
    documentation: `Dispatches a custom DOM event from element(s).

Example:
  JS.dispatch("click", to: "#button")
  JS.dispatch("custom:event", to: "#container", detail: %{data: "value"})

Options:
  - to: Target selector
  - detail: Event detail data
  - bubbles: Allow event to bubble (default: true)`,
    insertText: 'JS.dispatch("${1:event-name}", to: "${2:#selector}"${3:, detail: %{${4:key}: ${5:value}\\}})',
    isChainable: true,
  },

  // Exec (Advanced)
  {
    label: 'JS.exec',
    detail: 'Execute custom JavaScript',
    documentation: `Executes custom JavaScript code.

Example:
  JS.exec("console.log", to: "#element")

Note: Use sparingly. Prefer built-in JS commands when possible.
The "to" option specifies the element(s) to operate on.`,
    insertText: 'JS.exec("${1:js-function}", to: "${2:#selector}")',
    isChainable: true,
  },
];

/**
 * Get JS command completions for use in phx-* attribute values
 */
export function getJSCommandCompletions(): CompletionItem[] {
  return jsCommands.map((cmd, index) => ({
    label: cmd.label,
    kind: CompletionItemKind.Function,
    detail: cmd.detail,
    documentation: cmd.documentation,
    insertText: cmd.insertText,
    insertTextFormat: InsertTextFormat.Snippet,
    sortText: `1${index.toString().padStart(3, '0')}`, // Priority after event names but before HTML attrs
  }));
}

/**
 * Get chainable JS command completions (for use after pipe |>)
 */
export function getChainableJSCompletions(): CompletionItem[] {
  return jsCommands
    .filter((cmd) => cmd.isChainable)
    .map((cmd, index) => {
      // Remove "JS." prefix for chained calls
      const label = cmd.label.replace('JS.', '');
      return {
        label,
        kind: CompletionItemKind.Function,
        detail: cmd.detail,
        documentation: cmd.documentation + '\n\n(Chainable with |> operator)',
        insertText: cmd.insertText.replace('JS.', ''),
        insertTextFormat: InsertTextFormat.Snippet,
        sortText: `0${index.toString().padStart(3, '0')}`, // High priority in pipe context
      };
    });
}

/**
 * Check if the context suggests JS command usage
 */
export function isJSCommandContext(linePrefix: string): boolean {
  // Look for patterns like:
  // phx-click={JS.
  // phx-click="JS.
  // |>
  return (
    /phx-[a-z-]+\s*=\s*["{]\s*JS\./.test(linePrefix) ||
    /\|\>\s*$/.test(linePrefix)
  );
}

/**
 * Check if we're in a pipe chain context
 */
export function isPipeChainContext(linePrefix: string): boolean {
  return /\|\>\s*$/.test(linePrefix);
}
