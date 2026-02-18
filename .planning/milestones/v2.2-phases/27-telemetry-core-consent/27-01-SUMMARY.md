---
phase: 27-telemetry-core-consent
plan: "01"
subsystem: telemetry
tags: [posthog, consent, gdpr, ipc, localStorage, vitest]

# Dependency graph
requires:
  - phase: 26-infrastructure-transport-foundation
    provides: ph_send_batch Rust IPC relay, tauri-mocks ph_send_batch stub, 445 passing tests
provides:
  - Consent gate module (src/lib/telemetry.ts) with track(), getConsentState(), setConsentState(), shouldPromptConsent(), getDismissCount(), incrementDismissCount(), getDeviceId(), initTelemetry(), shutdownTelemetry()
  - Anonymous event relay via invoke('ph_send_batch') in Tauri mode, fetch to eu.i.posthog.com in web mode
  - Super-properties on every event (distinct_id, app_version, platform)
  - Unit tests (TCOV-05): 10 tests covering consent gate, dismiss logic, device ID, event batching
  - PRIVACY.md: full privacy policy (91 lines) in repo root
  - vitest.config.ts: __APP_VERSION__ and __CHANGELOG_CONTENT__ define constants for test environment
affects: [27-02, 27-03, app-startup, consent-dialog, settings-privacy-toggle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Approach B: direct IPC relay without posthog-js runtime — zero external SDK dependency"
    - "Module-level event queue (pendingEvents[]) with 100ms setTimeout debounce flush"
    - "Consent gate pattern: localStorage key 'ticketflow-telemetry-consent' checked before every dispatch"
    - "Anonymous device ID via crypto.randomUUID() persisted to localStorage"
    - "vi.resetModules() + dynamic import in beforeEach for fresh module state per test"

key-files:
  created:
    - src/lib/telemetry.ts
    - src/__tests__/telemetry.test.ts
    - PRIVACY.md
  modified:
    - vitest.config.ts

key-decisions:
  - "Approach B (direct IPC relay, no posthog-js runtime) — vitest.config.ts needs __APP_VERSION__ define to mirror vite.config.ts"
  - "shouldPromptConsent() logic: returns true when dismissCount <= 1 (0 or 1 dismisses = still prompt, 2+ = stop)"
  - "vi.mock('@tauri-apps/api/core') with vi.fn() used in tests for invoke spy assertions (not mockIPC intercept)"

patterns-established:
  - "Consent gate: track() first check is getConsentState() !== 'granted' — pure no-op before consent"
  - "Super-properties: distinct_id + app_version + platform merged into every event's properties object"
  - "Error tracking: anonymous unhandledrejection + window.error handlers truncate to 200 chars, no stack traces"

requirements-completed: [TELE-03, TELE-07, TCOV-05]

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 27 Plan 01: Telemetry Core + Consent Summary

**Consent-gated telemetry module with Tauri IPC relay and anonymous event batching — zero posthog-js runtime dependency, 10 tests covering GDPR consent gate scenarios, full PRIVACY.md**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-17T21:20:51Z
- **Completed:** 2026-02-17T21:26:47Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Created `src/lib/telemetry.ts`: self-contained module with consent gate, anonymous device ID, 100ms-debounced event batching, Tauri IPC relay (`ph_send_batch`) in desktop mode / direct fetch in web mode, super-properties (distinct_id, app_version, platform) on every event, error tracking handlers, and full lifecycle API (initTelemetry/shutdownTelemetry)
- Created `src/__tests__/telemetry.test.ts`: 10 vitest tests covering consent gate (no-op before consent, fires after, stops on revocation), dismiss count logic (0/1/2 dismiss scenarios for shouldPromptConsent), device ID UUID persistence, and multi-event batching in a single flush
- Created `PRIVACY.md`: 91-line comprehensive privacy policy in repo root — all required sections (overview, telemetry, what we collect/never collect, data processing, rights, retention, contact, change policy)
- Fixed `vitest.config.ts`: added `define` block with `__APP_VERSION__` and `__CHANGELOG_CONTENT__` so `src/lib/version.ts` can be imported in the test environment (mirrors vite.config.ts)
- Full test suite: 455 tests pass (10 new + 445 existing), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create telemetry.ts core module with consent gate and IPC relay** - `1955d83` (feat)
2. **Task 2: Create telemetry unit tests (TCOV-05) and PRIVACY.md** - `148d01f` (feat)

## Files Created/Modified

- `src/lib/telemetry.ts` — Consent gate, anonymous device ID, event queue with 100ms debounce, Tauri IPC relay / web fetch, super-properties, error tracking, lifecycle API. Zero posthog-js dependency.
- `src/__tests__/telemetry.test.ts` — 10 unit tests (TCOV-05): consent gate scenarios, dismiss logic, device ID, event batching
- `PRIVACY.md` — Full privacy policy document (91 lines) for repo root, linked from consent dialog
- `vitest.config.ts` — Added `__APP_VERSION__` and `__CHANGELOG_CONTENT__` define constants for test environment

## Decisions Made

- **Approach B confirmed** (direct IPC relay, no posthog-js at runtime): Plan specified this; execution confirmed it works cleanly with the Phase 26 `ph_send_batch` relay.
- **`vitest.config.ts` define constants**: Vite's `define` block in `vite.config.ts` is not automatically available in Vitest. Adding the same constants to `vitest.config.ts` was required to allow `src/lib/version.ts` (which uses `__APP_VERSION__`) to be imported in tests. This is a necessary test infrastructure fix.
- **`vi.mock('@tauri-apps/api/core')` for spy assertions**: The global `mockIPC` from `setupTauriMocks()` intercepts at transport level but doesn't expose a spy API. Mocking `@tauri-apps/api/core` with `vi.fn()` in the test file provides assertable invocations. Both work in combination.
- **`shouldPromptConsent()` boundary**: dismissCount <= 1 means 0 or 1 dismisses prompt the dialog; 2+ silently treat as declined. This matches the locked decision "re-prompt once on next launch, then treat as Decline if ignored again".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `__APP_VERSION__` define to vitest.config.ts**
- **Found during:** Task 2 (telemetry unit tests)
- **Issue:** `ReferenceError: __APP_VERSION__ is not defined` — Vite `define` constants from `vite.config.ts` are not propagated to the Vitest environment. `src/lib/telemetry.ts` imports `APP_VERSION` from `./version`, which uses the `__APP_VERSION__` define constant.
- **Fix:** Added `define: { __APP_VERSION__: JSON.stringify(packageJson.version), __CHANGELOG_CONTENT__: JSON.stringify('') }` to `vitest.config.ts`. This mirrors the Vite config define block and allows `version.ts` to be imported in tests.
- **Files modified:** `vitest.config.ts`
- **Verification:** All 10 telemetry tests pass after fix; all 455 tests in full suite pass.
- **Committed in:** `148d01f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test environment bug)
**Impact on plan:** Auto-fix was required for test infrastructure correctness. The fix benefits all future tests that import `src/lib/version.ts`. No scope creep.

## Issues Encountered

None — the `__APP_VERSION__` issue was immediately diagnosed and fixed in the same task.

## User Setup Required

None — no external service configuration required for the code itself. PostHog account and `VITE_POSTHOG_KEY` environment variable remain pending (noted in STATE.md pending todos — required before Phase 27 validation against live PostHog dashboard).

## Next Phase Readiness

- `telemetry.ts` is the foundation for all Phase 27 work — consent dialog (27-02), settings privacy toggle, and event instrumentation (27-03) can now import and use `track()`, `getConsentState()`, `setConsentState()`, `shouldPromptConsent()`
- Test infrastructure is now ready for future telemetry-related tests (vitest.config.ts define constants in place)
- PRIVACY.md is ready to be linked from the consent dialog in 27-02

---
*Phase: 27-telemetry-core-consent*
*Completed: 2026-02-17*

## Self-Check: PASSED

- `src/lib/telemetry.ts` — EXISTS
- `src/__tests__/telemetry.test.ts` — EXISTS
- `PRIVACY.md` — EXISTS
- `vitest.config.ts` — MODIFIED (define block added)
- Commit `1955d83` — EXISTS (Task 1: telemetry.ts)
- Commit `148d01f` — EXISTS (Task 2: tests + PRIVACY.md)
- All 455 tests pass (`pnpm test` verified)
- `pnpm build` passes (verified twice)
