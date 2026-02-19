# Requirements: TicketFlow

**Defined:** 2026-02-18
**Core Value:** Application desktop polished et productive — experience comparable a Linear pour projets personnels

## v2.2.1 Requirements

Requirements for milestone v2.2.1 "Battle-Ready". Each maps to roadmap phases.

### Stress Testing

- [x] **STRESS-01**: Automated test creates, reads, updates, and deletes 1000+ tickets in a single project database
- [x] **STRESS-02**: Bulk import stress-tested with max batch size (50 items) across 20+ consecutive rounds
- [x] **STRESS-03**: FTS5 search returns results in <100ms with 1000+ tickets indexed
- [x] **STRESS-04**: Concurrent rapid operations (create + search + edit) produce no data corruption
- [x] **STRESS-05**: SQLite PRAGMA integrity_check passes after all stress scenarios

### Performance Profiling

- [x] **PERF-01**: CRUD operation latency benchmarked at 100/500/1000 ticket scale with documented results
- [x] **PERF-02**: UI rendering performance validated (list/kanban views remain responsive at 1000+ items)
- [x] **PERF-03**: Memory usage profiled and peak consumption documented under sustained load
- [x] **PERF-04**: Performance bottlenecks identified and documented as prioritized backlog items

### Code Audit

- [x] **AUDIT-01**: Dead code identified (unused exports, stale imports, unreachable branches) with exact locations
- [x] **AUDIT-02**: Anti-patterns and code smells documented with severity classification
- [x] **AUDIT-03**: Security delta review against OWASP Top 10 since v2.0 audit
- [x] **AUDIT-04**: Dependency audit (outdated packages, known vulnerabilities, license compliance)
- [x] **AUDIT-05**: All findings compiled into prioritized issue list with fix recommendations

### README Showcase

- [x] **SHOW-01**: README updated with light mode screenshot alongside existing dark mode
- [x] **SHOW-02**: At least 3 animated GIFs demonstrating key workflows (AI generation, bulk import, command palette)
- [x] **SHOW-03**: README includes "Built with GSD" section linking to github.com/gsd-build/get-shit-done
- [x] **SHOW-04**: README media gallery refreshed with multiple app views (editor, AI chat, settings)

### Gap Closure — Type Safety & Critical Bugs (Phase 33)

- [x] **FIX-01**: All `as any` casts in AI provider selection replaced with proper type guards (SMELL-001, SMELL-002, SMELL-003)
- [x] **FIX-02**: `initTelemetry()` is idempotent — duplicate calls do not stack event listeners (SMELL-010)
- [x] **FIX-03**: `chatPanel.loadHistory` added to useEffect dependency array with stabilized callback (SMELL-004)
- [x] **FIX-04**: `ticketflow-questioning-mode` and `ticketflow-locale` centralized in STORAGE_KEYS (DEAD-008, SMELL-009)

### Gap Closure — Dead Code & Code Quality (Phase 34)

- [ ] **FIX-05**: All 11 DEAD-xxx findings removed (DEAD-001 through DEAD-011)
- [ ] **FIX-06**: `_projectPath` parameter removed from `getEffectiveAIConfig` and all 16+ call sites (DEAD-010, SMELL-018)
- [ ] **FIX-07**: Telemetry code quality: magic number extracted, consent boolean simplified, error policy documented (SMELL-011, SMELL-016, SMELL-017)
- [ ] **FIX-08**: `mockIpcWithState` orphaned export removed from stress-helpers.ts

### Gap Closure — Architecture & Performance (Phase 35)

- [ ] **FIX-09**: `ai.ts` split into focused modules — no single file exceeds 800 lines (SMELL-006)
- [ ] **FIX-10**: `ProjectWorkspace.tsx` reduced to under 600 lines via 4+ extracted hooks (SMELL-007)
- [ ] **FIX-11**: Business logic extracted from AISettingsModal + TypeConfig sync deps fixed (SMELL-008, SMELL-005)
- [ ] **FIX-12**: KanbanCard/ListView wrapped in React.memo + ListView virtualized (SMELL-012, SMELL-013)
- [ ] **FIX-13**: ProviderCard static objects moved to module scope + inline SVG replaced (SMELL-014, SMELL-015)

### Gap Closure — Security & Dependencies (Phase 36)

- [ ] **FIX-14**: Security findings hardened: IPC key validation, SHA-pinned CI, devtools conditional (SEC-D2, SEC-D8, SEC-D10)
- [ ] **FIX-15**: Cargo dependencies updated where fixes available; unfixable tracked in SECURITY.md (DEP-001)
- [ ] **FIX-16**: All npm dependencies updated (patch + minor + major) with build verification (DEP-002, DEP-003, DEP-004)
- [ ] **FIX-17**: README gallery restored to 3x2 or orphaned assets cleaned from repository

## Future Requirements

Deferred to subsequent releases.

- **XCOV-03**: Playwright E2E integration tests
- **PROV-07**: Provider health dashboard
- **PROV-08**: Smart provider switching
- **GENX-06**: Streaming response preview
- **GENX-07**: AI onboarding wizard for providers

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automated fix application | ~~This milestone identifies issues, does not fix them~~ — Now addressed by gap closure phases 33-36 |
| 100% test coverage | 70% enforced on critical modules; full coverage deferred |
| Playwright E2E | Deferred to v2.3+ (XCOV-03) |
| Load testing with real AI providers | Rate limits and costs make this impractical for automated testing |
| Video recording of demos | GIFs are sufficient for README showcase |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRESS-01 | Phase 30 | Complete |
| STRESS-02 | Phase 30 | Complete |
| STRESS-03 | Phase 30 | Complete |
| STRESS-04 | Phase 30 | Complete |
| STRESS-05 | Phase 30 | Complete |
| PERF-01 | Phase 30 | Complete |
| PERF-02 | Phase 30 | Complete |
| PERF-03 | Phase 30 | Complete |
| PERF-04 | Phase 30 | Complete |
| AUDIT-01 | Phase 31 | Complete |
| AUDIT-02 | Phase 31 | Complete |
| AUDIT-03 | Phase 31 | Complete |
| AUDIT-04 | Phase 31 | Complete |
| AUDIT-05 | Phase 31 | Complete |
| SHOW-01 | Phase 32 | Complete |
| SHOW-02 | Phase 32 | Complete |
| SHOW-03 | Phase 32 | Complete |
| SHOW-04 | Phase 32 | Complete |
| FIX-01 | Phase 33 | Complete |
| FIX-02 | Phase 33 | Complete |
| FIX-03 | Phase 33 | Complete |
| FIX-04 | Phase 33 | Complete |
| FIX-05 | Phase 34 | Pending |
| FIX-06 | Phase 34 | Pending |
| FIX-07 | Phase 34 | Pending |
| FIX-08 | Phase 34 | Pending |
| FIX-09 | Phase 35 | Pending |
| FIX-10 | Phase 35 | Pending |
| FIX-11 | Phase 35 | Pending |
| FIX-12 | Phase 35 | Pending |
| FIX-13 | Phase 35 | Pending |
| FIX-14 | Phase 36 | Pending |
| FIX-15 | Phase 36 | Pending |
| FIX-16 | Phase 36 | Pending |
| FIX-17 | Phase 36 | Pending |

**Coverage:**
- v2.2.1 requirements: 35 total (18 original + 17 gap closure)
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-19 after gap closure phases 33-36 added (17 FIX-xx requirements)*
