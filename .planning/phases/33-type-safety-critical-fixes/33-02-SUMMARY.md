---
phase: 33-type-safety-critical-fixes
plan: 02
subsystem: ui
tags: [telemetry, react-hooks, localStorage, storage-keys, idempotency]

# Dependency graph
requires: []
provides:
  - "Module-level errorTrackingSetUp guard in setupErrorTracking() — initTelemetry() is fully idempotent"
  - "chatPanel.loadHistory in useEffect dependency array in ProjectWorkspace — no stale closure on project switch"
  - "STORAGE_KEYS.QUESTIONING_MODE and STORAGE_KEYS.LOCALE defined in constants/storage.ts"
  - "useAIQuestioning, OnboardingWizard, ProjectWorkspace import from STORAGE_KEYS instead of hardcoded strings"
affects: [plan 33-01, telemetry, chat, onboarding, workspace]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level boolean guard for idempotent event listener registration"
    - "STORAGE_KEYS constant as single source of truth for all localStorage key strings"

key-files:
  created: []
  modified:
    - src/lib/telemetry.ts
    - src/components/workspace/ProjectWorkspace.tsx
    - src/constants/storage.ts
    - src/hooks/useAIQuestioning.ts
    - src/components/onboarding/OnboardingWizard.tsx

key-decisions:
  - "errorTrackingSetUp guard is module-level (not closure-level) — persists across multiple initTelemetry() calls within the same JS module lifetime"
  - "AISettingsModal.tsx ticketflow-questioning-mode replacements left for plan 33-01 (file ownership boundary to avoid parallel conflict)"

patterns-established:
  - "Module-level boolean guard: let guardFlag = false; in function: if (guardFlag) return; guardFlag = true;"
  - "All localStorage key strings must use STORAGE_KEYS constants — never hardcode key strings in components or hooks"

requirements-completed: [FIX-02, FIX-03, FIX-04]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 33 Plan 02: Telemetry Idempotency, useEffect Dependency, and Storage Key Centralization Summary

**Module-level guard prevents duplicate PostHog error listeners (SMELL-010); chatPanel.loadHistory added to useEffect deps (SMELL-004); QUESTIONING_MODE and LOCALE centralized in STORAGE_KEYS (DEAD-008, SMELL-009)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-19T00:00:00Z
- **Completed:** 2026-02-19T00:08:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `initTelemetry()` is now fully idempotent: `errorTrackingSetUp` module-level guard ensures `window.addEventListener` is called exactly once regardless of how many times `initTelemetry()` is invoked — fixes duplicate PostHog error event inflation (SMELL-010)
- `chatPanel.loadHistory` added to the `useEffect` dependency array in `ProjectWorkspace.tsx`, removing the stale closure risk on project switch — `eslint-disable-line` suppression removed (SMELL-004)
- `STORAGE_KEYS.QUESTIONING_MODE` and `STORAGE_KEYS.LOCALE` added to `src/constants/storage.ts` as the canonical definitions
- Local `QUESTIONING_STORAGE_KEY` constant removed from `useAIQuestioning.ts`, replaced with `STORAGE_KEYS.QUESTIONING_MODE` import (SMELL-009)
- Hardcoded `'ticketflow-locale'` replaced with `STORAGE_KEYS.LOCALE` in `OnboardingWizard.tsx` and `ProjectWorkspace.tsx` (DEAD-008)

## Task Commits

Each task was committed atomically:

1. **Task 1: Make initTelemetry() idempotent and fix useEffect dependency** - `9b07e31` (fix)
2. **Task 2: Centralize questioning-mode and locale storage keys in STORAGE_KEYS** - `230d223` (fix)

**Plan metadata:** (to be added after state update commit)

## Files Created/Modified

- `src/lib/telemetry.ts` - Added `errorTrackingSetUp` module-level boolean guard; wrapped `setupErrorTracking()` body; updated JSDoc
- `src/components/workspace/ProjectWorkspace.tsx` - Added `chatPanel.loadHistory` to useEffect deps; removed eslint-disable-line; added STORAGE_KEYS import; replaced hardcoded `'ticketflow-locale'` with `STORAGE_KEYS.LOCALE`
- `src/constants/storage.ts` - Added `QUESTIONING_MODE` and `LOCALE` entries to `STORAGE_KEYS` object
- `src/hooks/useAIQuestioning.ts` - Added `STORAGE_KEYS` import; removed local `QUESTIONING_STORAGE_KEY` constant; replaced usage with `STORAGE_KEYS.QUESTIONING_MODE`
- `src/components/onboarding/OnboardingWizard.tsx` - Added `STORAGE_KEYS` import; replaced hardcoded `'ticketflow-locale'` with `STORAGE_KEYS.LOCALE`

## Decisions Made

- `errorTrackingSetUp` guard is module-level, not closure-level — this ensures the guard persists across multiple `initTelemetry()` calls within the same JS module lifetime (the intended behavior)
- `AISettingsModal.tsx` references to `'ticketflow-questioning-mode'` (lines 33, 57) are owned by plan 33-01 and left for that plan to replace — avoids parallel execution file conflicts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 33-01 and 33-02 are now both complete for phase 33
- `AISettingsModal.tsx` hardcoded questioning-mode keys are handled by 33-01
- All SMELL-004, SMELL-009, SMELL-010, DEAD-008 findings from the audit are resolved across both plans

## Self-Check: PASSED

- src/lib/telemetry.ts: FOUND (verified via grep: errorTrackingSetUp on lines 54, 213-214)
- src/components/workspace/ProjectWorkspace.tsx: FOUND (chatPanel.loadHistory in dep array line 177)
- src/constants/storage.ts: FOUND (QUESTIONING_MODE line 45, LOCALE line 48)
- src/hooks/useAIQuestioning.ts: FOUND (STORAGE_KEYS import, QUESTIONING_MODE usage)
- src/components/onboarding/OnboardingWizard.tsx: FOUND (STORAGE_KEYS import, LOCALE usage)
- .planning/phases/33-type-safety-critical-fixes/33-02-SUMMARY.md: FOUND (this file)
- Commit 9b07e31: FOUND (fix(33-02): make initTelemetry idempotent and fix useEffect dependency)
- Commit 230d223: FOUND (fix(33-02): centralize questioning-mode and locale storage keys)
- pnpm build: PASSED (zero TypeScript errors, clean build)

---
*Phase: 33-type-safety-critical-fixes*
*Completed: 2026-02-19*
