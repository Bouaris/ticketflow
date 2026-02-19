---
phase: 34-dead-code-sweep
plan: 01
subsystem: ui
tags: [dead-code, cleanup, exports, imports, icons, console-log, typescript]

# Dependency graph
requires:
  - phase: 33-type-safety-critical-fixes
    provides: Type-safe provider registry and centralized storage keys
provides:
  - Merged tauri-bridge import in ConsentDialog.tsx
  - Removed clearTelemetry and getRecentTelemetry from ai-telemetry.ts
  - Removed getBuiltInProvider and getDefaultModelForProvider from ai-provider-registry.ts
  - DynamicBadge removed from barrel export (still in Badge.tsx for direct test import)
  - getProjectAIConfigKey removed from storage.ts
  - MaintenanceModal.tsx deleted
  - WelcomePage.tsx uses Icons.tsx for LogoIcon, FolderOpenIcon, SpinnerIcon
  - ai-context.ts console.log DEV-guarded
  - mockIpcWithState removed from stress-helpers.ts
affects: [35-god-file-refactor, future-maintenance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import.meta.env.DEV guard for debug console.log in production code paths"
    - "Barrel export cleanup: direct test imports preserved while removing re-exports"

key-files:
  created: []
  modified:
    - src/components/consent/ConsentDialog.tsx
    - src/lib/ai-telemetry.ts
    - src/lib/ai-provider-registry.ts
    - src/components/ui/index.ts
    - src/constants/storage.ts
    - src/components/welcome/WelcomePage.tsx
    - src/lib/ai-context.ts
    - src/test-utils/stress-helpers.ts
  deleted:
    - src/components/settings/MaintenanceModal.tsx

key-decisions:
  - "DynamicBadge kept in Badge.tsx but removed from barrel — test imports directly from Badge.tsx, not barrel"
  - "ErrorIcon, CloseSmallIcon, StarFilledIcon kept local in WelcomePage.tsx — these icons do not exist in Icons.tsx"
  - "StatefulSqlMock type kept in stress-helpers.ts — used as return type of createStatefulSqlMock(), only mockIpcWithState removed"
  - "console.warn in ai-context.ts left unguarded — logs actual errors, not debug info"

patterns-established:
  - "Use import.meta.env.DEV to guard debug console.log; console.warn for real errors stays unguarded"

requirements-completed: [FIX-05, FIX-08]

# Metrics
duration: 12min
completed: 2026-02-19
---

# Phase 34 Plan 01: Dead Code Sweep — Unused Exports and Orphaned Components Summary

**Removed 10 dead code findings across 9 files: deleted MaintenanceModal.tsx, purged 5 unused exports (clearTelemetry, getRecentTelemetry, getBuiltInProvider, getDefaultModelForProvider, getProjectAIConfigKey), replaced 3 local icon duplicates, guarded 3 console.log statements, and removed orphaned mockIpcWithState**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-19T12:06:06
- **Completed:** 2026-02-19T12:18:00
- **Tasks:** 2
- **Files modified:** 8 modified, 1 deleted

## Accomplishments
- Eliminated 5 never-imported exported functions (clearTelemetry, getRecentTelemetry, getBuiltInProvider, getDefaultModelForProvider, getProjectAIConfigKey) from their respective modules
- Deleted MaintenanceModal.tsx (orphaned since v1.5 — no import path existed in the entire codebase)
- Replaced 3 local SVG icon duplicates in WelcomePage.tsx with imports from the centralized Icons.tsx
- Guarded 3 debug console.log calls in ai-context.ts with import.meta.env.DEV
- Removed mockIpcWithState from stress-helpers.ts (exported but had zero consumers)
- Merged duplicate tauri-bridge imports in ConsentDialog.tsx into a single import line
- Removed DynamicBadge from the barrel export in ui/index.ts (preserved in Badge.tsx for direct test access)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove unused exports and merge duplicate imports (DEAD-001/002/003/005/007)** - `e111e4d` (fix)
2. **Task 2: Remove orphaned components, replace local icons, guard console.log, remove mockIpcWithState (DEAD-006/009/011, FIX-08)** - `b2950e5` (fix)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified
- `src/components/consent/ConsentDialog.tsx` - Merged two tauri-bridge imports into single import
- `src/lib/ai-telemetry.ts` - Removed clearTelemetry and getRecentTelemetry functions (+JSDoc)
- `src/lib/ai-provider-registry.ts` - Removed getBuiltInProvider and getDefaultModelForProvider functions (+JSDoc)
- `src/components/ui/index.ts` - Removed DynamicBadge from barrel export
- `src/constants/storage.ts` - Removed getProjectAIConfigKey function (+JSDoc)
- `src/components/welcome/WelcomePage.tsx` - Added import from Icons.tsx; removed local LogoIcon, FolderOpenIcon, SpinnerIcon definitions
- `src/lib/ai-context.ts` - Wrapped 3 console.log calls with import.meta.env.DEV guards
- `src/test-utils/stress-helpers.ts` - Removed mockIpcWithState function and JSDoc; StatefulSqlMock type retained
- ~~`src/components/settings/MaintenanceModal.tsx`~~ - DELETED

## Decisions Made
- DynamicBadge removed from barrel export but kept in Badge.tsx — the component test imports it directly via `'../components/ui/Badge'`, not from the barrel. Removing from barrel is safe.
- ErrorIcon, CloseSmallIcon, StarFilledIcon kept as local functions in WelcomePage.tsx — confirmed not present in Icons.tsx.
- StatefulSqlMock interface retained in stress-helpers.ts — it is the return type of createStatefulSqlMock() which is actively used by stress tests.
- Stale `.tsbuildinfo` caused a false TypeScript error on first build attempt — resolved by running `tsc -b --clean`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- First `pnpm build` run failed with `Expected 0 arguments, but got 1` on useAIFeedback.ts — stale `.tsbuildinfo` from Phase 33 changes. Fixed by running `npx tsc -b --clean` before rebuild. Not caused by this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 DEAD-xxx findings resolved (DEAD-001, 002, 003, 005, 006, 007, 009, 011 + FIX-08)
- DEAD-004 and DEAD-010 handled in Plan 34-02 (ai.ts and telemetry.ts ownership)
- Zero TypeScript errors, build passes cleanly
- Ready for Plan 34-02 (god file audit findings: telemetry.ts, ai.ts)

---
*Phase: 34-dead-code-sweep*
*Completed: 2026-02-19*
