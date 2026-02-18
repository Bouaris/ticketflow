# 31-02: OWASP Delta Review & Dependency Audit

**Phase:** 31 — Code Audit & Security Review
**Plan:** 02
**Date:** 2026-02-18
**Scope:** Delta review for v2.1 (provider registry, AI health) and v2.2 (telemetry, consent, CI/tests)
**Baseline:** Phase 18 audit (v2.0) — all categories clean, CSP enforced, gitleaks clean

---

## Executive Summary

This delta review evaluates the security impact of changes introduced in v2.1 and v2.2 against the v2.0 baseline established in Phase 18. The two milestones added:

- **v2.1:** AI provider registry (`ai-provider-registry.ts`), health check module (`ai-health.ts`), custom provider form/list, AISettings split, `aiProvider.ts` Zod schemas
- **v2.2:** Telemetry module (`telemetry.ts`, `telemetry.rs`), GDPR consent dialog, CI pipeline (`ci.yml`), test utilities

**Overall result:** 8 PASS, 2 NEEDS ATTENTION. No new FAIL categories introduced. Dependency audit reveals 2 new npm issues and 4 Rust vulnerabilities requiring tracking.

---

## OWASP Desktop Top 10 (2021) — Delta Review

### D1 — Injections (SQL, Command, etc.)

**Status**: PASS
**v2.0 Baseline**: All SQL uses parameterized `$1/$2` placeholders. No eval/Function() usage. Shell access limited to `shell:allow-open` for URLs only.
**v2.1/v2.2 Delta**:
- `telemetry.rs` introduces new SQLite queries for the offline event queue.
- All queries use sqlx positional binding (`?`): `INSERT INTO ph_event_queue (event_json, created_at) VALUES (?, ?)`, `DELETE FROM ph_event_queue WHERE id IN (...)` with bound parameters.
- The dynamic SQL in `flush_queue()` and `queue_events()` uses `id_placeholders.iter().map(|_| "?".to_string())` — placeholders are generated from safe integer IDs, values are bound separately via sqlx, no string interpolation of user data.
- `ai-provider-registry.ts`: Custom provider URLs and names go through Zod validation before storage. No SQL involved in the registry (localStorage only).
- No new `eval()`, `Function()`, or unsafe template literal usage found across v2.1/v2.2 files.
**Evidence**:
- `src-tauri/src/telemetry.rs:185-191` — parameterized INSERT
- `src-tauri/src/telemetry.rs:286-296` — parameterized DELETE with bound IDs
- `src/types/aiProvider.ts:58-75` — CustomProviderInputSchema Zod validation
**Findings**: None
**Recommendation**: No action needed.

---

### D2 — Broken Authentication and Session Management

**Status**: NEEDS ATTENTION
**v2.0 Baseline**: API keys stored via XOR obfuscation in localStorage (`secure-storage.ts`). Documented limitation — not cryptographic. BYOK model.
**v2.1/v2.2 Delta**:
- Custom provider API keys flow through `CustomProviderForm.tsx` → `setApiKey(input.apiKey, result.provider.id)` → `secure-storage.ts` XOR obfuscation. Same mechanism as built-in providers — no regression.
- `ai-health.ts` calls `testProviderConnection(providerId)` which internally retrieves the stored API key. The health check result only returns latency/success/errorType — no key material is ever included in the response object (`HealthCheckResult` interface has no key field).
- Telemetry does NOT handle API keys. `track()` in `telemetry.ts` sends only `event`, `properties`, `distinct_id`, `app_version`, `platform`. The `ph_send_batch` IPC command accepts `api_key` (PostHog key, not user AI keys) sent from `VITE_POSTHOG_KEY` env var — never from user input.
- **Attention item**: The `ph_send_batch` Rust command accepts `api_key: String` as a parameter from the frontend. In the current implementation the key comes from the compiled-in `POSTHOG_KEY` constant in `telemetry.ts` (`import.meta.env.VITE_POSTHOG_KEY`). However, the IPC interface itself does not validate that the provided key matches `POSTHOG_API_KEY` in Rust — a malicious script in the webview could invoke `ph_send_batch` with an arbitrary `api_key` string. This is low risk (Tauri CSP blocks external scripts; no third-party JS loaded), but represents a minor API surface concern.
**Evidence**:
- `src/lib/ai-health.ts:17-26` — HealthCheckResult interface (no key fields)
- `src/lib/telemetry.ts:175-196` — track() only sends event metadata
- `src-tauri/src/telemetry.rs:96-99` — ph_send_batch signature accepts api_key from caller
- `src/components/settings/CustomProviderForm.tsx:90-91` — setApiKey called after provider creation
**Findings**: `ph_send_batch` IPC accepts arbitrary api_key from webview without server-side validation against the compiled-in key.
**Recommendation**: Low priority given Tauri CSP prevents external script injection. Document in SECURITY.md. Optional hardening: validate `api_key == POSTHOG_API_KEY` in Rust before forwarding.

