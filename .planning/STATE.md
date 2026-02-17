# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels
**Current focus:** v2.2 Quality & Insights — Phase 27: Telemetry Core & Consent

## Current Position

Phase: 27 of 28 (Telemetry Core & Consent)
Plan: 2 of 3 complete in current phase
Status: Phase 27 in progress — Plans 01+02 complete (telemetry.ts, consent dialog, settings privacy toggle)
Last activity: 2026-02-17 — Phase 27 plan 02 executed (ConsentDialog, App.tsx wiring, AppSettingsModal Privacy section)

Progress: [█████████████████████░░░░░░░░░] ~93% (Phase 27 Plan 2/3 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 75 (v1.0: 22, v1.5: 24, v1.6: 8, v2.0: 8, v2.1: 11, quick: 2)
- Average duration: ~5.8 min per plan
- Total execution time: ~7.5 hours

**By Milestone:**

| Milestone | Plans | Phases | Requirements | Status |
|-----------|-------|--------|--------------|--------|
| v1.0 | 22 | 7 | 40/40 | Shipped 2026-02-06 |
| v1.5 | 24 | 6 | 63/63 | Shipped 2026-02-08 |
| v1.6 | 8 | 4 | 19/19 | Shipped 2026-02-14 |
| v2.0 | 8 | 4 | 23/23 | Shipped 2026-02-16 |
| v2.1 | 11 | 4 | 18/18 | Shipped 2026-02-17 |
| v2.2 | TBD | 3 | 3/17 | In progress (27-01 done) |
| **Total** | **76+** | **28** | **183** | |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions for v2.2:
- [v2.2 planning]: PostHog telemetry via EU endpoint (eu.i.posthog.com) — GDPR compliance
- [v2.2 planning]: Rust IPC relay (ph_send_batch) mandatory — posthog-js silently drops events in Tauri WebView
- [v2.2 planning]: TCOV-05 (telemetry unit tests) ships WITH Phase 27, not Phase 28 — consent gate tests are part of GDPR validation
- [v2.2 planning]: autocapture: false + __preview_enable_fetch_instrumentation: false — prevents fetch corruption on AI calls
- [26-01]: IPC-level mocking (mockIPC/mockWindows) chosen over JS module mocking — intercepts at transport layer preventing __TAURI_INTERNALS__ errors from plugin-sql
- [26-01]: setupTauriMocks() in global setupFiles so __TAURI_INTERNALS__ is available before any module-level side effects run
- [26-01]: jsdom stays at ^25.0.1 — Blob constructor incompatibility with jsdom 27+ and Vitest 4
- [26-02]: Separate telemetry.db avoids schema coupling with tauri-plugin-sql (no Rust-side API)
- [26-02]: reqwest with rustls-tls + default-features=false avoids native-tls dependency
- [26-02]: startup_flush skips delivery when api_key is empty — key provided by frontend per-batch
- [26-02]: WAL journal mode on telemetry.db for crash-safe event persistence
- [26-03]: Custom render wrapper (renderWithProviders) over global provider in setupFiles — avoids polluting non-i18n tests
- [26-03]: Test assertions must match fr.ts normalized strings (unaccented) — fr.ts deliberately uses unaccented chars for normalization
- [26-03]: AIContextIndicator mock returns ContextStatus.files array, not hasClaude/hasAgents shape
- [Phase 27]: Approach B confirmed: direct IPC relay without posthog-js runtime — zero external SDK, telemetry.ts routes events through invoke('ph_send_batch') in Tauri and direct fetch in web mode
- [Phase 27]: vitest.config.ts requires __APP_VERSION__ define constant to mirror vite.config.ts — required for any test that imports src/lib/version.ts
- [27-02]: ConsentDialog uses Modal component with closeOnBackdrop=false — prevents accidental dismissal, Escape maps to onDismiss (re-prompt once then permanent decline)
- [27-02]: consent_revoked fires BEFORE setConsentState('declined') in settings toggle — captures last event before gate closes
- [27-02]: All consent/privacy strings hardcoded English (never via i18n) — locked decision for GDPR clarity regardless of app locale

### Pending Todos

- Idee future: L'IA auto-cree des relations dans item_relations quand elle detecte des dependances
- Idee future: Ameliorer le systeme de raffinage IA pour les projets en cours
- SettingsModal maintenance feature temporarily disabled (needs redesign for ProjectWorkspace architecture)
- getEffectiveAIConfig unused _projectPath parameter cleanup (16 call sites)
- OpenAI-compatible API adapter layer (error formats, rate-limit headers)
- [Phase 27 prereq]: PostHog account + VITE_POSTHOG_KEY must exist before Phase 27 validation can run against live dashboard

### Blockers/Concerns

- (None — Phase 27 Plan 01 resolved the posthog-js transport concern by using Approach B: direct IPC relay, no posthog-js runtime dependency)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 13 | Optimize bulk import: higher tokens, progress callback, category-aware splitting, retry with backoff | 2026-02-13 | a528c3f | [13-optimize-bulk-import](./quick/13-optimize-bulk-import-higher-tokens-progr/) |
| 14 | Refonte page d'accueil: fix projets recents, favoris, renommage bouton, ameliorations UX/UI | 2026-02-14 | 7d29abf | [14-refonte-page-d-accueil](./quick/14-refonte-page-d-accueil-fix-projets-r-cen/) |
| 15 | Update AI model lists (Llama 4, Gemini 2.5, GPT-4.1) + Gemini free tier tooltip | 2026-02-17 | c870626 | [15-recherche-mod-les-ia](./quick/15-recherche-mod-les-ia-tooltip-recommandat/) |

## Session Continuity

Last session: 2026-02-17
Stopped at: Phase 27 Plan 02 complete — ConsentDialog.tsx (first-launch GDPR consent), App.tsx wiring (consent flow, project_created), AppSettingsModal Privacy section (toggle, dark_mode_toggled); 455 tests pass
Resume file: .planning/phases/27-telemetry-core-consent/27-02-SUMMARY.md
Next action: /gsd:execute-phase 27 (continue with plan 03)

---
*STATE.md initialized: 2026-02-05 | Last updated: 2026-02-17 after Phase 27 Plan 01 complete (telemetry core module)*
