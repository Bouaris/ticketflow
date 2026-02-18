# Roadmap: TicketFlow

## Milestones

- ✅ **v1.0 Stabilisation & IA Next Level** — Phases 1-7 (shipped 2026-02-06)
- ✅ **v1.5 Next-Gen Desktop Experience** — Phases 8-13 (shipped 2026-02-08)
- ✅ **v1.6 Smart Import** — Phases 14-17 (shipped 2026-02-14)
- ✅ **v2.0 Fresh Start** — Phases 18-21 (shipped 2026-02-16)
- ✅ **v2.1 AI Refresh** — Phases 22-25 (shipped 2026-02-17)
- 🚧 **v2.2 Quality & Insights** — Phases 26-29 (in progress)

## Phases

<details>
<summary>✅ v1.0 Stabilisation & IA Next Level (Phases 1-7) — SHIPPED 2026-02-06</summary>

- [x] Phase 1: SQLite Foundation (5/5 plans) — completed 2026-02-05
- [x] Phase 2: State & Reliability (3/3 plans) — completed 2026-02-05
- [x] Phase 3: AI Core (4/4 plans) — completed 2026-02-05
- [x] Phase 4: AI GSD + Learning (3/3 plans) — completed 2026-02-05
- [x] Phase 5: Search & Relations (3/3 plans) — completed 2026-02-06
- [x] Phase 6: UX Power User (2/2 plans) — completed 2026-02-06
- [x] Phase 7: Analytics (2/2 plans) — completed 2026-02-06

</details>

<details>
<summary>✅ v1.5 Next-Gen Desktop Experience (Phases 8-13) — SHIPPED 2026-02-08</summary>

- [x] Phase 8: Code Cleanup & Stabilisation (5/5 plans) — completed 2026-02-07
- [x] Phase 9: Dark Mode & Theme System (3/3 plans) — completed 2026-02-07
- [x] Phase 10: Command Palette (3/3 plans) — completed 2026-02-08
- [x] Phase 11: Inline Editing & Bulk Ops (3/3 plans) — completed 2026-02-08
- [x] Phase 12: AI Chat & Natural Language (4/4 plans) — completed 2026-02-08
- [x] Phase 13: Polish & Animations (6/6 plans) — completed 2026-02-08

</details>

<details>
<summary>✅ v1.6 Smart Import (Phases 14-17) — SHIPPED 2026-02-14</summary>

- [x] Phase 14: Bulk Import Service Layer (2/2 plans) — completed 2026-02-13
- [x] Phase 15: Bulk Import UI Wizard (3/3 plans) — completed 2026-02-13
- [x] Phase 16: Enhanced Onboarding (2/2 plans) — completed 2026-02-13
- [x] Phase 17: Legacy Cleanup (1/1 plan) — completed 2026-02-13

</details>

<details>
<summary>✅ v2.0 Fresh Start (Phases 18-21) — SHIPPED 2026-02-16</summary>

- [x] Phase 18: Security Audit & Code Polish (3/3 plans) — completed 2026-02-14
- [x] Phase 19: Repository Hygiene (2/2 plans) — completed 2026-02-15
- [x] Phase 20: OSS Documentation (1/1 plan) — completed 2026-02-15
- [x] Phase 21: Release Engineering (2/2 plans) — completed 2026-02-16

</details>

<details>
<summary>✅ v2.1 AI Refresh (Phases 22-25) — SHIPPED 2026-02-17</summary>

- [x] Phase 22: Provider Registry & Core Refactor (3/3 plans) — completed 2026-02-16
- [x] Phase 23: Settings UI Split & Provider Config (3/3 plans) — completed 2026-02-16
- [x] Phase 24: Validation & Generation UX (3/3 plans) — completed 2026-02-16
- [x] Phase 25: Model Resolution & Selection (2/2 plans) — completed 2026-02-17 (gap closure: GENX-03, PROV-01)

</details>

