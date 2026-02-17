---
phase: 22-provider-registry-core-refactor
plan: 01
subsystem: ai
tags: [zod, registry-pattern, csp, openai-compatible, provider-config, localStorage]

# Dependency graph
requires: []
provides:
  - "ProviderConfig Zod schema and TypeScript types (src/types/aiProvider.ts)"
  - "Provider registry SSOT with built-in + custom CRUD (src/lib/ai-provider-registry.ts)"
  - "CSP update allowing HTTPS scheme-source and localhost for custom endpoints"
affects: [22-02, 22-03, 23-settings-split, 24-custom-provider-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [registry-pattern, custom-provider-validation, HTTPS-only-enforcement]

key-files:
  created:
    - src/types/aiProvider.ts
    - src/lib/ai-provider-registry.ts
  modified:
    - src-tauri/tauri.conf.json

key-decisions:
  - "HTTPS-only enforcement (Option A) for CSP — https: scheme-source instead of wildcard"
  - "Conservative capabilities defaults for custom providers (structuredOutput: false, multimodal: false)"
  - "Custom provider IDs prefixed with 'custom-' to avoid collisions with built-in provider IDs"
  - "localhost and 127.0.0.1 allowed in production CSP for local AI providers (Ollama, LM Studio)"

patterns-established:
  - "Registry pattern: BUILT_IN_PROVIDERS array + loadCustomProviders() from localStorage = getAllProviders()"
  - "Custom provider input validation: Zod schema with HTTPS/localhost URL refinement"
  - "Provider ID generation: custom-{slugified-name} with regex sanitization"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 22 Plan 01: Provider Registry Foundation Summary

**Zod-validated provider registry with 3 built-in providers (Groq/Gemini/OpenAI), custom provider CRUD via localStorage, and CSP HTTPS-only enforcement for custom endpoints**

## Performance

- **Duration:** 3 min 45 sec
- **Started:** 2026-02-16T16:58:47Z
- **Completed:** 2026-02-16T17:02:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created provider registry types with Zod schemas for ProviderConfig and CustomProviderInput
- Built complete provider registry module with 10 exported functions + BUILT_IN_PROVIDERS constant
- Updated CSP to allow any HTTPS endpoint and localhost connections for custom AI providers
- Model lists exactly match existing AVAILABLE_MODELS in projectAIConfig.ts for backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create provider registry types with Zod schemas** - `245caac` (feat)
2. **Task 2: Create provider registry module with built-in providers and custom CRUD** - `b2c579f` (feat)
3. **Task 3: Update CSP to allow custom HTTPS endpoints** - `46e83f1` (chore)

## Files Created/Modified
- `src/types/aiProvider.ts` - Zod schemas (ProviderConfigSchema, CustomProviderInputSchema) and types (ProviderConfig, ProviderType, CustomProviderInput, BuiltInProviderId)
- `src/lib/ai-provider-registry.ts` - Registry SSOT: BUILT_IN_PROVIDERS, getAllProviders, getProviderById, getBuiltInProvider, addCustomProvider, removeCustomProvider, validateCustomProvider, loadCustomProviders, saveCustomProviders, isBuiltInProvider, getDefaultModelForProvider
- `src-tauri/tauri.conf.json` - CSP connect-src updated with https: scheme-source, http://localhost:*, http://127.0.0.1:* in both csp and devCsp

## Decisions Made
- **HTTPS-only CSP enforcement:** Used `https:` scheme-source (not wildcard `https://*`) per research Option A. This is the CSP standard way to allow all HTTPS while blocking arbitrary HTTP. Kept specific domain entries (api.groq.com, etc.) for documentation clarity.
- **Conservative capability defaults:** Custom providers default to `{ structuredOutput: false, multimodal: false }` since we can't know their capabilities. Safer to assume less.
- **Localhost in production CSP:** Added `http://localhost:*` and `http://127.0.0.1:*` to production CSP to support local AI providers (Ollama, LM Studio) without requiring dev mode.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Provider registry foundation ready for Plan 02 (ai.ts refactor to consume registry, singleton cache expansion)
- Provider registry foundation ready for Plan 03 (custom provider API key storage pattern)
- CSP decision resolved: HTTPS-only enforcement (blocker cleared from STATE.md)
- No breaking changes to existing functionality (only new files + CSP expansion)

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 22-provider-registry-core-refactor*
*Completed: 2026-02-16*
