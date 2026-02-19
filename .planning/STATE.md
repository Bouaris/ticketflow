# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels
**Current focus:** Phase 36 COMPLETE — Security, Dependencies, Cleanup — all 3 plans done

## Current Position

Phase: 36 of 36 (Security, Dependencies, Cleanup) — COMPLETE
Plan: 3 of 3 in current phase — COMPLETE
Status: Phase 36 complete — CI hardening, Cargo/npm dependency updates, README gallery restoration, final build verification (FIX-14, FIX-15, FIX-17 all resolved)
Last activity: 2026-02-19 — Completed 36-03 (FIX-17: README gallery 3x2 restoration + Phase 36 final build verification)

Progress: [█████████████████████████] 100% (all phases v1.0–v2.2 + v2.2.1 phase 33-36 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 86 (v1.0: 22, v1.5: 24, v1.6: 8, v2.0: 8, v2.1: 11, v2.2: 10, quick: 3)
- Average duration: ~5.5 min per plan
- Total execution time: ~8 hours

**By Milestone:**

| Milestone | Plans | Phases | Requirements | Status |
|-----------|-------|--------|--------------|--------|
| v1.0 | 22 | 7 | 40/40 | Shipped 2026-02-06 |
| v1.5 | 24 | 6 | 63/63 | Shipped 2026-02-08 |
| v1.6 | 8 | 4 | 19/19 | Shipped 2026-02-14 |
| v2.0 | 8 | 4 | 23/23 | Shipped 2026-02-16 |
| v2.1 | 11 | 4 | 18/18 | Shipped 2026-02-17 |
| v2.2 | 10 | 4 | 17/17 | Shipped 2026-02-18 |
| v2.2.1 | 3 | 3 | 18/18 | Complete 2026-02-19 |
| v2.2.2 (dead-code) | 2+ | 1 | 9+ | In Progress 2026-02-19 |
| **Total** | **94+** | **34** | **200+** | |
| Phase 34-dead-code-sweep P01 | 12 | 2 tasks | 9 files |
| Phase 35-architecture-performance P03 | 4 | 2 tasks | 3 files |
| Phase 35-architecture-performance P04 | 25 | 2 tasks | 3 files |
| Phase 36 P01 | 15 | 2 tasks | 2 files |
| Phase 36-security-dependencies-cleanup P02 | 18 | 2 tasks | 4 files |
| Phase 36-security-dependencies-cleanup P03 | 4 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting v2.2.1:
- Phases 30 and 32 are independent and can execute in parallel (no shared files)
- Phase 31 (code audit) is also independent — produces reports, not code changes
- PERF-REPORT.md and AUDIT-REPORT.md are the concrete deliverables for phases 30 and 31
- Use vi.mock('../db/database') pattern (not Tauri IPC) for database stress tests — avoids conflicts with global setup.ts
- Maintain stable vi.fn() mockDb ref + rewire via mockImplementation in beforeEach for clean state isolation per test
- [Phase 30]: FTS5 mock routing: backlog_items_fts condition must precede generic backlog_items conditions due to JOIN query containing both table names
- [Phase 30]: Self-contained stress mock pattern: stress test files include full mock inline to be independently executable without stress-helpers.ts
- [Phase 31-01]: SMELL-010 (initTelemetry non-idempotent) is P0 — duplicate addEventListener calls inflate PostHog error event counts
- [Phase 31-01]: DEAD-006 MaintenanceModal entirely unreachable from UI — product decision needed (re-enable or remove)
- [Phase 31-01]: God files: ai.ts (2229 lines), ProjectWorkspace.tsx (1569 lines) — P2 refactor for next milestone
- [Phase 31-01]: getEffectiveAIConfig _projectPath removal is coordinated refactor touching 16 call sites across 7 files
- [Phase 31-02]: ph_send_batch accepts arbitrary api_key from webview — low risk given CSP; documented, not fixed
- [Phase 31-02]: CI actions tag-pinned not SHA-pinned — improvement opportunity, low urgency for personal OSS
- [Phase 31-02]: devtools: true always enabled — pre-existing accepted risk for BYOK desktop app
- [Phase 31-02]: 4 Cargo vulns (bytes/rkyv/rsa/time) all transitive via Tauri — await upstream resolution
- [Phase 30-stress-testing-performance]: test.each([100,500,1000]) for CRUD benchmarks — parametrizes cleanly without duplication
- [Phase 30-stress-testing-performance]: PERF-REPORT.md bottlenecks: sequential bulk inserts (High), FTS5 rebuild on schema init (Medium), dbItemToBacklogItem JSON parse overhead (Medium)
- [Phase 31]: No P1 (Critical) findings in v2.2 audit — no exploitable security vulnerabilities or data loss risks
- [Phase 31]: AUDIT-REPORT.md at project root consolidates 44 prioritized findings: 7 P2 (immediate), 24 P3 (next sprint/backlog), 13 P4 (low)
- [Phase 32-02]: 3x2 gallery table used instead of planned 2x2 — all 6 available assets included; gallery-ai-chat.png does not exist, replaced by gallery-bulkimport.png and gallery-gsd-integration.png
- [Phase 32-02]: Light mode screenshot as hero image, dark mode screenshot placed in gallery section bottom-right
- [Phase 33-02]: errorTrackingSetUp guard is module-level (persists across initTelemetry() calls in same module lifetime)
- [Phase 33-02]: AISettingsModal.tsx questioning-mode key replacements left for plan 33-01 (file ownership boundary)
- [Phase 33-01]: Type predicate for isBuiltInProvider eliminates downstream as any casts at all call sites
- [Phase 33-01]: Storage key centralization: STORAGE_KEYS.QUESTIONING_MODE replaces hardcoded string in AISettingsModal
- [Phase 34-dead-code-sweep]: getEffectiveAIConfig() parameter removed — projectPath in options types left untouched as they serve other purposes (DB access, context loading)
- [Phase 34-dead-code-sweep]: shutdownTelemetry removed (DEAD-004): Rust WAL persistence in telemetry.rs makes JS-side shutdown redundant; documented as comment for future re-wiring
- [Phase 34-dead-code-sweep]: DynamicBadge kept in Badge.tsx but removed from barrel — test imports directly, barrel export was dead
- [Phase 34-dead-code-sweep]: Use import.meta.env.DEV to guard debug console.log; console.warn for real errors stays unguarded
- [Phase 35-architecture-performance]: useAIFeedbackStats follows useAIFeedback pattern with isOpen gate to prevent premature DB access from settings modal
- [Phase 35-architecture-performance]: PROVIDER_URLS and PROVIDER_COLORS kept as module-scope constants in ProviderCard (resolves SMELL-014/015); InfoIcon replaces inline SVG
- [Phase 35-architecture-performance]: Padding-based virtualization for HTML tables: spacer <tr> rows instead of position:absolute (which table layout engines ignore on <tr>)
- [Phase 35-architecture-performance]: memo with named inner function pattern for DevTools: function KanbanCardInner + export const KanbanCard = memo(KanbanCardInner)
- [Phase 35]: SMELL-007 resolved: ProjectWorkspace extracted into 5 focused hooks + WorkspaceDialogs component — reduced from 1569 to 555 lines (65%)
- [Phase 35]: SMELL-005 resolved: useWorkspaceTypeSync documents all eslint-disable-line rationale — stable useRef identity, stable projectPath per mount, stable initializeWithTypes reference
- [Phase 35-architecture-performance]: SMELL-006 resolved: ai.ts split from 2235 to 487 lines across 6 modules (ai-client, ai-config, ai-maintenance, ai-analysis, ai-prompts, ai). Leaf module pattern prevents circular deps. All existing import paths preserved via re-exports.
- [Phase 35-architecture-performance]: generateCompletion exported (not private) from ai-client.ts — maintenance/analysis modules call it directly without retry wrapping, which is correct for format analysis flows
- [Phase 36]: SHA-pinned pnpm/action-setup to v2.4.1 (latest v2.x) — the floating v2 major tag returned 404 on GitHub API; dereferenced annotated tag SHA for commit pin
- [Phase 36]: SEC-D2 (IPC api_key pass-through) accepted risk: exploiting requires bypassing Tauri CSP (already full compromise); documented in SECURITY.md
- [Phase 36]: SEC-D10 (devtools always enabled) accepted risk: local-first BYOK desktop app, user is sole operator; no meaningful security benefit from disabling; documented in SECURITY.md
- [Phase 36-02]: eslint 9.x->10.x deferred: major rewrite with flat config migration needed, defer to next milestone
- [Phase 36-02]: jsdom 25->28 deferred: dev-only, test env risk; react-dropzone 14->15 deferred: production dep with breaking API in BulkImportWizard
- [Phase 36-02]: Cargo.toml tauri pin changed from '2.9.5' to '2.10' semver range to allow future patch auto-updates; bytes and time CVEs resolved by cargo update
- [Phase 36-03]: README gallery restored to 3x2 (was 2x2): gallery-bulkimport.png and screenshot-dark.png added as previously orphaned assets
- [Phase 36-03]: pnpm tauri build signing error (TAURI_SIGNING_PRIVATE_KEY missing) is expected for local builds — bundles are produced, signing only in CI

### Pending Todos

- Idee future: L'IA auto-cree des relations dans item_relations quand elle detecte des dependances
- Idee future: Ameliorer le systeme de raffinage IA pour les projets en cours
- SettingsModal maintenance feature temporarily disabled (needs redesign for ProjectWorkspace architecture)
- OpenAI-compatible API adapter layer (error formats, rate-limit headers)
- PostHog account + VITE_POSTHOG_KEY must exist before telemetry validation can run against live dashboard
- shutdownTelemetry re-wire: if needed in future, wire to window 'beforeunload' or Tauri 'close-requested' event

### Blockers/Concerns

- (None)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 13 | Optimize bulk import: higher tokens, progress callback, category-aware splitting, retry with backoff | 2026-02-13 | a528c3f | [13-optimize-bulk-import](./quick/13-optimize-bulk-import-higher-tokens-progr/) |
| 14 | Refonte page d'accueil: fix projets recents, favoris, renommage bouton, ameliorations UX/UI | 2026-02-14 | 7d29abf | [14-refonte-page-d-accueil](./quick/14-refonte-page-d-accueil-fix-projets-r-cen/) |
| 15 | Update AI model lists (Llama 4, Gemini 2.5, GPT-4.1) + Gemini free tier tooltip | 2026-02-17 | c870626 | [15-recherche-mod-les-ia](./quick/15-recherche-mod-les-ia-tooltip-recommandat/) |
| 16 | Update all documentation to v2.2.0: version bumps, CHANGELOG v2.0/v2.1/v2.2, README badge + features, SECURITY.md telemetry/CSP | 2026-02-18 | d64d29a | [16-mise-jour-de-toute-la-documentation-vers](./quick/16-mise-jour-de-toute-la-documentation-vers/) |

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 36-03-PLAN.md — README gallery 3x2 restoration and Phase 36 final build verification (Phase 36 COMPLETE)
Resume file: .planning/phases/36-security-dependencies-cleanup/36-03-SUMMARY.md
Next action: All phases complete — no pending plans

---
*STATE.md initialized: 2026-02-05 | Last updated: 2026-02-19 after plan 36-03 completion (Phase 36 fully complete — Security, Dependencies, Cleanup)*