### 🚧 v2.2 Quality & Insights (In Progress)

**Milestone Goal:** Add privacy-safe PostHog telemetry with GDPR-compliant opt-in consent, and harden the test infrastructure with Vitest 4, SQL plugin mocking, and critical module coverage.

- [x] **Phase 26: Infrastructure & Transport Foundation** - Upgrade Vitest to 4.x, add Rust IPC relay for PostHog, mock SQL plugin, update CSP (completed 2026-02-17)
- [x] **Phase 27: Telemetry Core & Consent** - Full PostHog integration with consent dialog, telemetry wrapper, core events, and consent unit tests (completed 2026-02-17)
- [x] **Phase 28: Test Coverage & Quality Gates** - Parser/serializer/AI module tests, 70% coverage threshold, CI workflow (completed 2026-02-18)
- [ ] **Phase 29: Gap Closure & Tech Debt Cleanup** - Fix startup_flush no-op, remove dead Rust code, update stale documentation

## Phase Details

### Phase 26: Infrastructure & Transport Foundation
**Goal**: The build and test environments are modernized and the Tauri network relay is in place, enabling all subsequent telemetry and test work to proceed without infrastructure blockers.
**Depends on**: Phase 25
**Requirements**: TINF-01, TINF-02, TELE-04, TELE-08
**Success Criteria** (what must be TRUE):
  1. `pnpm test` runs with Vitest 4.x and exits 0 with zero `__TAURI_INTERNALS__ is not defined` errors from the SQL plugin
  2. The Rust `ph_send_batch` command is registered in the Tauri binary and accepts a JSON event batch, verifiable with `pnpm tauri build`
  3. PostHog endpoints (`eu.i.posthog.com`, `us.i.posthog.com`) are present in both `csp` and `devCsp` of `tauri.conf.json`
  4. A shared `src/test-utils/tauri-mocks.ts` exists providing `setupTauriMocks()` with `plugin:sql|*` handlers, and the existing test setup imports it
**Plans**: 3 plans

Plans:
- [ ] 26-01-PLAN.md — Vitest 4.x upgrade + shared setupTauriMocks() with plugin:sql IPC handlers
- [ ] 26-02-PLAN.md — Rust ph_send_batch IPC relay with SQLite offline queue + CSP + env var
- [ ] 26-03-PLAN.md — Gap closure: fix 134 pre-existing test failures (I18nProvider wrapper, schema assertions, ErrorBoundary strings)

### Phase 27: Telemetry Core & Consent
**Goal**: Users have full control over telemetry — prompted on first launch, able to revoke at any time — and the app captures the 15 core+secondary usage events in a privacy-safe, GDPR-compliant way.
**Depends on**: Phase 26
**Requirements**: TELE-01, TELE-02, TELE-03, TELE-05, TELE-06, TELE-07, TCOV-05
**Success Criteria** (what must be TRUE):
  1. A new user sees a consent dialog on first launch before any PostHog network call is made; Accept and Decline buttons have equal visual weight
  2. After accepting, clicking 5 different app actions produces corresponding events visible in the PostHog live events dashboard within 60 seconds from the production binary (`pnpm tauri build`)
  3. A user who previously accepted can toggle telemetry off in App Settings; subsequent app actions produce no PostHog network calls
  4. `pnpm build` shows `posthog-js` in a lazy chunk separate from the main bundle (delta under 50KB in main); AI health check passes immediately after PostHog init (no fetch corruption)
  5. Unit tests for `src/lib/telemetry.ts` verify: no events fire before consent is granted, events fire correctly after consent, and revocation stops event capture
**Plans**: 3 plans

Plans:
- [ ] 27-01-PLAN.md — Telemetry core module (consent gate, IPC relay, track API), unit tests (TCOV-05), PRIVACY.md
- [ ] 27-02-PLAN.md — Consent dialog component, App.tsx integration, AppSettingsModal Privacy toggle + dark_mode_toggled event
- [ ] 27-03-PLAN.md — Event instrumentation across codebase (15 core+secondary usage events)

