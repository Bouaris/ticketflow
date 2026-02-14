# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
ticketflow/
├── .planning/codebase/          # GSD analysis documents (this directory)
├── .backlog-assets/             # Screenshots and media assets (generated at runtime)
├── .claude/                      # Claude workspace artifacts
├── .vscode/                      # VS Code settings
├── src/                          # React source code
│   ├── components/               # React UI components (TSX)
│   ├── hooks/                    # Custom React hooks (state management)
│   ├── lib/                      # Business logic (parsing, AI, file I/O)
│   ├── types/                    # TypeScript definitions + Zod schemas
│   ├── constants/                # Centralized constants (patterns, colors, labels)
│   ├── test-utils/               # Test fixtures, mocks, setup
│   ├── __tests__/                # Unit tests (vitest)
│   ├── App.tsx                   # Root application component
│   ├── main.tsx                  # Vite entry point
│   └── index.css                 # Global Tailwind styles
├── src-tauri/                    # Rust/Tauri backend
│   ├── src/main.rs               # Window creation, plugin init
│   └── tauri.conf.json           # Tauri config (permissions, updater)
├── e2e/                          # Playwright E2E tests
├── dist/                         # Build output (generated)
├── index.html                    # HTML template
├── vite.config.ts                # Vite build config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies, scripts
├── CLAUDE.md                      # Project directives for Claude
└── README.md                     # User documentation
```

## Directory Purposes

**src/components/:**
- Purpose: All React UI components—views, modals, panels, widgets
- Contains: `.tsx` files and optional `.ts` index files (barrel exports)
- Structure by feature: `editor/`, `kanban/`, `list/`, `detail/`, `filter/`, `settings/`, `ui/`, `layout/`, `ai/`, `welcome/`, `export/`, `shared/`
- Key files:
  - `ui/Icons.tsx`: Centralized 30+ icon components (PlusIcon, DeleteIcon, etc.)
  - `ui/Modal.tsx`: Base modal wrapper (reused by ItemEditorModal, SettingsModal, etc.)
  - `kanban/KanbanBoard.tsx`: Drag-drop board with dnd-kit integration
  - `list/ListView.tsx`: Table view with item rows
  - `detail/ItemDetailPanel.tsx`: Right panel showing selected item metadata
  - `editor/ItemEditorModal.tsx`: Form for creating/editing items

**src/hooks/:**
- Purpose: Custom hooks—encapsulate state logic, not tied to specific components
- Contains: `.ts` files only (logic, no JSX)
- Key hooks:
  - `useBacklog.ts`: Central hook owning backlog state, filters, selections, history integration
  - `useFileAccess.ts`: File open/save logic, dual-mode (Tauri + Web)
  - `useTypeConfig.ts`: Item type configuration (per-project, localStorage-backed)
  - `useAIBacklogSuggestions.ts`: AI analysis suggestions (priority scores, groupings)
  - `useBacklogHistory.ts`: Undo/redo stack management
  - `useKeyboardShortcuts.ts`: Global keyboard event handlers
  - `useScreenshotFolder.ts`: Screenshot directory management (Tauri)
  - `useUpdater.ts`: App auto-update checks (Tauri updater plugin)
  - `useProjects.ts`: Project list and switching

**src/lib/:**
- Purpose: Reusable business logic—no React, no UI
- Contains: `.ts` files only
- Key modules:
  - `parser.ts`: Markdown → Backlog JSON (Zod-validated)
  - `serializer.ts`: JSON → Markdown reconstruction (faithful round-trip)
  - `ai.ts`: Multi-provider LLM client (Groq, Gemini, OpenAI)
  - `ai-context.ts`: AI prompt building with markdown context
  - `ai-decisions.ts`: AI decision logic for item classification
  - `ai-cache.ts`: Cache AI results to localStorage
  - `tauri-bridge.ts`: Tauri API wrapper (file I/O, dialogs, shell)
  - `fileSystem.ts`: File System Access API wrapper (web mode)
  - `search.ts`: Full-text search engine (minisearch)
  - `itemPlacement.ts`: Item ID generation, section finding logic
  - `screenshots.ts`: Screenshot metadata parsing and reference building
  - `utils.ts`: General utilities (formatting, validation helpers)
  - `version.ts`: App version string
  - `changelog.ts`: Changelog data for "What's New" modal
  - `secure-storage.ts`: Secure API key storage (Tauri keychain fallback)

**src/types/:**
- Purpose: TypeScript definitions, Zod schemas, type guards
- Contains: `.ts` files only (no logic, just schemas and guards)
- Key files:
  - `backlog.ts`: Zod schemas for Backlog, Section, BacklogItem, TableGroup, RawSection
  - `typeConfig.ts`: TypeDefinition interface, type detection logic, localStorage helpers
  - `guards.ts`: Type guard functions (isBacklogItem, isTableGroup, isRawSection)
  - `ai.ts`: AI response schemas (RefineResponse, SuggestionsResponse, etc.)
  - `projectAIConfig.ts`: Per-project AI settings (context files, custom instructions)
  - `project.ts`: Project definition
  - `dnd.ts`: Drag-and-drop types
  - `file-system-access.d.ts`: TypeScript definitions for File System Access API (web)

**src/constants/:**
- Purpose: Centralized hardcoded values, patterns, labels
- Contains: `.ts` files only
- Key files:
  - `patterns.ts`: Regex patterns for parser (PARSER_PATTERNS object)
  - `colors.ts`: Color maps (TYPE_COLORS, effort/severity/priority colors)
  - `labels.ts`: User-readable labels (SEVERITY_FULL_LABELS, EFFORT_SHORT_LABELS)
  - `storage.ts`: localStorage key names (STORAGE_KEYS object)
  - `config.ts`: AI model configs, rate limits
  - `index.ts`: Re-exports other constants

**src/test-utils/:**
- Purpose: Shared test infrastructure—fixtures, mocks, helpers
- Contains: `.ts` files
- Key files:
  - `fixtures.ts`: Sample backlog data, mock items
  - `mocks/tauri.ts`: Mocked Tauri API
  - `mocks/ai.ts`: Mocked AI responses
  - `setup.ts`: Vitest setup (DOM polyfills)
  - `index.ts`: Test helper functions

**src/__tests__/:**
- Purpose: Unit tests for all business logic
- Contains: `.test.ts` or `.spec.ts` files (Vitest format)
- Pattern: One test file per source file (e.g., `parser.test.ts` for `lib/parser.ts`)
- Coverage: Parser, serializer, hooks, guards, utils, AI decision logic, item placement

**src-tauri/:**
- Purpose: Rust backend (not covered in detail here)
- Contains: Tauri window creation, plugin initialization
- Relevant for: File I/O, dialog APIs, auto-updater, shell commands

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React entry point (Vite)—loads App.tsx into DOM
- `src/App.tsx`: Root component—orchestrates all hooks and UI
- `index.html`: HTML template with `<div id="root"></div>`
- `src-tauri/src/main.rs`: Tauri window creation (native desktop)

**Configuration:**
- `vite.config.ts`: Build settings (Vite, Tailwind, aliases)
- `tsconfig.json`: TypeScript strict mode, paths
- `package.json`: Dependencies, scripts (dev, build, test, tauri)
- `src-tauri/tauri.conf.json`: Tauri permissions, updater, bundle settings
- `CLAUDE.md`: Project directives and conventions (READ THIS FIRST)

**Core Logic:**
- `src/lib/parser.ts`: Markdown parsing (CRITICAL)
- `src/lib/serializer.ts`: JSON to Markdown serialization (CRITICAL)
- `src/hooks/useBacklog.ts`: State management (CRITICAL)
- `src/types/backlog.ts`: Zod schemas (CRITICAL)
- `src/lib/ai.ts`: AI integration
- `src/lib/itemPlacement.ts`: Item ID generation, section detection

**Testing:**
- `vitest.config.ts`: Vitest configuration
- `src/__tests__/**`: Unit tests
- `e2e/`: Playwright E2E tests
- `src/test-utils/`: Shared test fixtures and mocks

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `ItemEditorModal.tsx`, `KanbanBoard.tsx`)
- Hooks: camelCase, prefix `use` (e.g., `useBacklog.ts`, `useFileAccess.ts`)
- Utilities and lib: camelCase (e.g., `parser.ts`, `search.ts`)
- Constants: camelCase (e.g., `patterns.ts`, `colors.ts`)
- Tests: Match source file + `.test.ts` suffix (e.g., `parser.test.ts`)
- Barrel exports: `index.ts` in subdirectories (re-exports all exports)

**Directories:**
- Feature directories: lowercase plural (e.g., `components/`, `hooks/`, `lib/`, `types/`)
- Feature subdirectories: lowercase, by feature name (e.g., `components/editor/`, `components/kanban/`)
- Type definitions: Same as source but in `types/` (e.g., `types/backlog.ts`, `types/typeConfig.ts`)

**Functions:**
- Hooks: camelCase, `use` prefix (e.g., `useBacklog()`, `updateItemById()`)
- Utilities: camelCase (e.g., `parseBacklog()`, `serializeBacklog()`, `buildItemMarkdown()`)
- React components: PascalCase (e.g., `ItemDetailPanel`, `KanbanBoard`)
- Type constructors: PascalCase (e.g., `BacklogItemSchema`, `TypeConfigSchema`)
- Getters/helpers: camelCase (e.g., `getTypeColor()`, `getTypeLabel()`, `generateItemId()`)

**Variables:**
- State: camelCase (e.g., `backlog`, `selectedItem`, `filters`)
- Constants (unchanging): UPPERCASE_SNAKE_CASE (e.g., `MAX_HISTORY`, `DEFAULT_FILTERS`, `PARSER_PATTERNS`)
- Enums/unions: PascalCase (e.g., `type ViewMode = 'kanban' | 'list'`)

**Types:**
- Interfaces: PascalCase (e.g., `BacklogItem`, `TypeDefinition`, `UseBacklogReturn`)
- Enums: PascalCase (e.g., `Severity`, `Priority`, `Effort`)
- Zod schemas: PascalCase + Schema suffix (e.g., `BacklogItemSchema`, `TypeDefinitionSchema`)

## Where to Add New Code

**New Feature (e.g., "Add Comments"):**
- State hook: `src/hooks/useComments.ts` (manage comment state, CRUD operations)
- Type schema: `src/types/comments.ts` (Zod schema for Comment)
- Components: `src/components/comments/CommentList.tsx`, `src/components/comments/CommentEditor.tsx`
- Business logic: `src/lib/comments.ts` (parse comments from markdown, serialize back)
- Tests: `src/__tests__/comments.test.ts`, `src/__tests__/useComments.test.ts`
- Update Backlog schema in `src/types/backlog.ts` to include `comments?: Comment[]`

**New Component/Modal:**
- File: `src/components/{feature}/{ComponentName}.tsx` (e.g., `src/components/export/ExportModal.tsx`)
- Type definitions if needed: `src/types/{feature}.ts`
- Import in App.tsx, add state management for open/close, pass via prop
- Use existing `Modal.tsx` wrapper for consistent styling

**New Utility/Helper:**
- File: `src/lib/{utility}.ts` (e.g., `src/lib/formatter.ts`, `src/lib/validation.ts`)
- NO React imports
- Export as named functions
- Add tests in `src/__tests__/{utility}.test.ts`
- Re-export from `src/lib/index.ts` if heavily used

**New Constant/Pattern:**
- Add to existing constant file in `src/constants/` (e.g., add regex to `patterns.ts`)
- If new category, create new file and re-export from `src/constants/index.ts`
- Use UPPERCASE_SNAKE_CASE for constants

**Tests:**
- Unit test new function: Create `src/__tests__/{module}.test.ts`
- Use fixtures from `src/test-utils/fixtures.ts`
- Mock Tauri/AI as needed with `src/test-utils/mocks/`
- Run with `pnpm test` (watch: `pnpm test:watch`)

**Configuration:**
- Parsing pattern: Update `src/constants/patterns.ts` and `src/lib/parser.ts`
- Color/label: Update `src/constants/colors.ts` or `src/constants/labels.ts`
- Storage key: Add to `src/constants/storage.ts` and use consistently

## Special Directories

**dist/:**
- Purpose: Build output (generated by `pnpm build`)
- Generated: Yes (via Vite)
- Committed: No (in .gitignore)
- Contains: `index.html`, `assets/` folder with bundled JS/CSS

**.backlog-assets/:**
- Purpose: Runtime screenshots and media
- Generated: Yes (created when screenshots uploaded)
- Committed: No (in .gitignore, synced per-project)
- Contains: `screenshots/` subfolder with `.png` files

**.planning/codebase/:**
- Purpose: GSD analysis documents
- Generated: Via `/gsd:map-codebase` command
- Committed: Yes
- Contains: `ARCHITECTURE.md`, `STRUCTURE.md`, and other analysis docs

**src-tauri/src-tauri/:**
- Purpose: Tauri Rust code (not analyzed in detail)
- Generated: No
- Committed: Yes
- Contains: Window creation, plugin setup, menu definitions

**e2e/:**
- Purpose: End-to-end tests via Playwright
- Generated: Test reports only
- Committed: Yes (code is committed, reports are not)
- Run with: `pnpm test:e2e` or `pnpm test:e2e:ui`

---

*Structure analysis: 2026-02-05*
