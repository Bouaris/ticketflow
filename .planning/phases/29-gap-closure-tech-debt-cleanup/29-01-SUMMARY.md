---
phase: 29-gap-closure-tech-debt-cleanup
plan: "01"
subsystem: telemetry
tags: [rust, tauri, posthog, startup-flush, option_env, dead-code, documentation]

requires:
  - phase: 26-infrastructure-transport-foundation
    provides: telemetry.rs with ph_send_batch command and offline queue

provides:
  - startup_flush delivering queued events on app startup via compile-time POSTHOG_API_KEY
  - Dead BatchPayload struct removed from telemetry.rs
  - 26-02-SUMMARY.md with requirements-completed frontmatter field

affects: [src-tauri/src/telemetry.rs]

tech-stack:
  added: []
  patterns: [option_env-for-compile-time-env-vars, rust-let-else-for-option-guard]

key-files:
  created: []
  modified:
    - src-tauri/src/telemetry.rs
    - .planning/phases/26-infrastructure-transport-foundation/26-02-SUMMARY.md

key-decisions:
  - "option_env!(VITE_POSTHOG_KEY) at compile time is the correct approach for Rust startup_flush — no runtime env var needed, key baked into binary at release build"
  - "let-else pattern used for Option<&str> guard — idiomatic Rust over match block"

patterns-established:
  - "option_env! macro for compile-time env vars in Rust telemetry modules"

requirements-completed: []

duration: 3min
completed: "2026-02-18"
---

# Phase 29 Plan 01: Gap Closure — startup_flush Fix and Docs Summary

**startup_flush now delivers queued offline telemetry events at app launch via compile-time POSTHOG_API_KEY read from option_env!("VITE_POSTHOG_KEY"); dead BatchPayload struct removed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T~time
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed `startup_flush` no-op bug: was passing `""` to `flush_queue`, now reads compile-time key via `option_env!("VITE_POSTHOG_KEY")`
- Added `POSTHOG_API_KEY: Option<&str>` constant using `option_env!` macro — graceful no-op when env var not set at build time (dev builds)
- Removed dead `BatchPayload` struct (6 lines including doc comment) that was defined but never referenced anywhere in `src-tauri/`
- Added `requirements-completed: [TELE-04, TELE-08]` to `26-02-SUMMARY.md` frontmatter
- Verified all 17 REQUIREMENTS.md checkboxes are `[x]` — no edits needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix startup_flush and remove dead BatchPayload struct** - `1995065` (fix)
2. **Task 2: Update 26-02-SUMMARY.md frontmatter and verify REQUIREMENTS.md** - `08e3e1e` (docs)

## Files Created/Modified

- `src-tauri/src/telemetry.rs` - Added `POSTHOG_API_KEY` constant via `option_env!`, fixed `startup_flush` to use it, removed dead `BatchPayload` struct
- `.planning/phases/26-infrastructure-transport-foundation/26-02-SUMMARY.md` - Added `requirements-completed: [TELE-04, TELE-08]` to YAML frontmatter

## Decisions Made

- `option_env!("VITE_POSTHOG_KEY")` is the correct Rust mechanism for reading build-time env vars — produces `Option<&'static str>` that compiles to `None` in dev builds and `Some(key)` in release builds where `VITE_POSTHOG_KEY` is set in CI environment
- Used Rust `let-else` pattern (`let Some(api_key) = POSTHOG_API_KEY else { return; }`) for idiomatic Option handling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`.planning/` directory is listed in `.gitignore`. Task 2's planning doc commit required `git add -f` to force-add the file. This is consistent with how previous planning docs commits were made in this project (e.g., commit `818b143`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 29 Plan 01 complete — all tech debt items from the v2.2 milestone audit addressed
- `startup_flush` functional for release builds with `VITE_POSTHOG_KEY` set in GitHub Actions
- All 17 v2.2 requirements confirmed complete

---
*Phase: 29-gap-closure-tech-debt-cleanup*
*Completed: 2026-02-18*