### Phase 28: Test Coverage & Quality Gates
**Goal**: The critical library modules (parser, serializer, AI retry/health) have meaningful unit test coverage, a 70% coverage threshold is enforced for `src/lib/`, and a CI workflow validates every push automatically.
**Depends on**: Phase 27
**Requirements**: TINF-03, TINF-04, TCOV-01, TCOV-02, TCOV-03, TCOV-04
**Success Criteria** (what must be TRUE):
  1. `pnpm test:coverage` reports ≥70% line coverage for `src/lib/` without manual exclusions
  2. Parser round-trip tests cover at least: fused section separators, empty sections, Unicode content, and the `parse(serialize(parse(md))) === parse(md)` idempotency invariant
  3. `ai-retry.ts` tests verify exponential backoff triggers on 429/500 and does NOT retry on 401/403
  4. `ai-health.ts` tests verify all 5 error classifications (auth, rate_limit, timeout, network, unknown) produce the correct result type
  5. A GitHub Actions CI workflow runs all unit tests and coverage check on every push and PR to `master`, separate from `release.yml`
**Plans**: 3 plans

Plans:
- [ ] 28-01-PLAN.md — Parser/serializer test augmentation (idempotency, Unicode, edge cases) + Vitest coverage thresholds
- [ ] 28-02-PLAN.md — ai-retry.ts and ai-health.ts unit tests (retry logic, 5-type error classification)
- [ ] 28-03-PLAN.md — GitHub Actions CI workflow + end-to-end coverage validation

### Phase 29: Gap Closure & Tech Debt Cleanup
**Goal**: All tech debt from the v2.2 audit is resolved: startup_flush delivers queued events on app launch, dead Rust code is removed, and all documentation (checkboxes, frontmatter) accurately reflects delivered state.
**Depends on**: Phase 28
**Requirements**: None (all requirements already satisfied; this phase addresses tech debt and documentation gaps)
**Gap Closure**: Closes integration gap (startup_flush_noop), flow gap (offline_recovery_partial), and 5 tech debt items from v2.2-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `startup_flush` in `telemetry.rs` reads the PostHog API key from environment and passes it to `flush_queue`, so queued offline events are delivered on app startup
  2. The unused `BatchPayload` struct is removed from `src-tauri/src/telemetry.rs`
  3. All 17 requirement checkboxes in REQUIREMENTS.md are `[x]` (none stale)
  4. `26-02-SUMMARY.md` has `requirements-completed` frontmatter listing TELE-04 and TELE-08
**Plans**: 1 plan

Plans:
- [ ] 29-01-PLAN.md — Fix startup_flush, remove dead BatchPayload struct, update stale documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 26 → 27 → 28 → 29

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. v1.0 phases | v1.0 | 22/22 | Complete | 2026-02-06 |
| 8-13. v1.5 phases | v1.5 | 24/24 | Complete | 2026-02-08 |
| 14-17. v1.6 phases | v1.6 | 8/8 | Complete | 2026-02-14 |
| 18-21. v2.0 phases | v2.0 | 8/8 | Complete | 2026-02-16 |
| 22-25. v2.1 phases | v2.1 | 13/13 | Complete | 2026-02-17 |
| 26. Infrastructure & Transport Foundation | v2.2 | Complete    | 2026-02-17 | - |
| 27. Telemetry Core & Consent | v2.2 | Complete    | 2026-02-17 | - |
| 28. Test Coverage & Quality Gates | 3/3 | Complete    | 2026-02-18 | - |
| 29. Gap Closure & Tech Debt Cleanup | v2.2 | 0/1 | Pending | - |

---
*Roadmap created: 2026-02-05 | Updated: 2026-02-18 (gap closure Phase 29 added — Phases 26-29)*
*Full milestone details: .planning/milestones/*
