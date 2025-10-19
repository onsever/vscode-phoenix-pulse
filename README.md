<p align="center">
  <img src="images/logo.png" alt="Phoenix Pulse Logo" width="200"/>
</p>

<h1 align="center">Phoenix Pulse</h1>

<p align="center">
  <strong>The complete IDE companion for Phoenix LiveView development.</strong>
</p>

<p align="center">
  Phoenix Pulse provides intelligent IntelliSense, validation, and navigation for Phoenix 1.6+ and 1.7+ applications. Work faster with smart completions for components, templates, routes, and assigns—all powered by deep understanding of your Phoenix project structure.
</p>

---

## ✨ Features

### 🧩 Component Intelligence

**Completions**
- Type `<.` to see all available function components
- Autocomplete component attributes with type information
- Smart slot completions inside components (`<:slot_name>`)
- Special attribute completions (`:for`, `:if`, `:let`, `:key`)

**Diagnostics**
- ❌ Missing required attributes
- ⚠️ Unknown attributes (unless `attr :rest, :global`)
- ⚠️ Invalid attribute values (validates against `values: [...]`)
- ❌ Missing required slots
- ⚠️ Unknown slots
- ❌ Component not imported in HTML module

**Navigation**
- **F12 / Ctrl+Click** on component name → Jump to definition
- **Hover** over components → See documentation, attributes, and slots

**Example:**
```heex
<.button variant="primary" size="lg">
  <!--     ^^^^^^^ Autocomplete with valid values
              ^^^^ Validated against attr declaration -->
  Click me
</.button>
<!-- Hover shows all attributes, slots, and docs -->
```

---

### 📄 Template Features (Phoenix 1.7+)

**Completions**
- Type `render(conn, :` in controllers to see available templates
- Shows both file-based (`.heex`) and embedded (`def name(assigns)`) templates

**Diagnostics**
- ❌ Template not found in HTML module
- Suggests creating template file or embedded function

**Navigation**
- **F12 / Ctrl+Click** on `:template_name` → Jump to template file or function definition
- **Hover** → See template type, location, and module

**Supports:**
- Phoenix 1.7+ `:html` modules with `page_html/` directories
- Phoenix 1.6 `:view` modules with `templates/` directories
- `embed_templates "pattern/*"` declarations
- Function templates: `def home(assigns) do ... end`

**Example:**
```elixir
# page_controller.ex
def home(conn, _params) do
  render(conn, :home, layout: false)
  #           ^^^^^ F12 jumps to home.html.heex or def home(assigns)
  #                 Hover shows template location and type
end
```

---

### 🛣️ Route Intelligence

**Completions**
- Route helper completions: `Routes.user_path(conn, :show, id)`
- Action completions filtered by resource options (`only:`, `except:`)
- Verified route completions: `~p"/users/#{id}"`
- Parameter suggestions based on route definition

**Diagnostics**
- ❌ Route helper not found
- ⚠️ Missing required route parameters
- ❌ Verified route path not found in router
- ⚠️ Invalid route in navigation components (`<.link navigate="/invalid">`)

**Navigation**
- **F12 / Ctrl+Click** on route helper → Jump to router definition
- **F12 / Ctrl+Click** on verified route → Jump to router definition
- **Hover** → See HTTP verb, path, params, controller/LiveView, pipeline

**Example:**
```elixir
# Shows: GET /users/:id, params: id, controller: UserController, action: :show
Routes.user_path(conn, :show, user.id)
#      ^^^^^^^^^ F12 jumps to router.ex

~p"/users/#{user.id}"
# ^^^^^^^^^^^^^^^^ Validated against router, F12 jumps to definition
```

---

### 📦 Controller-Aware Assigns

**Completions**
- Type `@` in templates to see assigns from controller `render()` calls
- Schema-aware drill-down: `@user.email`, `@post.title`
- Works in both `.heex` templates and `~H` sigils in `.ex` files

**Ecto Schema Integration**
- Automatically discovers Ecto schema fields
- Shows field types in completion documentation
- Works with nested schemas via associations

**Example:**
```elixir
# user_controller.ex
def show(conn, %{"id" => id}) do
  user = Accounts.get_user!(id)
  render(conn, :show, user: user)
  #                   ^^^^ Feeds into template
end
```

```heex
<!-- show.html.heex -->
<h1><%= @user.name %></h1>
<!--    ^^^^^ Autocomplete from controller
           ^^^^^ Schema-aware: shows email, name, inserted_at, etc. -->
```

---

### ⚡ Phoenix Attributes

**Completions**
- All 29 `phx-*` attributes with rich documentation
- Event-aware: only shows `phx-click`, `phx-submit` when `handle_event` exists
- Special attributes: `:for`, `:if`, `:let`, `:key`

**Documentation**
- **Hover** over `phx-click` → See usage examples, HexDocs link
- Every attribute includes code examples and best practices

**Event Completions**
- Inside `phx-click=""` → Shows available `handle_event` functions
- Shows both primary (same file) and secondary (LiveView file) events

**Example:**
```heex
<button phx-click="delete_user">
        ^^^^^^^^^ Hover shows docs with examples
                  ^^^^^^^^^^^ Autocomplete from handle_event functions
</button>
```

---

### 🔄 Stream Validation

**Smart :for Loop Validation**
- Requires `:key` attribute for regular `:for` loops
- Skips `:key` requirement for `@streams` (uses `id` from `stream/4`)
- Warns if you add `:key` to stream iteration (unnecessary)

**Example:**
```heex
<!-- Regular :for - needs :key -->
<div :for={user <- @users} :key={user.id}>
  <%= user.name %>
</div>

<!-- Stream - no :key needed -->
<div :for={{dom_id, user} <- @streams.users} id={dom_id}>
  <%= user.name %>
</div>
```

