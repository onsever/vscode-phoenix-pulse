# Phoenix Pulse

Phoenix Pulse is the VS Code companion for modern Phoenix & LiveView apps. It keeps your HEEx, controllers, and LiveView workflows in sync with rich IntelliSense, controller-aware assigns, VerifiedRoutes completions, and diagnostics powered by Tree-sitter.

## Why Phoenix Pulse?

- **Template-first experience** – `<.component>` tags, `<:slots>`, and `~H` sigils understand your project structure, display hovers, and jump to definitions (even across embedded templates).
- **Controller aware** – `render(conn, :index, user: user)` feeds straight into your template: `@user` is suggested with schema-aware drill downs.
- **Routes on tap** – VerifiedRoutes (`~p""`) and navigation attributes (`patch`, `navigate`) complete from your routers.
- **Noise-free diagnostics** – Helpful warnings for missing assigns, slots, events, and `JS.push/2` usage while suppressing everything in comments and docs.
- **Tree-sitter ready** – The extension ships with a Tree-sitter bridge for fast, incremental parsing when you bundle the HEEx grammar.

## Feature Highlights

| Area | Superpowers |
| --- | --- |
| **Completions** | `<.local>`, `<Namespace.remote>`, slot tags, Phoenix attributes, HTML attributes, VerifiedRoutes, controller assigns, JS commands |
| **Hovers** | Component and slot docs, attribute metadata, controller assign provenance, event signatures, Phoenix JS helpers |
| **Diagnostics** | Missing/unknown component assigns, required slots, LiveView navigation issues, invalid `JS.push/2`, suppressed in comments & `@doc` |
| **Navigation** | Go to definition for components & embedded templates, Ctrl+Click slot navigation |
| **Tooling** | VSIX packaging, Tree-sitter caching, router/schema/component registries |

### Marketplace (coming soon)
Search for **“Phoenix Pulse”** in the VS Code Marketplace and install.

### VSIX (today)
1. Grab the latest `phoenix-pulse-*.vsix` from the [releases](https://github.com/onsever/vscode-phoenix-lsp/releases).
2. Run `Extensions: Install from VSIX` in VS Code.
3. Select the downloaded file and reload the window.

## Configuration

No settings required. Optional tweaks:

| Setting | Purpose |
| --- | --- |
| `emmet.includeLanguages["phoenix-heex"] = "html"` | Keep Emmet working inside HEEx |
| `tailwindCSS.includeLanguages["phoenix-heex"] = "html"` | Tailwind IntelliSense support |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Missing completions/diagnostics | Reload window (`Developer: Reload Window`) to restart registries |
| VSIX not installing | Run `npm install` & `npm run compile` before packaging locally |
| Tree-sitter warnings | Bundle the HEEx WASM grammar or ignore – Pulse automatically falls back to regex parsing |
| Controllers not detected | Ensure files are named `*_controller.ex` and `render/3` calls use keyword assigns |

### Debug logging

Need more insight? Set an env var before launching VS Code:

```bash
PHOENIX_PULSE_DEBUG=definition code .
```

Valid flags: `definition`, `registry`, or `all`. Logs appear in the “Phoenix Pulse” output channel.

## Contributing

We welcome improvements! See [CONTRIBUTING.md](CONTRIBUTING.md) for project structure, dev setup, testing, and PR workflow.

## License & Credits

Phoenix Pulse is MIT licensed. Inspired by the Phoenix community and countless LiveView projects pushing the framework forward. Enjoy the pulse! 💥
