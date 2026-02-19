---
phase: 36-security-dependencies-cleanup
verified: 2026-02-19T16:30:00Z
status: gaps_found
score: 9/10 must-haves verified
re_verification: false
gaps:
  - truth: "SECURITY.md accurately reflects resolution status of bytes and time CVEs after cargo update"
    status: partial
    reason: "Plan 36-01 wrote initial tracking entries for bytes/time as 'tracked; resolution depends on upstream'. Plan 36-02 resolved both CVEs via cargo update (bytes 1.11.0->1.11.1, time 0.3.44->0.3.47) but did NOT update SECURITY.md status fields to 'resolved'. The documentation now contradicts the actual Cargo.lock state."
    artifacts:
      - path: "SECURITY.md"
        issue: "bytes status says 'tracked; resolution depends on upstream Tauri' — but cargo update already resolved it. time status says 'same upstream resolution path as bytes' — but it was also resolved."
    missing:
      - "Update SECURITY.md bytes entry: Status: resolved via cargo update (2026-02-19) — bytes updated to 1.11.1+"
      - "Update SECURITY.md time entry: Status: resolved via cargo update (2026-02-19) — time updated to 0.3.47+"
---

# Phase 36: Security, Dependencies, Cleanup — Verification Report

**Phase Goal:** All security findings hardened, all dependencies updated to latest compatible versions, README gallery restored, orphaned assets cleaned
**Verified:** 2026-02-19T16:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All CI actions in ci.yml reference commit SHAs, not mutable tags | VERIFIED | 3 `uses:` lines: `checkout@34e114876b...`, `pnpm/action-setup@eae0cfeb28...`, `setup-node@49933ea528...` — zero `@v` tag references |
| 2 | SECURITY.md documents SEC-D2 (ph_send_batch IPC api_key) as accepted risk with rationale | VERIFIED | Lines 184-198: full Finding/Risk/Mitigations/Accepted because/Reference structure present |
| 3 | SECURITY.md documents SEC-D10 (devtools always enabled) as accepted risk with rationale | VERIFIED | Lines 202-216: full Finding/Risk/Mitigations/Accepted because/Reference structure present |
| 4 | SECURITY.md documents tracked Cargo vulnerabilities (bytes, time, rkyv, rsa) | VERIFIED | Lines 124-128: all four crates documented in Cargo exceptions section |
| 5 | SECURITY.md CVE status fields accurately reflect actual Cargo.lock resolution state | FAILED | bytes and time were resolved by cargo update in plan 36-02 but SECURITY.md still shows them as "tracked; resolution depends on upstream Tauri" — contradicts Cargo.lock reality |
| 6 | All safe npm patch and minor updates applied and build passes | VERIFIED | tailwindcss 4.2.0, @tauri-apps/api 2.10.1, openai 6.22.0, typescript-eslint 8.56.0, motion 12.34.2, @types/node 25.x — all at claimed versions |
| 7 | Tauri ecosystem updated to 2.10.x in both Cargo.toml and package.json | VERIFIED | Cargo.toml: `tauri = "2.10"`, tauri-build `"2.5"`; package.json: @tauri-apps/api 2.10.1, @tauri-apps/cli 2.10.0 |
| 8 | Cargo dependencies with available fixes (bytes, time) are updated in Cargo.lock | VERIFIED | 36-02 SUMMARY confirms cargo update applied 128 crate updates resolving bytes 1.11.1 and time 0.3.47 CVEs; Cargo.toml uses semver ranges for auto-resolution |
| 9 | README gallery displays 6 images in a 3x2 table layout | VERIFIED | README.md lines 213-244: 3 `<tr>` rows x 2 `<td>` columns = 6 images in HTML table |
| 10 | No orphaned gallery assets (every gallery-*.png and screenshot-dark.png appears in README.md) | VERIFIED | All 5 gallery-*.png files + screenshot-dark.png referenced in README gallery; screenshot-light.png in hero, GIFs in "See it in action" — zero unaccounted assets |

