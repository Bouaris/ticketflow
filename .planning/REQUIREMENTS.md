# Requirements: TicketFlow v2.2

**Defined:** 2026-02-17
**Core Value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels

## v2.2 Requirements

Requirements for milestone v2.2 "Quality & Insights". Each maps to roadmap phases.

### Telemetry

- [ ] **TELE-01**: User sees a first-launch consent dialog explaining what data is collected; can accept or decline with equal-weight buttons
- [ ] **TELE-02**: User can toggle telemetry on/off in App Settings at any time; revocation takes effect immediately
- [ ] **TELE-03**: PostHog SDK initializes only after explicit consent (lazy-loaded via dynamic import, zero PII collected)
- [ ] **TELE-04**: Telemetry events are delivered from Tauri desktop builds via Rust IPC relay command (ph_send_batch)
- [ ] **TELE-05**: 10 core usage events are instrumented (app_launched, project_created, ticket_created, ai_generation_completed, ai_generation_failed, view_switched, settings_opened, consent_granted, consent_revoked, project_opened)
- [ ] **TELE-06**: Secondary events are instrumented (command_palette_opened, bulk_import_completed, onboarding_completed, dark_mode_toggled, ai_health_check_run)
- [ ] **TELE-07**: App version and platform sent as super-properties on every event; EU endpoint (eu.i.posthog.com) used for GDPR
- [ ] **TELE-08**: PostHog API key stored as VITE_POSTHOG_KEY env var (never in source); CSP updated for PostHog endpoints in dev and prod

### Test Infrastructure

- [ ] **TINF-01**: Vitest upgraded from 2.x to 4.x with @vitest/coverage-v8 matching version (Vite 7 compatibility)
- [ ] **TINF-02**: @tauri-apps/plugin-sql mocked at module level in shared test setup; all hook tests run without __TAURI_INTERNALS__ errors
- [x] **TINF-03**: CI workflow (GitHub Actions) runs unit tests and coverage check on every push/PR
- [x] **TINF-04**: Coverage threshold enforced at 70% for src/lib/ modules

### Test Coverage

- [x] **TCOV-01**: parser.ts has unit tests covering round-trip correctness, edge cases (fused separators, empty sections, Unicode)
- [x] **TCOV-02**: serializer.ts has unit tests verifying serialize(parse(md)) invariant and idempotency
- [x] **TCOV-03**: ai-retry.ts has unit tests for exponential backoff, retry on 429/500, no retry on 401/403
- [x] **TCOV-04**: ai-health.ts has unit tests for 5-type error classification (auth/rate_limit/timeout/network/unknown)
- [ ] **TCOV-05**: telemetry.ts has unit tests verifying consent gate (no-op before consent) and event firing after consent

## Future Requirements

Deferred to v2.3 or later. Tracked but not in current roadmap.

### Robustness Audit (v2.3)

- **ROBU-01**: Stress test scenarios executed on 1000+ tickets with concurrent operations
- **ROBU-02**: Performance profiling (CPU/RAM/IO) under sustained load
- **ROBU-03**: Dead code audit with exact file locations documented
- **ROBU-04**: Data integrity verification after massive CRUD operations
- **ROBU-05**: Security review for vulnerabilities not caught by v2.0 audit

### Extended Coverage (v2.3+)

- **XCOV-01**: Hook tests for useAnalytics, useCommandSearch, useBacklogDB
- **XCOV-02**: Component tests for ConsentDialog, AppSettingsModal, ItemEditorModal
- **XCOV-03**: Playwright E2E for consent flow, project creation, ticket CRUD, view switching
- **XCOV-04**: Coverage threshold raised to 80%+ across all src/ modules

## Out of Scope

| Feature | Reason |
|---------|--------|
| 100% test coverage | Unrealistic for 54K LOC in one milestone; targeting 70% on critical modules first |
| Robustness audit / stress testing | Requires test infra in place first; deferred to v2.3 |
| PostHog session recording | Captures DOM snapshots in desktop app — privacy risk, no value |
| PostHog autocapture | Captures element text/content — PII risk in desktop app |
| PostHog feature flags / A/B tests | Out of scope; adds SDK complexity |
| Self-hosted PostHog | Cloud free tier (1M events/month) sufficient |
| Tauri binary E2E (tauri-driver) | Fragile on Windows, requires Edge Driver matching; web-mode E2E sufficient |
| Offline event queue to disk | posthog-js queues in-memory; accept events lost while offline |
| posthog-react wrapper package | Adds React context overhead with no benefit for this integration pattern |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TELE-01 | Phase 27 | Pending |
| TELE-02 | Phase 27 | Pending |
| TELE-03 | Phase 27 | Pending |
| TELE-04 | Phase 26 | Pending |
| TELE-05 | Phase 27 | Pending |
| TELE-06 | Phase 27 | Pending |
| TELE-07 | Phase 27 | Pending |
| TELE-08 | Phase 26 | Pending |
| TINF-01 | Phase 26 | Pending |
| TINF-02 | Phase 26 | Pending |
| TINF-03 | Phase 28 | Complete |
| TINF-04 | Phase 28 | Complete |
| TCOV-01 | Phase 28 | Complete |
| TCOV-02 | Phase 28 | Complete |
| TCOV-03 | Phase 28 | Complete |
| TCOV-04 | Phase 28 | Complete |
| TCOV-05 | Phase 27 | Pending |

**Coverage:**
- v2.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after roadmap creation (traceability complete)*
