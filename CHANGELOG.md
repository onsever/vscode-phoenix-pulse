# Changelog

All notable changes to the Phoenix Pulse extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-10-22

### Added - Router Enhancements

#### Nested Resources
- **Full support for parent-child resource relationships**
  - Generates correct nested paths: `/users/:user_id/posts/:id`
  - Proper helper naming: `user_post_path(conn, :show, user_id, post_id)`
  - Multi-level nesting supported (3+ levels deep)
  - Works with all resource options (`only:`, `except:`, `singleton:`, `param:`)

**Example:**
```elixir
resources "/users", UserController do
  resources "/posts", PostController do
    resources "/comments", CommentController
  end
end
# Generates: /users/:user_id/posts/:post_id/comments/:id
```

#### Singleton Resources
- **Support for single-instance resources without `:id` param**
  - No index action (collection view not applicable)
  - Perfect for user accounts, profiles, settings, dashboards

**Example:**
```elixir
resources "/account", AccountController, singleton: true
# Routes: GET /account (show), GET /account/edit, etc.
# No /account/:id routes
```

#### Custom Param Names
- **SEO-friendly URLs with custom parameter names**
  - Works with nested resources
  - Maintains type safety in completions

**Example:**
```elixir
resources "/articles", ArticleController, param: "slug"
# Routes use :slug instead of :id
# GET /articles/:slug, PATCH /articles/:slug, etc.
```

#### Match Routes
- **Support for `match` macro with wildcard and multiple verbs**
  - `match :*` - Catches all HTTP verbs
  - `match [:get, :post]` - Multiple specific verbs
  - Single verb: `match :options`

**Example:**
```elixir
match :*, "/catch-all", CatchAllController, :handle_any
match [:get, :post, :put, :delete], "/webhook", WebhookController, :handle
```

#### Additional HTTP Verbs
- Confirmed support for `options` and `head` verbs (already working)
- CORS preflight: `options "/cors", CorsController, :preflight`
- Health checks: `head "/health", HealthController, :check`

### Fixed

- **Resources Expansion Bug** - Fixed issue where `resources` created single entry instead of 8 RESTful routes
  - Before: Error "Route `/products/products/new` not found"
  - After: Correctly generates all 8 routes with proper paths
- **Nested Resource Scope Aliases** - Fixed duplicate scope prefix in nested resource helpers
  - Before: `admin_user_admin_post_path` (incorrect)
  - After: `admin_user_post_path` (correct)
- **Parameter Naming** - Parent params now use Phoenix convention
  - Before: `/users/:id/posts/:id` (incorrect, duplicate params)
  - After: `/users/:user_id/posts/:id` (correct, unique params)

### Tests

- Added 10 new comprehensive tests for router features
  - `nested-resources.test.ts` - 4 tests for single/multi-level nesting
  - `match-routes.test.ts` - 6 tests for match routes and verbs
- **All 150+ tests passing**
- **Zero regressions**

### Internal

- Extended `BlockEntry` type to track resource blocks with params
- Added helper functions: `getParentResources()`, `consumePendingResourceDo()`
- Added `matchPattern` regex for match route parsing
- Updated `expandResourceRoutes()` to handle singleton and custom params
- Improved parameter naming logic for nested resources

---

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
