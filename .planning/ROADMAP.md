# Roadmap: TicketFlow

## Milestones

- ✅ **v1.0 Stabilisation & IA Next Level** — Phases 1-7 (shipped 2026-02-06)
- ✅ **v1.5 Next-Gen Desktop Experience** — Phases 8-13 (shipped 2026-02-08)
- ✅ **v1.6 Smart Import** — Phases 14-17 (shipped 2026-02-14)
- ✅ **v2.0 Fresh Start** — Phases 18-21 (shipped 2026-02-16)
- ✅ **v2.1 AI Refresh** — Phases 22-25 (shipped 2026-02-17)
- ✅ **v2.2 Quality & Insights** — Phases 26-29 (shipped 2026-02-18)
- 🚧 **v2.2.1 Battle-Ready** — Phases 30-36 (in progress)

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
- [x] **Phase 33: Type Safety & Critical Bug Fixes** - Fix all P2 correctness issues: type casts, telemetry idempotency bug, useEffect deps, storage key centralization (gap closure) (completed 2026-02-19)
- [x] **Phase 34: Dead Code Sweep & Code Quality** - Remove all 11 dead code findings, clean orphaned exports, improve telemetry code quality (gap closure) (completed 2026-02-19)
- [x] **Phase 35: Architecture Refactoring & Performance** - Split god files, extract hooks, add React.memo and virtualization (gap closure) (completed 2026-02-19)
- [x] **Phase 36: Security, Dependencies & Cleanup** - SHA-pin CI, harden IPC, update all dependencies, restore README gallery (gap closure) (completed 2026-02-19)

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

### Phase 33: Type Safety & Critical Bug Fixes
**Goal**: All P2 type safety and correctness issues from AUDIT-REPORT.md are resolved — zero `as any` casts, idempotent telemetry init, correct useEffect deps, centralized storage keys
**Depends on**: Phase 31 (audit findings identified)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Gap Closure**: Closes SMELL-001, SMELL-002, SMELL-003, SMELL-004, SMELL-010, DEAD-008, SMELL-009
**Success Criteria** (what must be TRUE):
  1. `initTelemetry()` is idempotent — calling it twice does NOT duplicate `window.addEventListener` registrations (module-level guard)
  2. Zero `as any` casts remain in AISettingsModal provider selection — proper type guard validates provider ID
  3. `ticket: any` in ai-bulk.ts replaced with Zod-inferred type — TypeScript catches property typos at compile time
  4. ProviderCard color lookup is type-safe — uses typed Map or exhaustive switch, not string index with silent fallback
  5. `chatPanel.loadHistory` is in the useEffect dependency array in ProjectWorkspace — no stale closure on project switch
  6. `ticketflow-questioning-mode` and `ticketflow-locale` are defined in STORAGE_KEYS and imported from constants in all 4+ usage sites
**Plans**: 2 plans
Plans:
- [ ] 33-01-PLAN.md — Type-safe provider selection, bulk ticket type, ProviderCard colors (FIX-01)
- [ ] 33-02-PLAN.md — Telemetry idempotency, useEffect deps, storage key centralization (FIX-02, FIX-03, FIX-04)

### Phase 34: Dead Code Sweep & Code Quality
**Goal**: Every dead code finding from AUDIT-REPORT.md is removed and telemetry code quality items are resolved
**Depends on**: Phase 33 (storage key centralization in Phase 33 affects DEAD-008 overlap)
**Requirements**: FIX-05, FIX-06, FIX-07, FIX-08
**Gap Closure**: Closes DEAD-001 through DEAD-011, SMELL-018, SMELL-011, SMELL-016, SMELL-017, orphaned mockIpcWithState
**Success Criteria** (what must be TRUE):
  1. All 11 DEAD-xxx findings are resolved: no unused exports, stale imports, local icon duplicates, or unguarded console.log remain
  2. `getEffectiveAIConfig` no longer accepts `_projectPath` parameter — all 16+ call sites updated
  3. `mockIpcWithState` removed from stress-helpers.ts exports (or has a consumer)
  4. Telemetry code quality: magic number 200 extracted to named constant, consent boolean simplified, error severity policy documented
  5. `pnpm build` passes with zero TypeScript errors after all removals
**Plans**: 2 plans
Plans:
- [ ] 34-01-PLAN.md — Dead code removal: unused exports, orphaned components, icon dedup, console.log guards (FIX-05, FIX-08)
- [ ] 34-02-PLAN.md — Remove _projectPath parameter, telemetry code quality improvements (FIX-06, FIX-07)

