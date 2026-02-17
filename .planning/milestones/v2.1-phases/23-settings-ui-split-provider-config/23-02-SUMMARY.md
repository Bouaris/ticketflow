---
phase: 23-settings-ui-split-provider-config
plan: 02
subsystem: ui/settings
tags: [i18n, settings, localization]
dependency_graph:
  requires: [23-01]
  provides: [i18n-settings-complete]
  affects: []
tech_stack:
  added: []
  patterns: [i18n-integration, locale-aware-content]
key_files:
  created: []
  modified:
    - src/i18n/types.ts
    - src/i18n/locales/fr.ts
    - src/i18n/locales/en.ts
    - src/components/settings/AppSettingsModal.tsx
    - src/components/settings/AISettingsModal.tsx
    - src/components/settings/ProviderCard.tsx
    - src/components/settings/CustomProviderForm.tsx
    - src/components/settings/CustomProviderList.tsx
decisions:
  - title: "Provider descriptions use locale-aware inline conditions"
    rationale: "Rather than adding 6+ new i18n keys for provider descriptions, used locale === 'fr' ? french : english inline conditionals in ProviderCard. Keeps i18n file lean while supporting bilingual descriptions."
  - title: "API key optional label combined into single key"
    rationale: "Created apiKeyOptional key 'API Key (optional)' / 'Cle API (optionnelle)' instead of separate keys. Cleaner and matches existing patterns in codebase."
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 0
  files_modified: 8
  lines_added: 108
  lines_removed: 41
  commits: 2
  completed_at: "2026-02-16"
---

# Phase 23 Plan 02: Add i18n Keys and Internationalize Settings Split Components

Complete internationalization layer for the five Plan 01 settings components, adding 20 new i18n keys and replacing all hardcoded English strings with proper t.settings.* calls.

## One-liner

Added 20 new i18n keys for settings split UI (appSettings, aiSettings, providers, customProviders, etc.) and replaced all hardcoded strings in Plan 01 components with locale-aware translations in French and English.

## Objective

Add all new i18n keys required by the settings split, then update the five Plan 01 components to replace hardcoded English strings with proper i18n calls for full FR/EN translation support.

## Tasks Completed

### Task 1: Add i18n keys to types and locale files ✅

**i18n/types.ts** — Added 20 new keys to settings section:
- `appSettings`, `aiSettings`, `providers`, `customProviders`
- `addProvider`, `editProvider`, `deleteProvider`, `deleteProviderConfirm`
- `providerName`, `endpointURL`, `endpointHint`, `defaultModel`
- `apiKeyOptional`, `apiKeyHintLocal`
- `providerConfigured`, `providerNotConfigured`, `noCustomProviders`
- `providerAdded`, `providerDeleted`, `saveProvider`

**i18n/locales/fr.ts** — Added French translations for all 20 keys:
- Example: `appSettings: 'Parametres generaux'`
- Example: `providerName: 'Nom du fournisseur'`
- Example: `endpointHint: 'Doit etre HTTPS ou localhost'`

**i18n/locales/en.ts** — Added English translations for all 20 keys:
- Example: `appSettings: 'General Settings'`
- Example: `providerName: 'Provider Name'`
- Example: `endpointHint: 'Must be HTTPS or localhost'`

**Verification:** `pnpm build` passed. TypeScript enforces matching keys across types.ts, fr.ts, and en.ts.

**Commit:** `ec707a1` — feat(23-02): add i18n keys for settings split UI

---

### Task 2: Replace hardcoded strings in Plan 01 components with i18n calls ✅

Replaced all `// TODO: i18n` marked strings with proper `t.settings.*` keys across all five components:

**AppSettingsModal.tsx:**
- Modal title: `t.common.parameters` → `t.settings.appSettings`

**AISettingsModal.tsx:**
- Modal title: `t.settings.title` → `t.settings.aiSettings`
- Tab label "Built-in Providers" → `t.settings.providers`
- Tab label "Custom Providers" → `t.settings.customProviders`

**ProviderCard.tsx:**
- Status badge: `'OK' : '...'` → `t.settings.providerConfigured : t.settings.providerNotConfigured`
- Provider descriptions: Added locale-aware inline conditionals
  - Groq: `locale === 'fr' ? '14,400 req/jour...' : '14,400 req/day...'`
  - Gemini: Bilingual with locale check
  - OpenAI: Bilingual with locale check
- Added `locale` to useTranslation destructuring

