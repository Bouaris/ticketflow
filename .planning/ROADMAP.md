# Roadmap: TicketFlow

## Milestones

- ✅ **v1.0 Stabilisation & IA Next Level** — Phases 1-7 (shipped 2026-02-06)
- ✅ **v1.5 Next-Gen Desktop Experience** — Phases 8-13 (shipped 2026-02-08)
- ✅ **v1.6 Smart Import** — Phases 14-17 (shipped 2026-02-14)
- ✅ **v2.0 Fresh Start** — Phases 18-21 (shipped 2026-02-16)
- 🚧 **v2.1 AI Refresh** — Phases 22-24 (in progress)

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

### 🚧 v2.1 AI Refresh (In Progress)

**Milestone Goal:** Refactor AI settings UX — separate app settings from AI config, add custom provider support, fix provider override logic, improve generation feedback.

#### Phase 22: Provider Registry & Core Refactor ✓
**Goal**: Centralize provider logic and enable custom endpoints
**Depends on**: Phase 21
**Requirements**: INTL-01, INTL-02, PROV-06
**Status**: Complete — 2026-02-16 | Verified: 10/10 must-haves

Plans:
- [x] 22-01-PLAN.md — Provider Registry Foundation (types, registry module, CSP update)
- [x] 22-02-PLAN.md — Core AI Client Refactor (singleton cache expansion, registry integration, project config removal)
- [x] 22-03-PLAN.md — Consumer Migration & Cleanup (deprecate projectAIConfig, simplify hook, update ProviderToggle)

#### Phase 23: Settings UI Split & Provider Config
**Goal**: Separate App Settings from AI Settings with dedicated provider management
**Depends on**: Phase 22
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, PROV-01, PROV-02, PROV-03, PROV-05
**Success Criteria** (what must be TRUE):
  1. User can access App Settings (language, theme, updates) separately from AI Settings
  2. User can access dedicated AI Settings panel from header with clear visual separation
  3. User can add, edit, and delete custom OpenAI-compatible providers (name, baseURL, API key, model)
  4. User sees provider status indicator (configured/not configured) for each provider in AI Settings
  5. Project-level AI provider selector is removed (single global AI config only)
**Plans**: 2 plans

Plans:
- [ ] 23-01-PLAN.md — Create AppSettingsModal, AISettingsModal, and provider CRUD sub-components
- [ ] 23-02-PLAN.md — Wire modals, update Header/i18n, remove deprecated files and project-level AI selector

#### Phase 24: Validation & Generation UX
**Goal**: Provider health checks, loading states, and improved generation feedback
**Depends on**: Phase 23
**Requirements**: PROV-04, GENX-01, GENX-02, GENX-03, GENX-04, GENX-05, INTL-03
**Success Criteria** (what must be TRUE):
  1. User can test provider connection and see latency and error details before using provider
  2. User sees loading spinner and progress text during AI generation (not silent operations)
  3. User can cancel in-flight AI generation for operations longer than 5 seconds
  4. Provider selector in ticket creation modal overrides default provider (not ignored as before)
  5. Tooltip recommends Gemini free tier with actionable info (Pay-as-you-go Level 1: 15 req/min, 1M tokens/day)
**Plans**: TBD

Plans:
- [ ] 24-01: TBD
- [ ] 24-02: TBD

## Progress

| Milestone | Phases | Plans | Requirements | Shipped |
|-----------|--------|-------|--------------|---------|
| v1.0 Stabilisation & IA | 1-7 | 22 | 40/40 | 2026-02-06 |
| v1.5 Next-Gen Desktop | 8-13 | 24 | 63/63 | 2026-02-08 |
| v1.6 Smart Import | 14-17 | 8 | 19/19 | 2026-02-14 |
| v2.0 Fresh Start | 18-21 | 8 | 23/23 | 2026-02-16 |
| v2.1 AI Refresh | 22-24 | 3+ | 18/18 | In progress |
| **Total** | **24** | **65+** | **163** | |

---
*Roadmap created: 2026-02-05 | Updated: 2026-02-16 (Phase 22 complete)*
*Full milestone details: .planning/milestones/*
