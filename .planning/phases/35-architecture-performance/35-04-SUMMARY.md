---
phase: 35-architecture-performance
plan: 04
subsystem: ui
tags: [react, react-memo, tanstack-virtual, virtualization, performance, kanban, list-view]

# Dependency graph
requires:
  - phase: 35-architecture-performance
    provides: Phase context for performance optimizations (SMELL-012, SMELL-013)
provides:
  - React.memo-wrapped KanbanCard preventing sibling re-renders on drag-drop
  - Virtualized ListView rendering only visible rows for 500+ item performance
  - Memo-wrapped ListViewRow for stable row rendering
affects: [35-architecture-performance, future-kanban-work, future-listview-work]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-virtual (useVirtualizer)"]
  patterns:
    - "Padding-based virtual scrolling for HTML tables (spacer <tr> rows instead of position:absolute)"
    - "React.memo with inner function naming for DevTools readability (KanbanCardInner -> export memo(KanbanCardInner))"
    - "sortedItems memoized with useMemo to prevent unnecessary re-sorts on unrelated state changes"

key-files:
  created: []
  modified:
    - src/components/kanban/KanbanCard.tsx
    - src/components/list/ListView.tsx
    - src/lib/ai-client.ts

key-decisions:
  - "Padding-based virtualization (spacer rows) over absolute positioning: HTML table layout engines ignore position:absolute on <tr> elements"
  - "memo with named inner function (KanbanCardInner) preserves DevTools display name while enabling memo wrapping"
  - "No custom comparison function for KanbanCard.memo — shallow comparison sufficient since item reference changes on update (correct behavior)"
  - "AnimatePresence and motion.tr removed from ListView row level — virtualization takes priority over row enter/exit animations"
  - "estimateSize: 52px per row, overscan: 10 rows for smooth scrolling buffer"
  - "sortedItems wrapped in useMemo to avoid re-sorting on every parent render"

patterns-established:
  - "Padding virtualization for tables: paddingTop=virtualItems[0].start, paddingBottom=totalSize-lastItem.end, colSpan=999 on spacer <td>"
  - "Memo inner function pattern: function ComponentInner(props) {} export const Component = memo(ComponentInner)"

requirements-completed: [FIX-12]

# Metrics
duration: 25min
completed: 2026-02-19
---

# Phase 35 Plan 04: Architecture Performance — Memo and Virtualization Summary

**React.memo on KanbanCard and virtualized ListView using @tanstack/react-virtual with padding-based spacer rows for 500+ item performance**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-19T14:40:00Z
- **Completed:** 2026-02-19T15:05:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 target + 1 deviation fix)

## Accomplishments
- KanbanCard wrapped in `React.memo` — prevents full re-render of all cards when a single sibling item changes during drag-drop (SMELL-012 resolved)
- ListView virtualized with `@tanstack/react-virtual` — only visible rows rendered in DOM; 500+ items scroll without degradation (SMELL-013 resolved)
- `ListViewRow` extracted as a `memo`-wrapped component — stable row rendering when other rows change
- `AnimatePresence` and `motion.tr` removed from row level — virtualization incompatible with absolute-positioned animation transforms on table rows
- `sortedItems` computation memoized with `useMemo` to avoid unnecessary re-sorts

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap KanbanCard in React.memo** - `340b59f` (feat)
2. **Task 2: Wrap ListView row in React.memo and add virtualization** - `fd68bc9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/kanban/KanbanCard.tsx` - Renamed to `KanbanCardInner`, exported as `memo(KanbanCardInner)` preserving `KanbanCard` export name
- `src/components/list/ListView.tsx` - `ListViewRow` memo component, `useVirtualizer` integration, padding-based spacer rows, `useMemo` for sort
- `src/lib/ai-client.ts` - Removed unused imports blocking build (deviation Rule 3 fix)

## Decisions Made
- **Padding-based virtualization:** `position: absolute` on `<tr>` is ignored by browser table layout engines. Used spacer rows with calculated heights (`paddingTop = virtualItems[0].start`, `paddingBottom = totalSize - lastItem.end`) with `colSpan={999}` to span all columns regardless of column count.
- **No custom memo comparator for KanbanCard:** React's default shallow comparison is correct — `item` reference changes when the item is updated (intended behavior), primitive props (`isSelected`, `isDragOverlay`) change correctly.
- **`memo` with named inner function:** `function KanbanCardInner` + `export const KanbanCard = memo(KanbanCardInner)` preserves React DevTools display name while keeping the export name unchanged so all 20+ import sites need no modification.
- **Animation removed from ListView rows:** `AnimatePresence` + `motion.tr` row-level enter/exit animations conflict with virtualized rendering (position calculations). Performance takes priority; the card-level animations in KanbanCard are unaffected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused imports in src/lib/ai-client.ts blocking build**
- **Found during:** Task 1 (initial build verification)
- **Issue:** `src/lib/ai-client.ts` (untracked file from phase 35-01/02/03 work) had 4 unused imports: `recordTelemetry`, `getEffectiveAIConfig`, `resolveModelForProvider`, `getCurrentLocale` — TypeScript `noUnusedLocals: true` caused build failure
- **Fix:** Changed import from `{ recordTelemetry, type TelemetryErrorType }` to `type { TelemetryErrorType }` only; removed `getEffectiveAIConfig` and `resolveModelForProvider` from ai-config import (kept `getProvider`, `getProviderDisplayName`); removed `getCurrentLocale` from i18n import (kept `getTranslations`)
- **Files modified:** `src/lib/ai-client.ts`
- **Verification:** `pnpm build` passes after fix (confirmed via node subprocess check due to Bash exit code quirk)
- **Committed in:** `340b59f` (included in Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking import cleanup)
**Impact on plan:** Fix was necessary for build to pass. Pre-existing issue from phase 35 in-progress work.

## Issues Encountered
- **TypeScript incremental build cache quirk:** `tsc -b` reported false error about `useWorkspaceTypeSync` module not found on second run after clearing tsbuildinfo — resolved by running fresh `tsc -b` which compiled successfully. Root cause: stale incremental cache state from previous phase 35 work.
- **Bash tool exit code reporting:** The `pnpm build` command showed exit code 1 in the Bash tool despite actually succeeding. Verified via `node -e` subprocess wrapper which showed `SUCCESS` exit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FIX-12 (SMELL-012 + SMELL-013) resolved — all render performance smells from audit are addressed
- Phase 35-04 completes the architecture performance improvements targeting identified smells
- KanbanCard is memo-stable; any future callback props added to it should use `useCallback` in parent components for maximum effectiveness

---
*Phase: 35-architecture-performance*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: src/components/kanban/KanbanCard.tsx
- FOUND: src/components/list/ListView.tsx
- FOUND: .planning/phases/35-architecture-performance/35-04-SUMMARY.md
- FOUND: commit 340b59f (Task 1 - KanbanCard memo)
- FOUND: commit fd68bc9 (Task 2 - ListView virtualization)