**CustomProviderForm.tsx:**
- "Provider Name" → `t.settings.providerName`
- "Base URL" → `t.settings.endpointURL`
- "Must use HTTPS or localhost" → `t.settings.endpointHint`
- "Default Model" → `t.settings.defaultModel`
- API Key label + "(optional)" → `t.settings.apiKeyOptional`
- Placeholder "Optional for localhost providers" → `t.settings.apiKeyHintLocal`
- Button text: `'Save Changes' : 'Add Provider'` → `t.settings.saveProvider : t.settings.addProvider`
- Error fallback: `'Unknown error'` → `t.error.unknown`

**CustomProviderList.tsx:**
- Form title: `'Edit Custom Provider' : 'Add Custom Provider'` → `t.settings.editProvider : t.settings.addProvider`
- Header: "Custom Providers" → `t.settings.customProviders`
- Add button: "Add Provider" → `t.settings.addProvider`
- Empty state: "No custom providers..." → `t.settings.noCustomProviders`
- "Model: {model}" → `t.settings.defaultModel: {model}`
- aria-label: "Edit provider" → `t.settings.editProvider`
- aria-label: "Delete provider" → `t.settings.deleteProvider`
- Delete confirmation: "Delete provider "{name}"?..." → `t.settings.deleteProviderConfirm`

**Verification:**
1. `grep -rn "TODO: i18n" src/components/settings/` returned zero results ✅
2. `pnpm build` passed with zero TypeScript errors ✅

**Commit:** `483fc44` — feat(23-02): replace hardcoded strings with i18n in Plan 01 components

---

## Deviations from Plan

None — plan executed exactly as written.

## Verification

1. ✅ All 20 new keys present in types.ts, fr.ts, and en.ts
2. ✅ TypeScript enforces matching keys across all locale files (build would fail if keys mismatch)
3. ✅ All five Plan 01 components use t.settings.* for user-facing strings
4. ✅ Zero `// TODO: i18n` comments remain
5. ✅ `pnpm build` passes with zero errors

## Key Files

**Modified:**
- `src/i18n/types.ts` — Added 20 new settings keys to Translations interface
- `src/i18n/locales/fr.ts` — Added French translations for all new keys
- `src/i18n/locales/en.ts` — Added English translations for all new keys
- `src/components/settings/AppSettingsModal.tsx` — Used t.settings.appSettings
- `src/components/settings/AISettingsModal.tsx` — Used t.settings.aiSettings, providers, customProviders
- `src/components/settings/ProviderCard.tsx` — Full i18n integration with locale-aware descriptions
- `src/components/settings/CustomProviderForm.tsx` — All form labels and hints internationalized
- `src/components/settings/CustomProviderList.tsx` — Complete i18n for list UI and confirmation dialog

## Technical Notes

**i18n Pattern:**
- Used `const { t, locale } = useTranslation()` in ProviderCard to access current locale
- Inline conditionals for provider descriptions keep i18n files lean
- All placeholder text internationalized for form inputs

**Key Naming Convention:**
- Kept consistent with existing patterns: `providerConfigured`, `providerNotConfigured` (no verb)
- Used descriptive names: `apiKeyOptional`, `apiKeyHintLocal`, `deleteProviderConfirm`

**TypeScript Safety:**
- Build fails if any key is missing from locale files
- All keys type-checked via Translations interface

## Self-Check: PASSED ✅

**Modified files exist:**
```
FOUND: src/i18n/types.ts
FOUND: src/i18n/locales/fr.ts
FOUND: src/i18n/locales/en.ts
FOUND: src/components/settings/AppSettingsModal.tsx
FOUND: src/components/settings/AISettingsModal.tsx
FOUND: src/components/settings/ProviderCard.tsx
FOUND: src/components/settings/CustomProviderForm.tsx
FOUND: src/components/settings/CustomProviderList.tsx
```

**Commits exist:**
```
FOUND: ec707a1 feat(23-02): add i18n keys for settings split UI
FOUND: 483fc44 feat(23-02): replace hardcoded strings with i18n in Plan 01 components
```

**Build verification:**
```
✓ pnpm build passed with zero TypeScript errors
✓ All i18n keys match across types.ts, fr.ts, and en.ts
✓ No TODO: i18n comments remain in any component
```

## Next Steps

Plan 03 will:
1. Wire AppSettingsModal and AISettingsModal into App.tsx
2. Create settings router to handle shortcuts (Cmd+, opens appropriate modal)
3. Remove deprecated SettingsModal.tsx and projectAIConfig.ts
