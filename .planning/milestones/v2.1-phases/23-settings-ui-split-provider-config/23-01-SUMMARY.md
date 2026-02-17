---
phase: 23-settings-ui-split-provider-config
plan: 01
subsystem: ui/settings
tags: [settings, ui-split, provider-config, custom-providers]
dependency_graph:
  requires: [22-provider-registry]
  provides: [app-settings-modal, ai-settings-modal, provider-card, custom-provider-ui]
  affects: []
tech_stack:
  added: []
  patterns: [modal-composition, tabbed-navigation, form-validation, crud-operations]
key_files:
  created:
    - src/components/settings/AppSettingsModal.tsx
    - src/components/settings/AISettingsModal.tsx
    - src/components/settings/ProviderCard.tsx
    - src/components/settings/CustomProviderForm.tsx
    - src/components/settings/CustomProviderList.tsx
  modified: []
decisions:
  - title: "Standalone components NOT wired"
    rationale: "Plan 01 creates components as standalone files. Wiring into App.tsx happens in Plan 02. This allows clean separation of UI construction from integration."
  - title: "TODO comments for i18n"
    rationale: "New UI strings marked with '// TODO: i18n' for Plan 02 to add proper translations. Used hardcoded English strings temporarily."
  - title: "ProviderCard loads key on mount"
    rationale: "When card becomes active, load existing API key via getApiKey(). Pattern ensures current key is shown when switching between providers."
  - title: "Custom provider edit uses remove+add"
    rationale: "Registry has no update function. Edit operation removes old provider, then adds new with updated data. API key stored separately via ai.ts setApiKey()."
metrics:
  duration_minutes: 5
  tasks_completed: 1
  files_created: 5
  files_modified: 0
  lines_added: 1197
  lines_removed: 0
  commits: 1
  completed_at: "2026-02-16"
---

# Phase 23 Plan 01: Create AppSettingsModal and AISettingsModal with Sub-components

Split the monolithic 774-line SettingsModal into two focused panels with complete sub-component architecture.

## One-liner

Five standalone modal components created: AppSettingsModal (language/theme/updates/backups), AISettingsModal (tabbed provider config with custom provider CRUD), ProviderCard, CustomProviderForm, CustomProviderList.

## Objective

Create AppSettingsModal and AISettingsModal as standalone new files with all sub-components. These modals are NOT yet wired into App.tsx — that happens in later plans. Focus: build the complete UI components consuming Phase 22 registry.

## Tasks Completed

### Task 1: Create AppSettingsModal and AISettingsModal with sub-components ✅

**Created files:**

1. **AppSettingsModal.tsx** (297 lines) — Non-AI settings:
   - Language selector (French/English buttons)
   - Theme toggle (light/dark/system)
   - Update section (Tauri only — check updates button)
   - Changelog section (WhatsNewModal trigger)
   - Export section (Tauri only — markdown export)
   - Backup & Restore section (Tauri only — create/restore backups)
   - Uses Modal with size="md", no footer (all actions inline)
   - Reuses exact i18n keys from SettingsModal (t.settings.*)

2. **AISettingsModal.tsx** (232 lines) — AI-specific settings:
   - Tabbed navigation: "Built-in Providers" and "Custom Providers"
   - Tab bar with accent underline on active tab
   - Providers tab: renders ProviderCard for each BUILT_IN_PROVIDERS entry
   - Custom tab: renders CustomProviderList component
   - AI Questioning Mode toggle (extracted from SettingsModal)
   - AI Feedback Stats section (shows when projectPath provided)
   - Uses Modal with size="lg"

3. **ProviderCard.tsx** (147 lines) — Reusable provider card:
   - Shows provider icon (GroqIcon/GeminiIcon/OpenAIIcon)
   - Status badge: "OK" (configured) or "..." (not configured) via hasApiKey
   - Provider name and description with color-coded styling
   - When selected (isActive), shows API key input field with show/hide toggle
   - Save button stores key via setApiKey(), calls resetClient()
   - Clear button via clearApiKey(), calls resetClient()
   - Provider-specific accent colors (orange for groq, blue for gemini, emerald for openai)
   - "Get API Key" link opens provider console in browser

4. **CustomProviderForm.tsx** (195 lines) — Add/edit custom provider:
   - Fields: name (text), baseURL (url), defaultModel (text), apiKey (password, optional)
   - Zod validation via validateCustomProvider from registry
   - Edit mode: removes old provider, adds new (registry has no update function)
   - API key stored separately via setApiKey(key, providerId) from ai.ts
   - Inline validation errors under each field
   - Form styling consistent with SettingsModal inputs
   - Submit disabled until name, baseURL, and defaultModel are filled

