---
phase: 34-dead-code-sweep
plan: 02
subsystem: ai
tags: [typescript, telemetry, dead-code, refactor, ai-config]

# Dependency graph
requires:
  - phase: 33-type-safety-critical-fixes
    provides: "Zod-inferred types, isBuiltInProvider predicate, centralized storage keys"
provides:
  - "getEffectiveAIConfig() with no parameters — bare signature, no _projectPath"
  - "All 16 call sites across 6 files updated to pass no arguments"
  - "MAX_ERROR_MESSAGE_CHARS constant replacing magic number 200 in telemetry"
  - "shouldPromptConsent() with named hasBeenDismissedTooManyTimes boolean"
  - "Error severity policy comment in telemetry.ts"
  - "shutdownTelemetry removed with Rust WAL persistence explanation"
affects: [ai-features, telemetry, code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead parameter removal: bare function signature when parameter is fully ignored"
    - "Named intermediate boolean for readability in boolean-returning functions"
    - "Magic number extraction to named constant with JSDoc documenting rationale"

key-files:
  created: []
  modified:
    - src/lib/ai.ts
    - src/lib/ai-bulk.ts
    - src/lib/ai-chat.ts
    - src/lib/ai-dependencies.ts
    - src/lib/ai-questioning.ts
    - src/hooks/useAIFeedback.ts
    - src/lib/telemetry.ts

key-decisions:
  - "getEffectiveAIConfig() parameter removed without touching options types — projectPath in options types may still serve other purposes (DB access, context loading); only the getEffectiveAIConfig call site was the target"
  - "shutdownTelemetry removed rather than wired: Rust WAL persistence in telemetry.rs makes JS-side shutdown redundant; documented for future re-wiring if needed"
  - "Error severity policy documented as code comment — console.warn for telemetry (non-critical), console.error for user-visible failures"

patterns-established:
  - "Named boolean pattern: const hasBeenDismissedTooManyTimes = getDismissCount() > 1; return !hasBeenDismissedTooManyTimes"
  - "Dead export removal with explanatory comment preserving rationale for future developers"

requirements-completed: [FIX-06, FIX-07]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 34 Plan 02: Dead Code Sweep — AI Config & Telemetry Cleanup Summary

**Removed misleading _projectPath parameter from getEffectiveAIConfig across 16 call sites in 6 files, and improved telemetry.ts with named constant, simplified boolean, policy comment, and shutdownTelemetry dead export removal**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T11:06:02Z
- **Completed:** 2026-02-19T11:08:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `getEffectiveAIConfig` signature updated to bare `(): { provider, modelId }` — no parameters; all 16 call sites across 6 files updated (DEAD-010, SMELL-018, FIX-06)
- `shutdownTelemetry` dead export removed with explanatory comment about Rust WAL persistence (DEAD-004)
- `MAX_ERROR_MESSAGE_CHARS = 200` constant extracted; 3 usages of magic number replaced (SMELL-016)
- `shouldPromptConsent()` simplified with named `hasBeenDismissedTooManyTimes` boolean (SMELL-017)
- Error severity policy (console.warn vs console.error) documented as code comment (SMELL-011)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove _projectPath from getEffectiveAIConfig and update all call sites** - `df78563` (fix)
2. **Task 2: Telemetry code quality improvements** - `ead83d3` (fix)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified

- `src/lib/ai.ts` — Function signature updated from `(_projectPath?: string)` to `()`; 7 internal call sites updated
- `src/lib/ai-bulk.ts` — 2 call sites updated (lines 473, 615)
- `src/lib/ai-chat.ts` — 1 call site updated (line 192)
- `src/lib/ai-dependencies.ts` — 2 call sites updated (lines 195, 246)
- `src/lib/ai-questioning.ts` — 2 call sites updated (lines 213, 278)
- `src/hooks/useAIFeedback.ts` — 1 call site updated (line 94)
- `src/lib/telemetry.ts` — MAX_ERROR_MESSAGE_CHARS constant, named boolean, error policy comment, shutdownTelemetry removed

## Decisions Made

- `projectPath` in options types (e.g., `RefineOptions`, `GenerateOptions`, `AIOptions`) was intentionally left in place — those types serve other purposes like DB access and context loading. Only the `getEffectiveAIConfig` call site argument was removed.
- `shutdownTelemetry` was removed (not just deprecated): Rust-side WAL persistence makes JS-side flush redundant; preserved rationale as comment for future re-wiring if needed.
- Error severity policy comment placed before `// ERROR TRACKING` section for maximum discoverability.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all 16 call sites identified by grep, all updated, build passed cleanly on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All DEAD-004, DEAD-010, SMELL-011, SMELL-016, SMELL-017, SMELL-018 findings resolved
- FIX-06 and FIX-07 requirements complete
- Phase 34 plan 02 complete — ready for plan 03 if it exists, or phase closure

---
*Phase: 34-dead-code-sweep*
*Completed: 2026-02-19*
