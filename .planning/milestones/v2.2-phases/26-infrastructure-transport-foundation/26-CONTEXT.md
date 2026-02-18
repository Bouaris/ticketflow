# Phase 26: Infrastructure & Transport Foundation - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Modernize test infrastructure (Vitest 4.x upgrade, Tauri SQL plugin mocking) and build the Rust IPC relay (`ph_send_batch`) that Phase 27 telemetry will use. Update CSP for PostHog endpoints. No telemetry logic, no consent UI, no test coverage targets — those are Phases 27 and 28.

</domain>

<decisions>
## Implementation Decisions

### Rust IPC relay (`ph_send_batch`)
- Queue offline with persistent storage: events are buffered in SQLite when network is unavailable
- Flush queue automatically when connectivity returns
- Persistent across app restarts — no event loss on crash/close
- SQLite table in the existing Tauri app database (or a dedicated telemetry.db — Claude's discretion)

### Claude's Discretion
- Vitest 4.x migration approach and config conventions
- Test file organization (co-located vs `__tests__/` folder)
- `setupTauriMocks()` design — mock granularity, response configurability
- SQLite schema for the offline queue (table structure, flush strategy, max queue size)
- Whether to use a separate telemetry.db or share the app database
- Retry/backoff strategy for failed batch sends
- CSP entry format (exact endpoints)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that the relay must be reliable enough that telemetry data is not silently lost during normal desktop usage (brief disconnects, app restarts).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-infrastructure-transport-foundation*
*Context gathered: 2026-02-17*
