-- Phoenix Pulse Neovim Plugin
-- Main module and setup function

local M = {}

-- Default configuration
local default_config = {
  -- Explorer UI mode: "float", "split", or "auto" (float by default, split with :PhoenixPulseExplorerSplit)
  explorer_mode = "float",

  -- Auto-open ERD in browser
  auto_open_erd = true,

  -- Keybindings (set to false to disable)
  keybindings = {
    toggle_explorer = "<leader>pp",
    show_erd = "<leader>pe",
    refresh = "<leader>pr",
  },

  -- LSP server path (auto-detected relative to plugin)
  lsp_server_path = nil,  -- Will be auto-set to ../../lsp/dist/server.js
}

-- Merged user config
M.config = {}

-- Setup function (called by user in their config)
function M.setup(user_config)
  -- Merge user config with defaults
  M.config = vim.tbl_deep_extend("force", default_config, user_config or {})

  -- Auto-detect LSP server path if not provided
  if not M.config.lsp_server_path then
    local plugin_root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h:h")
    M.config.lsp_server_path = plugin_root .. "/lsp/dist/server.js"
  end

  -- Check if LSP server exists
  if vim.fn.filereadable(M.config.lsp_server_path) == 0 then
    vim.notify(
      "[Phoenix Pulse] LSP server not found at: " .. M.config.lsp_server_path .. "\n" ..
      "Please run 'npm run compile' in the vscode-phoenix-pulse directory.",
      vim.log.levels.ERROR
    )
    return
  end

  -- Setup LSP client
  require("phoenix-pulse.lsp").setup(M.config)

  -- Setup commands
  require("phoenix-pulse.commands").setup(M.config)

  -- Setup keybindings
  if M.config.keybindings then
    local function set_keymap(key, command)
      if key and key ~= false then
        vim.keymap.set("n", key, command, { desc = "Phoenix Pulse: " .. command })
      end
    end

    set_keymap(M.config.keybindings.toggle_explorer, "<cmd>PhoenixPulseToggle<CR>")
    set_keymap(M.config.keybindings.show_erd, "<cmd>PhoenixPulseERD<CR>")
    set_keymap(M.config.keybindings.refresh, "<cmd>PhoenixPulseRefresh<CR>")
  end

  -- Plugin ready - notifications only for errors or important events
end

return M