5. **CustomProviderList.tsx** (147 lines) — CRUD for custom providers:
   - Uses loadCustomProviders() to get list
   - Each row: provider name, baseURL, defaultModel, edit button, delete button
   - Delete: confirmation dialog, then removeCustomProvider(id), reload list
   - Edit: opens CustomProviderForm in edit mode
   - Add button: opens CustomProviderForm in create mode
   - Empty state: "No custom providers. Add Ollama, LM Studio, or other OpenAI-compatible endpoints."
   - Icons: EditIcon, TrashIcon, PlusIcon

**Implementation details:**
- All components use semantic Tailwind tokens (bg-surface, text-on-surface, border-outline)
- All components support dark mode via existing theme tokens
- useTranslation() for all user-facing strings
- NEW strings marked with `// TODO: i18n` for Plan 02 to add proper translations
- No modifications to existing files — only created new files
- Verification: created temporary barrel file, imported in App.tsx, ran `pnpm build` (passed), then removed temporary files

**Commit:** `646d757` — feat(23-01): create AppSettingsModal and AISettingsModal with sub-components

## Deviations from Plan

None — plan executed exactly as written.

## Verification

1. ✅ All five files created at specified paths
2. ✅ Temporary barrel file verified all 5 components compile without TypeScript errors
3. ✅ `pnpm build` passed (with temporary barrel, then again after removal)
4. ✅ No modifications to existing files (except temporary import added and removed during verification)
5. ✅ Each component uses Modal, Icons, and ai-provider-registry imports correctly

**Build output:** 1197 lines added across 5 files. TypeScript compilation succeeded with zero errors.

## Key Files

**Created:**
- `src/components/settings/AppSettingsModal.tsx` (297 lines) — App-level settings modal
- `src/components/settings/AISettingsModal.tsx` (232 lines) — AI settings modal with tabs
- `src/components/settings/ProviderCard.tsx` (147 lines) — Provider card with API key config
- `src/components/settings/CustomProviderForm.tsx` (195 lines) — Add/edit custom provider form
- `src/components/settings/CustomProviderList.tsx` (147 lines) — Custom provider CRUD list

**Dependencies:**
- Uses Phase 22 registry: `BUILT_IN_PROVIDERS`, `loadCustomProviders`, `addCustomProvider`, `removeCustomProvider`, `validateCustomProvider`
- Uses ai.ts functions: `hasApiKey`, `getApiKey`, `setApiKey`, `clearApiKey`, `resetClient`
- Uses Modal, Icons, useTranslation, useTheme
- Uses db/backup, db/queries/projects, lib/markdown-export for app-level features

## Technical Notes

**i18n Strategy:**
- Reused existing i18n keys where possible (t.settings.*, t.action.*, t.common.*)
- NEW strings marked with `// TODO: i18n` comment for Plan 02 to add proper keys
- Examples: "Built-in Providers", "Custom Providers", "Add Provider", "Edit Custom Provider", provider descriptions

**ProviderCard API Key Loading:**
- Uses useState(() => {}) pattern to load existing API key when card becomes active
- Ensures user sees current key when switching between providers

**Custom Provider Edit Pattern:**
- No update function in registry (intentional design from Phase 22)
- Edit operation: removeCustomProvider(old.id) → addCustomProvider(new)
- API key stored separately via setApiKey() using provider ID

**Tab Navigation:**
- Simple useState for activeTab ('providers' | 'custom')
- Tab buttons with conditional accent underline
- Clean separation between built-in and custom provider UIs

## Self-Check: PASSED ✅

**Created files exist:**
```
FOUND: src/components/settings/AppSettingsModal.tsx
FOUND: src/components/settings/AISettingsModal.tsx
FOUND: src/components/settings/ProviderCard.tsx
FOUND: src/components/settings/CustomProviderForm.tsx
FOUND: src/components/settings/CustomProviderList.tsx
```

**Commits exist:**
```
FOUND: 646d757 feat(23-01): create AppSettingsModal and AISettingsModal with sub-components
```

**Build verification:**
```
✓ pnpm build passed with zero TypeScript errors
✓ All 5 components compile correctly
✓ Clean state after temporary files removed
```

## Next Steps

Plan 02 will:
1. Add missing i18n keys for new strings (marked with TODO comments)
2. Wire AppSettingsModal and AISettingsModal into App.tsx
3. Create settings router to handle shortcuts (Cmd+, opens appropriate modal)
4. Remove deprecated SettingsModal.tsx and projectAIConfig.ts
