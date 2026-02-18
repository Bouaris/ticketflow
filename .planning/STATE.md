# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels
**Current focus:** v2.2 Gap Closure — Phase 29 in progress (plan 01 complete)

## Current Position

Phase: 29 of 29 (Gap Closure & Tech Debt Cleanup) — Plan 01 complete
Plan: 1 of 1 complete in current phase
Status: Phase 29 plan 01 complete — startup_flush fixed with option_env! compile-time key, dead BatchPayload struct removed, 26-02-SUMMARY.md frontmatter updated
Last activity: 2026-02-18 — Phase 29 plan 01 executed (startup_flush no-op bug fixed, BatchPayload removed, 26-02-SUMMARY requirements-completed added)

Progress: [██████████████████████████████] ~100% (Phase 29 plan 01 complete, all v2.2 tech debt addressed)

## Performance Metrics

**Velocity:**
- Total plans completed: 76 (v1.0: 22, v1.5: 24, v1.6: 8, v2.0: 8, v2.1: 11, v2.2-gap: 1, quick: 2)
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
| v2.2 | 9 | 3 | 17/17 | Shipped 2026-02-18 |
| v2.2-gap | 1 | 1 | 0/0 | Complete 2026-02-18 |
| **Total** | **79+** | **29** | **183+** | |

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
- [27-03]: handleViewModeChange wrapper centralizes view_switched tracking — replaces all direct backlog.setViewMode usages (Header, shortcuts, workspaceActions)
- [27-03]: settings_opened uses 4 panel-specific wrappers (app/ai/type_config/project) for richer metadata at instrumentation points
- [27-03]: ai_health_check_run fires at every return path in testProviderHealth (not just one point) to avoid missing events on early returns
- [27-03]: hasApiKey(getProvider()) at onboarding_completed time determines ai_configured — simpler than tracking wizard-internal AI setup state
- [28-02]: isAbortError mock must implement real DOMException check — ai-health.ts calls isAbortError() to classify timeouts, a mock returning false routes AbortErrors to 'unknown' instead of 'timeout'
- [28-02]: vi.mock() hoisted at top level before all imports for Vitest module mock hoisting to work correctly in pure logic module tests
- [28-01]: Per-file Vitest thresholds scoped to 4 specific files (not src/lib/**) — avoids false failures on Tauri-coupled modules at 0% coverage
- [28-01]: html reporter removed from vitest.config.ts — fixes Windows TypeError (pathe v2 input.replace) in coverage runs; text+json sufficient
- [28-01]: ai-health.test.ts mockResolvedValue(undefined) -> mockResolvedValue('') — testProviderConnection returns Promise<string> not void
- [Phase 28-03]: ubuntu-latest chosen over windows-latest for CI — JS tests run in jsdom, no OS-specific behavior; ubuntu sidesteps the Windows pathe crash entirely
- [Phase 28-03]: pnpm test:coverage exit code 0 confirmed via cmd /c on Windows — bash tool stderr propagation masked true exit code; vitest exits cleanly with all 4 per-file thresholds met
- [29-01]: option_env!("VITE_POSTHOG_KEY") is correct Rust mechanism for compile-time env vars — produces Option<&'static str>, None in dev builds, Some(key) in release builds with CI secret
- [29-01]: startup_flush uses let-else pattern on Option<&str> for idiomatic Rust Option guard before calling flush_queue

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

Last session: 2026-02-18
Stopped at: Phase 29 Plan 01 complete — startup_flush no-op bug fixed with option_env!(VITE_POSTHOG_KEY), dead BatchPayload struct removed, 26-02-SUMMARY.md requirements-completed frontmatter added; all v2.2 tech debt addressed
Resume file: .planning/phases/29-gap-closure-tech-debt-cleanup/29-01-SUMMARY.md
Next action: (Phase 29 plan 01 complete — all gap closure items resolved, no further phases planned)

---
*STATE.md initialized: 2026-02-05 | Last updated: 2026-02-18 after Phase 29 Plan 01 complete (startup_flush fix, BatchPayload removed, docs updated)*