---

### 🔍 Go-to-Definition (F12)

**Works for:**
- ✅ Component names (`<.button>`)
- ✅ Slot names (`<:actions>`)
- ✅ Template atoms (`:home` in `render(conn, :home)`)
- ✅ Route helpers (`Routes.user_path`)
- ✅ Verified routes (`~p"/users"`)

**Usage:**
- Press **F12** on any of the above
- **Ctrl+Click** (Cmd+Click on Mac)
- Right-click → **Go to Definition**

---

### 💡 Hover Information

**Shows documentation for:**
- ✅ Components (attributes, slots, docs)
- ✅ Component attributes (type, required, default, values)
- ✅ Phoenix attributes (`phx-*` with examples)
- ✅ Templates (type, location, module)
- ✅ Routes (verb, path, params, controller, pipeline)
- ✅ Events (function signature, location)
- ✅ JS commands (`JS.push`, `JS.show`, etc.)

---

## 🚀 Installation

### From VSIX (Current)
```bash
code --install-extension phoenix-pulse-0.1.9.vsix
```

### From VS Code Marketplace (Coming Soon)
Search for "Phoenix Pulse" in the Extensions view.

---

## ⚙️ Configuration

**No settings required!** Phoenix Pulse works out of the box.

### Optional: Enhanced Experience

For the best experience, add to your VS Code `settings.json`:

```json
{
  // Enable Emmet in HEEx files
  "emmet.includeLanguages": {
    "phoenix-heex": "html"
  },

  // Enable Tailwind CSS IntelliSense
  "tailwindCSS.includeLanguages": {
    "phoenix-heex": "html"
  },

  // Reduce noise from ElixirLS in HEEx templates
  "[phoenix-heex]": {
    "editor.wordBasedSuggestions": "off"
  },

  "elixirLS.suggestSpecs": false,
  "elixirLS.signatureAfterComplete": false
}
```

---

## 📋 Requirements

- **VS Code** 1.75.0 or higher
- **Phoenix** 1.6+ or 1.7+ project
- **Elixir** files using `.ex`, `.exs`, `.heex` extensions

---

## 🎯 Supported Phoenix Versions

| Feature | Phoenix 1.6 | Phoenix 1.7+ |
|---------|-------------|--------------|
| Components | ✅ | ✅ |
| Templates (`:view`) | ✅ | ✅ |
| Templates (`:html`) | - | ✅ |
| Routes | ✅ | ✅ |
| Verified Routes (`~p`) | - | ✅ |
| LiveView | ✅ | ✅ |
| Ecto Schemas | ✅ | ✅ |

---

## 🏗️ How It Works

Phoenix Pulse uses a **Language Server Protocol (LSP)** implementation that:

1. **Scans your workspace** on load to build registries of components, routes, schemas, templates, and events
2. **Updates incrementally** via file watchers when you edit code
3. **Provides context-aware completions** based on cursor position
4. **Validates in real-time** using Phoenix and LiveView conventions
5. **Caches intelligently** for fast responses (< 10ms for most operations)

**Registries maintained:**
- ComponentsRegistry (components, attributes, slots)
- TemplatesRegistry (templates from HTML modules)
- RouterRegistry (routes, helpers, pipelines)
- SchemaRegistry (Ecto schema fields)
- EventsRegistry (handle_event, handle_info)
- ControllersRegistry (render calls, assigns)

---

## 📊 Performance

Phoenix Pulse is designed for speed:

- **Startup**: ~100-500ms workspace scan (depends on project size)
- **Completions**: < 10ms response time (cached)
- **Diagnostics**: Debounced 500ms after typing stops
- **Go-to-definition**: < 10ms (cached lookups)

**Large projects**: Tested with 100+ components, 200+ routes, no performance issues.

---

## 🐛 Troubleshooting

### Completions not working?
1. Make sure you're in a Phoenix project (has `mix.exs`)
2. Check "Phoenix Pulse" output channel for errors
3. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

### Template features not working?
- Ensure your HTML module uses `use YourAppWeb, :html` (Phoenix 1.7)
- Or `use YourAppWeb, :view` (Phoenix 1.6)
- Check that controller module name matches convention (`PageController` → `PageHTML`)

### Routes not showing?
- Make sure `router.ex` is in your project
- Routes are scanned from files matching `*_web/router.ex`

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Architecture overview
- Testing guidelines
- PR workflow

---

## 📝 Changelog

### v0.1.9 (2025-10-19)

**Template Features:**
- ✅ Template completions for `render(conn, :template)`
- ✅ Template validation (errors for missing templates)
- ✅ Go-to-definition for templates (F12 on `:home`)
- ✅ Hover documentation for templates
- ✅ Phoenix 1.7+ `:html` module support
- ✅ Function template support (`def name(assigns)`)
- ✅ Namespace-aware (handles `RaffleyWeb.PageController`)

**Route Features:**
- ✅ Route hover documentation
- ✅ Route go-to-definition
- ✅ Route validation (helpers, verified routes, params)
- ✅ Resource action filtering (`only:`, `except:`)
- ✅ Live routes, forward routes, pipeline tracking

**Bug Fixes:**
- ✅ Fixed stream validation conflict (`:for` + `@streams`)
- ✅ Fixed duplicate templates in completions
- ✅ Fixed namespace extraction (content vs file path)
- ✅ Fixed atom detection (F12/hover works anywhere in `:atom`)

---

## 📄 License

MIT License - See [LICENSE](LICENSE.txt) for details.

---

## 💖 Credits

Built with ❤️ for the Phoenix community.

Inspired by the amazing Phoenix framework, LiveView, and the developers pushing Elixir web development forward.

**Enjoy the pulse!** 💥
