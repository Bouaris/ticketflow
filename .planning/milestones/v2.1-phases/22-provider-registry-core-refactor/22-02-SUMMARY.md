---
phase: 22-provider-registry-core-refactor
plan: 02
subsystem: ai
tags: [provider-registry, openai-sdk, singleton-cache, baseURL, structured-output, backward-compat]

# Dependency graph
requires:
  - "Provider registry types and CRUD (src/types/aiProvider.ts, src/lib/ai-provider-registry.ts) from 22-01"
provides:
  - "Registry-integrated AI client with Map-based OpenAI singleton cache (src/lib/ai.ts)"
  - "Structured output detection using registry provider types (src/lib/ai-retry.ts)"
  - "Storage keys for custom provider API keys (src/constants/storage.ts)"
  - "Simplified getEffectiveAIConfig (global-only, no project-level resolution)"
affects: [22-03, 23-settings-split, 24-custom-provider-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [map-based-client-cache, registry-aware-routing, deprecated-stub-pattern]

key-files:
  created: []
  modified:
    - src/lib/ai.ts
    - src/lib/ai-retry.ts
    - src/constants/storage.ts

key-decisions:
  - "Map-based OpenAI client cache keyed by apiKey::baseURL to prevent state leaks between custom providers"
  - "loadProjectAIConfig/saveProjectAIConfig kept as deprecated no-op stubs (useProjectAIConfig hook and ProjectSettingsModal still import them)"
  - "Custom providers default to structured output 'none' (conservative -- unknown endpoint capabilities)"
  - "Provider type resolution via registry: providerType = providerConfig.type ?? providerId"

patterns-established:
  - "OpenAI client cache: Map<string, OpenAI> keyed by apiKey::baseURL separates distinct provider endpoints"
  - "Registry-aware routing: resolve providerType from registry before branching on groq/gemini/openai-compatible"
  - "Deprecated stub pattern: keep function signature, return default, mark @deprecated for gradual migration"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 22 Plan 02: AI Core Registry Integration Summary

**Map-based OpenAI client cache keyed by apiKey+baseURL, registry-aware provider routing in generateCompletion/generateChatCompletion, and simplified global-only getEffectiveAIConfig**

## Performance

- **Duration:** 4 min 49 sec
- **Started:** 2026-02-16T17:05:54Z
- **Completed:** 2026-02-16T17:10:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Expanded OpenAI client singleton from single-instance to Map-based cache (apiKey::baseURL keys), preventing state leaks between custom providers
- Integrated provider registry throughout generateCompletion and generateChatCompletion with type-based routing
- Simplified getEffectiveAIConfig to global-only (project-level config deprecated as no-op)
- Updated getStructuredOutputMode to accept arbitrary provider IDs with conservative 'none' for custom providers
- Added custom provider API key storage helpers (CUSTOM_PROVIDER_API_KEY_PREFIX pattern)

## Task Commits

Tasks 1 and 2 were committed together (Task 2 was pulled forward to unblock the build -- see Deviations):

1. **Task 1+2: Registry integration in ai.ts + ai-retry.ts structured output** - `a508efc` (feat)

## Files Created/Modified
- `src/lib/ai.ts` - Registry-integrated AI client: Map-based OpenAI cache, registry-aware routing, simplified getEffectiveAIConfig, deprecated project-level config stubs
- `src/lib/ai-retry.ts` - getStructuredOutputMode accepts arbitrary provider IDs, resolves type via registry, custom providers get 'none'
- `src/constants/storage.ts` - Added CUSTOM_AI_PROVIDERS and CUSTOM_PROVIDER_API_KEY_PREFIX keys, getCustomProviderApiKeyKey helper

## Decisions Made
- **Map-based cache key format**: `apiKey::baseURL` separates clients by both credentials and endpoint. Entries without baseURL use just `apiKey` (backward-compatible with built-in OpenAI).
- **Deprecated stubs over deletion**: `loadProjectAIConfig` and `saveProjectAIConfig` kept as no-op stubs returning defaults because `useProjectAIConfig` hook and `ProjectSettingsModal` actively import them. Full removal deferred to Plan 03 or settings split phase.
- **Provider type resolution fallback**: When registry lookup returns null (unknown provider), `providerType` falls back to the provider ID itself, matching existing behavior for built-in 'groq'/'gemini' IDs.
- **Conservative structured output**: Custom providers always return 'none' for structured output mode since we cannot know their capabilities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged Task 2 (ai-retry.ts) into Task 1 commit**
- **Found during:** Task 1 (build verification)
- **Issue:** `getStructuredOutputMode` in ai-retry.ts still accepted `'groq' | 'gemini' | 'openai'` but ai.ts now passes `string` (providerId). TypeScript build failed with TS2345.
- **Fix:** Applied Task 2 changes (ai-retry.ts refactor) during Task 1 to unblock the build.
- **Files modified:** src/lib/ai-retry.ts
- **Verification:** `pnpm build` passes
- **Committed in:** a508efc (combined commit)

**2. [Rule 3 - Blocking] Kept loadProjectAIConfig/saveProjectAIConfig as deprecated stubs**
- **Found during:** Task 1 (removing project-level AI config)
- **Issue:** Plan specified removing these functions, but `useProjectAIConfig` hook and `ProjectSettingsModal` (actively rendered in App.tsx) import them. Deletion would break the build.
- **Fix:** Kept as deprecated no-op stubs: `loadProjectAIConfig` returns `DEFAULT_PROJECT_AI_CONFIG`, `saveProjectAIConfig` is a no-op.
- **Files modified:** src/lib/ai.ts
- **Verification:** `pnpm build` passes, existing consumers still compile
- **Committed in:** a508efc

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for build compilation. No scope creep -- all planned functionality delivered.

## Issues Encountered
None beyond the blocking issues documented as deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI core module fully integrated with provider registry
- Custom providers route through OpenAI SDK with correct baseURL
- Singleton cache prevents state leaks between providers with different endpoints
- Ready for Plan 03 (remaining cleanup and consumer updates)
- Deprecated stubs (loadProjectAIConfig/saveProjectAIConfig) should be cleaned up when settings split phase removes ProjectSettingsModal dependency

## Self-Check: PASSED

All files exist. All commits verified.
