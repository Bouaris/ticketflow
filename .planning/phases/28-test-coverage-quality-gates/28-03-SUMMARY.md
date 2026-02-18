---
phase: 28-test-coverage-quality-gates
plan: 03
subsystem: infra
tags: [github-actions, ci, vitest, coverage, yaml]

# Dependency graph
requires:
  - phase: 28-test-coverage-quality-gates/28-01
    provides: vitest.config.ts per-file thresholds for 4 critical lib modules
  - phase: 28-test-coverage-quality-gates/28-02
    provides: ai-retry.test.ts and ai-health.test.ts pushing modules above 70% line coverage

provides:
  - GitHub Actions CI workflow (.github/workflows/ci.yml) running pnpm test:coverage on every push/PR to master
  - End-to-end validated: 490 tests pass, all 4 per-file thresholds met (parser 86%, serializer 94%, ai-retry 80%, ai-health 100%)

affects: [future PRs, contributors, release pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI workflow separate from release.yml — different trigger (branch push/PR vs tag push), different purpose (tests vs release)"
    - "ubuntu-latest for JS-only test CI — no Rust toolchain needed, faster and cheaper than windows-latest"
    - "pnpm test:coverage as single CI gate — runs tests AND enforces per-file thresholds in one step"

key-files:
  created:
    - .github/workflows/ci.yml
  modified: []

key-decisions:
  - "ubuntu-latest chosen over windows-latest for CI — JS tests run in jsdom, no OS-specific behavior; ubuntu is faster and avoids Windows-only pathe crash (already fixed in Plan 01 but ubuntu sidesteps it entirely)"
  - "Single pnpm test:coverage command enforces both test pass and 70% coverage threshold — no separate coverage upload step"
  - "No coverage badge in this plan — adds complexity (artifact upload, shields.io URL) deferred for future iteration"
  - "pnpm test:coverage exits 0 confirmed via cmd /c on Windows — bash tool stderr propagation was masking true exit code, actual vitest exit is clean"

patterns-established:
  - "CI-as-quality-gate: every PR to master must pass pnpm test:coverage before merge"
  - "Per-file threshold enforcement via vitest.config.ts thresholds object — file-specific not global"

requirements-completed: [TINF-03]

# Metrics
duration: 15min
completed: 2026-02-18
---

# Phase 28 Plan 03: CI Workflow & Final Validation Summary

**GitHub Actions CI workflow shipping `pnpm test:coverage` on every push/PR to master, with all 4 per-file thresholds confirmed passing (490 tests, zero failures)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-18T02:05:00Z
- **Completed:** 2026-02-18T02:20:00Z
- **Tasks:** 2
- **Files modified:** 1 created

## Accomplishments
- Created `.github/workflows/ci.yml` — triggers on push to master and pull_request targeting master, runs pnpm 9 + Node 20 + `pnpm test:coverage`
- Confirmed end-to-end: 490 tests across 22 test files, zero failures, zero regressions
- Confirmed all 4 per-file thresholds met: parser.ts 86.25% lines, serializer.ts 94.47% lines, ai-retry.ts 79.76% lines, ai-health.ts 100% lines
- Confirmed `pnpm build` passes (TypeScript clean, chunk size warning expected and documented)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions CI workflow** - `4b852d1` (feat)
2. **Task 2: Validate all coverage thresholds pass locally** - (validation only — no source changes, documented in plan metadata commit)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified
- `.github/workflows/ci.yml` - GitHub Actions CI workflow: triggers on push/PR to master, runs pnpm 9 + Node 20 + `pnpm test:coverage`

## Decisions Made
- **ubuntu-latest:** JS tests run in jsdom, no OS-specific behavior. Ubuntu is faster and cheaper than windows-latest. The html reporter crash (pathe v2 Windows issue) was already fixed in Plan 01 but ubuntu avoids it entirely as a secondary benefit.
- **pnpm/action-setup@v2 + version: 9:** Matches existing release.yml pattern exactly.
- **Single `pnpm test:coverage` command:** Runs all tests AND enforces per-file thresholds in one step. CI fails if any threshold is below 70% or any test fails.
- **No coverage badge:** Adds complexity (artifact upload, shields.io URL). Deferred for future iteration.
- **Exit code verification:** On Windows, the bash tool reports exit code 1 when stderr output is present even if vitest exits 0. Verified true exit code via `cmd /c pnpm test:coverage` through Node.js spawnSync — exit code confirmed 0, all thresholds pass.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Windows bash exit code masking:** The bash tool on Windows propagates exit code 1 when stderr output is present, even if the underlying process exits cleanly. Initial `pnpm test:coverage` calls appeared to fail but all 490 tests passed and no threshold violations existed. Resolved by running via Node.js `execFileSync('cmd', ['/c', 'pnpm', 'test:coverage'])` to get the true exit code (0). This is a test environment peculiarity — on Ubuntu (which CI uses), bash handles stderr/exit codes correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 28 is complete: all 3 plans executed (28-01: parser/serializer tests + thresholds, 28-02: ai-retry/ai-health tests, 28-03: CI workflow + validation)
- Requirements TCOV-01/02/03/04 and TINF-03/04 all delivered
- CI workflow is live — every future PR to master will run `pnpm test:coverage` as a quality gate
- v2.2 milestone complete

---
*Phase: 28-test-coverage-quality-gates*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml` (created, committed 4b852d1)
- FOUND: `.planning/phases/28-test-coverage-quality-gates/28-03-SUMMARY.md`
- CONFIRMED: commit 4b852d1 exists in git log
- CONFIRMED: 490 tests pass, 22 test files, zero failures
- CONFIRMED: parser.ts 86.25% lines >= 70% threshold
- CONFIRMED: serializer.ts 94.47% lines >= 70% threshold
- CONFIRMED: ai-retry.ts 79.76% lines >= 70% threshold
- CONFIRMED: ai-health.ts 100% lines >= 70% threshold
- CONFIRMED: pnpm build passes (TypeScript clean)
