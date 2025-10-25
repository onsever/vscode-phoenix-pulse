<p align="center">
  <img src="images/logo.png" alt="Phoenix Pulse Logo" width="200"/>
</p>

<h1 align="center">Phoenix Pulse</h1>

<p align="center">
  <strong>The complete IDE companion for Phoenix LiveView development</strong>
</p>

<p align="center">
  <a href="#%EF%B8%8F-recommended-settings">Recommended Settings</a> •
  <a href="#-phoenix-pulse-project-explorer">Project Explorer</a> •
  <a href="#-phoenix-snippets">Phoenix Snippets</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-performance">Performance</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

Phoenix Pulse provides intelligent IntelliSense, validation, and navigation for Phoenix 1.6+ and 1.7+ applications. Work faster with smart completions for components, templates, routes, and assigns—all powered by deep understanding of your Phoenix project structure.

**Powered by Elixir's own AST parser** for 100% accurate code analysis with intelligent caching for lightning-fast performance.

---

## ⚙️ Recommended Settings

For the best experience with Phoenix Pulse, add these settings to your VS Code `settings.json`:

These settings significantly improve completion quality and responsiveness. These settings used by the developer while testing the extension:

No any other extensions for snippets and syntax highlighting is necessary for this extension to work, it's a bundle of all.

```json
{
    // My Personal Options
    "workbench.colorTheme": "Bearded Theme Arc",
    "workbench.iconTheme": "file-icons",
    "editor.fontSize": 18,
    "editor.fontFamily": "JetBrainsMono Nerd Font Mono",
    "editor.inlayHints.fontFamily": "JetBrainsMono Nerd Font Mono",
    "files.autoSave": "afterDelay",
    "editor.suggest.shareSuggestSelections": false,
    "editor.suggest.filterGraceful": false,
    "editor.suggest.showStatusBar": false,
    "extensions.verifySignature": false,
    "search.exclude": {
        "**/.elixir_ls": true,
        "**/.lexical": true,
        "**/.vscode": true,
        "**/.idea":true,
        "**/.expert":true,
        "**/deps": true,
        "**/_build": true,
        "**/.elixir-tools": true,
        "**/.claude": true
    },

    // Disable word-based suggestions to prevent pollution
    "editor.wordBasedSuggestions": "off",
    // Allow Phoenix snippets in quick suggestions
    "editor.suggest.snippetsPreventQuickSuggestions": false,
     // Instant completions (no delay)
    "editor.quickSuggestionsDelay": 0,
    // Better completion ordering
    "editor.suggest.localityBonus": true,
    // Optional: Debug Mode
    "terminal.integrated.env.linux": {"PHOENIX_PULSE_DEBUG": "parser,registry"},
    // Elixir Lexical Language Server
    "lexical.server.releasePathOverride": "path_to_start_start_lexical.sh",
}
```

> **Note:** These settings are **recommended** but not required. Phoenix Pulse works without them, but the experience is noticeably better with them.

---

## ☰ Phoenix Pulse Project Explorer

<img src="images/phoenix_pulse_explorer_menu.png" alt="Phoenix Pulse Explorer" width="auto"/>

Phoenix Pulse provides a comprehensive **Project Explorer** in the VS Code sidebar that gives you instant visibility into your entire Phoenix application structure. Click the Phoenix Pulse icon in the Activity Bar to access it.

#### Quick Navigation

