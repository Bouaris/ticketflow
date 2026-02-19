# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.2.x   | :white_check_mark: |
| 2.1.x   | :white_check_mark: |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in TicketFlow, please report it responsibly:

- **Method:** Use [GitHub Security Advisories](https://github.com/Bouaris/ticketflow/security/advisories/new)
- **Do NOT open a public issue** for security vulnerabilities
- **Expected response time:** 48 hours for acknowledgment, 7 days for assessment

## Security Model

TicketFlow is a **local-first desktop application**. All data stays on your machine. There is no server and no cloud sync. Anonymous telemetry is available but disabled by default and requires explicit user consent (see [Privacy Policy](PRIVACY.md)).

### What TicketFlow accesses

| Resource | Purpose | Scope |
|----------|---------|-------|
| Local filesystem | Read/write project SQLite databases | User-selected directories only (via file picker) |
| AI provider APIs | Generate backlog items, chat assistance | Groq, Gemini, or OpenAI (user's choice) |
| GitHub releases | Check for app updates | github.com/Bouaris/ticketflow only |
| PostHog (opt-in) | Anonymous usage analytics | eu.i.posthog.com (only if user consents) |

### Content Security Policy (CSP)

The production build enforces a strict CSP:

- **No `unsafe-eval`** — prevents code injection
- **Whitelisted network access** — Groq, Gemini, OpenAI API endpoints, and PostHog (opt-in telemetry)
- **`https:` scheme-source** — allows custom OpenAI-compatible providers (Ollama, LM Studio, etc.) added in v2.1
- **Known exception:** `unsafe-inline` in `style-src` is required by Tailwind CSS for dynamic styling. No user-controlled CSS injection vectors exist.

**Full production CSP:**
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src ipc: http://ipc.localhost https://api.groq.com https://generativelanguage.googleapis.com https://api.openai.com https://eu.i.posthog.com https://us.i.posthog.com https:;
object-src 'none';
base-uri 'self'
```

## API Key Storage

### How it works

TicketFlow uses a **Bring Your Own Key (BYOK)** model. You provide your own API keys for AI providers (Groq, Gemini, or OpenAI).

**Storage location:**
- **Desktop app (Tauri):** Keys are stored in the application's `localStorage` (isolated WebView context)
- **Web mode:** Keys are stored in `sessionStorage` (cleared when tab closes)

**Obfuscation:**
Keys are obfuscated using XOR encoding + base64 before storage. This prevents casual inspection via browser DevTools.

**Implementation:** See `src/lib/secure-storage.ts` for the complete implementation. The code explicitly states: "This is defense-in-depth, not cryptographic security."

### Security limitations (transparency)

**XOR obfuscation is NOT cryptographic encryption.** It is a defense-in-depth measure that:
- Prevents plaintext keys from appearing in DevTools Storage tab
- Adds a layer of obscurity against casual observation
- Does NOT protect against a determined attacker with local disk access

**Why not use OS keychain?**
- Tauri v2 does not provide a maintained secure storage plugin (Stronghold was deprecated and removed in Tauri v3)
- There is no cross-platform keychain API available for Tauri WebView context
- The Tauri team is aware of this gap (see [tauri-apps/tauri#7846](https://github.com/tauri-apps/tauri/discussions/7846))

**Why is this acceptable?**
- TicketFlow is a desktop app running in a sandboxed Tauri process
- API keys are user-owned and user-managed (not shared secrets)
- An attacker with local disk access already has access to all your files
- The threat model is equivalent to any desktop app storing user preferences
- This approach is standard practice for desktop BYOK applications

### Recommended practices

- Use **project-specific API keys** with limited quotas when possible
- **Rotate keys** periodically or if you suspect compromise
- **Never commit** API keys to version control
- Set **spending limits** on your AI provider accounts

## File System Permissions

TicketFlow requests broad file system access (`path: "**"`) because:
- Users select project directories via native file picker — projects can be anywhere on disk
- Restricting to specific paths would prevent users from choosing their own project locations

**Real-world examples:**
- `C:\Users\Alice\Documents\Projects\my-project\`
- `D:\Work\ClientA\backlog-2024\`
- `E:\External\Drive\Projects\side-hustle\`
- `\\NetworkShare\Team\ProductBacklog\`

**Mitigations:**
- All file access requires explicit user interaction (file picker dialog)
- No background file scanning or indexing
- Network exfiltration prevented by CSP (no unauthorized outbound connections)
- OS-level file permissions still apply
- Tauri sandbox provides process isolation

## Dependency Security

- Dependencies are audited with `pnpm audit` before each release
- Zero high/critical vulnerabilities policy
- Known exceptions are documented with risk assessment

**Current exceptions:**

**npm:**
- **esbuild 0.21.5 CORS vulnerability (GHSA-67mh-4wv8-2f99)** — Moderate severity, dev-only dependency. TicketFlow does not use esbuild's `serve` feature. Vite has its own dev server. No impact on production users or normal development. Will auto-resolve when vitest/vite updates to esbuild 0.25.0+.

**Cargo (Rust — all transitive via Tauri, no direct fix available):**
- **bytes** (affected: <1.11.1) — Denial-of-service via out-of-bounds read in `Bytes::copy_from_slice`. Transitive dependency via Tauri's HTTP stack. Status: **resolved** via `cargo update` (2026-02-19) — updated to >=1.11.1.
- **time** (affected: <0.3.41) — Potential panic via integer overflow in date arithmetic. Transitive via Tauri's `time`-dependent crates. Status: **resolved** via `cargo update` (2026-02-19) — updated to >=0.3.47.
- **rkyv 0.7.x** — Unsound memory handling in deserialization; crate is unmaintained at 0.7.x. Transitive via Tauri serialization internals. Status: no 0.7.x patch exists. Tauri team is tracking migration to rkyv 0.8.x. No action available until upstream Tauri migrates.
- **rsa 0.9.x** — Potential timing side-channel in RSA decryption. Transitive via Tauri's TLS stack (rustls). Status: no 0.9.x patch released; fix is in a future breaking version. No action available until upstream resolves.

All four Cargo vulnerabilities are transitive — TicketFlow does not directly import these crates. They will resolve when Tauri releases updated versions. Tracked in AUDIT-REPORT.md (DEP-001).

## Signed Releases

All release binaries are signed with a minisign key pair. The Tauri updater verifies signatures before applying updates.

**Public key:**
```
untrusted comment: minisign public key: 5CED179762C1B128
RWQoscFilxftXNhV9NpjOOL0SuxZr69lFv+f579+tdopDK+xhh+r4gcw
```

**Note:** The signing key was rotated at v2.0.0. Users on v1.x must manually reinstall to receive updates.

## Security Audits

**Most recent audit:** 2026-02-18 (Phase 31 — v2.2 code audit & security review)

**Phase 31 results:**
- ✅ Zero P1 (Critical) findings — no exploitable security vulnerabilities or data loss risks
- ✅ OWASP Desktop Top 10 reviewed: 8/10 categories PASS; 2 NEEDS ATTENTION (IPC api_key surface and CI tag-pinning — both documented as accepted risks)
- ✅ No secrets found in source code
- 7 P2 (High) findings documented in AUDIT-REPORT.md — addressed in Phases 33–36
- 4 Cargo crate vulnerabilities tracked (all transitive via Tauri; documented above)

**Phase 36 hardening (2026-02-19):**
- SHA-pinned all GitHub Actions in `.github/workflows/ci.yml` (eliminates CI supply chain tag-mutation risk)
- Formal accepted risk documentation for IPC api_key pass-through (SEC-D2) and devtools always enabled (SEC-D10)

**Audit artifacts available in:** `.planning/phases/18-security-audit-code-polish/audit-results/` (Phase 18) and `AUDIT-REPORT.md` (Phase 31)

---

**Previous audit:** 2026-02-14 (Phase 18 — pre-public-release audit)

**Phase 18 results:**
- ✅ Zero secrets found in source code (gitleaks scan)
- ✅ Zero high/critical dependency vulnerabilities (pnpm audit)
- ✅ Production CSP enforced (no unsafe-eval, whitelisted AI domains only)
- ✅ All Tauri permissions documented and justified
- ✅ OWASP Desktop Top 10 compliance verified

## Secure Development Practices

- No use of `eval()`, `dangerouslySetInnerHTML`, or `.innerHTML`
- All SQL queries use parameterized statements (`$1`, `$2` placeholders)
- No shell command execution (except `shell:allow-open` for URLs only)
- All HTTPS communication (no insecure fallbacks)
- React automatic prop sanitization
- TypeScript strict mode enabled

## Accepted Risks

The following findings were reviewed in the Phase 31 audit and formally accepted as low-risk given TicketFlow's threat model (local-first desktop BYOK application).

### SEC-D2 — IPC api_key Pass-Through in ph_send_batch

**Finding:** The `ph_send_batch` Rust IPC command accepts `api_key: String` from the frontend WebView without validating it against the compile-time `POSTHOG_API_KEY` constant baked into the binary.

**Risk:** A malicious script executing inside the WebView could invoke `ph_send_batch` with an arbitrary PostHog project key, redirecting telemetry events to an attacker-controlled PostHog project.

**Mitigations:**
- Tauri's Content Security Policy (`script-src 'self'`) prevents external script injection into the WebView
- Telemetry is opt-in and disabled by default; the IPC command is only reachable after explicit user consent
- The PostHog `api_key` is write-only — it is a project identifier, not a credential granting data read access
- The WebView is a trusted execution context in Tauri's security model (same-origin enforcement)

**Accepted because:** Exploiting this requires first bypassing Tauri CSP to inject arbitrary JavaScript into the WebView — which is already a complete application compromise. Validating the runtime `api_key` against the compiled-in constant would add code complexity without meaningfully reducing the attack surface, since an attacker who can run code in the WebView can already exfiltrate data through other channels.

**Reference:** AUDIT-REPORT.md SEC-D2 (Phase 31, 2026-02-18)

---

### SEC-D10 — DevTools Always Enabled in Production Builds

**Finding:** `"devtools": true` in `src-tauri/tauri.conf.json` enables the browser DevTools panel in all build modes, including production `.exe` releases.

**Risk:** Users (or anyone with physical access to the machine) can open DevTools and inspect `localStorage`, where XOR-obfuscated API keys are stored.

**Mitigations:**
- The BYOK model means users own their API keys and already possess them; inspecting localStorage reveals data the user already has
- XOR + base64 obfuscation prevents plaintext keys from appearing in DevTools Storage tab without additional tooling
- TicketFlow runs on the user's own machine where they already have full disk access, administrative rights, and can read the SQLite database directly
- Disabling DevTools would hinder legitimate debugging for advanced users and does not prevent OS-level inspection

**Accepted because:** TicketFlow is a local-first desktop application where the user is the sole operator of their own machine. The threat model does not include adversarial access to an already-running, logged-in session — an attacker with physical access to an unlocked machine already has complete access to all data. Disabling DevTools provides no meaningful security benefit against this threat model, while removing a useful diagnostic tool for power users.

**Reference:** AUDIT-REPORT.md SEC-D10 (Phase 31, 2026-02-18)

---

**Version:** 2.2.1
**Last updated:** 2026-02-19
**Contact:** See [GitHub Security Advisories](https://github.com/Bouaris/ticketflow/security/advisories)
