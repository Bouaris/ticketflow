---
phase: 22-provider-registry-core-refactor
plan: 03
subsystem: ai
tags: [provider-registry, backward-compat, deprecated-shim, barrel-export, global-config]

# Dependency graph
requires:
  - "Provider registry types and CRUD (src/types/aiProvider.ts, src/lib/ai-provider-registry.ts) from 22-01"
  - "Registry-integrated AI client with Map-based OpenAI singleton cache (src/lib/ai.ts) from 22-02"
provides:
  - "Deprecated projectAIConfig.ts with AVAILABLE_MODELS/DEFAULT_MODELS derived from registry"
  - "Simplified useProjectAIConfig hook (global-only, no project-level resolution)"
  - "Registry-aware ProviderToggle with getProviderLabel accepting any provider string"
  - "Barrel exports for ProviderConfig, BuiltInProviderId, CustomProviderInput types"
  - "Barrel exports for registry functions (BUILT_IN_PROVIDERS, getAllProviders, getProviderById, etc.)"
affects: [23-settings-split, 24-custom-provider-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [deprecated-shim-with-registry-derivation, global-only-config-hook, registry-aware-label-resolution]

key-files:
  created: []
  modified:
    - src/types/projectAIConfig.ts
    - src/hooks/useProjectAIConfig.ts
    - src/components/ui/ProviderToggle.tsx
    - src/types/index.ts
    - src/lib/index.ts

key-decisions:
  - "AVAILABLE_MODELS and DEFAULT_MODELS derived from BUILT_IN_PROVIDERS at module level (not duplicated)"
  - "useProjectAIConfig setProvider/setModelId kept as no-ops with console.warn for backward compat"
  - "getProviderLabel widened from AIProvider to string to support custom providers in Phase 24"

patterns-established:
  - "Deprecated shim pattern: old module imports from registry, re-exports derived values with same shape"
  - "No-op hook pattern: keep return interface, replace logic with global-only + deprecation warnings"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 22 Plan 03: Consumer Migration Summary

**Deprecated projectAIConfig.ts as registry-derived shim, simplified useProjectAIConfig to global-only, and updated ProviderToggle and barrel exports for registry awareness**

## Performance

- **Duration:** 2 min 49 sec
- **Started:** 2026-02-16T17:13:33Z
- **Completed:** 2026-02-16T17:16:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Deprecated projectAIConfig.ts with AVAILABLE_MODELS and DEFAULT_MODELS now derived from BUILT_IN_PROVIDERS (registry is single source of truth for model lists)
- Simplified useProjectAIConfig hook from full project-level config management to a thin global-config wrapper with no-op setters
- Updated ProviderToggle getProviderLabel to resolve labels via registry, accepting any string (not just AIProvider), preparing for custom provider display
- Added new registry types (ProviderConfig, BuiltInProviderId, CustomProviderInput) and functions to barrel exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Deprecate projectAIConfig.ts and redirect to registry types** - `c827c38` (refactor)
2. **Task 2: Simplify useProjectAIConfig hook and update ProviderToggle** - `2ca1883` (feat)

## Files Created/Modified
- `src/types/projectAIConfig.ts` - Deprecated shim: imports BUILT_IN_PROVIDERS, derives AVAILABLE_MODELS and DEFAULT_MODELS, keeps Zod schemas and types unchanged
- `src/hooks/useProjectAIConfig.ts` - Simplified: always returns global config via getProvider()/getProviderById(), no-op setters with console.warn
- `src/components/ui/ProviderToggle.tsx` - Registry-aware: getProviderLabel uses BUILT_IN_PROVIDERS lookup with string fallback, ProviderToggleProps.value accepts AIProvider | string
- `src/types/index.ts` - Added barrel export for ProviderConfig, BuiltInProviderId, CustomProviderInput
- `src/lib/index.ts` - Added barrel export for BUILT_IN_PROVIDERS, getAllProviders, getProviderById, addCustomProvider, removeCustomProvider, validateCustomProvider, isBuiltInProvider

## Decisions Made
- **Registry derivation over duplication:** AVAILABLE_MODELS and DEFAULT_MODELS computed from BUILT_IN_PROVIDERS array at module level, ensuring any registry update automatically propagates to deprecated exports.
- **No-op setters with warnings:** useProjectAIConfig's setProvider and setModelId kept as no-ops with console.warn (not console.log) so ProjectSettingsModal still compiles without runtime errors. The warnings guide developers to migrate.
- **Widened getProviderLabel signature:** Changed from `(provider: AIProvider) => string` to `(provider: string) => string` to support custom provider IDs (e.g., 'custom-ollama') in Phase 24, with fallback to capitalizing the ID.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 22 plans complete -- provider registry fully integrated across the codebase
- Deprecated stubs in ai.ts (loadProjectAIConfig/saveProjectAIConfig) and deprecated projectAIConfig.ts module ready for cleanup in Phase 23 (settings split)
- Barrel exports enable clean imports for Phase 23/24 consumers
- ProjectSettingsModal still uses AVAILABLE_MODELS/DEFAULT_MODELS from deprecated module -- will be refactored in settings split phase

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 22-provider-registry-core-refactor*
*Completed: 2026-02-16*