### Phase 35: Architecture Refactoring & Performance
**Goal**: God files are split into focused modules, React rendering is optimized with memo and virtualization, and remaining architectural smells are resolved
**Depends on**: Phase 34 (dead code removed first to reduce merge conflicts in god files)
**Requirements**: FIX-09, FIX-10, FIX-11, FIX-12, FIX-13
**Gap Closure**: Closes SMELL-005, SMELL-006, SMELL-007, SMELL-008, SMELL-012, SMELL-013, SMELL-014, SMELL-015
**Success Criteria** (what must be TRUE):
  1. `ai.ts` is split into 3+ focused modules (ai-client.ts, ai-config.ts, ai-maintenance.ts) — no single file exceeds 800 lines
  2. `ProjectWorkspace.tsx` has 4+ extracted hooks (useWorkspaceBulkOps, useWorkspaceTypeSync, useWorkspaceItemActions, useWorkspaceModals) — main component under 600 lines
  3. AISettingsModal does not directly call database query functions — `useAIFeedbackStats` hook extracted
  4. KanbanCard and ListView row components are wrapped in `React.memo`
  5. ListView uses `@tanstack/react-virtual` for windowed rendering
  6. ProviderCard static objects moved to module scope; inline SVG replaced with InfoIcon import
  7. TypeConfig sync effect dependencies documented or fixed
  8. `pnpm build` passes; existing test suite remains green
**Plans**: 4 plans
Plans:
- [ ] 35-01-PLAN.md — Split ai.ts into ai-client.ts, ai-config.ts, ai-maintenance.ts (FIX-09)
- [ ] 35-02-PLAN.md — Extract 4 hooks from ProjectWorkspace.tsx, document TypeConfig sync deps (FIX-10)
- [ ] 35-03-PLAN.md — Extract useAIFeedbackStats hook, ProviderCard cleanup (FIX-11, FIX-13)
- [ ] 35-04-PLAN.md — React.memo for KanbanCard/ListView + ListView virtualization (FIX-12)

### Phase 36: Security, Dependencies & Cleanup
**Goal**: All security findings hardened, all dependencies updated to latest compatible versions, README gallery restored, orphaned assets cleaned
**Depends on**: Phase 35 (architecture changes may affect dependency imports)
**Requirements**: FIX-14, FIX-15, FIX-16, FIX-17
**Gap Closure**: Closes SEC-D2, SEC-D8, SEC-D10, DEP-001, DEP-002, DEP-003, DEP-004, README orphaned assets
**Success Criteria** (what must be TRUE):
  1. `ph_send_batch` Rust command validates api_key against compiled-in key or documents accepted risk in SECURITY.md
  2. All CI actions in ci.yml are SHA-pinned (not tag-pinned)
  3. DevTools conditionally disabled in production builds (or documented as accepted risk in SECURITY.md)
  4. `bytes` and `time` Cargo crates updated to fixed versions; `rkyv` and `rsa` documented as tracked upstream
  5. All 10 npm patch updates applied; all 10 minor updates applied; 5 major updates applied or explicitly deferred with rationale
  6. Tauri ecosystem updated to 2.10.x (coordinated Cargo.toml + package.json)
  7. README gallery restored to 3x2 with all 6 assets, or orphaned files cleaned from assets/
  8. `pnpm build` and `pnpm tauri build` pass after all dependency changes
**Plans**: 3 plans
Plans:
- [ ] 36-01-PLAN.md — SHA-pin CI actions, document accepted security risks in SECURITY.md (FIX-14)
- [ ] 36-02-PLAN.md — Update all npm + Cargo dependencies, Tauri ecosystem to 2.10.x (FIX-15, FIX-16)
- [ ] 36-03-PLAN.md — Restore README gallery to 3x2 + final build verification (FIX-17)

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
| 33. Type Safety & Critical Bug Fixes | 2/2 | Complete    | 2026-02-19 | - |
| 34. Dead Code Sweep & Code Quality | 2/2 | Complete    | 2026-02-19 | - |
| 35. Architecture Refactoring & Performance | 4/4 | Complete    | 2026-02-19 | - |
| 36. Security, Dependencies & Cleanup | 3/3 | Complete    | 2026-02-19 | - |

---
*Roadmap created: 2026-02-05 | Updated: 2026-02-19 (gap closure phases 33-36 added from milestone audit)*
*Full milestone details: .planning/milestones/*