---

### D3 — Insecure Data Storage

**Status**: PASS
**v2.0 Baseline**: Backlog data in user-chosen SQLite files. API keys in XOR-obfuscated localStorage.
**v2.1/v2.2 Delta**:
- **Telemetry SQLite queue** (`telemetry.db` in `app_data_dir`): Stores serialized `PhEvent` JSON. Events contain: `event` name (string like "ai_health_check_run"), `properties` (object with `distinct_id`, `app_version`, `platform`, `provider`, `success`, `latency_ms`, `error_message`). No PII, no API keys, no file contents. Error messages are truncated to 200 chars.
- **Consent state**: `ticketflow-telemetry-consent` in localStorage — value is `'granted'` or `'declined'` or absent. No sensitive data.
- **Device ID**: `ticketflow-telemetry-device-id` — random UUID generated via `crypto.randomUUID()`. Not linked to any personal identity.
- **Custom provider config**: Stored in `custom-ai-providers` localStorage key as JSON. Contains provider name, baseURL, model IDs. API keys stored separately via `secure-storage.ts` (XOR obfuscated), not embedded in provider config JSON.
- Queue auto-trims at `MAX_QUEUE_SIZE = 500` events.
**Evidence**:
- `src/lib/telemetry.ts:116-123` — getDeviceId() uses crypto.randomUUID()
- `src/lib/telemetry.ts:209-225` — error tracking captures max 200 chars, no stack traces
- `src-tauri/src/telemetry.rs:9` — MAX_QUEUE_SIZE = 500
- `src/lib/ai-provider-registry.ts:19, 117-119` — custom providers stored separately from keys
**Findings**: None
**Recommendation**: No action needed.

---

### D4 — Insecure Communication

**Status**: PASS
**v2.0 Baseline**: CSP enforced with whitelisted AI domains. HTTPS-only for all external calls.
**v2.1/v2.2 Delta**:
- **CSP additions**: `https://eu.i.posthog.com` and `https://us.i.posthog.com` added to `connect-src`. Both are HTTPS-only.
- **`https:` scheme-source** was added in v2.1 to allow custom OpenAI-compatible providers. This is a known exception documented in SECURITY.md.
- **PostHog endpoint**: `POSTHOG_HOST = 'https://eu.i.posthog.com'` — hardcoded HTTPS. The Rust `api_host` is initialized from the same constant; no runtime-configurable host.
- **reqwest TLS**: `reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }` — uses `rustls-tls` (Rust-native TLS, no OpenSSL dependency). Secure by default.
- **Custom provider URLs**: `CustomProviderInputSchema` enforces HTTPS or localhost: `url.startsWith('https://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')`. HTTP is only allowed for loopback addresses.
- **Telemetry fallback**: Web mode uses `fetch()` which follows the CSP `connect-src` directives; only `https://eu.i.posthog.com` is whitelisted.
**Evidence**:
- `src-tauri/tauri.conf.json:35` — connect-src includes PostHog domains
- `src/types/aiProvider.ts:62-68` — CustomProviderInputSchema URL refine
- `src-tauri/Cargo.toml:32` — rustls-tls feature
- `src/lib/telemetry.ts:28` — POSTHOG_HOST hardcoded HTTPS
**Findings**: None
**Recommendation**: No action needed.

---

### D5 — Insufficient Cryptography

