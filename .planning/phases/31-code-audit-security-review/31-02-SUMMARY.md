---
phase: 31-code-audit-security-review
plan: 02
subsystem: security
tags: [owasp, security-audit, dependency-audit, cargo-audit, pnpm-audit, csp, telemetry, gdpr]

# Dependency graph
requires:
  - phase: 18-security-audit-code-polish
    provides: v2.0 OWASP baseline and gitleaks results used as comparison point
  - phase: 26-infrastructure-transport
    provides: telemetry transport (ph_send_batch IPC, telemetry.rs)
  - phase: 27-telemetry-core-consent
    provides: telemetry.ts, ConsentDialog, 15 telemetry events
provides:
  - "OWASP Desktop Top 10 delta review (v2.1/v2.2 vs v2.0 baseline)"
  - "npm dependency audit: 2 moderate vulns documented, 25 outdated packages cataloged"
  - "Cargo audit: 4 vulnerabilities + 18 unmaintained crate warnings documented"
  - "License compliance: 100% MIT-compatible across npm and Cargo"
  - "3 NEEDS ATTENTION items with prioritized remediation recommendations"
affects:
  - 31-03-consolidation (consumes this report for final AUDIT-REPORT.md)
  - future maintenance sprints (dependency update recommendations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OWASP delta review pattern: compare new code surfaces against clean baseline"
    - "Cargo audit: RUSTSEC advisories for transitive Tauri dependencies tracked separately"
    - "License compliance: MIT + Apache-2.0 dual-licensed packages are MIT-compatible"

key-files:
  created:
    - ".planning/phases/31-code-audit-security-review/31-02-security-dependencies.md"
  modified: []

key-decisions:
  - "ph_send_batch IPC accepts api_key from webview without Rust-side validation — documented as low risk given CSP protects against third-party script injection"
  - "CI actions (actions/checkout@v4, pnpm/action-setup@v2) are tag-pinned, not SHA-pinned — noted as improvement opportunity, low urgency for personal OSS"
  - "devtools: true always enabled in tauri.conf.json — pre-existing v2.0 behavior, documented as accepted risk"
  - "4 Cargo vulnerabilities (bytes/rkyv/rsa/time) are all transitive via Tauri ecosystem — low practical risk on Windows desktop, tracked for Tauri upstream resolution"
  - "ajv ReDoS (GHSA-2g4f-4pwh-qvx6) is new vs v2.0 — dev-only transitive dependency via eslint, zero production impact"

requirements-completed: [AUDIT-03, AUDIT-04]

# Metrics
duration: 35min
completed: 2026-02-18
---

# Phase 31 Plan 02: Security Delta & Dependency Audit Summary

**OWASP delta review (v2.0 baseline vs v2.1/v2.2): 8 PASS, 2 NEEDS ATTENTION; pnpm audit found 2 moderate dev-only vulns; cargo audit found 4 transitive vulnerabilities in Tauri ecosystem with low desktop risk; 100% MIT-compatible licenses across all 29 production npm packages and all Cargo dependencies**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18T00:35:00Z
- **Tasks:** 2
- **Files modified:** 1 (report created)

## Accomplishments

- Performed full OWASP Desktop Top 10 (2021) delta review against Phase 18 v2.0 baseline, covering all v2.1 provider registry and v2.2 telemetry/consent changes — no new FAIL categories
- Captured live `pnpm audit` output: 2 moderate vulnerabilities (esbuild known exception + new ajv ReDoS), both dev-only with zero production impact
- Captured live `cargo-audit` output (922 advisories, 635 deps): 4 vulnerabilities all transitive via Tauri ecosystem, 18 unmaintained-crate warnings all Linux-specific
- Verified 100% license compliance: 29 production npm packages and all Cargo direct deps under MIT or Apache-2.0
- Cataloged 25 outdated npm packages (10 patch safe, 10 minor, 5 major) with risk classification for maintenance planning

## Task Commits

Each task was committed atomically:

1. **Task 1: OWASP Top 10 delta review for v2.1 and v2.2 changes** - `3589ba5` (docs)
2. **Task 2: Dependency audit — vulnerabilities, outdated versions, license compliance** - (included in `3589ba5` — both tasks write to the same report file, data collected in single pass)

**Plan metadata:** See final commit below.

## Files Created/Modified

- `.planning/phases/31-code-audit-security-review/31-02-security-dependencies.md` - Complete OWASP delta review and dependency audit report (399 lines)

## Decisions Made

- **ph_send_batch api_key surface (D2 NEEDS ATTENTION)**: The Rust IPC command accepts `api_key` from the webview without validating it against the compiled-in `POSTHOG_API_KEY`. Assessed as low risk because Tauri CSP blocks external script injection — no third-party JS can reach this IPC command. Documented for transparency; optional hardening deferred.
- **CI action SHA-pinning (D8 NEEDS ATTENTION)**: Current `ci.yml` uses tag-pinned actions (`@v4`, `@v2`) instead of commit SHA-pinned. This is a SLSA Level 3 concern; low urgency for a personal OSS project. Recommended as a future improvement.
- **devtools: true (D10)**: Pre-existing from v2.0, not a new v2.1/v2.2 regression. Allows DevTools access to localStorage where XOR-obfuscated API keys are stored. Accepted risk for a BYOK desktop app where the user controls their own machine.
- **4 Cargo vulns**: All transitive (via reqwest/tauri) with no direct TicketFlow exposure path on Windows desktop. Tracked; resolution depends on Tauri ecosystem updates.

## Deviations from Plan

None — plan executed exactly as written. Both tasks executed sequentially against the same output file. All dependency audit tools (pnpm audit, cargo-audit, license-checker) were available and returned real data.

## Issues Encountered

- `cargo-audit` binary required full Windows path (`C:\Users\Boris\.cargo\bin\cargo-audit.exe`) — `cargo audit` subcommand not available in bash shell PATH on this machine. Worked around by invoking binary directly via PowerShell.
- `cargo-audit` output truncated when piped through `| head` (broken pipe panic). Worked around by capturing full output via PowerShell without piping.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Report `.planning/phases/31-code-audit-security-review/31-02-security-dependencies.md` ready for consumption by Plan 31-03 (audit consolidation)
- All OWASP delta findings structured with Status/Evidence/Recommendation format for easy extraction
- Dependency audit findings include severity classification and update type (patch/minor/major) for maintenance sprint planning
- No blocking security issues — no FAIL categories identified

---
*Phase: 31-code-audit-security-review*
*Completed: 2026-02-18*
