---
phase: 36-security-dependencies-cleanup
plan: 02
subsystem: infra
tags: [npm, cargo, tauri, dependencies, security, pnpm, rust]

# Dependency graph
requires:
  - phase: 35-architecture-performance
    provides: "Stable codebase baseline for dependency updates"
provides:
  - "All npm patch/minor dependencies updated to latest compatible versions"
  - "Tauri ecosystem updated to 2.10.x (Cargo.toml + package.json synchronized)"
  - "bytes CVE and time CVE resolved via cargo update"
  - "Selected npm majors applied (@types/node 25.x, globals 17.x, eslint-plugin-react-refresh 0.5.x)"
  - "Deferred majors documented with rationale (eslint 10, jsdom 28, react-dropzone 15)"
affects: [security-audit, future-milestones]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tauri Cargo.toml uses semver ranges (2.10) not pinned versions (2.9.5) to allow patch auto-updates"
    - "eslint-plugin-react-refresh 0.5.x requires eslint>=9 peer dep — compatible with eslint 9.x until v10 migration"

key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock

key-decisions:
  - "eslint 9.x->10.x deferred: ESLint 10 is a major rewrite requiring flat config migration and eslint.config.js rewrite — defer to next milestone"
  - "jsdom 25.x->28.x deferred: dev-only dep, vitest handles jsdom internally, risk of breaking test environment"
  - "react-dropzone 14.x->15.x deferred: production dep used in BulkImportWizard, v15 has breaking API changes requiring component updates"
  - "@types/node 24.x->25.x applied: type-only package, no runtime impact, verified build passes"
  - "globals 16.x->17.x applied: no peer deps, compatible with eslint 9.x, globals.browser API unchanged"
  - "eslint-plugin-react-refresh 0.4.x->0.5.x applied: requires eslint>=9, compatible with current eslint 9.x"
  - "Cargo.toml tauri pin changed from '2.9.5' to '2.10' semver range to allow future patch updates without manual edits"
  - "npm audit 11 vulns (ajv/minimatch via eslint chain) are dev-only and fix requires ESLint 10 (deferred) — accepted risk"
  - "Cargo remaining vulns: rsa (RUSTSEC-2023-0071) via sqlx-mysql with no fix available; rkyv awaiting sqlx upstream"
  - "bytes 1.11.1 and time 0.3.47 CVEs resolved by cargo update — these were the two actionable Cargo vulns"

patterns-established:
  - "Three-stage npm update pattern: pnpm update (patches) -> explicit minor installs -> evaluated major installs"
  - "cargo update --dry-run before applying to preview changes safely"

requirements-completed: [FIX-15, FIX-16]

# Metrics
duration: 18min
completed: 2026-02-19
---

# Phase 36 Plan 02: Dependency Updates Summary

**npm patch/minor/selective-major updates + Tauri 2.10.x ecosystem sync with bytes/time CVE resolution via cargo update**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-02-19T15:37:00Z
- **Completed:** 2026-02-19T15:55:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Applied all npm patch and minor updates (20+ packages) including react 19.2.4, openai 6.22.0, tailwindcss 4.2.0, typescript-eslint 8.56.0, Tauri plugins 2.10.x
- Applied selective npm major updates: @types/node 25.x, globals 17.x, eslint-plugin-react-refresh 0.5.x — all verified compatible with current toolchain
- Updated Tauri in Cargo.toml from 2.9.5 to "2.10" semver range; cargo update applied 128 crate updates resolving bytes and time CVEs
- Cargo build passes (tauri 2.10.2, tauri-build 2.5.5) — full compilation in 1m04s
- All 523 tests pass after npm updates; pnpm build passes throughout all stages

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all npm dependencies (patch, minor, and major)** - `469304a` (chore)
2. **Task 2: Update Cargo dependencies and Tauri ecosystem** - `c424e23` (chore)

**Plan metadata:** (to be committed in final docs commit)

## Files Created/Modified

- `D:\PROJET CODING\ticketflow\package.json` - Updated 20+ npm dependencies to latest compatible versions; tailwindcss pinned to 4.2.0 (was 4.1.18)
- `D:\PROJET CODING\ticketflow\pnpm-lock.yaml` - Regenerated lock file with all new dependency resolutions
- `D:\PROJET CODING\ticketflow\src-tauri\Cargo.toml` - tauri "2.9.5" -> "2.10", tauri-build "2.5.3" -> "2.5"
- `D:\PROJET CODING\ticketflow\src-tauri\Cargo.lock` - Regenerated lock with 128 crate updates

## Decisions Made

- **ESLint 10 deferred:** Major rewrite with flat config migration; `eslint.config.js` would need full rewrite. Dev-only tooling risk not worth taking mid-milestone.
- **jsdom 28 deferred:** Dev-only dep, vitest manages jsdom version internally; jump from 25 to 28 risks test environment breakage.
- **react-dropzone 15 deferred:** Production dep in `BulkImportWizard.tsx`, v15 has breaking API changes that require component updates. Defer to dedicated milestone.
- **Cargo semver range for tauri:** Changed from pinned `"2.9.5"` to `"2.10"` range to get future 2.10.x patch fixes automatically without manual Cargo.toml edits.
- **npm audit 11 vulns accepted:** All through eslint -> ajv/minimatch chain. Dev-only tools. Fix requires ESLint 10 which is already deferred. No production exposure.

## Deviations from Plan

None - plan executed exactly as written. All three stages of npm updates applied, all major updates either applied or explicitly deferred with documented rationale. Cargo.toml and package.json kept synchronized for Tauri ecosystem.

## Issues Encountered

- `pnpm outdated` returns exit code 1 even when no errors occur (expected behavior — exit 1 means outdated packages found)
- `tailwindcss` was pinned at `4.1.18` (no `^`) while `@tailwindcss/vite` updated to `4.2.0` via `pnpm update`. Fixed by explicitly installing `tailwindcss@4.2.0` to keep them in sync.

## Cargo Audit Summary (for reference)

**Resolved by this update:**
- `bytes` 1.11.0 -> 1.11.1: ReDoS vulnerability resolved
- `time` 0.3.44 -> 0.3.47: Overflow vulnerability resolved

**Remaining (unfixable, all transitive via Tauri):**
- `rsa 0.9.10` (RUSTSEC-2023-0071): Marvin Attack timing side-channel via `sqlx-mysql -> sqlx`. No fixed version available. Documentation handled by plan 36-01.
- `rkyv 0.7.46`: Prior vulnerability, awaiting sqlx upstream update.
- Various `unmaintained` warnings (GTK3 bindings via wry): Linux-only code paths, not compiled on Windows target.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All dependencies at latest compatible versions
- Tauri ecosystem synchronized at 2.10.x
- eslint/jsdom/react-dropzone major upgrades documented as deferred items for next milestone planning
- Build and test suite green — ready for phase 36 completion

---
*Phase: 36-security-dependencies-cleanup*
*Completed: 2026-02-19*

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `package.json` | FOUND |
| `pnpm-lock.yaml` | FOUND |
| `src-tauri/Cargo.toml` | FOUND |
| `src-tauri/Cargo.lock` | FOUND |
| `36-02-SUMMARY.md` | FOUND |
| Commit `469304a` (Task 1) | VERIFIED |
| Commit `c424e23` (Task 2) | VERIFIED |
