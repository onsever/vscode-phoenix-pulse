# Phoenix Pulse

Phoenix Pulse is the VS Code companion for modern Phoenix & LiveView apps. It keeps your HEEx, controllers, and LiveView workflows in sync with rich IntelliSense, controller-aware assigns, VerifiedRoutes completions, and diagnostics powered by Tree-sitter.

## Why Phoenix Pulse?

- **Template-first experience** – `<.component>` tags, `<:slots>`, and `~H` sigils understand your project structure, display hovers, and jump to definitions (even across embedded templates).
- **Controller aware** – `render(conn, :index, user: user)` feeds straight into your template: `@user` is suggested with schema-aware drill downs.
- **Routes on tap** – VerifiedRoutes (`~p""`) and navigation attributes (`patch`, `navigate`) complete from your routers.
- **Noise-free diagnostics** – Helpful warnings for missing assigns, slots, events, and `JS.push/2` usage while suppressing everything in comments and docs.
- **Tree-sitter ready** – The extension ships with a Tree-sitter bridge for fast, incremental parsing when you bundle the HEEx grammar.

## Configuration

No settings required. Optional tweaks:

| Setting | Purpose |
| --- | --- |
| `emmet.includeLanguages["phoenix-heex"] = "html"` | Keep Emmet working inside HEEx |
| `tailwindCSS.includeLanguages["phoenix-heex"] = "html"` | Tailwind IntelliSense support |

## Performance Tips

Phoenix Pulse uses aggressive `sortText` prioritization to ensure its completions appear first. However, when using multiple language servers (ElixirLS, Tailwind CSS, etc.), you may experience slow completion responses.

### Recommended: Configure ElixirLS for HEEx Files

Add to your VS Code `settings.json`:

```json
{
  "elixirLS.suggestSpecs": false,
  "elixirLS.signatureAfterComplete": false,
  "elixirLS.enableTestLenses": false,

  "[phoenix-heex]": {
    "editor.wordBasedSuggestions": "off"
  }
}
```

### Recommended: Optimize Tailwind CSS

If using Tailwind CSS IntelliSense, consider disabling regex scanning in HEEx files:

```json
{
  "tailwindCSS.experimental.classRegex": []
}
```

Or limit it to specific contexts if you need the regex:

```json
{
  "tailwindCSS.experimental.classRegex": [
    "class[:]\\s*\"([^\"]*)\"  // Only in class: attributes
  ]
}
```

### Why This Helps

Phoenix Pulse provides **component attributes, Phoenix directives, and controller assigns** — ElixirLS providing Elixir standard library completions inside `<.button>` tags clutters the list and slows down CTRL+SPACE. The above settings keep ElixirLS active for `.ex` files while reducing noise in HEEx templates.

## Contributing

We welcome improvements! See [CONTRIBUTING.md](CONTRIBUTING.md) for project structure, dev setup, testing, and PR workflow.

## License & Credits

Phoenix Pulse is MIT licensed. Inspired by the Phoenix community and countless LiveView projects pushing the framework forward. Enjoy the pulse! 💥
