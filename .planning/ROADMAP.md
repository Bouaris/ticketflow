# Roadmap: TicketFlow

## Milestones

- ✅ **v1.0 Stabilisation & IA Next Level** — Phases 1-7 (shipped 2026-02-06)
- ✅ **v1.5 Next-Gen Desktop Experience** — Phases 8-13 (shipped 2026-02-08)
- ✅ **v1.6 Smart Import** — Phases 14-17 (shipped 2026-02-14)
- ✅ **v2.0 Fresh Start** — Phases 18-21 (shipped 2026-02-16)
- ✅ **v2.1 AI Refresh** — Phases 22-25 (shipped 2026-02-17)
- ✅ **v2.2 Quality & Insights** — Phases 26-29 (shipped 2026-02-18)
- 🚧 **v2.2.1 Battle-Ready** — Phases 30-32 (in progress)

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

<details>
<summary>✅ v2.2 Quality & Insights (Phases 26-29) — SHIPPED 2026-02-18</summary>

- [x] Phase 26: Infrastructure & Transport Foundation (3/3 plans) — completed 2026-02-17
- [x] Phase 27: Telemetry Core & Consent (3/3 plans) — completed 2026-02-17
- [x] Phase 28: Test Coverage & Quality Gates (3/3 plans) — completed 2026-02-18
- [x] Phase 29: Gap Closure & Tech Debt Cleanup (1/1 plan) — completed 2026-02-18

</details>

### v2.2.1 Battle-Ready (In Progress)

**Milestone Goal:** Stress-test every critical path, characterize performance under load, audit the codebase for hidden issues, and polish the public-facing README with visual showcase content.

- [x] **Phase 30: Stress Testing & Performance** - Prove the database and UI hold up under 1000+ ticket load with documented latency and memory profiles (completed 2026-02-18)
- [x] **Phase 31: Code Audit & Security Review** - Sweep the codebase for dead code, anti-patterns, and security drift since v2.0; compile prioritized findings (completed 2026-02-18)
- [x] **Phase 32: README Showcase** - Publish light mode screenshot, animated workflow GIFs, and GSD attribution to the public repo (completed 2026-02-18)

## Phase Details

### Phase 30: Stress Testing & Performance
**Goal**: The application is proven stable and fully characterized under 1000+ ticket load
**Depends on**: Phase 29 (490+ tests green, CI enforced)
**Requirements**: STRESS-01, STRESS-02, STRESS-03, STRESS-04, STRESS-05, PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. A Vitest stress suite creates, reads, updates, and deletes 1000+ tickets without error and SQLite PRAGMA integrity_check passes at the end
  2. 20+ consecutive bulk import rounds of 50 items each complete without data loss or test failure
  3. FTS5 search on a 1000+ ticket database returns results in under 100ms (measured and asserted in test)
  4. Concurrent create + search + edit operations produce no data corruption across repeated runs
  5. CRUD latency at 100/500/1000 ticket scale, UI responsiveness at 1000 items, and peak memory usage are documented as concrete numbers in a PERF-REPORT.md
**Plans**: 3 plans
Plans:
- [x] 30-01-PLAN.md — Stress test infrastructure and CRUD at 1000+ scale (STRESS-01, STRESS-05)
- [ ] 30-02-PLAN.md — Bulk import endurance, FTS5 search, and concurrency stress (STRESS-02, STRESS-03, STRESS-04)
- [ ] 30-03-PLAN.md — Performance benchmarks and PERF-REPORT.md (PERF-01, PERF-02, PERF-03, PERF-04)

### Phase 31: Code Audit & Security Review
**Goal**: All hidden code quality and security issues since v2.0 are identified, classified, and compiled into an actionable list
**Depends on**: Nothing (independent analytical work)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05
**Success Criteria** (what must be TRUE):
  1. Every unused export, stale import, and unreachable branch is listed with exact file and line location
  2. Anti-patterns and code smells are documented with severity (high/medium/low) and a concrete fix recommendation for each
  3. An OWASP Top 10 delta review against the v2.0 audit is complete, covering changes introduced in v2.1 and v2.2
  4. All dependencies are checked for known vulnerabilities and outdated versions, with license compliance confirmed
  5. A single prioritized issue list (AUDIT-REPORT.md) consolidates all findings ready for triage into backlog items
**Plans**: 3 plans
Plans:
- [x] 31-01-PLAN.md — Dead code scan and anti-pattern audit (AUDIT-01, AUDIT-02)
- [ ] 31-02-PLAN.md — OWASP security delta and dependency audit (AUDIT-03, AUDIT-04)
- [ ] 31-03-PLAN.md — Consolidated prioritized AUDIT-REPORT.md (AUDIT-05)

### Phase 32: README Showcase
**Goal**: The public README presents the full visual breadth of TicketFlow and credits GSD
**Depends on**: Nothing (independent content work)
**Requirements**: SHOW-01, SHOW-02, SHOW-03, SHOW-04
**Success Criteria** (what must be TRUE):
  1. README displays a light mode screenshot alongside the existing dark mode screenshot
  2. At least 3 animated GIFs are embedded, each demonstrating one key workflow: AI generation, bulk import, and drag-and-drop Kanban
  3. README contains a "Built with GSD" section with a link to github.com/gsd-build/get-shit-done
  4. README media gallery shows multiple app views including the item editor, AI chat panel, and settings
**Plans**: 2 plans
Plans:
- [ ] 32-01-PLAN.md — GSD attribution (badge + section) and media asset capture
- [ ] 32-02-PLAN.md — README restructure with hero, GIF section, and media gallery

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7. v1.0 phases | v1.0 | 22/22 | Complete | 2026-02-06 |
| 8-13. v1.5 phases | v1.5 | 24/24 | Complete | 2026-02-08 |
| 14-17. v1.6 phases | v1.6 | 8/8 | Complete | 2026-02-14 |
| 18-21. v2.0 phases | v2.0 | 8/8 | Complete | 2026-02-16 |
| 22-25. v2.1 phases | v2.1 | 13/13 | Complete | 2026-02-17 |
| 26-29. v2.2 phases | v2.2 | 10/10 | Complete | 2026-02-18 |
| 30. Stress Testing & Performance | 3/3 | Complete    | 2026-02-18 | - |
| 31. Code Audit & Security Review | 3/3 | Complete    | 2026-02-18 | - |
| 32. README Showcase | 2/2 | Complete    | 2026-02-18 | - |

---
*Roadmap created: 2026-02-05 | Updated: 2026-02-18 (31-01 complete: dead code + anti-pattern audit, 29 findings)*
*Full milestone details: .planning/milestones/*
