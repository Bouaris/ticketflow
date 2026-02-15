# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in TicketFlow, please report it responsibly:

- **Method:** Use [GitHub Security Advisories](https://github.com/Bouaris/ticketflow/security/advisories/new)
- **Do NOT open a public issue** for security vulnerabilities
- **Expected response time:** 48 hours for acknowledgment, 7 days for assessment

## Security Model

TicketFlow is a **local-first desktop application**. All data stays on your machine. There is no server, no cloud sync, and no telemetry sent externally.

### What TicketFlow accesses

| Resource | Purpose | Scope |
|----------|---------|-------|
| Local filesystem | Read/write project SQLite databases | User-selected directories only (via file picker) |
| AI provider APIs | Generate backlog items, chat assistance | Groq, Gemini, or OpenAI (user's choice) |
| GitHub releases | Check for app updates | github.com/Bouaris/ticketflow only |

### Content Security Policy (CSP)

The production build enforces a strict CSP:

- **No `unsafe-eval`** — prevents code injection
- **Whitelisted network access** — only Groq, Gemini, and OpenAI API endpoints
- **No wildcard domains** — each allowed domain is explicitly listed (`api.groq.com`, `generativelanguage.googleapis.com`, `api.openai.com`)
- **Known exception:** `unsafe-inline` in `style-src` is required by Tailwind CSS for dynamic styling. No user-controlled CSS injection vectors exist.

**Full production CSP:**
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src ipc: http://ipc.localhost https://api.groq.com https://generativelanguage.googleapis.com https://api.openai.com;
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
- **esbuild 0.21.5 CORS vulnerability (GHSA-67mh-4wv8-2f99)** — Moderate severity, dev-only dependency. TicketFlow does not use esbuild's `serve` feature. Vite has its own dev server. No impact on production users or normal development. Will auto-resolve when vitest/vite updates to esbuild 0.25.0+.

## Signed Releases

All release binaries are signed with a minisign key pair. The Tauri updater verifies signatures before applying updates.

**Public key:**
```
untrusted comment: minisign public key: 5CED179762C1B128
RWQoscFilxftXNhV9NpjOOL0SuxZr69lFv+f579+tdopDK+xhh+r4gcw
```

**Note:** The signing key will be rotated in the next release (after v1.6.0). Users will need to manually reinstall the application to receive future updates. This is a one-time security improvement.

## Security Audits

**Last audit:** 2026-02-14 (Phase 18 — pre-public-release audit)

**Results:**
- ✅ Zero secrets found in source code (gitleaks scan)
- ✅ Zero high/critical dependency vulnerabilities (pnpm audit)
- ✅ Production CSP enforced (no unsafe-eval, whitelisted AI domains only)
- ✅ All Tauri permissions documented and justified
- ✅ OWASP Desktop Top 10 compliance verified

**Audit artifacts available in:** `.planning/phases/18-security-audit-code-polish/audit-results/`

## Secure Development Practices

- No use of `eval()`, `dangerouslySetInnerHTML`, or `.innerHTML`
- All SQL queries use parameterized statements (`$1`, `$2` placeholders)
- No shell command execution (except `shell:allow-open` for URLs only)
- All HTTPS communication (no insecure fallbacks)
- React automatic prop sanitization
- TypeScript strict mode enabled

---

**Version:** 2.0
**Last updated:** 2026-02-15
**Contact:** See [GitHub Security Advisories](https://github.com/Bouaris/ticketflow/security/advisories)
