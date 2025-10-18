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

## Contributing

We welcome improvements! See [CONTRIBUTING.md](CONTRIBUTING.md) for project structure, dev setup, testing, and PR workflow.

## License & Credits

Phoenix Pulse is MIT licensed. Inspired by the Phoenix community and countless LiveView projects pushing the framework forward. Enjoy the pulse! 💥
