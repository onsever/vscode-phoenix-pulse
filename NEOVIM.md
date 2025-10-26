# Phoenix Pulse for Neovim

Complete Neovim plugin providing intelligent IDE tooling for Phoenix LiveView development. Uses the same LSP server as the VS Code extension.

## Features

✅ **LSP Features** (via Language Server)
- Component completions (`<.button`, attrs, slots)
- Schema completions (`@user.`, associations drill-down)
- Route completions (`~p"/users"`, verified routes)
- Event completions (`phx-click="save"`)
- Diagnostics (missing attrs, invalid values, etc.)
- Hover documentation
- Go-to-definition (F12 on components)

✅ **Project Explorer** (UI Features)
- Tree view of schemas, components, routes, events, LiveViews
- Hierarchical details: expand schemas (fields/associations), components (attrs/slots)
- LiveViews organized by folder with function lifecycle tracking
- Project statistics showing totals and top schemas
- Real-time search/filter functionality across all items
- Context-aware copy commands (y to copy names, paths, etc.)
- Toggle between floating window and split sidebar
- Jump to definition

✅ **ERD Diagram Viewer**
- Visual Entity Relationship Diagram
- Shows schemas with relationships
- Auto-opens in browser with Mermaid.js

## Prerequisites

- **Neovim 0.8+** (tested on 0.9 and 0.10)
- **Node.js 16+** (for LSP server)
- **nvim-lspconfig** plugin
- **nvim-web-devicons** (optional, for icons)

## Installation

### Step 1: Compile the LSP Server

The Neovim plugin uses the same LSP server as VS Code. Build it once:

```bash
cd vscode-phoenix-pulse
npm install
npm run compile
```

This creates `lsp/dist/server.js` which the plugin will use.

### Step 2: Install the Plugin

#### LazyVim / lazy.nvim

Create `~/.config/nvim/lua/plugins/phoenix-pulse.lua`:

```lua
return {
  {
    dir = "~/vscode-phoenix-pulse/nvim",  -- Adjust path to your clone
    dependencies = {
      "neovim/nvim-lspconfig",
      "nvim-tree/nvim-web-devicons",  -- Optional
    },
    ft = { "elixir", "heex", "eelixir" },
    config = function()
      require("phoenix-pulse").setup({
        explorer_mode = "float",  -- or "split"
        auto_open_erd = true,
        keybindings = {
          toggle_explorer = "<leader>pp",
          show_erd = "<leader>pe",
          refresh = "<leader>pr",
        },
      })
    end,
  }
}
```

#### NvChad

Add to `~/.config/nvim/lua/custom/plugins.lua`:

```lua
local plugins = {
  {
    "phoenix-pulse",
    dir = "~/vscode-phoenix-pulse/nvim",
    dependencies = {
      "neovim/nvim-lspconfig",
      "nvim-tree/nvim-web-devicons",
    },
    ft = { "elixir", "heex", "eelixir" },
    config = function()
      require("phoenix-pulse").setup()
    end,
  },
}
return plugins
```

#### Packer.nvim

```lua
use {
  "~/vscode-phoenix-pulse/nvim",
  requires = { "neovim/nvim-lspconfig" },
  ft = { "elixir", "heex", "eelixir" },
  config = function()
    require("phoenix-pulse").setup()
  end
}
```

#### Vanilla Neovim

Add to `~/.config/nvim/init.lua`:

```lua
-- Add plugin to runtimepath
vim.opt.runtimepath:append("~/vscode-phoenix-pulse/nvim")

-- Setup plugin
require("phoenix-pulse").setup()
```

### Step 3: Restart Neovim

```bash
nvim
```

You should see: `[Phoenix Pulse] Plugin loaded successfully!`

## Configuration

### Default Configuration

```lua
require("phoenix-pulse").setup({
  -- Explorer UI mode: "float" (popup) or "split" (sidebar)
  explorer_mode = "float",

  -- Auto-open ERD diagram in browser
  auto_open_erd = true,

  -- Keybindings (set to false to disable)
  keybindings = {
    toggle_explorer = "<leader>pp",
    show_erd = "<leader>pe",
    refresh = "<leader>pr",
  },

  -- LSP server path (auto-detected, usually don't need to set)
  lsp_server_path = nil,
})
```

### Custom Configuration Example

```lua
require("phoenix-pulse").setup({
  explorer_mode = "split",  -- Always use sidebar
  keybindings = {
    toggle_explorer = "<C-e>",  -- Ctrl+E to toggle explorer
    show_erd = "<C-d>",         -- Ctrl+D for diagram
    refresh = false,             -- Disable refresh keybinding
  },
})
```

## Commands

### Project Explorer

- `:PhoenixPulseToggle` - Toggle project explorer
- `:PhoenixPulseExplorerFloat` - Open as floating window
- `:PhoenixPulseExplorerSplit` - Open as split sidebar
- `:PhoenixPulseRefresh` - Refresh explorer data

### ERD Diagram

- `:PhoenixPulseERD` - Generate and open ERD in browser
- `:PhoenixPulseERDMermaid` - Generate `phoenix-erd.mmd` file only

### Data Commands

- `:PhoenixPulseSchemas` - List all Ecto schemas
- `:PhoenixPulseComponents` - List all Phoenix components
- `:PhoenixPulseRoutes` - List all routes
- `:PhoenixPulseEvents` - List all LiveView events

## Keybindings

### LSP Keybindings (Auto-set)