**Score:** 9/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | SHA-pinned GitHub Actions | VERIFIED | All 3 `uses:` lines use 40-char hex SHAs with `# vN` comment; `grep @v` returns 0 matches |
| `SECURITY.md` | Accepted risk docs + Cargo tracking | VERIFIED (partial) | SEC-D2 and SEC-D10 fully documented; Cargo tracking present but bytes/time resolution status stale |
| `package.json` | Updated npm dependencies | VERIFIED | 20+ packages at latest compatible versions; deferred: eslint 10, jsdom 28, react-dropzone 15 |
| `pnpm-lock.yaml` | Locked dependency tree | VERIFIED | File exists and was regenerated per 36-02 SUMMARY |
| `src-tauri/Cargo.toml` | Updated Rust dependencies | VERIFIED | tauri "2.10", tauri-build "2.5" semver ranges |
| `src-tauri/Cargo.lock` | Locked Cargo tree after cargo update | VERIFIED | 128 crate updates applied per 36-02 SUMMARY |
| `README.md` | 3x2 gallery with all 6 images | VERIFIED | gallery-editor, gallery-ai-settings, gallery-bulkimport, gallery-settings, gallery-gsd-integration, screenshot-dark all present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/ci.yml` | GitHub Actions runners | SHA-pinned action references | WIRED | 3 SHA refs confirmed: `@34e114876b`, `@eae0cfeb28`, `@49933ea528` |
| `SECURITY.md` | `ph_send_batch` IPC finding | Text reference to SEC-D2 | WIRED | "The `ph_send_batch` Rust IPC command" in Accepted Risks section |
| `SECURITY.md` | Cargo vulnerability tracking | Dependency exceptions section | WIRED | bytes, time, rkyv 0.7.x, rsa 0.9.x all documented |
| `README.md` | `assets/` | img src references with `assets/gallery-` | WIRED | 6 `<img src="./assets/...">` references in Gallery table |
| `package.json` | `pnpm-lock.yaml` | pnpm install | WIRED | Lock file was regenerated after package.json updates |
| `src-tauri/Cargo.toml` | `src-tauri/Cargo.lock` | cargo update | WIRED | 128 crate updates applied |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FIX-14 | 36-01 | Security findings hardened: IPC key validation, SHA-pinned CI, devtools conditional (SEC-D2, SEC-D8, SEC-D10) | VERIFIED | SHA-pins in ci.yml (SEC-D8); SEC-D2 and SEC-D10 documented as accepted risks in SECURITY.md. Note: requirement text says "devtools conditional" but plan chose accepted-risk documentation over conditional compilation — audit finding explicitly allowed either approach ("accepted risk or conditionally disable"). devtools remains `true` unconditionally, documented as accepted. |
| FIX-15 | 36-02 | Cargo dependencies updated where fixes available; unfixable tracked in SECURITY.md (DEP-001) | PARTIAL | bytes and time CVEs were resolved by cargo update (bytes 1.11.1, time 0.3.47). rkyv 0.7.x and rsa 0.9.x correctly tracked as unfixable. However SECURITY.md still shows bytes/time as "tracked; resolution depends on upstream" instead of "resolved" — documentation gap. |
| FIX-16 | 36-02 | All npm dependencies updated (patch + minor + major) with build verification (DEP-002, DEP-003, DEP-004) | VERIFIED | 20+ npm packages updated; selective majors applied (@types/node 25, globals 17, eslint-plugin-react-refresh 0.5); eslint/jsdom/react-dropzone deferred with documented rationale; 523 tests pass |
| FIX-17 | 36-03 | README gallery restored to 3x2 or orphaned assets cleaned from repository | VERIFIED | Gallery expanded from 2x2 to 3x2 (6 images); all gallery-*.png and screenshot-dark.png referenced; zero orphaned gallery assets |

**Orphaned requirements check:** REQUIREMENTS.md maps only FIX-14, FIX-15, FIX-16, FIX-17 to Phase 36. All four are accounted for by plans 36-01, 36-02, 36-03. No orphaned requirements.

---

## Anti-Patterns Found

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `SECURITY.md` lines 124-125 | bytes and time show "Status: tracked; resolution depends on upstream Tauri" despite having been resolved by cargo update on 2026-02-19 | Warning | Documentation accuracy — readers following SECURITY.md guidance would incorrectly believe these CVEs are still unresolved |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in modified files. No empty implementations.

---

## Human Verification Required

### 1. pnpm build verification

**Test:** Run `pnpm build` from project root
**Expected:** Exit 0, no TypeScript errors, expected chunk size warning (>500kB) is pre-existing
**Why human:** Build tool execution cannot be verified statically; SUMMARY claims exit 0 but cannot be confirmed programmatically in this session

### 2. pnpm test verification

**Test:** Run `pnpm test` from project root
**Expected:** 523 tests passing across 25 files — same count as pre-Phase 36 to confirm no regressions from dependency updates
**Why human:** Test execution cannot be verified statically; SUMMARY claims 523/523 but new dependency versions (tailwindcss 4.2, openai 6.22, @types/node 25) could have introduced subtle regressions

### 3. Deferred major updates documented

**Test:** Run `pnpm outdated` and confirm only eslint 10, jsdom 28, react-dropzone 15 appear as major-version outdated
**Expected:** No unaccounted deferred major updates; all deferrals have documented rationale in 36-02 SUMMARY
**Why human:** `pnpm outdated` output cannot be run in this session

---

## Gaps Summary

One gap found, low severity:

**Gap: SECURITY.md bytes/time CVE status not updated after cargo update resolution**

Plan 36-01 wrote initial tracking entries for bytes and time CVEs with status "tracked; resolution depends on upstream Tauri" — which was accurate at the time (before cargo update ran). Plan 36-01 explicitly noted these would be updated by plan 36-02 after running cargo update.

Plan 36-02 successfully resolved both CVEs (bytes 1.11.0 -> 1.11.1, time 0.3.44 -> 0.3.47) via cargo update, but the SECURITY.md was not updated to reflect this. The result is a documentation contradiction: SECURITY.md tells readers bytes and time are still vulnerable (pending upstream fix), while Cargo.lock contains the patched versions.

This is a documentation accuracy issue rather than a security issue — the actual runtime libraries are patched. The fix requires two line edits in SECURITY.md to change the status fields from "tracked" to "resolved via cargo update (2026-02-19)".

This gap does not block the phase goal (security hardened, deps updated, gallery restored) but FIX-15 ("unfixable tracked in SECURITY.md") is only partially satisfied because the fixable ones are inaccurately still shown as unresolved.

---

## Summary

Phase 36 achieved its primary goals:

- CI supply chain hardened: all 3 GitHub Actions SHA-pinned, zero mutable tag references
- Security risks documented: SEC-D2 and SEC-D10 formally accepted with structured rationale in SECURITY.md
- Dependencies updated: npm patch/minor/selective-major applied (20+ packages); Tauri 2.10.x synchronized across Cargo.toml and package.json; bytes and time CVEs resolved via cargo update
- README gallery restored: 2x2 expanded to 3x2, all 6 screenshots displayed, zero orphaned assets

One documentation accuracy gap: SECURITY.md Cargo vulnerability tracking entries for bytes and time were not updated to show "resolved" status after plan 36-02 ran cargo update. Two line edits needed.

---

_Verified: 2026-02-19T16:30:00Z_
_Verifier: Claude (gsd-verifier) — Sonnet 4.6_
