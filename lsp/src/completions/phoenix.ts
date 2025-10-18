import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';

// Phoenix LiveView specific attributes
const phoenixAttributes = [
  // Event Bindings
  {
    label: 'phx-click',
    detail: 'Trigger an event on click',
    documentation: 'Binds a click event to send a message to the LiveView server.',
    insertText: 'phx-click="${1:event_name}"',
  },
  {
    label: 'phx-change',
    detail: 'Trigger an event on form input change',
    documentation: 'Binds a change event for form inputs.',
    insertText: 'phx-change="${1:event_name}"',
  },
  {
    label: 'phx-submit',
    detail: 'Trigger an event on form submit',
    documentation: 'Binds a submit event for forms.',
    insertText: 'phx-submit="${1:event_name}"',
  },
  {
    label: 'phx-blur',
    detail: 'Trigger an event when element loses focus',
    documentation: 'Binds a blur event.',
    insertText: 'phx-blur="${1:event_name}"',
  },
  {
    label: 'phx-focus',
    detail: 'Trigger an event when element gains focus',
    documentation: 'Binds a focus event.',
    insertText: 'phx-focus="${1:event_name}"',
  },
  {
    label: 'phx-window-keydown',
    detail: 'Trigger an event on window keydown',
    documentation: 'Binds a keydown event at the window level.',
    insertText: 'phx-window-keydown="${1:event_name}"',
  },
  {
    label: 'phx-window-keyup',
    detail: 'Trigger an event on window keyup',
    documentation: 'Binds a keyup event at the window level.',
    insertText: 'phx-window-keyup="${1:event_name}"',
  },
  {
    label: 'phx-key',
    detail: 'Filter key events by key name',
    documentation: 'Filters key events to only trigger on specific keys.',
    insertText: 'phx-key="${1:Enter}"',
  },

  // Target & Throttle
  {
    label: 'phx-target',
    detail: 'Specify the event target',
    documentation: 'Specifies which LiveView component should handle the event.',
    insertText: 'phx-target="${1:@myself}"',
  },
  {
    label: 'phx-throttle',
    detail: 'Throttle event frequency',
    documentation: 'Throttles how often events are sent (in milliseconds).',
    insertText: 'phx-throttle="${1:1000}"',
  },
  {
    label: 'phx-debounce',
    detail: 'Debounce event frequency',
    documentation: 'Debounces events to reduce frequency (in milliseconds).',
    insertText: 'phx-debounce="${1:500}"',
  },

  // Value Bindings
  {
    label: 'phx-value-',
    detail: 'Send custom value with event',
    documentation: 'Adds a custom value parameter to the event payload.',
    insertText: 'phx-value-${1:key}="${2:value}"',
  },

  // DOM Operations
  {
    label: 'phx-update',
    detail: 'Control how content is updated',
    documentation: 'Controls DOM update strategy (replace, append, prepend, ignore).',
    insertText: 'phx-update="${1|replace,append,prepend,ignore|}"',
  },
  {
    label: 'phx-remove',
    detail: 'Remove element on update',
    documentation: 'Marks an element for removal on the next update.',
    insertText: 'phx-remove',
  },

  // Hooks
  {
    label: 'phx-hook',
    detail: 'Attach a client-side hook',
    documentation: 'Attaches a JavaScript hook for client-side interactivity.',
    insertText: 'phx-hook="${1:HookName}"',
  },

  // Feedback
  {
    label: 'phx-disable-with',
    detail: 'Show text while processing',
    documentation: 'Replaces button/input text during form submission.',
    insertText: 'phx-disable-with="${1:Processing...}"',
  },
  {
    label: 'phx-feedback-for',
    detail: 'Associate feedback with input',
    documentation: 'Associates error feedback elements with form inputs.',
    insertText: 'phx-feedback-for="${1:input_name}"',
  },

  // Viewport
  {
    label: 'phx-viewport-top',
    detail: 'Trigger event when scrolled to top',
    documentation: 'Triggers event when element enters top of viewport.',
    insertText: 'phx-viewport-top="${1:event_name}"',
  },
  {
    label: 'phx-viewport-bottom',
    detail: 'Trigger event when scrolled to bottom',
    documentation: 'Triggers event when element enters bottom of viewport.',
    insertText: 'phx-viewport-bottom="${1:event_name}"',
  },

  // Page Events
  {
    label: 'phx-page-loading',
    detail: 'Show element during page load',
    documentation: 'Controls element visibility during page transitions.',
    insertText: 'phx-page-loading',
  },
  {
    label: 'phx-connected',
    detail: 'CSS class when connected',
    documentation: 'CSS class applied when LiveView is connected.',
    insertText: 'phx-connected="${1:connected}"',
  },
  {
    label: 'phx-disconnected',
    detail: 'CSS class when disconnected',
    documentation: 'CSS class applied when LiveView is disconnected.',
    insertText: 'phx-disconnected="${1:disconnected}"',
  },

  // Links and Navigation
  {
    label: 'phx-link',
    detail: 'Create a LiveView patch link',
    documentation: 'Creates a link that patches the current LiveView.',
    insertText: 'phx-link="${1:patch}"',
  },
  {
    label: 'phx-click-away',
    detail: 'Trigger event on click outside',
    documentation: 'Triggers event when clicking outside the element.',
    insertText: 'phx-click-away="${1:event_name}"',
  },

  // Upload
  {
    label: 'phx-drop-target',
    detail: 'File drop target for uploads',
    documentation: 'Marks element as a drop target for file uploads.',
    insertText: 'phx-drop-target="${1:@uploads.${2:name}.ref}"',
  },

  // Track Static
  {
    label: 'phx-track-static',
    detail: 'Track static asset changes',
    documentation: 'Tracks static assets for live reload on changes.',
    insertText: 'phx-track-static',
  },
];

export function getPhoenixCompletions(): CompletionItem[] {
  return phoenixAttributes.map((attr, index) => ({
    label: attr.label,
    kind: CompletionItemKind.Keyword,
    detail: attr.detail,
    documentation: attr.documentation,
    insertText: attr.insertText,
    insertTextFormat: InsertTextFormat.Snippet,
    sortText: `6${index.toString().padStart(3, '0')}`,
  }));
}
