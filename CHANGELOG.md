# Changelog

All notable changes to the Phoenix Pulse extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-21

### Added
- **Smart Activation**: Extension now only activates for Phoenix/Elixir projects (not in JavaScript/Python projects)
- Runtime Phoenix project detection with helpful user messaging
- LRU cache for tree-sitter parse trees (prevents memory leaks, max 200 entries)
- Phoenix dependency check in `mix.exs` for accurate project detection

### Fixed
- **Critical - Race Conditions**: Fixed race conditions in SchemaRegistry, ComponentsRegistry, and EventsRegistry that could corrupt data
- **Security - DoS Prevention**: Fixed catastrophic backtracking vulnerability in regex patterns (ReDoS attack prevention)
- **Stability - Cache Corruption**: Fixed race condition in tree-sitter incremental parsing cache
- **Performance**: Removed redundant double filesystem checks (2x speedup in file operations)
- **Memory**: Tree-sitter cache now bounded to 200 entries (~10MB max, previously unbounded)
- Depth counting bug in ControllersRegistry (incorrect handling of inline `do:` vs block `do`)
- Namespace fallback bug creating invalid module names (e.g., `.User` instead of `User`)
- Infinite loop risk in `parseAttributes` when parsing malformed HEEx input
- Unbounded backward search in `:for` loop parser (now limited to 50 lines)
- Type confusion in definitions cache
- Scope mutation in RouterRegistry (now uses immutable updates)

### Changed
- **Activation Strategy**: Changed from `*` (all workspaces) to Phoenix/Elixir-specific triggers
  - `onLanguage:elixir` - Activates when opening .ex/.exs files
  - `onLanguage:phoenix-heex` - Activates when opening .heex files
  - `workspaceContains:mix.exs` - Activates if Elixir project detected
- Search strategy: Character-based → Line-based (max 50 lines, more efficient)
- Registry updates: Mutable patterns → Immutable patterns throughout codebase
- Cache strategy: Unbounded Map → LRU cache with automatic eviction
- Registry lifecycle: Standardized patterns across all registries for consistency

### Technical Details
- Fixed 16 total bugs across all priority levels (3 critical, 3 high, 5 medium, 5 low)
- Implemented atomic swap pattern for registry updates (prevents race conditions)
- Added bounded repetition `{1,100}` to regex patterns (DoS protection)
- All tests passing: 140/140 (100% success rate)
- Zero regressions introduced
- Improved code consistency and maintainability across registries
- LSP specification compliance documented (UTF-16 positions)

### Developer Notes
- All registry patterns now follow consistent lifecycle (prevents future bugs)
- Comprehensive session documentation added for maintenance
- Clean git history with well-structured commits

---

## [1.0.0] - 2025-10-XX

Initial release.

- Phoenix LiveView HEEx language support
- Smart component completions
- Controller-aware assigns
- Phoenix route helpers
- Diagnostics and validation
- Go-to-definition support
- Tree-sitter powered parsing
