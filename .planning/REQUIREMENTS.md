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
- [ ] **SHOW-03**: README includes "Built with GSD" section linking to github.com/gsd-build/get-shit-done
- [x] **SHOW-04**: README media gallery refreshed with multiple app views (editor, AI chat, settings)

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
| Automated fix application | This milestone identifies issues, does not fix them |
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
| SHOW-03 | Phase 32 | Pending |
| SHOW-04 | Phase 32 | Complete |

**Coverage:**
- v2.2.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation (phases 30-32 assigned)*
