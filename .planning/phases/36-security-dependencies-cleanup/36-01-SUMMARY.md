---
phase: 36-security-dependencies-cleanup
plan: 01
subsystem: infra
tags: [github-actions, ci, security, supply-chain, sha-pinning, cargo, telemetry]

# Dependency graph
requires:
  - phase: 31-code-audit
    provides: AUDIT-REPORT.md with SEC-D2, SEC-D8, SEC-D10 findings and Cargo vulnerability list
provides:
  - SHA-pinned GitHub Actions in ci.yml (eliminates tag-mutation risk)
  - SECURITY.md Accepted Risks section (SEC-D2, SEC-D10 formally documented)
  - SECURITY.md Cargo vulnerability tracking (bytes, time, rkyv, rsa)
  - SECURITY.md Security Audits updated with Phase 31 and Phase 36 hardening
affects: [36-02-cargo-update, future-ci-maintenance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SHA-pinned GitHub Actions with human-readable tag comment suffix (e.g., @sha... # v4)"
    - "Accepted risk documentation pattern: Finding + Risk + Mitigations + Accepted because + Reference"
    - "Cargo vulnerability tracking in SECURITY.md exceptions with upstream resolution status"

key-files:
  created: []
  modified:
    - ".github/workflows/ci.yml"
    - "SECURITY.md"

key-decisions:
  - "Use actual commit SHAs from GitHub API (not plan-provided placeholder SHAs) — resolved pnpm/action-setup v2.4.1 = eae0cfeb286e66ffb5155f1a79b90583a127a68b"
  - "SHA-pin to latest v2.x (v2.4.1) for pnpm/action-setup — plan said @v2 tag which was a moving tag, pinned to latest stable v2.x release instead"
  - "Accepted risk documentation added after Secure Development Practices section (before footer) per plan spec"
  - "Split Dependency Security exceptions into npm and Cargo sub-sections for clarity"
  - "Security Audits section restructured: Phase 31 as most recent with Phase 36 hardening subsection, Phase 18 demoted to Previous audit"

patterns-established:
  - "SHA-pinned CI actions: all uses: lines reference 40-char hex SHA + human-readable comment tag"
  - "Accepted risk entries: structured as Finding / Risk / Mitigations list / Accepted because rationale / Reference"

requirements-completed: [FIX-14]

# Metrics
duration: 15min
completed: 2026-02-19
---

# Phase 36 Plan 01: CI Supply Chain Hardening and Security Risk Documentation Summary

**SHA-pinned all 3 GitHub Actions CI steps (eliminating tag-mutation supply chain risk) and formally documented SEC-D2 (IPC api_key pass-through) and SEC-D10 (devtools always enabled) as accepted risks in SECURITY.md, with Cargo vulnerability tracking for bytes, time, rkyv, and rsa**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-19
- **Completed:** 2026-02-19
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- SHA-pinned all 3 GitHub Actions in `.github/workflows/ci.yml` using actual commit SHAs resolved via GitHub API — zero mutable tag references remain
- Added formal "Accepted Risks" section to SECURITY.md covering SEC-D2 (ph_send_batch IPC api_key pass-through) and SEC-D10 (devtools always enabled in production), each with structured finding/risk/mitigations/rationale/reference
- Updated "Dependency Security" exceptions with Cargo vulnerability tracking (bytes, time, rkyv 0.7.x, rsa 0.9.x — all transitive via Tauri with upstream resolution status)
- Updated Security Audits section to reference Phase 31 (2026-02-18) as most recent audit; documented Phase 36 hardening actions
- Bumped SECURITY.md footer to version 2.2.1, date 2026-02-19

## Task Commits

Each task was committed atomically:

1. **Task 1: SHA-pin all GitHub Actions in ci.yml** - `2943963` (chore)
2. **Task 2: Document accepted security risks and Cargo vulnerabilities in SECURITY.md** - `ae54bd6` (docs)

## Files Created/Modified

- `.github/workflows/ci.yml` - All 3 `uses:` lines now reference 40-char commit SHAs with `# vN` comment suffix; zero `@v` tag references remain
- `SECURITY.md` - Added Accepted Risks section (SEC-D2, SEC-D10), expanded Dependency Security exceptions (npm + Cargo subsections), updated Security Audits history, bumped version to 2.2.1

## Decisions Made

- SHA-pinned to `pnpm/action-setup@v2.4.1` (latest v2.x release, commit `eae0cfeb...`) rather than the plan's placeholder SHA — resolved via GitHub API since the `@v2` major tag was not directly available
- Split Dependency Security "Current exceptions" into `npm:` and `Cargo:` subsections for clarity — the single-paragraph format was insufficient for tracking 5 distinct vulnerabilities
- Structured accepted risk entries with consistent four-field format (Finding / Risk / Mitigations / Accepted because) matching standard security documentation practice
- Security Audits section restructured to show Phase 31 as primary (most recent) with Phase 36 hardening as sub-entry; Phase 18 demoted to "Previous audit" to accurately reflect audit history

## Deviations from Plan

None — plan executed exactly as written. The pnpm/action-setup SHA resolution required additional API calls (the `@v2` major tag returned a 404, so the latest v2.x release tag was used instead), but this is a minor execution detail, not a deviation from plan intent.

## Issues Encountered

- `pnpm/action-setup/git/ref/tags/v2` returned HTTP 404 — the repository uses specific release tags (v2.0.0, v2.1.0, etc.) rather than a floating `v2` major tag. Resolved by listing releases, identifying `v2.4.1` as the latest v2.x release, dereferencing its annotated tag SHA to get the underlying commit SHA (`eae0cfeb286e66ffb5155f1a79b90583a127a68b`).

## Next Phase Readiness

- Plan 36-01 complete — CI supply chain hardened, security documentation up to date
- Ready for Plan 36-02: cargo update and Cargo audit (will update the resolution status fields added to SECURITY.md in this plan)
- No blockers

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`
- FOUND: `SECURITY.md`
- FOUND: `.planning/phases/36-security-dependencies-cleanup/36-01-SUMMARY.md`
- FOUND: commit `2943963` (chore(36-01): SHA-pin all GitHub Actions in ci.yml)
- FOUND: commit `ae54bd6` (docs(36-01): document accepted security risks and Cargo vulnerabilities in SECURITY.md)

---
*Phase: 36-security-dependencies-cleanup*
*Completed: 2026-02-19*