**Status**: PASS
**v2.0 Baseline**: XOR obfuscation for API keys documented as not cryptographic. No cryptographic operations in app.
**v2.1/v2.2 Delta**:
- No new cryptographic operations introduced.
- `crypto.randomUUID()` in `telemetry.ts:119` uses the Web Crypto API for UUID generation — cryptographically random, appropriate for device ID generation.
- Telemetry data is sent as plaintext JSON over HTTPS (TLS handles transport encryption). Event payloads do not contain sensitive data requiring at-rest encryption.
- XOR obfuscation scope has not expanded: custom provider API keys use the same `setApiKey()` path as built-in providers.
- No new hashing, signing, or encryption operations added.
**Evidence**:
- `src/lib/telemetry.ts:119` — crypto.randomUUID() for device ID
- `src/lib/ai-provider-registry.ts:90-91` — setApiKey uses existing secure-storage path
**Findings**: None
**Recommendation**: No action needed.

---

### D6 — Insecure Authorization

**Status**: PASS
**v2.0 Baseline**: Tauri capability model enforces permissions at plugin level. No new IPC commands beyond documented set.
**v2.1/v2.2 Delta**:
- **New IPC command**: `ph_send_batch` (telemetry.rs) — registered in Tauri's command registry. It accepts events and an API key, then POSTs to PostHog. This command is NOT listed as a permission in `capabilities/default.json` because it is a custom command (not a plugin permission). All Tauri custom commands are accessible by the webview by default, which is the standard Tauri model.
- **No new Tauri plugin permissions** added beyond those already in `default.json`. The permission set is unchanged from v2.0.
- **`fs:allow-*`** with `path: "**"` is unchanged from v2.0 (pre-existing documented broad access).
- `ph_send_batch` does not perform any filesystem operations or access sensitive Tauri state beyond the telemetry pool. No privilege escalation possible.
- `startup_flush` is called from `lib.rs` (Rust side), not exposed as a frontend IPC command — appropriate access control.
**Evidence**:
- `src-tauri/capabilities/default.json` — no new permissions added
- `src-tauri/src/telemetry.rs:95-149` — ph_send_batch: only accesses TelemetryState (SQLite pool)
- `src-tauri/src/telemetry.rs:157-166` — startup_flush: Rust-only function
**Findings**: None
**Recommendation**: No action needed.

---

### D7 — Client Code Quality

**Status**: PASS
**v2.0 Baseline**: No dangerouslySetInnerHTML, innerHTML, or eval(). Zod validation on all user inputs.
**v2.1/v2.2 Delta**:
- Grep scan across all v2.1/v2.2 TypeScript files confirms zero instances of `dangerouslySetInnerHTML`, `innerHTML =`, `eval()`, or `Function()`.
- `CustomProviderForm.tsx`: Renders user-provided strings (name, baseURL, model) via React JSX — React's automatic escaping prevents XSS. No raw HTML rendering.
- `ConsentDialog.tsx`: Static text only, no user-controlled content rendered.
- `telemetry.ts`: `error_message` captured from Error.message, truncated to 200 chars. Sent as a string property in a JSON object to PostHog — not rendered back in the UI.
- All v2.1/v2.2 user inputs validated with Zod:
  - `CustomProviderInputSchema` validates name (1-50 chars), baseURL (URL + scheme check), defaultModel (min 1 char)
  - `ProviderConfigSchema` validates all provider fields on load from localStorage
- No new `console.log` statements in v2.1/v2.2 production code (telemetry.ts, ai-provider-registry.ts, ai-health.ts, ConsentDialog.tsx use `console.warn` only for non-critical network errors).
**Evidence**:
- Grep scan result: `dangerouslySetInnerHTML|innerHTML\s*=|eval\(` — no matches in src/
- `src/types/aiProvider.ts:58-75` — CustomProviderInputSchema full validation
- `src/lib/telemetry.ts:148, 155` — console.warn only for network errors (non-leaking)
**Findings**: None
**Recommendation**: No action needed.

---

### D8 — Code Tampering

