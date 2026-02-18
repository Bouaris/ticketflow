---
phase: 26-infrastructure-transport-foundation
plan: "02"
subsystem: telemetry-transport
tags: [rust, tauri, posthog, offline-queue, sqlx, reqwest, csp, ipc]
dependency_graph:
  requires: [26-01]
  provides: [ph_send_batch-command, telemetry-db, offline-queue, posthog-csp]
  affects: [src-tauri/src/lib.rs, src-tauri/src/telemetry.rs, src-tauri/tauri.conf.json]
tech_stack:
  added: [reqwest-0.12, sqlx-0.8-sqlite, telemetry.db]
  patterns: [rust-tauri-command, sqlx-offline-queue, wal-mode-sqlite, csp-explicit-allowlist]
key_files:
  created:
    - src-tauri/src/telemetry.rs
    - .env.example
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
    - .github/workflows/release.yml
    - src/test-utils/tauri-mocks.ts
decisions:
  - "Separate telemetry.db avoids schema coupling with tauri-plugin-sql which has no Rust-side API"
  - "reqwest with rustls-tls and default-features = false avoids native-tls dependency"
  - "startup_flush skips delivery when api_key is empty — key comes from frontend per-batch"
  - "WAL journal mode on telemetry.db ensures crash-safe persistence"
  - "mockIPC payload typed as InvokeArgs (not Record<string, unknown>) to match @tauri-apps/api types"
requirements-completed: [TELE-04, TELE-08]
metrics:
  duration_seconds: 397
  completed_date: "2026-02-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 5
---

# Phase 26 Plan 02: Rust Telemetry IPC Relay Summary

Rust `ph_send_batch` IPC command with SQLite-backed offline queue, PostHog EU endpoint in CSP, and VITE_POSTHOG_KEY env var wired through GitHub Actions.

## What Was Built

### Task 1: Rust telemetry module with ph_send_batch and offline queue

Created `src-tauri/src/telemetry.rs` implementing:

- `TelemetryState` — Tauri managed state holding `SqlitePool` and `api_host`
- `ph_send_batch` — Tauri IPC command that forwards event batches to PostHog EU endpoint; on network failure, falls back to offline queue; on success, flushes queued events
- `queue_events` — inserts events into `ph_event_queue` as JSON, enforces 500-event max by pruning oldest rows
- `flush_queue` — reads up to 50 queued events, POSTs them, deletes on success or increments retry_count on failure; discards events exceeding 5 retries
- `init_telemetry_db` — opens/creates `telemetry.db` in app data dir with WAL mode; runs schema DDL
- `startup_flush` — called on app startup to drain events queued before last shutdown

Updated `src-tauri/src/lib.rs` to:
- Declare `mod telemetry`
- Register `telemetry::ph_send_batch` in `generate_handler![]`
- Initialize `TelemetryState` in setup closure using `block_on(init_telemetry_db(...))`
- Call `startup_flush` in setup closure

Updated `src-tauri/Cargo.toml` with direct dependencies:
- `reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }`
- `sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }`

### Task 2: CSP updates, env var config

Updated `src-tauri/tauri.conf.json`:
- Added `https://eu.i.posthog.com https://us.i.posthog.com` to `connect-src` in both `csp` and `devCsp`

Updated `.github/workflows/release.yml`:
- Added `VITE_POSTHOG_KEY: ${{ secrets.VITE_POSTHOG_KEY }}` to build step env

Created `.env.example` documenting the required PostHog API key env var with instructions pointing to the EU PostHog dashboard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in tauri-mocks.ts**
- **Found during:** Task 2 (`pnpm build` check)
- **Issue:** `mockIPC` callback typed `payload: Record<string, unknown>` but `InvokeArgs` type is `Record<string, unknown> | number[] | ArrayBuffer | Uint8Array`, causing TS2345
- **Fix:** Imported `InvokeArgs` from `@tauri-apps/api/core`, typed callback as `(cmd: string, payload?: InvokeArgs)`, added local cast `const p = payload as Record<string, unknown> | undefined` for property access
- **Files modified:** `src/test-utils/tauri-mocks.ts`
- **Commit:** 82ccc8c

## Verification Results

| Check | Result |
|-------|--------|
| `ph_send_batch` in `generate_handler![]` | PASS |
| `mod telemetry` in lib.rs | PASS |
| `reqwest` in Cargo.toml | PASS |
| `sqlx` in Cargo.toml | PASS |
| `eu.i.posthog.com` in tauri.conf.json | 2 occurrences (csp + devCsp) |
| `us.i.posthog.com` in tauri.conf.json | 2 occurrences (csp + devCsp) |
| `VITE_POSTHOG_KEY` in release.yml | PASS |
| `.env.example` exists | PASS |
| `pnpm tauri build` (release Rust compile) | PASS |
| `pnpm build` (TypeScript + Vite) | PASS |

## Commits

| Hash | Message |
|------|---------|
| a3390bf | feat(26-02): add Rust ph_send_batch command with SQLite offline queue |
| 82ccc8c | feat(26-02): update CSP for PostHog, add env var config, fix mock type |

## Self-Check

Files created:
- src-tauri/src/telemetry.rs — FOUND
- .env.example — FOUND

Commits:
- a3390bf — FOUND
- 82ccc8c — FOUND