- [📊 Statistics Overview](#-statistics-overview)
- [🗂️ Schemas](#️-schemas)
- [🧩 Components](#-components)
- [🛣️ Routes](#️-routes)
- [📄 Templates](#-templates)
- [⚡ LiveView](#-liveview)
- [🔍 Search & Filter](#-search--filter)
- [📋 Copy Actions](#-copy-actions)
- [♻️ Refresh](#️-refresh)

---

### 📊 Statistics Overview

Get a bird's-eye view of your Phoenix project with real-time metrics:

- **Overview** - Total counts: components, routes, schemas, templates, LiveView modules
- **Route Breakdown** - Routes grouped by HTTP verb (GET, POST, PUT, DELETE, etc.)
- **Component Metrics** - Components categorized by complexity (simple, medium, complex based on attribute count)
- **Top Schemas** - Top 5 schemas by total fields and associations

### 🗂️ Schemas

Browse all your Ecto schemas with field and association counts:

- **Expand schema** → View all fields (with types) and associations
- **Click field/association** → Jump to schema definition
- **Right-click** → Copy schema name, module name, table name, or file path

### 🧩 Components

Explore all function components grouped by file:

- **Expand component file** → See all components in that file
- **Component info** → Shows attribute and slot counts
- **Expand component** → View all attributes and slots with types
- **Click component** → Jump to component definition
- **Right-click** → Copy component name, module name, tag (`<.component>`), or file path

### 🛣️ Routes

Navigate your Phoenix router with grouped routes:

- **Routes grouped by controller** for better organization
- **Route info** → Shows HTTP verb, path, and action
- **Click route** → Jump to route definition in router
- **Right-click** → Copy route name, path, or file path

### 📄 Templates

View all templates (file-based and embedded):

- **Expand template file** → See all templates in that file
- **Template info** → Shows format (HTML, JSON, etc.)
- **Click template** → Jump to template file or function definition
- **Right-click** → Copy template name or file path

### ⚡ LiveView

**NEW in v1.2.2!** Complete visibility into your LiveView architecture:

- **LiveView modules grouped by name** (e.g., `AnalyticsLive`, `DashboardLive`, `LoginLive`)
- **Expand module** → See all lifecycle functions organized by type:
  - 🔷 **Lifecycle Functions** (blue icons)
    - `mount/3` - Component initialization
    - `handle_params/3` - URL parameter handling
    - `render/1` - Template rendering
  - 🔴 **Event Handlers** (red icons)
    - `handle_event/3` - User interactions (phx-click, phx-submit, etc.)
    - `handle_info/2` - Message handling (PubSub, timers, etc.)
- **Function count badge** - Shows total functions in each module
- **Click function** → Jump directly to function definition
- **Type-specific icons** - Visual distinction between function types:
  - `$(layers)` - mount
  - `$(link)` - handle_params
  - `$(file-code)` - render
  - `$(zap)` - handle_event
  - `$(mail)` - handle_info

**Example LiveView Module:**
```
📦 AnalyticsLive (5 functions)
  ├─ 🔷 mount (mount)
  ├─ 🔷 handle_params (handle_params)
  ├─ 🔷 render (render)
  ├─ 🔴 change_date_range (handle_event)
  └─ 🔴 refresh_data (handle_info)
```

### 🔍 Search & Filter

- **Search icon** in toolbar → Filter all sections by name, path, or action
- **Multi-word search** → Use "user admin" to find items matching both terms
- **Clear icon** → Reset filter and show all items
- **Auto-expand** → Matching categories expand automatically

### 📋 Copy Actions

Right-click any item to copy useful information to clipboard:

- **Copy Name** - The item's name (e.g., "User", "index", "save")
- **Copy Module Name** - Full module path (e.g., "MyApp.Accounts.User")
- **Copy File Path** - Absolute path to the file
- **Copy Component Tag** - Ready-to-use component tag (e.g., `<.button>`)
- **Copy Route Path** - Route path (e.g., "/api/users/:id")
- **Copy Table Name** - Database table name for schemas

### ♻️ Refresh

- **Refresh icon** in toolbar → Re-scan workspace and update all sections
- **Automatically refreshes** when you save files
- **Clears search filter** when refreshing

## ⚡ Phoenix Snippets

Phoenix Pulse includes **45+ built-in snippets** for common Phoenix and LiveView patterns. No configuration required—just start typing!

### Component Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `.live` | `<.live_component module={} id="" />` |
| `.modal` | `<.modal id="...">...</.modal>` |
| `.form` | `<.form for={@form}>...</.form>` |
| `.table` | `<.table rows={@items}>...</.table>` |
| `.link` | `<.link navigate={~p"/..."}>...</.link>` |
| `.button` | `<.button>...</.button>` |
| `.input` | `<.input field={@form[:field]} />` |

### HEEx Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `:for` | `<div :for={item <- @items}>` |
| `:if` | `<div :if={condition}>` |
| `:unless` | `<div :unless={condition}>` |
| `:let` | `:let={item}` |

### Event Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `@click` | `phx-click="event"` |
| `@submit` | `phx-submit="save"` |
| `@change` | `phx-change="validate"` |
| `@blur` | `phx-blur="event"` |
| `@focus` | `phx-focus="event"` |
| `@keydown` | `phx-keydown="event"` |
| `@keyup` | `phx-keyup="event"` |
| `@input` | `phx-input="search"` |

**Event Modifiers:** Type `@click.` to see modifiers like `target`, `debounce`, `throttle`

### Phoenix Patterns
| Trigger | Expands To |
|---------|-----------|
| `form.phx` | `<form phx-submit="save">...</form>` |
| `link.phx` | `<a phx-click="event">...</a>` |
| `btn.phx` | `<button phx-click="event">...</button>` |
| `div.loading` | `<div phx-loading>Loading...</div>` |
| `div.error` | `<div class="error">...</div>` |

### Form Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `input.text` | `<input type="text" name="" />` |
| `input.email` | `<input type="email" name="" />` |
| `input.password` | `<input type="password" name="" />` |
| `input.number` | `<input type="number" name="" />` |
| `select.phx` | `<select phx-change="event">...</select>` |
| `checkbox.phx` | `<input type="checkbox" phx-click="toggle" />` |
| `textarea.phx` | `<textarea phx-blur="save">...</textarea>` |

### Route Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `link.nav` | `<.link navigate={~p"/path"}>...</.link>` |
| `link.patch` | `<.link patch={~p"/path"}>...</.link>` |
| `a.nav` | `<a href={~p"/path"}>...</a>` |
| `a.href` | `<a href="url">...</a>` |

### Asset Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `img.static` | `<img src={~p"/images/file.jpg"} alt="" />` |
| `link.css` | `<link rel="stylesheet" href={~p"/assets/app.css"} />` |
| `script.js` | `<script src={~p"/assets/app.js"}>` |

### Layout Shortcuts
| Trigger | Expands To |
|---------|-----------|
| `.hero` | `<section class="hero">...</section>` |
| `.card` | `<div class="card">...</div>` |
| `.grid` | `<div class="grid grid-cols-3 gap-4">...</div>` |
| `.container` | `<div class="container mx-auto px-4">...</div>` |
| `.section` | `<section class="...">...</section>` |

### Stream Shortcut
| Trigger | Expands To |
|---------|-----------|
| `stream` | `<div id={id} :for={{id, item} <- @streams.items}>` |

**Note:** All snippets use tab stops (`$1`, `$2`, etc.) for quick navigation through editable fields.

---

## ✨ Features

### 🧩 Component Intelligence

**Smart Completions**
- Type `<.` to see all available function components
- Autocomplete component attributes with type information and documentation
- Slot completions (`<:slot_name>`) with attribute suggestions
- Special attribute completions (`:for`, `:if`, `:let`, `:key`)

**Real-Time Validation**
- ❌ Missing required attributes
- ⚠️ Unknown attributes (respects `attr :rest, :global`)
- ⚠️ Invalid attribute values (validates against `values: [...]` constraints)
- ❌ Missing required slots with nested slot support
- ❌ Component not imported in HTML module

**Navigation & Documentation**
- **F12 / Ctrl+Click** on component name → Jump to definition
- **Hover** over components → See full documentation, attributes, slots, and usage examples
- Works with nested components and function clauses (pattern matching)

**Example:**
```heex
<.input
  field={@form[:email]}
  type="email"
  label="Email Address"
  required
/>
<!-- All attributes validated, autocompleted, and documented -->
```

---

### 📄 Template Features (Phoenix 1.7+)

**Template Completions**
- Type `render(conn, :` in controllers to see available templates
- Shows both file-based (`.heex`) and embedded function templates
- Template suggestions include location and type information

**Template Validation**
- ❌ Template not found in HTML module
- Suggests creating template file or embedded function
- Validates template name conventions

**Navigation**
- **F12 / Ctrl+Click** on `:template_name` → Jump to template file or function definition
- **Hover** → See template type, file location, and parent module
- Supports both Phoenix 1.6 (`:view`) and 1.7+ (`:html`) patterns

**Supported Template Types:**
- File-based templates: `page_html/home.html.heex`
- Embedded templates: `def home(assigns) do ~H"""...""" end`
- `embed_templates "pattern/*"` declarations
- Template deduplication (prevents duplicates from multiple discovery methods)

---

### 🛣️ Route Intelligence

**Comprehensive Router Support**
- ✅ All HTTP verbs (`get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `match`)
- ✅ Phoenix 1.7 verified routes (`~p"/users/#{user.id}"`)
- ✅ Nested resources with proper path generation
- ✅ Singleton resources (`singleton: true`)
- ✅ Custom parameter names (`param: "slug"`)
- ✅ Live routes and forward routes
- ✅ Resource action filtering (`only:`, `except:`)
- ✅ Pipeline tracking and scope management

**Smart Completions**
- Route helper completions with parameter hints
- Action completions filtered by resource options
- Verified route path completions
- Navigation component route validation

**Diagnostics**
- ❌ Route helper not found in router
- ⚠️ Missing required route parameters
- ❌ Verified route path doesn't exist
- ⚠️ Invalid navigation paths in `<.link>` components

**Navigation & Documentation**
- **F12 / Ctrl+Click** on route helpers or verified routes → Jump to router definition
- **Hover** → See HTTP verb, full path, parameters, controller/LiveView, and pipeline

**Example:**
```elixir
# Nested resources
resources "/users", UserController do
  resources "/posts", PostController
end
# Generates: /users/:user_id/posts/:id
# Helper: user_post_path(conn, :show, user_id, post_id)

# Verified routes (Phoenix 1.7+)
~p"/users/#{user.id}/posts/#{post.id}"
# Validated against router, F12 jumps to definition
```

---

### 📦 Controller-Aware Assigns

**Schema-Aware Completions**
- Type `@` in templates to see assigns passed from controller `render()` calls
- Drill down into Ecto schemas: `@user.email`, `@post.author.name`
- Works in both `.heex` templates and `~H` sigils in `.ex` files
- Detects `has_many` associations and suggests `:for` loop patterns

**Ecto Schema Integration**
- Automatically discovers all Ecto schema fields and associations
- Shows field types in completion documentation
- Resolves `belongs_to`, `has_one`, `has_many`, and `many_to_many` associations
- Handles schema aliases across module namespaces

**Example:**
```elixir
# user_controller.ex
def show(conn, %{"id" => id}) do
  user = Accounts.get_user!(id)
  render(conn, :show, user: user)
end
```

```heex
<!-- show.html.heex -->
<h1><%= @user.name %></h1>
<p>Email: <%= @user.email %></p>
<!-- All fields autocompleted from User schema -->
```

---

### ⚡ Phoenix Attributes & Events

**Phoenix LiveView Attributes**
- All 29 `phx-*` attributes with rich documentation
- Context-aware: `phx-click`, `phx-submit` only shown when events exist
- Hover documentation includes usage examples and HexDocs links

**Event Completions**
- Inside `phx-click=""` → Shows available `handle_event` functions
- Distinguishes between primary (same file) and secondary (LiveView) events
- Supports both string and atom event names
- Validates event name exists in LiveView module

**JS Command Support**
- `JS.push`, `JS.navigate`, `JS.patch`, `JS.show`, `JS.hide`, etc.
- Pipe chain completions: `JS.hide("#modal") |> JS.show("#toast")`
- Parameter suggestions for each command

---

### 🔄 Smart :for Loop Validation

**Context-Aware Key Requirements**
- Regular `:for` loops require `:key` attribute
- Stream iterations (`:for={{id, item} <- @streams.items}`) skip `:key` requirement
- Warns if `:key` added to stream (unnecessary, uses DOM `id`)

**:for Loop Variable Completions**
- Type inference for loop variables: `<div :for={user <- @users}>{user.█}</div>`
- Shows Ecto schema fields for loop variables
- Supports nested field access: `user.organization.name`
- Handles tuple destructuring: `{id, item} <- @streams.items`

---

### 🔍 Go-to-Definition (F12)

**Supported Navigation:**
- ✅ Component names (`<.button>`)
- ✅ Nested components (`<.icon>` inside `<.banner>`)
- ✅ Slot names (`<:actions>`, `<:header>`)
- ✅ Template atoms (`:home` in `render(conn, :home)`)
- ✅ Route helpers (`Routes.user_path`)
- ✅ Verified routes (`~p"/users"`)

**Fast & Cached:**
- First navigation: ~500ms (parses file)
- Subsequent: ~1-2ms (uses cache)
- Content-based caching for instant repeat lookups

---

### 💡 Hover Information

**Rich Documentation for:**
- ✅ Components (all attributes, slots, documentation blocks)
- ✅ Component attributes (type, required status, default value, allowed values)
- ✅ Phoenix attributes (`phx-*` with examples and links)
- ✅ Templates (type, file location, module info)
- ✅ Routes (HTTP verb, full path, parameters, controller, pipeline)
- ✅ Events (`handle_event` function signature and location)
- ✅ JS commands (all `JS.*` functions with parameters)
- ✅ Schema associations (shows target schema and available fields)

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for **"Phoenix Pulse"**
4. Click **Install**

### From VSIX File

1. Download the latest `.vsix` from [GitHub Releases](https://github.com/onsever/vscode-phoenix-pulse/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Install from VSIX" and select the command
5. Choose the downloaded `.vsix` file

### Manual Installation

```bash
# Download the VSIX file, then:
code --install-extension phoenix-pulse-1.2.0.vsix

# Reload VS Code window
# Ctrl+Shift+P → "Developer: Reload Window"
```

---

## ⚙️ Configuration

**Phoenix Pulse works out of the box with zero configuration required!**

### Recommended VS Code Settings

For the best development experience, add these optional settings to your VS Code `settings.json`:

```json
{
  // === Phoenix Pulse Settings ===

  // Use Elixir's AST parser for 100% accurate parsing (recommended)
  "phoenixPulse.useElixirParser": true,

  // Maximum concurrent Elixir parser processes (1-20)
  // Lower values reduce CPU usage, higher values speed up workspace scans
  "phoenixPulse.parserConcurrency": 10,

  // Show progress notifications during workspace scans
  "phoenixPulse.showProgressNotifications": true,

  // === Tailwind CSS Integration ===

  // Enable Tailwind CSS IntelliSense in HEEx templates
  "tailwindCSS.includeLanguages": {
    "phoenix-heex": "html"
  },

  // Tailwind experimental features for better completion
  "tailwindCSS.experimental.classRegex": [
    ["class[:]\\s*\"([^\"]*)", "([^\"]*"]
  ],

  // === ElixirLS Integration ===

  // Reduce completion noise from ElixirLS in HEEx templates
  "[phoenix-heex]": {
    "editor.wordBasedSuggestions": "off"
  },

  // Disable ElixirLS suggestions that conflict with Phoenix Pulse
  "elixirLS.suggestSpecs": false,
  "elixirLS.signatureAfterComplete": false,

  // === Editor Settings ===

  // Format on save (requires Phoenix formatter in mix.exs)
  "editor.formatOnSave": true,

  // Auto-close tags in HEEx templates
  "editor.autoClosingTags": true
}
```

### Environment Variables

**Performance Debugging** (optional):
```bash
# Enable performance logging
export PHOENIX_LSP_DEBUG_PERF=true
code .

# Check "Phoenix Pulse" output channel for timing logs
# Example: [Perf] onCompletion: 0.8ms
```

**Force Regex Parser** (if Elixir not installed):
```bash
export PHOENIX_PULSE_USE_REGEX_PARSER=true
```

---

## 📋 Requirements

### Minimum Requirements

- **VS Code**: 1.75.0 or higher
- **Phoenix**: 1.6+ or 1.7+ project
- **Node.js**: 16+ (for LSP server)

### Recommended

- **Elixir**: 1.13+ (for accurate AST parsing)
  - Without Elixir: Falls back to regex parser (less accurate)
  - With Elixir: 100% accurate parsing with function clause support
- **Phoenix**: 1.7+ (for verified routes and `:html` modules)

### Supported File Types

- `.ex` - Elixir source files
- `.exs` - Elixir script files
- `.heex` - HEEx template files
- `~H` sigils - Embedded HEEx in `.ex` files

---

## 🚀 Performance

Phoenix Pulse is engineered for production-grade performance:

### Benchmarks

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| **Completions** | < 50ms | 0.5-2ms | Instant response while typing |
| **Hover** | < 100ms | 0.5-1ms | Documentation appears instantly |
| **Go-to-Definition (cached)** | < 50ms | 1-2ms | 357x faster after first use |
| **Go-to-Definition (first)** | < 500ms | 50-500ms | One-time parse, then cached |
| **Workspace Scan** | < 10s | 4-8s | On startup (medium projects) |

### Performance Features

**Intelligent Caching**
- Content-based caching for HEEx templates (hash-based)
- File-based caching for component definitions (mtime-based)
- LRU cache eviction (200 entries max)
- Cache hit rate: ~95% during active development

**Debounced Updates**
- Registry updates only fire 500ms after you stop typing
- No lag while typing (completions remain instant)
- Background processing doesn't block editor

**Concurrency Control**
- Maximum 10 concurrent Elixir parser processes (configurable 1-20)
- Prevents resource exhaustion and SIGTERM crashes
- Smart file filtering skips irrelevant files

**Performance Optimizations**
- Tree-sitter parsing for HEEx syntax (when available)
- Incremental file updates via watchers
- Parallel registry scanning on startup
- Smart file filtering (e.g., only `*_live.ex` for EventsRegistry)

### Performance Testing

Enable performance logging to measure real-world performance:

```bash
export PHOENIX_LSP_DEBUG_PERF=true
code /path/to/phoenix/project
```

Then check the "Phoenix Pulse" output channel for timing logs:
```
[Perf] onCompletion: 0.8ms
[Perf] onHover: 0.6ms
[Perf] onDefinition: 1.5ms (cached)
[Phoenix Pulse] Workspace scan complete in 4158ms
```

See [PERF_QUICK_START.md](PERF_QUICK_START.md) and [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) for detailed testing guides.

---

## 🎯 Supported Phoenix Versions

| Feature | Phoenix 1.6 | Phoenix 1.7+ |
|---------|-------------|--------------|
| Function Components | ✅ | ✅ |
| Component Attributes & Slots | ✅ | ✅ |
| Templates (`:view` modules) | ✅ | ✅ |
| Templates (`:html` modules) | - | ✅ |
| Verified Routes (`~p`) | - | ✅ |
| Route Helpers | ✅ | ✅ |
| LiveView Events | ✅ | ✅ |
| Ecto Schemas | ✅ | ✅ |
| Controller Assigns | ✅ | ✅ |
| Nested Resources | ✅ | ✅ |
| Singleton Resources | ✅ | ✅ |

---

## 🏗️ Architecture

Phoenix Pulse uses a **Language Server Protocol (LSP)** implementation with:

### Two-Layer Architecture

```
┌─────────────────────────────────┐
│  Extension Host (src/)          │
│  - Launches LSP client          │
│  - Registers commands           │
│  - Handles document sync        │
└──────────────┬──────────────────┘
               │ JSON-RPC
┌──────────────▼──────────────────┐
│  Language Server (lsp/src/)     │
│  - Completions                  │
│  - Hovers & Diagnostics         │
│  - Go-to-definition             │
│  - Workspace scanning           │
└─────────────────────────────────┘
```

### Registries (Stateful Indexes)

Phoenix Pulse maintains 6 specialized registries:

1. **ComponentsRegistry** - Function components, attrs, slots
2. **TemplatesRegistry** - File and embedded templates
3. **RouterRegistry** - Routes, helpers, pipelines
4. **SchemaRegistry** - Ecto schemas, fields, associations
5. **EventsRegistry** - `handle_event`, `handle_info` functions
6. **ControllersRegistry** - Render calls, assigns linking

**Update Strategy:**
- **Startup**: Full workspace scan (parallel, ~4-8s)
- **Edit**: Incremental updates (debounced 500ms)
- **Save**: File watcher triggers registry refresh

### Parsing Stack

```
Elixir AST Parser (Primary) ────► 100% accurate
         │ (Elixir installed)
         │
         └─► Fallback: Regex Parser ─► 95% accurate
                (Elixir not found)
```

**Elixir AST Parser Benefits:**
- ✅ 100% accuracy (uses Elixir's own `Code.string_to_quoted/1`)
- ✅ Handles function clauses (pattern matching)
- ✅ Multi-line declarations
- ✅ Complex default values
- ✅ Comments mid-declaration
- ✅ Future-proof (adapts to new Elixir syntax)

---

## 🐛 Troubleshooting

### Completions not working?

**Check 1: Phoenix Project Detection**
- Ensure `mix.exs` exists in workspace root
- Phoenix dependency should be in `deps`
- Check "Phoenix Pulse" output channel for "✅ Phoenix project detected!"

**Check 2: File Types**
- HEEx templates must use `.heex` extension
- Elixir files must use `.ex` or `.exs`
- Components must be in `*_web/components/` directory

**Check 3: Reload VS Code**
```
Ctrl+Shift+P → "Developer: Reload Window"
```

### Template features not working?

**Phoenix 1.7+ (`:html` modules)**
- HTML module must use: `use YourAppWeb, :html`
- Controller name must match convention: `PageController` → `PageHTML`
- Templates in `page_html/` directory or embedded functions

**Phoenix 1.6 (`:view` modules)**
- View module must use: `use YourAppWeb, :view`
- Controller name must match: `PageController` → `PageView`
- Templates in `templates/page/` directory

### Routes not showing?

**Check Router Location**
- Router file must match pattern: `*_web/router.ex`
- Standard location: `lib/my_app_web/router.ex`

**Check Router Syntax**
- Ensure `router.ex` compiles without errors
- Run `mix compile` to check for syntax errors

**Check Scope/Pipeline**
- Routes must be inside `scope` or `pipeline` blocks
- Phoenix Pulse supports nested scopes

### Performance issues?

**Enable Performance Logging**
```bash
export PHOENIX_LSP_DEBUG_PERF=true
code .
```

Check the "Phoenix Pulse" output channel for slow operations:
- **Good**: < 50ms for completions, < 100ms for hover
- **Slow**: > 200ms indicates issue

**Common Causes:**
- Very large codebase (500+ files) → Increase `phoenixPulse.parserConcurrency`
- Elixir not installed → Install Elixir for better performance
- Network drive → Use local filesystem

**Solutions:**
1. Lower concurrency: `"phoenixPulse.parserConcurrency": 5`
2. Disable progress notifications: `"phoenixPulse.showProgressNotifications": false`
3. Check Elixir is installed: `elixir --version`

### Extension not activating?

**Check VS Code Version**
```
Help → About → Check version ≥ 1.75.0
```

**Check Extension is Installed**
```
Extensions panel → Search "Phoenix Pulse" → Should show "Installed"
```

**Check Output Channel**
```
View → Output → Select "Phoenix Pulse" → Look for activation logs
```

### Still having issues?

1. **Check GitHub Issues**: https://github.com/onsever/vscode-phoenix-pulse/issues
2. **Open New Issue**: Include:
   - VS Code version
   - Phoenix version
   - Extension version
   - Logs from "Phoenix Pulse" output channel
   - Sample code that reproduces the issue

---

## 🤝 Contributing

We welcome contributions! To get started:

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/vscode-phoenix-pulse
   cd vscode-phoenix-pulse
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Make changes and test**
   ```bash
   npm run compile    # Build extension
   npm test           # Run tests
   # Press F5 in VS Code to launch Extension Development Host
   ```
5. **Submit Pull Request**

For detailed development documentation, architecture overview, and best practices, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📝 Changelog

### Recent Releases

**v1.2.0 (2025-10-25) - Performance & Stability Release** 🚀

**Major Performance Improvements:**
- ✅ **Content-based caching** for HEEx templates (357x faster go-to-definition after first use)
- ✅ **Debounced file updates** (500ms delay prevents lag while typing)
- ✅ **Cache hit rate**: ~95% during development
- ✅ Go-to-definition: 500ms → 1.5ms (cached)
- ✅ Completions remain instant: < 2ms

**Critical Bug Fixes:**
- ✅ Fixed function clause deduplication (components with pattern matching)
- ✅ Eliminated file update spam on every keystroke
- ✅ Resolved SIGTERM crashes from too many concurrent processes
- ✅ Fixed typing lag caused by unbounded registry updates

**Architecture:**
- Added `HEExContentCache` with FNV-1a hashing (100 entries, LRU)
- Implemented file watcher debouncing (500ms timeout)
- Enhanced Elixir parser to detect and skip duplicate function clauses
- Improved performance logging with detailed metrics

**v1.1.3 (2025-10-25) - HEEx Parser & Nested Components**

**Features:**
- ✅ Elixir-based HEEx parser (100% accurate nesting)
- ✅ Nested component go-to-definition support
- ✅ Function clause support for components

---

## 📄 License

MIT License - See [LICENSE](LICENSE.txt) for details.

---

## 💖 Credits

Built with ❤️ for the Phoenix community by [Onurcan Sever](https://github.com/onsever).

Inspired by the amazing Phoenix framework, LiveView, and the developers pushing Elixir web development forward.

**Special Thanks:**
- Phoenix Framework team for creating an incredible web framework
- Elixir community for continuous inspiration
- All contributors and users who provided feedback

---

<p align="center">
  <strong>Enjoy the pulse! 💥</strong>
</p>

<p align="center">
  <a href="https://github.com/onsever/vscode-phoenix-pulse">GitHub</a> •
  <a href="https://github.com/onsever/vscode-phoenix-pulse/issues">Issues</a> •
  <a href="https://marketplace.visualstudio.com/items?itemName=onsever.phoenix-pulse">VS Code Marketplace</a>
</p>