**Status**: NEEDS ATTENTION
**v2.0 Baseline**: Ed25519 signing via tauri-action. GitHub Actions CI/CD with release workflow.
**v2.1/v2.2 Delta**:
- **CI workflow added** (`.github/workflows/ci.yml`): Runs tests on push/PR to master.
- **Action versions**: `actions/checkout@v4`, `pnpm/action-setup@v2`, `actions/setup-node@v4` — using tag-pinned versions (v4/v2), NOT commit-SHA-pinned. This is a supply chain risk per GitHub Actions security best practices: a compromised tag could execute malicious code.
- The `pnpm/action-setup@v2` and `actions/setup-node@v4` are trusted/official actions, but SHA pinning is still considered best practice for SLSA Level 3+ compliance.
- Signed release process (tauri-action, Ed25519 minisign) remains intact and unchanged.
- `createUpdaterArtifacts: true` (boolean) correctly set — v2.0 fix preserved.
**Evidence**:
- `.github/workflows/ci.yml:14-28` — action versions pinned to tags, not commit SHAs
- `src-tauri/tauri.conf.json:53` — createUpdaterArtifacts: true
**Findings**: CI actions not SHA-pinned (tag pinning only). Minor supply chain risk.
**Recommendation**: Pin CI actions to commit SHAs for SLSA compliance: e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af68 # v4`. Low urgency for a personal OSS project; medium priority if the project grows.

---

### D9 — Reverse Engineering

**Status**: PASS
**v2.0 Baseline**: Source code is open (MIT). No proprietary algorithms. No sensitive data in source.
**v2.1/v2.2 Delta**:
- **PostHog API key exposure**: `VITE_POSTHOG_KEY` is a Vite environment variable embedded at build time. In production Tauri builds, the key IS present in the compiled binary/bundle. This is intentional and documented — PostHog project API keys are designed to be public (they only accept writes, not reads).
- In dev builds without `VITE_POSTHOG_KEY` set, `POSTHOG_KEY` is `undefined` and telemetry is a graceful no-op.
- Rust side uses `option_env!("VITE_POSTHOG_KEY")` — key is `None` in dev builds without the env var. This correctly keeps secrets out of dev/test builds.
- Health check responses expose: latency_ms, errorType ('network'|'auth'|'rate_limit'|'timeout'|'unknown'). No API key material, no endpoint details beyond what user configured.
- Telemetry events expose: event name, app_version, platform, distinct_id (UUID), provider ID (e.g., 'groq'). No internal implementation details.
**Evidence**:
- `src/lib/telemetry.ts:32` — POSTHOG_KEY from import.meta.env (Vite env, public by design)
- `src-tauri/src/telemetry.rs:16` — option_env! for Rust side
- `src/lib/ai-health.ts:17-26` — HealthCheckResult: no sensitive fields
**Findings**: None. PostHog key exposure is by design and not a security issue.
**Recommendation**: No action needed.

---

### D10 — Extraneous Functionality

**Status**: PASS
**v2.0 Baseline**: devtools enabled in dev mode only. No debug endpoints.
**v2.1/v2.2 Delta**:
- **devtools flag**: `tauri.conf.json:24` — `"devtools": true` is set at the window level. In Tauri 2, this flag controls WebView devtools availability. It is NOT scoped to dev-only builds — it is always enabled. This was present at v2.0 baseline and is not a new regression, but merits documentation: in a production app, devtools access allows any user to inspect localStorage (where XOR-obfuscated API keys are stored). Given the app is local-only and open-source, this is acceptable but should be confirmed as a deliberate choice.
- Test utilities (`tauri-mocks.ts`, `test-wrapper.tsx`) are in `src/test-utils/` — they are imported only by test files in `__tests__/` and `vitest.config.ts`. They do NOT appear in production build entry points. Vite tree-shaking ensures they are excluded from the production bundle.
- `ci.yml` runs tests on ubuntu-latest — no cross-platform test coverage (Windows is the primary target). This is a test coverage concern, not a security concern.
- No commented-out code with sensitive logic found in v2.1/v2.2 files.
- No debug-only endpoints or routes added.
**Evidence**:
- `src-tauri/tauri.conf.json:24` — devtools: true (always enabled)
- Test utils files are not imported by production source (src/main.tsx, src/App.tsx, etc.)
**Findings**: `devtools: true` always enabled (not dev-only). Existing behavior, not a new regression.
**Recommendation**: Consider disabling devtools in production builds via build-time flag or Tauri's `#[cfg(dev)]` conditional. Document as accepted risk in SECURITY.md if left enabled.

---

## OWASP Summary Table

