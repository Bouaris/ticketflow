# Phase 26: Infrastructure & Transport Foundation - Research

**Researched:** 2026-02-17
**Domain:** Test infrastructure (Vitest 4.x), Tauri Rust IPC, PostHog telemetry transport, CSP
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rust IPC relay (`ph_send_batch`) with SQLite offline queue
- Events buffered in SQLite when network is unavailable
- Queue flushes automatically when connectivity returns
- Queue persists across app restarts (no event loss on crash/close)

### Claude's Discretion
- Vitest 4.x migration approach and config conventions
- Test file organization (co-located vs `__tests__/` folder)
- `setupTauriMocks()` design — mock granularity, response configurability
- SQLite schema for the offline queue (table structure, flush strategy, max queue size)
- Whether to use a separate telemetry.db or share the app database
- Retry/backoff strategy for failed batch sends
- CSP entry format (exact endpoints)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TINF-01 | Vitest upgraded from 2.x to 4.x with @vitest/coverage-v8 matching version (Vite 7 compatibility) | Verified: vitest 4.0.18 declares `vite: "^6.0.0 || ^7.0.0"` — compatible with project's Vite 7.3.0. Install target: `vitest@^4.0.18` + `@vitest/coverage-v8@^4.0.18`. Config changes required: `coverage.all` removed (must use `coverage.include`), `basic` reporter removed. |
| TINF-02 | @tauri-apps/plugin-sql mocked at module level in shared test setup; all hook tests run without __TAURI_INTERNALS__ errors | Research: `@tauri-apps/api/mocks` provides `mockIPC` + `mockWindows` + `clearMocks`. The IPC mock handler intercepts `plugin:sql|*` commands. Must be called in setup file BEFORE any test module imports. Shared file: `src/test-utils/tauri-mocks.ts`. |
| TELE-04 | Telemetry events delivered from Tauri desktop builds via Rust IPC relay command (`ph_send_batch`) | Research: Rust command using `reqwest` (already in Cargo.lock as transitive dep). SQLite offline queue uses a dedicated table in the existing app DB or a separate `telemetry.db` (Claude's discretion: recommend separate). Pattern: `tauri_plugin_http::reqwest` re-export, OR add `reqwest` directly. |
| TELE-08 | PostHog API key stored as VITE_POSTHOG_KEY env var; CSP updated for PostHog endpoints | PostHog batch endpoint: `POST https://eu.i.posthog.com/batch` (GDPR decision). Body: `{ "api_key": "...", "batch": [...] }`. CSP `connect-src` must add `https://eu.i.posthog.com https://us.i.posthog.com`. Env: `.env.local` (gitignored), CI: GitHub Secret. |
</phase_requirements>

---

## Summary

Phase 26 has three distinct workstreams that are largely independent: (1) upgrading Vitest 2.x to 4.x, (2) creating a shared `setupTauriMocks()` that properly intercepts `plugin:sql` IPC calls, and (3) implementing a Rust `ph_send_batch` command with SQLite-backed offline queue.

The Vitest 4.x upgrade is a mechanical dependency bump with a small number of breaking config changes. The project's current `vitest.config.ts` uses `coverage.all` (removed in v4) and should have it replaced with explicit `coverage.include`. The jsdom 25 version the project uses is safe — known breakage is with jsdom 27+ (Blob constructor mismatch). The `@tauri-apps/api/mocks` `mockIPC` function is the correct, officially supported mechanism for intercepting `plugin:sql|*` commands in unit tests without requiring `__TAURI_INTERNALS__`. The current `tauri-mock.ts` mocks `tauri-bridge.ts` functions, but doesn't cover the underlying IPC layer that `@tauri-apps/plugin-sql` uses directly — hence the `__TAURI_INTERNALS__ is not defined` errors in tests that import hooks using database.ts.

For the Rust IPC relay, `reqwest` is already in `Cargo.lock` as a transitive dependency (via `tauri-plugin-updater`). The simplest approach is to either use `tauri_plugin_http::reqwest` (requires adding `tauri-plugin-http` to Cargo.toml) or add `reqwest` directly as a direct dependency. The offline queue should use a **separate `telemetry.db`** to avoid schema coupling with the main app database (which already has its own migration system via `tauri-plugin-sql`'s migration runner). The Rust command accesses SQLite via `sqlx` (already v0.8.6 in Cargo.lock) with a Tauri-managed state pool.

**Primary recommendation:** Use `reqwest` directly (not via `tauri-plugin-http`) + `sqlx` with a separate `telemetry.db` opened at Tauri setup time and stored in managed state. This avoids coupling with the frontend JS SQL plugin while keeping all telemetry concerns isolated.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | 4.0.18 (latest) | Test runner | Official upgrade target |
| `@vitest/coverage-v8` | 4.0.18 | V8 coverage | Must match vitest version exactly |
| `@tauri-apps/api/mocks` | already installed (^2.9.1) | IPC mock in tests | Official Tauri mocking API |
| `reqwest` | 0.12.x (via Cargo.lock) | HTTP client in Rust | Already present as transitive dep |
| `sqlx` | 0.8.6 (via Cargo.lock) | SQLite access in Rust | Already present as transitive dep |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `serde_json` | 1.0 (in Cargo.toml) | JSON serialization | Already in Cargo.toml |
| `tokio` | 1.48.0 (via Cargo.lock) | Async runtime | Already transitive dep |
| `jsdom` | 25.x (current) | DOM env for tests | Keep at current version — jsdom 27 has Blob compat issues with Vitest 4 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `reqwest` direct | `tauri_plugin_http::reqwest` re-export | Adds `tauri-plugin-http` dependency unnecessarily; our command is backend-only |
| Separate `telemetry.db` | Add table to main app DB | Main DB is managed by `tauri-plugin-sql` JS API; Rust-side access requires `sqlx` separately anyway — cleaner to isolate |
| `mockIPC` from `@tauri-apps/api/mocks` | Module-level `vi.mock('@tauri-apps/plugin-sql', ...)` | Module mock is simpler but doesn't properly intercept the IPC layer; `mockIPC` is the official Tauri solution |

**Installation:**
```bash
# JavaScript (devDeps upgrade)
pnpm add -D vitest@^4.0.18 @vitest/coverage-v8@^4.0.18

# Rust (Cargo.toml direct deps — versions already in lock)
# reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
# sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── test-utils/
│   ├── setup.ts             # existing — add mockWindows() + clearMocks() call
│   └── tauri-mocks.ts       # NEW — exports setupTauriMocks() with plugin:sql handlers
src-tauri/src/
├── lib.rs                   # add ph_send_batch to invoke_handler + init telemetry DB state
├── telemetry.rs             # NEW — ph_send_batch command, offline queue logic, flush
└── migrations/
    └── 001_initial.sql      # existing (untouched)
```

### Pattern 1: Vitest 4.x Config Migration

**What:** Update `vitest.config.ts` to remove deprecated options and fix coverage config.
**When to use:** Required — `coverage.all` is removed in Vitest 4.

```typescript
// Source: https://vitest.dev/guide/migration.html
// BEFORE (Vitest 2.x):
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/lib/**', 'src/hooks/**', 'src/types/**', 'src/components/ui/**'],
  exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test-utils/**'],
  // coverage.all was implicitly true — explicitly set include in v4
}

// AFTER (Vitest 4.x — no breaking change here, include was already set):
// coverage.all removed in v4 but this project already uses coverage.include
// No changes needed to coverage section for this project
// Key: verify no 'basic' reporter used, no 'poolMatchGlobs', no 'workspace' key
```

**Summary of breaking changes that affect this project:**
- `coverage.all` option removed (replaced by `coverage.include` — **already done in this project**)
- `basic` reporter removed (use `default` with `summary: false`) — **not used here**
- `vi.restoreAllMocks()` no longer resets `vi.fn()` state (only `vi.spyOn`) — **check setup.ts afterEach**
- `minWorkers` option removed — **not used here**
- `workspace` → `projects` rename — **not used here**

### Pattern 2: Shared `setupTauriMocks()` in test-utils

**What:** A shared function that calls `mockWindows()` + `mockIPC()` from `@tauri-apps/api/mocks` to intercept all Tauri IPC calls including `plugin:sql|*` commands.
**When to use:** Called in `setup.ts` (the Vitest `setupFiles` entry) so it runs before every test.

```typescript
// Source: https://v2.tauri.app/develop/tests/mocking/
// src/test-utils/tauri-mocks.ts

import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import { vi, beforeAll, afterEach } from 'vitest';

export interface SqlMockOptions {
  /** Override default SELECT responses per table name pattern */
  selectHandlers?: Record<string, unknown[]>;
  /** Override execute to return specific lastInsertId / rowsAffected */
  executeResult?: { lastInsertId: number; rowsAffected: number };
}

export function setupTauriMocks(options: SqlMockOptions = {}): void {
  beforeAll(() => {
    // Step 1: Fake the window context (required for __TAURI_INTERNALS__)
    mockWindows('main');

    // Step 2: Intercept ALL IPC commands at the transport layer
    mockIPC((cmd, payload) => {
      // plugin:sql|load → return a fake db handle
      if (cmd === 'plugin:sql|load') {
        return Promise.resolve('sqlite:mock');
      }
      // plugin:sql|execute → INSERT/UPDATE/DELETE success
      if (cmd === 'plugin:sql|execute') {
        return Promise.resolve(
          options.executeResult ?? { lastInsertId: 1, rowsAffected: 1 }
        );
      }
      // plugin:sql|select → empty result by default
      if (cmd === 'plugin:sql|select') {
        return Promise.resolve([]);
      }
      // plugin:sql|close → no-op
      if (cmd === 'plugin:sql|close') {
        return Promise.resolve();
      }
      // ph_send_batch → success stub
      if (cmd === 'ph_send_batch') {
        return Promise.resolve({ queued: 0, sent: (payload as any)?.events?.length ?? 0 });
      }
    });
  });

  afterEach(() => {
    clearMocks();
  });
}
```

**Integration in `setup.ts`:**
```typescript
// Add to src/test-utils/setup.ts
import { setupTauriMocks } from './tauri-mocks';
setupTauriMocks();
```

### Pattern 3: Rust `ph_send_batch` Command with SQLite Offline Queue

**What:** A Tauri command that accepts a JSON event batch, tries to POST to PostHog, and on failure queues events in a separate `telemetry.db` SQLite database. A background task flushes the queue when network is available.

**When to use:** Always invoked from frontend instead of direct PostHog JS calls (Tauri WebView blocks direct fetch to external domains without reqwest bypass).

```rust
// Source: https://v2.tauri.app/develop/calling-rust/ + https://goroji.com/posts/how-to-use-sqlx-with-tauri/
// src-tauri/src/telemetry.rs

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhEvent {
    pub event: String,
    pub properties: serde_json::Value,
    pub timestamp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchPayload {
    pub events: Vec<PhEvent>,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub sent: usize,
    pub queued: usize,
}

pub struct TelemetryState {
    pub pool: SqlitePool,
    pub api_key: String,
    pub api_host: String,
}

#[tauri::command]
pub async fn ph_send_batch(
    payload: BatchPayload,
    state: State<'_, TelemetryState>,
) -> Result<BatchResult, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "api_key": &payload.api_key,
        "batch": &payload.events,
    });

    match client
        .post(format!("{}/batch", state.api_host))
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            // Also flush any queued events
            flush_queue(&state.pool, &client, &payload.api_key, &state.api_host).await;
            Ok(BatchResult { sent: payload.events.len(), queued: 0 })
        }
        _ => {
            // Network failure: queue all events
            let count = queue_events(&state.pool, &payload.events).await
                .map_err(|e| e.to_string())?;
            Ok(BatchResult { sent: 0, queued: count })
        }
    }
}
```

**SQLite schema for offline queue** (separate `telemetry.db`):
```sql
-- Create on first open, not via tauri-plugin-sql migration system
CREATE TABLE IF NOT EXISTS ph_event_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_json TEXT NOT NULL,           -- JSON of PhEvent
    created_at INTEGER NOT NULL,        -- Unix timestamp ms
    retry_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_queue_created ON ph_event_queue(created_at ASC);
```

**Max queue size:** 500 events (prune oldest when exceeded — prevents unbounded growth).
**Flush trigger:** Called after every successful `ph_send_batch`; also call at app startup.
**Retry backoff:** On flush, if HTTP fails again, increment `retry_count`. Discard after `retry_count >= 5`.

### Pattern 4: CSP Update for PostHog

**What:** Add PostHog endpoints to both `csp` and `devCsp` in `tauri.conf.json`.
**When to use:** Required for TELE-08.

```json
// In src-tauri/tauri.conf.json, app.security.csp.connect-src
// ADD: https://eu.i.posthog.com https://us.i.posthog.com
// BEFORE:
"connect-src": "ipc: http://ipc.localhost ... https://api.openai.com https:"
// AFTER:
"connect-src": "ipc: http://ipc.localhost ... https://api.openai.com https://eu.i.posthog.com https://us.i.posthog.com https:"
```

Note: The trailing `https:` wildcard already allows all HTTPS, so technically the explicit entries are redundant when `https:` is present. However, best practice for CSP in Tauri is to be explicit rather than rely on wildcards. Remove the `https:` wildcard and be explicit about each allowed domain for better security posture. This is a judgment call — keeping `https:` means PostHog works without explicit entry, but explicit is safer.

**Recommendation: Keep `https:` wildcard AND add explicit PostHog entries** for documentation clarity (any reviewer can see PostHog is intentionally allowed).

### Pattern 5: VITE_POSTHOG_KEY Environment Variable

**What:** PostHog API key is a build-time env var, injected via Vite's `import.meta.env.VITE_POSTHOG_KEY`.
**Convention:**
- Local dev: `.env.local` (already in `.gitignore`)
- CI/GitHub Actions: GitHub Secret `VITE_POSTHOG_KEY` passed as env var in release.yml

```yaml
# In .github/workflows/release.yml, add to Build and release step env:
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  VITE_POSTHOG_KEY: ${{ secrets.VITE_POSTHOG_KEY }}  # ADD THIS
```

### Anti-Patterns to Avoid

- **Do NOT add PostHog API key to source code** — even in a const or default value. It should always be `undefined` if the env var is missing (graceful degradation: no telemetry).
- **Do NOT use `vi.mock('@tauri-apps/plugin-sql', ...)` module mock** — this only stubs the JS module surface, not the underlying IPC layer. The `__TAURI_INTERNALS__` error comes from the IPC layer during `Database.load()`, which requires `mockIPC`.
- **Do NOT add telemetry table to 001_initial.sql or the main migration chain** — the offline queue belongs in a separate `telemetry.db` managed directly by Rust.
- **Do NOT share the `SqlitePool` for telemetry with the main app DB** — the main DB uses the `tauri-plugin-sql` JS API and has its own connection lifecycle; mixing Rust-managed pools creates conflicts.
- **Do NOT use `coverage.all: true`** in Vitest 4 config — the option is removed. The project already has `coverage.include` defined, so no change is needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client in Rust | Custom TCP socket code | `reqwest` (already in Cargo.lock 0.12.28) | TLS, timeouts, connection pooling handled |
| IPC interception in tests | Custom `window.__TAURI_INTERNALS__` setup | `@tauri-apps/api/mocks` `mockIPC` | Official API, handles all edge cases including event mocking |
| Offline queue serialization | Custom binary format | SQLite row with `event_json TEXT` | Simple, inspectable, survives crashes |
| Async runtime in Rust commands | Roll own thread management | `tauri::async_runtime` (Tokio under the hood) | Tauri's runtime is already initialized |

**Key insight:** Both `reqwest` and `sqlx` are already in the project's Cargo.lock as transitive dependencies. Making them direct dependencies just requires adding them to Cargo.toml — no new code is downloaded.

---

## Common Pitfalls

### Pitfall 1: `mockIPC` Must Be Called Before Any Module Import That Uses It

**What goes wrong:** If `setupTauriMocks()` is called in `afterEach` or `beforeEach` but a test file imports a hook that calls `Database.load()` at module initialization time, the mock won't be in place.
**Why it happens:** Vitest hoists `vi.mock()` calls but `mockIPC` is a runtime call; module-level side effects run before `beforeEach`.
**How to avoid:** Call `mockIPC` inside `beforeAll` in the setup file so it runs before any test module executes. The `vitest.config.ts` `setupFiles` option ensures `setup.ts` runs first.
**Warning signs:** `__TAURI_INTERNALS__ is not defined` error in test output.

### Pitfall 2: Vitest 4 `vi.restoreAllMocks()` Behavior Change

**What goes wrong:** `afterEach(() => vi.restoreAllMocks())` previously reset `vi.fn()` mocks; in Vitest 4 it only restores `vi.spyOn()` mocks.
**Why it happens:** Breaking change in Vitest 4 spy implementation rewrite.
**How to avoid:** The current `setup.ts` uses `vi.clearAllMocks()` (not `restoreAllMocks`) — this is correct for Vitest 4. No change needed.
**Warning signs:** Mock call counts accumulating across tests unexpectedly.

### Pitfall 3: jsdom Version Compatibility with Vitest 4

**What goes wrong:** Upgrading jsdom beyond 26.x alongside Vitest 4 causes `URL.createObjectURL` Blob constructor mismatch errors.
**Why it happens:** jsdom 27 changed internal Blob implementation incompatible with Vitest 4's environment bridging.
**How to avoid:** Keep `jsdom` at `^25.0.1` (current). Do NOT upgrade jsdom as part of this phase.
**Warning signs:** `TypeError: The 'obj' argument must be an instance of Blob` in tests that use `URL.createObjectURL`.
**Already mitigated:** The current `setup.ts` manually stubs `URL.createObjectURL` with `vi.fn()`, which bypasses this issue even if jsdom version changes.

### Pitfall 4: `tauri-plugin-sql` Has No Rust-Side API

**What goes wrong:** Trying to open/query the main `ticketflow.db` from Rust using `tauri-plugin-sql`'s Rust crate — there is no public Rust API.
**Why it happens:** The plugin is designed for JS-to-Rust bridge only; Rust access requires `sqlx` directly.
**How to avoid:** Use `sqlx::SqlitePool` for the telemetry DB, managed via `app.manage(TelemetryState { pool })`. This is completely separate from what the JS-side plugin manages.
**Warning signs:** Compile errors trying to import `tauri_plugin_sql::Database` or similar types for direct query.

### Pitfall 5: Reqwest Feature Flags Needed

**What goes wrong:** `reqwest` is in Cargo.lock as a transitive dep but may not have `json` and TLS features enabled for direct use.
**Why it happens:** Transitive deps use the features required by the dependency that pulls them in; direct dep needs its own feature declaration.
**How to avoid:** Declare explicitly in Cargo.toml: `reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }`
**Warning signs:** Compile error "the method `json` exists but the following trait bounds were not satisfied".

### Pitfall 6: `ph_send_batch` Must Be Added to `invoke_handler`

**What goes wrong:** Defining `#[tauri::command] async fn ph_send_batch(...)` but forgetting to add it to `tauri::generate_handler![...]` in `lib.rs`.
**Why it happens:** Tauri's command registration is explicit, not automatic.
**How to avoid:** Update `lib.rs`: `.invoke_handler(tauri::generate_handler![force_quit, ph_send_batch])`.

---

## Code Examples

Verified patterns from official sources:

### Vitest 4 Config (minimal changes from current)

```typescript
// Source: https://vitest.dev/config/
// vitest.config.ts — changes from current 2.x config
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'src-tauri'],
    setupFiles: ['./src/test-utils/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // No change needed — coverage.include already defined; coverage.all was
      // not explicitly set in this project so removal is a no-op.
      include: ['src/lib/**', 'src/hooks/**', 'src/types/**', 'src/components/ui/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test-utils/**',
      ],
    },
  },
});
// Key changes: none to config structure for this project.
// The main work is the npm package version bump.
```

### `mockIPC` for plugin:sql Commands

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacemocks/
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';

// In setup.ts / setupTauriMocks():
mockWindows('main');  // must call before mockIPC to establish __TAURI_INTERNALS__

mockIPC((cmd, payload) => {
  switch (cmd) {
    case 'plugin:sql|load':
      return Promise.resolve('sqlite:mock-handle');
    case 'plugin:sql|execute':
      return Promise.resolve({ lastInsertId: 1, rowsAffected: 1 });
    case 'plugin:sql|select':
      return Promise.resolve([]);  // empty rows
    case 'plugin:sql|close':
      return Promise.resolve(null);
  }
});

afterEach(() => clearMocks());
```

### Rust Telemetry Command Registration

```rust
// Source: https://v2.tauri.app/develop/calling-rust/
// src-tauri/src/lib.rs — additions

mod telemetry;
use telemetry::{ph_send_batch, TelemetryState};

pub fn run() {
    // ... existing setup ...

    // Initialize telemetry DB (separate from main app DB)
    let telemetry_state = tauri::async_runtime::block_on(async {
        let db_path = /* app_data_dir + /telemetry.db */;
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite:{}?mode=rwc", db_path))
            .await
            .expect("Failed to open telemetry DB");
        // Run CREATE TABLE IF NOT EXISTS ...
        sqlx::query(QUEUE_SCHEMA).execute(&pool).await.ok();
        TelemetryState {
            pool,
            api_host: "https://eu.i.posthog.com".to_string(),
        }
    });

    tauri::Builder::default()
        .manage(telemetry_state)
        .invoke_handler(tauri::generate_handler![force_quit, ph_send_batch])
        // ... rest of existing builder ...
}
```

**Challenge:** `app_data_dir` is only available after `.setup()`, not before `.manage()`. Use `tauri::Builder::setup()` to initialize the pool:

```rust
.setup(|app| {
    let data_dir = app.path().app_data_dir()
        .expect("app data dir unavailable");
    let db_path = data_dir.join("telemetry.db");
    let pool = tauri::async_runtime::block_on(async {
        sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite:{}?mode=rwc", db_path.display()))
            .await
            .expect("Failed to open telemetry DB")
    });
    tauri::async_runtime::block_on(async {
        sqlx::query(QUEUE_SCHEMA).execute(&pool).await.ok();
    });
    app.manage(TelemetryState {
        pool,
        api_host: "https://eu.i.posthog.com".to_string(),
    });
    // ... rest of existing setup ...
    Ok(())
})
```

### Cargo.toml Additions

```toml
# src-tauri/Cargo.toml — additions to [dependencies]
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
```

Note: Both are already in Cargo.lock (0.12.28 and 0.8.6 respectively). This just makes them direct deps.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest 2.x `coverage.all: true` | Must use `coverage.include` | Vitest 4.0 | Remove `coverage.all`, keep explicit `include` (already done) |
| `basic` reporter | Use `default` reporter with `summary: false` | Vitest 4.0 | Not used in this project |
| `vi.mock('@tauri-apps/plugin-sql', ...)` module mock | `mockIPC` from `@tauri-apps/api/mocks` | Tauri v2 best practice | Intercepts at IPC layer, no `__TAURI_INTERNALS__` errors |
| `tinypool` for Vitest workers | Custom pool without tinypool | Vitest 4.0 | Internal change, no config impact for this project |
| jsdom 27+ | Stay at jsdom 25-26 range | Issue reported Nov 2025 | Blob constructor compatibility with Vitest 4 |

**Deprecated/outdated:**
- `coverage.all`: removed in Vitest 4 — replaced by `coverage.include` (already set in project)
- `poolMatchGlobs`, `environmentMatchGlobs`: removed in Vitest 4 — not used in project
- `workspace` config key: renamed to `projects` in Vitest 4 — not used in project

---

## Open Questions

1. **`app_data_dir` path for telemetry.db on Windows**
   - What we know: `app.path().app_data_dir()` returns `%APPDATA%\com.ticketflow.app` on Windows
   - What's unclear: Whether this directory exists at first launch before `tauri-plugin-sql` creates it
   - Recommendation: Use `std::fs::create_dir_all()` before opening the DB

2. **Connectivity detection strategy for queue flush**
   - What we know: No native Tauri connectivity API; best proxy is "did the HTTP call succeed"
   - What's unclear: Whether to attempt flush on every app startup or only after successful sends
   - Recommendation: Attempt flush on app startup (in setup) and after each successful `ph_send_batch`. No network polling needed.

3. **`plugin:sql|select` response format**
   - What we know: `mockIPC` intercepts the command; we return `[]` as default
   - What's unclear: Whether the actual response is `rows[]` or a wrapper object `{ rows: [] }`
   - Recommendation: Look at `@tauri-apps/plugin-sql` JS source to verify shape. Based on the JS API signature (`Database.select<T>() → T[]`), the IPC response is a plain array of row objects.

4. **Max queue size enforcement**
   - What we know: Recommended 500 events max
   - What's unclear: Whether to enforce at insert time (DELETE oldest) or at flush time
   - Recommendation: Enforce at insert time using: `DELETE FROM ph_event_queue WHERE id NOT IN (SELECT id FROM ph_event_queue ORDER BY id DESC LIMIT 500)`

---

## Sources

### Primary (HIGH confidence)
- `https://vitest.dev/guide/migration.html` — Vitest 4.x migration guide, breaking changes
- `https://github.com/vitest-dev/vitest/releases/tag/v4.0.0` — Official v4 release notes
- `npm info vitest@4.0.18 dependencies` — Verified `vite: "^6.0.0 || ^7.0.0"` compatibility
- `npm info @vitest/coverage-v8` — Confirmed v4.0.18 is latest
- `https://v2.tauri.app/reference/javascript/api/namespacemocks/` — `mockIPC`, `mockWindows`, `clearMocks` API
- `https://v2.tauri.app/develop/calling-rust/` — `#[tauri::command]` pattern
- `D:/PROJET CODING/ticketflow/src-tauri/Cargo.lock` — Verified: reqwest 0.12.28, sqlx 0.8.6, tokio 1.48.0 already present
- `D:/PROJET CODING/ticketflow/src-tauri/tauri.conf.json` — Current CSP structure
- `D:/PROJET CODING/ticketflow/src/test-utils/setup.ts` — Current test setup
- `D:/PROJET CODING/ticketflow/vitest.config.ts` — Current vitest config (v2.x)

### Secondary (MEDIUM confidence)
- `https://goroji.com/posts/how-to-use-sqlx-with-tauri/` — SQLx + Tauri managed state pattern
- `https://v2.tauri.app/plugin/http-client/` — tauri-plugin-http re-exports reqwest for Rust
- `https://github.com/tauri-apps/tauri/discussions/9937` — tauri-plugin-sql has no Rust API
- PostHog batch endpoint format: `{ "api_key": "...", "batch": [...] }` — multiple sources cross-referenced
- PostHog EU endpoint: `https://eu.i.posthog.com/batch` — verified via official docs reference

### Tertiary (LOW confidence)
- jsdom 27 Blob incompatibility with Vitest 4: `https://github.com/vitest-dev/vitest/issues/8917` — active issue, workaround known
- Retry/backoff strategy: general best practice for telemetry queues, no Tauri-specific source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm and Cargo.lock
- Architecture: HIGH — patterns verified from official Tauri v2 and Vitest v4 docs
- Pitfalls: HIGH — most verified from official issue trackers and docs; jsdom issue is MEDIUM (active open issue)

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days — stable ecosystem; Vitest 4.x and Tauri v2 are stable releases)
