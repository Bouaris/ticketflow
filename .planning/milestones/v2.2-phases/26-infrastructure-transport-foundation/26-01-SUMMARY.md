---
phase: 26-infrastructure-transport-foundation
plan: 01
subsystem: testing
tags: [vitest, tauri, mocks, ipc, sql, test-infrastructure]

# Dependency graph
requires: []
provides:
  - "Vitest 4.x test runner compatible with Vite 7"
  - "Shared setupTauriMocks() function intercepting plugin:sql|* IPC commands at transport layer"
  - "ph_send_batch IPC stub for Phase 27 telemetry tests"
affects:
  - 26-02
  - 27-posthog-telemetry-consent-gate
  - all future test files needing Tauri SQL mocking

# Tech tracking
tech-stack:
  added:
    - "vitest@4.0.18 (upgraded from 2.1.9)"
    - "@vitest/coverage-v8@4.0.18 (upgraded from 2.1.9)"
  patterns:
    - "IPC-level Tauri mocking via @tauri-apps/api/mocks (mockIPC + mockWindows) in global Vitest setup"
    - "setupTauriMocks() called in setupFiles before any test imports - establishes __TAURI_INTERNALS__ globally"

key-files:
  created:
    - "src/test-utils/tauri-mocks.ts"
  modified:
    - "src/test-utils/setup.ts"
    - "src/__tests__/tauriBridge.test.ts"
    - "package.json"
    - "pnpm-lock.yaml"

key-decisions:
  - "IPC-level mocking (mockIPC/mockWindows) chosen over JS module mocking - intercepts at transport layer preventing __TAURI_INTERNALS__ errors from plugin-sql"
  - "setupTauriMocks() placed in global setupFiles (not per-test) so __TAURI_INTERNALS__ is available before any module-level side effects run"
  - "afterEach calls clearMocks() (not mockWindows cleanup) - __TAURI_INTERNALS__ stays for the file, IPC handler is refreshed"
  - "ph_send_batch handler included in setupTauriMocks() to pre-stub Phase 27 telemetry relay command"
  - "jsdom stays at ^25.0.1 (not upgraded to 27+) - Blob constructor incompatibility with Vitest 4"

patterns-established:
  - "Global Tauri IPC mock: all tests in the suite have __TAURI_INTERNALS__ available via beforeAll in setup.ts"
  - "Test isolation: tauriBridge tests that check absence of __TAURI_INTERNALS__ must explicitly delete/restore it"

requirements-completed:
  - TINF-01
  - TINF-02

# Metrics
duration: 12min
completed: 2026-02-17
---

# Phase 26 Plan 01: Vitest 4.x Upgrade + Tauri IPC Mock Infrastructure Summary

**Vitest upgraded from 2.x to 4.x with shared setupTauriMocks() intercepting plugin:sql|* IPC commands via mockIPC at transport layer, eliminating __TAURI_INTERNALS__ errors from all tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-17T17:53:54Z
- **Completed:** 2026-02-17T18:06:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Upgraded Vitest from 2.1.9 to 4.0.18 with matching @vitest/coverage-v8; vitest.config.ts required no changes (no breaking config used)
- Created `src/test-utils/tauri-mocks.ts` with `setupTauriMocks()` that intercepts `plugin:sql|load`, `plugin:sql|execute`, `plugin:sql|select`, `plugin:sql|close`, and `ph_send_batch` IPC commands
- Integrated `setupTauriMocks()` into global `setup.ts` via `setupFiles` — zero `__TAURI_INTERNALS__` errors in test output

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade Vitest to 4.x and verify config compatibility** - `427e605` (chore)
2. **Task 2: Create shared setupTauriMocks() with plugin:sql IPC handlers** - `77ca9f4` (feat)

## Files Created/Modified

- `src/test-utils/tauri-mocks.ts` - IPC-level Tauri mock with setupTauriMocks() exporting plugin:sql and ph_send_batch handlers
- `src/test-utils/setup.ts` - Added import and call to setupTauriMocks() before localStorage mock
- `src/__tests__/tauriBridge.test.ts` - Fixed test 17: explicitly delete/restore __TAURI_INTERNALS__ since global setup now defines it
- `package.json` - vitest ^2.1.8 → ^4.0.18, @vitest/coverage-v8 ^2.1.8 → ^4.0.18
- `pnpm-lock.yaml` - Lockfile updated for new dependency tree

## Decisions Made

- Chose IPC-level mocking (`mockIPC`/`mockWindows` from `@tauri-apps/api/mocks`) over JS module-level mocking — this intercepts at the transport layer preventing the `@tauri-apps/plugin-sql` from throwing `__TAURI_INTERNALS__ is not defined` during module initialization
- `setupTauriMocks()` uses `beforeAll` (not `beforeEach`) for `mockWindows` since jsdom environments persist `__TAURI_INTERNALS__` once set; IPC handler is re-established per `beforeAll` scope
- `clearMocks()` in `afterEach` clears the IPC invoke handler between tests without touching `__TAURI_INTERNALS__` itself
- Pre-included `ph_send_batch` stub in the shared mock to support Phase 27 telemetry tests without requiring separate setup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tauriBridge test 17 broken by global __TAURI_INTERNALS__ setup**
- **Found during:** Task 2 (Create shared setupTauriMocks())
- **Issue:** Test 17 (`returns false when __TAURI_INTERNALS__ is not present`) expected `isTauri()` to return `false` in a clean jsdom environment. After integrating `setupTauriMocks()` globally, `__TAURI_INTERNALS__` is now always defined before tests run, causing test 17 to fail (isTauri() returns `true`).
- **Fix:** Updated test 17 to explicitly `delete window.__TAURI_INTERNALS__` before the assertion and restore it afterwards — making the test independent of global mock state.
- **Files modified:** `src/__tests__/tauriBridge.test.ts`
- **Verification:** tauriBridge.test.ts passes 35/35 tests
- **Committed in:** `77ca9f4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Auto-fix necessary for correctness — the global Tauri mock changed test environment assumptions. Fix is minimal and correct.

## Issues Encountered

- `tauri-mocks.ts` was already tracked in git from plan documentation commit (`641233a`) — the linter refined the content (added `import type { InvokeArgs }` for proper type annotation). No functional impact; the file matched the plan specification.
- Pre-existing test failures in `useProjects`, `useUpdater`, `components`, `KanbanBoard`, `ItemEditorModal` tests — all failing due to `useTranslation must be used within an I18nProvider` (missing I18nProvider wrapper in test render). These are pre-existing, NOT introduced by this plan.

## Next Phase Readiness

- Plan 26-02 (Rust ph_send_batch relay) can now be tested with the IPC stub already in place
- All future plans in Phase 26 and 27 can use `setupTauriMocks()` from `src/test-utils/tauri-mocks.ts` for SQL and telemetry command mocking
- Pre-existing test failures (I18nProvider missing, Zod schema assertions) are out of scope for this plan; logged in deferred items

---
*Phase: 26-infrastructure-transport-foundation*
*Completed: 2026-02-17*

## Self-Check: PASSED

All artifacts verified:
- `src/test-utils/tauri-mocks.ts` — FOUND
- `src/test-utils/setup.ts` — FOUND (contains setupTauriMocks call)
- `26-01-SUMMARY.md` — FOUND
- Commit `427e605` (Task 1 - vitest upgrade) — FOUND
- Commit `77ca9f4` (Task 2 - setupTauriMocks integration) — FOUND