| Category | Status | New Attack Surface | Action |
|----------|--------|--------------------|--------|
| D1 Injection | PASS | telemetry.rs SQLite (parameterized) | None |
| D2 Authentication | NEEDS ATTENTION | ph_send_batch accepts arbitrary api_key | Document/optional hardening |
| D3 Data Storage | PASS | telemetry.db (no PII), device UUID | None |
| D4 Communication | PASS | PostHog HTTPS endpoints added to CSP | None |
| D5 Cryptography | PASS | crypto.randomUUID() for device ID | None |
| D6 Authorization | PASS | ph_send_batch IPC (standard model) | None |
| D7 Code Quality | PASS | Zod validation on all v2.1/v2.2 inputs | None |
| D8 Code Tampering | NEEDS ATTENTION | CI actions tag-pinned, not SHA-pinned | SHA-pin actions (low urgency) |
| D9 Reverse Engineering | PASS | PostHog key in bundle (by design) | None |
| D10 Extraneous | PASS | devtools always enabled (pre-existing) | Document or conditionally disable |

---

## Dependency Audit

### npm Vulnerabilities

Results from `pnpm audit` (2026-02-18):

| Package | Severity | Advisory | Fix Available | Status |
|---------|----------|----------|---------------|--------|
| esbuild 0.21.5 | Moderate | GHSA-67mh-4wv8-2f99 | >=0.25.0 | Known exception (dev-only, documented in SECURITY.md) |
| ajv <8.18.0 | Moderate | GHSA-2g4f-4pwh-qvx6 | >=8.18.0 | NEW — via `eslint > ajv`. Dev-only dependency. |

**Total npm vulnerabilities**: 2 (0 critical, 0 high, 2 moderate)

**Analysis of new finding (ajv ReDoS)**:
- `ajv` is a transitive dependency of `eslint` (devDependency).
- The vulnerability is a ReDoS (Regular Expression Denial of Service) when using the `$data` option.
- TicketFlow does not use eslint in production code execution — it is a build-time/development linting tool only.
- The `$data` option is an advanced ajv feature not used by the eslint internal schema validation.
- **Risk**: None for production users. Moderate for CI environments if build system is attacked, but build system is GitHub Actions with repo-level access controls.
- **Resolution**: Will auto-resolve when eslint upgrades its ajv dependency to >=8.18.0. No immediate action required.

### npm Outdated

Results from `pnpm outdated` (2026-02-18):

| Package | Current | Latest | Update Type | Classification |
|---------|---------|--------|-------------|----------------|
| @tanstack/react-virtual | 3.13.16 | 3.13.18 | Patch | Safe |
| @tauri-apps/plugin-fs | 2.4.4 | 2.4.5 | Patch | Safe |
| @tauri-apps/plugin-shell | 2.3.3 | 2.3.5 | Patch | Safe |
| @testing-library/react (dev) | 16.3.1 | 16.3.2 | Patch | Safe |
| @types/react (dev) | 19.2.7 | 19.2.14 | Patch | Safe |
| @vitejs/plugin-react (dev) | 5.1.2 | 5.1.4 | Patch | Safe |
| react | 19.2.3 | 19.2.4 | Patch | Safe |
| react-dom | 19.2.3 | 19.2.4 | Patch | Safe |
| vite (dev) | 7.3.0 | 7.3.1 | Patch | Safe |
| zod | 4.3.4 | 4.3.6 | Patch | Safe |
| @playwright/test (dev) | 1.57.0 | 1.58.2 | Minor | Review |
| @tauri-apps/api (dev) | 2.9.1 | 2.10.1 | Minor | Review |
| @tauri-apps/cli (dev) | 2.9.6 | 2.10.0 | Minor | Review |
| @tauri-apps/plugin-dialog | 2.4.2 | 2.6.0 | Minor | Review |
| @tauri-apps/plugin-updater | 2.9.0 | 2.10.0 | Minor | Review |
| motion | 12.33.0 | 12.34.2 | Minor | Review |
| openai | 6.15.0 | 6.22.0 | Minor | Review |
| typescript-eslint (dev) | 8.51.0 | 8.56.0 | Minor | Review |
| @eslint/js (dev) | 9.39.2 | 10.0.1 | **Major** | Breaking — review required |
| @types/node (dev) | 24.10.4 | 25.2.3 | **Major** | Breaking — review required |
| eslint (dev) | 9.39.2 | 10.0.0 | **Major** | Breaking — review required |
| globals (dev) | 16.5.0 | 17.3.0 | **Major** | Breaking — review required |
| jsdom (dev) | 25.0.1 | 28.1.0 | **Major** | Breaking — review required |
| react-dropzone | 14.3.5 | 15.0.0 | **Major** | Breaking — review required |
| eslint-plugin-react-refresh (dev) | 0.4.26 | 0.5.0 | Minor | Review |