- `gd` - Go to definition
- `K` - Show hover documentation
- `gi` - Go to implementation
- `<C-k>` - Show signature help
- `<leader>rn` - Rename symbol
- `<leader>ca` - Code actions
- `gr` - Show references

### Explorer Keybindings (In Explorer Window)

- `<CR>` or `<Space>` - Expand/collapse item or jump to definition
- `/` - Search/filter items (real-time filtering)
- `x` - Clear search filter
- `y` - Open copy menu (context-aware options)
- `r` - Refresh explorer data
- `za` - Toggle current item
- `zM` - Collapse all categories
- `zR` - Expand all categories
- `?` - Show help
- `q` or `<Esc>` - Close explorer

## Usage

### Opening the Project Explorer

Default keybinding: `<leader>pp`

Or run: `:PhoenixPulseToggle`

The explorer shows:
```
📦 Phoenix Pulse Explorer
  💡 <CR>: open | r: refresh | /: search | x: clear | y: copy | ?: help

📊 Project Statistics
  📈 12 Schemas, 24 Components, 35 Routes, 18 Events, 8 LiveViews
  🏆 Top Schemas:
    User (15 fields)
    Post (12 fields)
    Comment (8 fields)

▼ 📊 Schemas (12)
  ▼ 📄 User
    ▼ 📋 Fields (10)
      📄 id: integer
      📄 email: string
      📄 name: string
    ▼ 🔗 Associations (5)
      🔗 has_many :posts → Post
      🔗 has_many :comments → Comment

▼ 🧩 Components (24)
  ▼ 🧱 button
    ⚙️ type: :string (required, values: primary, secondary)
    ⚙️ size: :string (default: md)
    🎰 :inner_block (required)

▼ 🛣️ Routes (35)
  ➡️ GET /users
  ➡️ POST /users

▼ ⚡ Events (18)
  🔔 save
  🔔 delete

▼ 🔴 LiveViews (8)
  ▼ 📁 UserLive (3 modules)
    ▼ 📄 IndexLive (4 functions)
      🔵 mount
      🔵 handle_params
      ⚡ handle_event "delete"
      📝 render
```

**Actions:**
- Press `<CR>` or `<Space>` to expand/collapse or jump to definition
- Press `/` to search/filter items
- Press `x` to clear search
- Press `y` to open copy menu
- Press `r` to refresh data
- Press `?` for help
- Press `q` to close

### Viewing ERD Diagram

Default keybinding: `<leader>pe`

Or run: `:PhoenixPulseERD`

This will:
1. Fetch all schemas from LSP
2. Generate Mermaid ERD diagram
3. Create HTML file with Mermaid.js
4. Auto-open in your default browser

The diagram shows:
- Table names (e.g., `users`, `posts`)
- Relationships with arrows
- Fields with types (PK, FK markers)
- Elixir module names in comments

### Using LSP Features

All LSP features work automatically when editing `.ex`, `.exs`, or `.heex` files in a Phoenix project:

**Completions:**
```heex
<.button█  ← Shows button component with attrs
@user.█    ← Shows User schema fields
~p"/█      ← Shows route completions
```

**Diagnostics:**
```heex
<.button color="invalid">  ← Error: Invalid value for color
<.button>                  ← Error: Missing required attr: type
```

**Hover Documentation:**
Hover over `<.button>` to see component documentation

**Go-to-Definition:**
Press `gd` on `<.button>` to jump to component definition

## Troubleshooting

### Plugin Not Loading

**Error:** `[Phoenix Pulse] LSP server not found`

**Fix:** Compile the LSP server:
```bash
cd vscode-phoenix-pulse
npm run compile
```

Verify `lsp/dist/server.js` exists.

### No Completions

**Check if LSP is running:**
```vim
:lua vim.print(vim.lsp.get_active_clients())
```

You should see `phoenix_pulse` in the list.

**Check logs:**
```vim
:lua vim.cmd('e ' .. vim.lsp.get_log_path())
```

### Explorer Shows Empty Data

**Try manual refresh:**
```vim
:PhoenixPulseRefresh
```

**Check LSP connection:**
```vim
:PhoenixPulseSchemas
```

If this shows data, the LSP works but explorer needs refresh.

### ERD Not Opening

**Check browser command:**
- macOS: Uses `open`
- Linux: Uses `xdg-open`
- Windows: Uses `start`

**Manual open:**
```bash
# The HTML file is saved to /tmp/phoenix-pulse-erd-*.html
xdg-open /tmp/phoenix-pulse-erd-*.html
```

### Icons Not Showing

**Install nvim-web-devicons:**
```lua
-- For lazy.nvim
{ "nvim-tree/nvim-web-devicons" }
```

Without devicons, the plugin falls back to text icons like `[S]`, `[C]`, `[R]`.

## Comparison with VS Code Extension

| Feature | VS Code | Neovim |
|---------|---------|--------|
| LSP Features | ✅ | ✅ |
| Completions | ✅ | ✅ |
| Diagnostics | ✅ | ✅ |
| Hover | ✅ | ✅ |
| Go-to-Definition | ✅ | ✅ |
| Project Explorer | ✅ (TreeView) | ✅ (Float/Split) |
| ERD Diagram | ✅ (Webview) | ✅ (Browser) |
| File Watching | ✅ | ✅ |

**Both use the same LSP server** - 100% feature parity!

## Contributing

Found a bug? Have a feature request?

Open an issue: https://github.com/onsever/vscode-phoenix-pulse/issues

## License

Same license as Phoenix Pulse (check main README.md)

## Credits

Neovim plugin created to extend Phoenix Pulse to the Neovim ecosystem while sharing the same LSP server implementation.
