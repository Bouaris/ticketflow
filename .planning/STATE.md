# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels

**Current focus:** Phase 21 - Release Engineering (v2.0 Fresh Start)

## Current Position

Phase: 21 of 21 (Release Engineering)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-15 — Completed 21-01 (Release Config & Signing)

Progress: [████████████████░░░░] 61/TBD plans (TBD%)

## Performance Metrics

**Velocity:**
- Total plans completed: 61 (v1.0: 22, v1.5: 24, v1.6: 8, v2.0: 7)
- Average duration: ~6.5 min per plan
- Total execution time: ~6.5 hours

**By Milestone:**

| Milestone | Plans | Phases | Requirements | Status |
|-----------|-------|--------|--------------|--------|
| v1.0 | 22 | 7 | 40/40 | Shipped 2026-02-06 |
| v1.5 | 24 | 6 | 63/63 | Shipped 2026-02-08 |
| v1.6 | 8 | 4 | 19/19 | Shipped 2026-02-14 |
| v2.0 | 7 (TBD total) | 5 | 26/TBD | In progress |

**Recent Trend:**
- Last 5 plans: v2.0-19-01 (repo prep 3m), v2.0-19-02 (force push 2m), v2.0-20-01 (OSS docs 8m), v2.0-21-01 (release config 4m)
- Trend: Stable — signing keys rotated, version bumped to 2.0.0, release workflow upgraded, ready for v2.0.0 tag

*Plan count for v2.0 phases to be determined during planning*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting v2.0:

- **Fresh git init (no history rewrite):** History contains signing keys + passwords — fresh start is cleaner than BFG
- **MIT license:** Most permissive, standard for desktop OSS
- **GitHub user: Bouaris:** Public repo at github.com/Bouaris/ticketflow
- **esbuild moderate vulnerability exception (18-01):** Accept esbuild CORS vulnerability as dev-only — not exploitable in TicketFlow (Vite has own server)
- **Tailwind CSS unsafe-inline exception (18-02):** Accept style-src 'unsafe-inline' for Tailwind JIT compiler — no CSS injection vectors exist (documented in CSP review)
- **Tauri file system wildcard justification (18-02):** path: "**" necessary for user-selected projects on any drive — Tauri sandbox + file picker dialog + CSP provide defense-in-depth
- **localStorage API key obfuscation (18-02):** XOR obfuscation is defense-in-depth, not encryption — standard for desktop BYOK apps (documented in SEC-07)
- **GitHub Security Advisories for vulnerability reporting (18-03):** Standard GitHub feature for professional vulnerability disclosure — integrates with GitHub security tools, no personal email needed
- **XOR obfuscation transparency (18-03):** Document as "NOT cryptographic encryption" in SECURITY.md — honesty builds user trust, standard for desktop BYOK apps
- **Comprehensive .gitignore over incremental updates (19-01):** Replace entire .gitignore with organized sections and all missing patterns — prevents accidental leaks in Plan 02 orphan branch
- **Backup outside working directory (19-01):** Store git backup at ../ticketflow-git-backup-20260214/ instead of inside repo — prevents backup deletion during .git operations
- **Orphan branch for fresh start (19-02):** Use git checkout --orphan instead of BFG/filter-branch — cleanest approach for complete history reset, 1 commit with all source code preserved
- **Force push checkpoint (19-02):** Require user approval before force push to GitHub — destructive operation needs explicit confirmation after verification
- **Old tag cleanup (19-02):** Delete all old version tags (v1.0.0-v1.6.0 on old commits) from remote, re-tag only v1.6.0 on fresh commit — removes references to deleted history
- **For-the-badge style badges (20-01):** Use for-the-badge style for tech stack badges (React, TypeScript, Vite, Tauri, Tailwind CSS) — more visual impact than flat badges, standard for modern OSS
- **Theme-aware screenshots (20-01):** Use HTML picture element with prefers-color-scheme for screenshots — GitHub auto-switches based on user theme
- **Version 2.0.0 declaration (20-01):** Declare v2.0.0 in README badge — reflects fresh start milestone after clean git history
- **Supported versions policy (20-01):** Only v2.0.x marked as supported in SECURITY.md — reflects fresh start strategy, old versions on deleted history are unsupported
- **Password-protected signing key (21-01):** New Ed25519 keypair at ~/.tauri/ticketflow.key with password protection -- stored locally, never committed
- **Base64 pubkey format (21-01):** Tauri CLI generates single base64-encoded string, used as-is in tauri.conf.json
- **English release body (21-01):** Replaced French release notes with English for OSS standard -- consistent with README language

### Pending Todos

- Idee future: L'IA auto-cree des relations dans item_relations quand elle detecte des dependances
- Idee future: Ameliorer le systeme de raffinage IA pour les projets en cours
- SettingsModal maintenance feature temporarily disabled (needs redesign for ProjectWorkspace architecture)

### Blockers/Concerns

**Security considerations (v2.0):**
- ✅ Tauri signing key rotated (21-01) — new keypair generated, breaking change documented in README, v1.x users informed of manual reinstall
- ✅ Git history fresh: 1 commit, zero leaked secrets — REPO-03 satisfied (Plan 19-02 complete, GitHub live)
- ✅ localStorage API keys documented in SECURITY.md — SEC-07 satisfied with honest transparency (XOR obfuscation, not encryption)

**Execution order:**
- Phase 18 (audit) must complete BEFORE Phase 19 (fresh init) — cannot fix secrets after repo goes public
- Phase 19 (repo hygiene) must complete BEFORE Phase 21 (release) — keys must rotate before first public tag

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 13 | Optimize bulk import: higher tokens, progress callback, category-aware splitting, retry with backoff | 2026-02-13 | a528c3f | [13-optimize-bulk-import](./quick/13-optimize-bulk-import-higher-tokens-progr/) |
| 14 | Refonte page d'accueil: fix projets recents, favoris, renommage bouton, ameliorations UX/UI | 2026-02-14 | 7d29abf | [14-refonte-page-d-accueil](./quick/14-refonte-page-d-accueil-fix-projets-r-cen/) |

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 21-01 (Release Config & Signing) - New keypair, v2.0.0 version bump, tauri-action@v0.6.1, breaking change docs
Resume file: None
Next action: Execute Plan 21-02 (GitHub Secrets + v2.0.0 tag creation)

---
*STATE.md initialized: 2026-02-05 | Last updated: 2026-02-15 after Plan 21-01 completion*