**Summary**:
- 10 packages with patch updates available (all safe to apply in maintenance window)
- 9 packages with minor updates (review recommended, unlikely breaking)
- 5 packages with major updates (eslint v10, jsdom v28, react-dropzone v15, @types/node v25, globals v17) — breaking changes likely, deferred to next maintenance sprint

### Cargo Vulnerabilities

Results from `cargo-audit 0.22.1` (922 advisories loaded, 635 crate dependencies scanned):

**Vulnerabilities (4 found)**:

| Crate | Version | ID | Title | Severity | Fix |
|-------|---------|-----|-------|----------|-----|
| bytes | 1.11.0 | RUSTSEC-2026-0007 | Integer overflow in `BytesMut::reserve` | High | Upgrade to >=1.11.1 |
| rkyv | 0.7.45 | RUSTSEC-2026-0001 | Potential UB in `Arc<T>`/`Rc<T>` impls on OOM | High | No fix available (unmaintained) |
| rsa | 0.9.10 | RUSTSEC-2023-0071 | Marvin Attack: timing sidechannel key recovery | High | No patch for 0.9.x |
| time | 0.3.44 | RUSTSEC-2026-0009 | Denial of Service via Stack Exhaustion | Moderate | Upgrade to >=0.3.41 |

**Analysis**:

**bytes 1.11.0 (RUSTSEC-2026-0007)**: Integer overflow in `BytesMut::reserve`. Transitive via `reqwest → tower-http`. TicketFlow uses reqwest for telemetry batch sending to PostHog. The overflow triggers on very large reserve operations — unlikely to be reachable via PostHog API calls which have bounded payload sizes. Risk: Low in practice. Resolution: will resolve when tauri/reqwest updates bytes dependency to >=1.11.1.

**rkyv 0.7.45 (RUSTSEC-2026-0001)**: Potential undefined behavior in Arc/Rc implementations under OOM. Transitive via `rust_decimal → rkyv`. TicketFlow does not directly use rkyv or rust_decimal in application code — this comes through `tauri-plugin-log`. UB only triggers on out-of-memory, which is not a typical attack vector for a local desktop app. Risk: Low. No fix available — tracked as unmaintained advisory.

**rsa 0.9.10 (RUSTSEC-2023-0071)**: Marvin Attack timing sidechannel. Transitive via Tauri's TLS stack. TicketFlow does not perform RSA operations directly — this would be in the TLS handshake for reqwest connections. The Marvin Attack requires the attacker to measure precise timing of many RSA decryption operations — not feasible for a desktop app where the "attacker" is local. Risk: Very low (desktop threat model). Resolution: Tauri team must upgrade TLS deps.

**time 0.3.44 (RUSTSEC-2026-0009)**: Stack exhaustion DoS via `time` crate. Transitive dependency. TicketFlow does not directly call time parsing functions. This is triggered by parsing malformed time strings, which would require crafted input to reach. Risk: Low for desktop app. Resolution: will resolve when upstream deps update.

**Warnings (18 found — unmaintained crates)**:

All 18 warnings are Linux-specific GUI toolkit crates (gtk3, atk, gdk, webkit2gtk, gdkx11, gdkwayland) plus `proc-macro-error`, `fxhash`, and `unic-*` Unicode crates. These are transitive dependencies of `wry/tao/tauri-runtime-wry` for Linux support. TicketFlow's primary target is Windows — these crates are not used at runtime on Windows. The `glib` unsound warning (RUSTSEC-2024-0429) affects `VariantStrIter` — not used in application code.

| Category | Count | Risk to TicketFlow |
|----------|-------|---------------------|
| gtk3 bindings unmaintained | 9 | Linux-only, not used on Windows |
| Unicode crates unmaintained | 5 | Transitive, no direct use |
| proc-macro-error unmaintained | 1 | Build-time only |
| fxhash unmaintained | 1 | Transitive |
| glib unsound | 1 | Linux-only |

### Cargo Outdated

