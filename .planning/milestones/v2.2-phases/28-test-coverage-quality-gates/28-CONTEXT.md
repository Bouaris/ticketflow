# Phase 28: Test Coverage & Quality Gates - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Unit test coverage for critical `src/lib/` modules (parser, serializer, AI retry/health), 70% line coverage threshold enforced for `src/lib/`, and a GitHub Actions CI workflow that validates every push and PR to `master`. This is separate from `release.yml`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User gave full discretion on all implementation choices. Claude should decide based on best practices and existing project conventions:

- **Test file organization** — co-located vs separate folder, naming convention, shared fixtures
- **CI failure mode** — required check (blocking) vs advisory, branch protection rules
- **Coverage badge** — whether to add a coverage badge to README based on OSS conventions
- **Parser test approach** — example-based only vs adding property-based testing (fast-check), based on complexity/value tradeoff
- **Coverage scope** — 70% threshold for `src/lib/` as specified; Claude decides whether to track additional directories
- **Test utilities** — shared mocks, fixtures, helper functions as needed

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants this phase executed quickly with Claude making all tactical decisions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-test-coverage-quality-gates*
*Context gathered: 2026-02-18*
