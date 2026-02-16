# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels

**Current focus:** Milestone v2.1 "AI Refresh" — Phase 22 complete, ready for Phase 23

## Current Position

Phase: 24 of 24 (Validation & Generation UX)
Plan: 3 of 3
Status: In Progress
Last activity: 2026-02-16 — Completed 24-01 (Provider Health Check)

Progress: [██████████████████░░] 2/3 plans (66%)

## Performance Metrics

**Velocity:**
- Total plans completed: 70 (v1.0: 22, v1.5: 24, v1.6: 8, v2.0: 8, v2.1: 8)
- Average duration: ~6.1 min per plan
- Total execution time: ~7.1 hours

**By Milestone:**

| Milestone | Plans | Phases | Requirements | Status |
|-----------|-------|--------|--------------|--------|
| v1.0 | 22 | 7 | 40/40 | Shipped 2026-02-06 |
| v1.5 | 24 | 6 | 63/63 | Shipped 2026-02-08 |
| v1.6 | 8 | 4 | 19/19 | Shipped 2026-02-14 |
| v2.0 | 8 | 4 | 23/23 | Shipped 2026-02-16 |
| v2.1 | TBD | 3 | 18/18 | In progress |

**Phase 23 (23-01, 23-02, 23-03):**
| Plan | Duration | Tasks | Files | Status |
|------|----------|-------|-------|--------|
| 01 | 5 min | 1 | 5 created | Complete ✓ |
| 02 | 4 min | 2 | 8 modified | Complete ✓ |
| 03 | 6 min | 2 | 7 modified, 3 deleted | Complete ✓ |

**Phase 24 (24-01, 24-02, 24-03):**
| Plan | Duration | Tasks | Files | Status |
|------|----------|-------|-------|--------|
| 01 | 3 min | 2 | 1 created, 4 modified | Complete ✓ |
| 02 | 2 min | 1 | 1 modified | Complete ✓ |
| 03 | TBD | TBD | TBD | Pending |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting v2.1:

- **Separate App Settings from AI Settings:** App settings = language, theme, updates. AI settings = provider, key, model, custom endpoints.
- **Provider registry pattern:** Centralize all provider logic in ai-provider-registry.ts (single source of truth).
- **Custom AI providers support:** OpenAI SDK baseURL parameter enables custom OpenAI-compatible endpoints (Ollama, LM Studio).
- **Remove project-level AI selector:** One global AI config — simplify, remove redundancy.
- **CSP decision resolved (22-01):** HTTPS-only enforcement via https: scheme-source + localhost in production CSP.
- **Provider registry pattern established (22-01):** BUILT_IN_PROVIDERS + loadCustomProviders() = getAllProviders() in ai-provider-registry.ts.
- **Map-based OpenAI client cache (22-02):** Cache keyed by apiKey::baseURL prevents state leaks between custom providers.
- **Deprecated stubs for project-level AI config (22-02):** loadProjectAIConfig/saveProjectAIConfig kept as no-ops for backward compat with useProjectAIConfig hook.
- **Registry-derived deprecated exports (22-03):** AVAILABLE_MODELS/DEFAULT_MODELS derived from BUILT_IN_PROVIDERS at module level (not duplicated).
- **Global-only useProjectAIConfig (22-03):** Hook simplified to always return global config with no-op setters and console.warn deprecation warnings.
- **Widened getProviderLabel (22-03):** Accepts any string (not just AIProvider) to support custom provider IDs in Phase 24.
- **Standalone components NOT wired (23-01):** Plan 01 creates components as standalone files. Wiring into App.tsx happens in Plan 02. Clean separation of UI construction from integration.
- **TODO comments for i18n (23-01):** New UI strings marked with '// TODO: i18n' for Plan 02 to add proper translations.
- **Custom provider edit uses remove+add (23-01):** Registry has no update function. Edit operation removes old provider, then adds new with updated data.
- **Keep getEffectiveAIConfig parameter (23-03):** Kept unused _projectPath parameter for backward compatibility with 16 call sites across AI subsystem. Avoids cascading changes, can clean up later.
- **AI Settings button always visible (23-03):** Unlike Project Settings (only visible when project loaded), AI Settings accessible from welcome screen or within project.
- **Amber badge on AI Settings (23-03):** Visual indicator for first-run users. Badge disappears once any provider has API key configured.
- **Promise.race wrapper for Gemini SDK (24-02):** Google GenerativeAI SDK doesn't support AbortSignal natively — use Promise.race with abort listener for cancellation.
- **Signal as 2nd parameter for Groq/OpenAI (24-02):** Both SDKs follow OpenAI pattern: create(request, { signal }) as RequestOptions.
- **Export testProviderConnection (24-02):** Dedicated lightweight function for health checks — no retry, no telemetry, minimal tokens.
- **5-type error classification (24-01):** Health check errors classified into auth, rate_limit, timeout, network, unknown for actionable user guidance.
- **Auto-clear success messages (24-01):** Health check success results auto-clear after 3s to avoid UI clutter; errors persist for user action.
- **Gemini recommendation badge (24-01):** Green "Recommended free tier" badge on Gemini card guides users toward best free option (15 req/min, 1M tokens/day).

### Pending Todos

- Idee future: L'IA auto-cree des relations dans item_relations quand elle detecte des dependances
- Idee future: Ameliorer le systeme de raffinage IA pour les projets en cours
- SettingsModal maintenance feature temporarily disabled (needs redesign for ProjectWorkspace architecture)

### Blockers/Concerns

**Phase 22 (COMPLETE):**
- ~~CSP decision gates custom provider feature~~ RESOLVED in 22-01: HTTPS-only enforcement
- ~~Client singleton cache must expand to handle baseURL~~ RESOLVED in 22-02: Map-based cache with apiKey::baseURL key
- ~~Consumer migration to registry~~ RESOLVED in 22-03: projectAIConfig deprecated, useProjectAIConfig simplified, ProviderToggle registry-aware
- loadProjectAIConfig/saveProjectAIConfig deprecated stubs + projectAIConfig.ts module need full removal in Phase 23 settings split

**Phase 23 (COMPLETE):**
- ~~Settings modal split may break existing shortcuts (Cmd+,)~~ RESOLVED in 23-03: Command palette "Settings" opens AppSettingsModal via onOpenSettings callback

**Phase 24:**
- OpenAI-compatible API shape differences require adapter layer (error formats, rate-limit headers)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 13 | Optimize bulk import: higher tokens, progress callback, category-aware splitting, retry with backoff | 2026-02-13 | a528c3f | [13-optimize-bulk-import](./quick/13-optimize-bulk-import-higher-tokens-progr/) |
| 14 | Refonte page d'accueil: fix projets recents, favoris, renommage bouton, ameliorations UX/UI | 2026-02-14 | 7d29abf | [14-refonte-page-d-accueil](./quick/14-refonte-page-d-accueil-fix-projets-r-cen/) |

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 24-01-PLAN.md (Provider Health Check)
Resume file: None
Next action: Continue Phase 24 (Plan 24-03: Cancel Button + Progress UI)

---
*STATE.md initialized: 2026-02-05 | Last updated: 2026-02-16 after 24-01 plan complete*