`cargo-outdated` not installed. Manual check of direct Cargo.toml dependencies against crates.io (2026-02-18):

| Crate | Cargo.toml | Resolved | Latest Stable | Status |
|-------|-----------|---------|----------------|--------|
| tauri | 2.9.5 | 2.9.5 | 2.10.x | Minor update available |
| reqwest | 0.12 | 0.12.28 | 0.12.x | Current minor |
| sqlx | 0.8 | 0.8.6 | 0.8.x | Current minor |
| serde | 1.0 | 1.0.x | 1.0.x | Current |
| serde_json | 1.0 | 1.0.x | 1.0.x | Current |
| tauri-build | 2.5.3 | 2.5.3 | 2.5.x | Current minor |

Key Tauri plugins (from Cargo.lock resolution):
- `tauri-plugin-updater 2.9.0` — minor update to 2.10.0 available (matches @tauri-apps/plugin-updater npm update)
- `tauri-plugin-dialog 2.4.2` — minor update to 2.6.0 available
- `tauri-plugin-fs 2.4.4` — patch update to 2.4.5 available

Tauri ecosystem updates should be coordinated (Rust + npm side together) to avoid version mismatches.

### License Compliance

Results from `npx license-checker --production --summary` (2026-02-18):

| License | Count | MIT-Compatible | Packages |
|---------|-------|----------------|---------|
| MIT | 19 | Yes | react, react-dom, zod, dagre, jsondiffpatch, minisearch, motion, @dnd-kit/*, @xyflow/react, @tanstack/react-virtual, react-markdown, react-dropzone, unified, remark-*, @tauri-apps/plugin-* (5 pkgs) |
| MIT OR Apache-2.0 | 7 | Yes | @tauri-apps/plugin-dialog, plugin-fs, plugin-global-shortcut, plugin-process, plugin-shell, plugin-sql, plugin-updater |
| Apache-2.0 | 3 | Yes | @google/generative-ai, groq-sdk, openai |

**Total**: 29 production packages
**License issues**: None — all MIT-compatible

Apache-2.0 is compatible with MIT for use in applications (TicketFlow itself is MIT). No GPL, AGPL, or LGPL dependencies found.

**Rust direct dependencies (Cargo.toml)**:
- serde, serde_json: MIT OR Apache-2.0
- log: MIT OR Apache-2.0
- tauri and all tauri-plugin-*: MIT OR Apache-2.0
- reqwest: MIT OR Apache-2.0
- sqlx: MIT OR Apache-2.0

All Rust dependencies are MIT and/or Apache-2.0 licensed. No copyleft (GPL/LGPL) dependencies.

### Dependency Audit Summary

- **Total npm vulnerabilities**: 2 (0 critical, 0 high, 2 moderate — both dev-only)
- **Total Cargo vulnerabilities**: 4 (3 high, 1 moderate — all transitive, low practical risk on desktop)
- **Cargo warnings**: 18 (unmaintained/unsound — all Linux-only or build-time)
- **Outdated npm packages**: 25 total (10 patch, 10 minor, 5 major)
- **Outdated Cargo packages**: ~3 minor updates available (Tauri ecosystem)
- **License issues**: None — 100% MIT-compatible across npm and Cargo

---

## Remediation Priority

| Priority | Item | Effort |
|----------|------|--------|
| P3 (Low) | Document ph_send_batch api_key surface in SECURITY.md | 15 min |
| P3 (Low) | SHA-pin CI actions in ci.yml | 30 min |
| P3 (Low) | Evaluate devtools: true for production releases | 30 min |
| P4 (Deferred) | Apply 10 npm patch updates | 1 hr (maintenance sprint) |
| P4 (Deferred) | Apply 10 npm minor updates | 2 hrs (review + test) |
| P4 (Deferred) | Evaluate npm major updates (eslint v10, react-dropzone v15) | 4+ hrs |
| P4 (Deferred) | Cargo: monitor bytes/time vulnerability fixes in Tauri ecosystem | Automatic |
| P5 (Won't fix) | Cargo rkyv/rsa advisories — transitive, no fix available | N/A |

---

*Report generated: 2026-02-18*
*Tools: cargo-audit 0.22.1 (922 advisories), pnpm audit, npx license-checker*
*Scope: v2.1 (provider registry) and v2.2 (telemetry, consent, CI)*
