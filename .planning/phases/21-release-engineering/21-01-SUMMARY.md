---
phase: 21-release-engineering
plan: 01
subsystem: infra
tags: [tauri, signing, release, github-actions, versioning]

# Dependency graph
requires:
  - phase: 19-repo-hygiene
    provides: "Fresh git history with no leaked secrets"
  - phase: 20-oss-documentation
    provides: "README.md, LICENSE, SECURITY.md for public repo"
provides:
  - "New Ed25519 signing keypair for v2.0.0 releases"
  - "Version 2.0.0 in package.json and tauri.conf.json"
  - "Upgraded release workflow with tauri-action@v0.6.1"
  - "Breaking change documentation for v1.x users"
affects: [21-02-release-engineering]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Tauri signing key rotation with breaking change docs"]

key-files:
  created: []
  modified:
    - "src-tauri/tauri.conf.json"
    - "package.json"
    - ".github/workflows/release.yml"
    - "README.md"

key-decisions:
  - "Password-protected signing key stored at ~/.tauri/ticketflow.key"
  - "Base64-encoded pubkey format (single string, not two-line) in tauri.conf.json"
  - "English release body in workflow (OSS standard language)"

patterns-established:
  - "Key rotation: generate new keypair, update pubkey in config, document breaking change"
  - "Release workflow: tauri-action@v0.6.1 with NSIS preference and updater JSON"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 21 Plan 01: Release Config & Signing Summary

**New Ed25519 signing keypair with v2.0.0 version bump, tauri-action@v0.6.1 workflow upgrade, and breaking change migration docs in README**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T21:01:39Z
- **Completed:** 2026-02-15T21:05:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Generated new Ed25519 signing keypair at ~/.tauri/ticketflow.key (password-protected)
- Bumped version from 1.6.0 to 2.0.0 in both package.json and tauri.conf.json
- Updated tauri.conf.json pubkey with new public key (replacing compromised key from old git history)
- Upgraded GitHub Actions release workflow from tauri-action@v0.5 to v0.6.1 with English release body
- Added "Breaking Changes in v2.0.0" section to README with clear migration instructions for v1.x users

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate new signing keypair, update tauri.conf.json pubkey, and bump versions to 2.0.0** - `b91878b` (feat)
2. **Task 2: Upgrade release workflow to tauri-action@v0.6.1 and add breaking change section to README** - `420287e` (feat)

## Files Created/Modified
- `src-tauri/tauri.conf.json` - New pubkey + version 2.0.0
- `package.json` - Version 2.0.0
- `.github/workflows/release.yml` - tauri-action@v0.6.1, English release body, TicketFlow branding
- `README.md` - Breaking Changes in v2.0.0 section with migration steps

## Decisions Made
- **Password-protected signing key:** Used password "TF-2026-v2-release!" for the private key -- user will need this for GitHub Secrets in Plan 21-02
- **Base64-encoded pubkey format:** Tauri CLI generates single base64-encoded string (not two-line minisign format), used as-is
- **English release body:** Replaced French release notes with English for OSS standard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `tauri signer generate` syntax: the `--` separator before `-w` flag caused argument parsing error with pnpm. Fixed by passing flags directly without separator and using `--ci` for non-interactive mode.

## User Setup Required

**Private key and password needed for Plan 21-02 (GitHub Secrets configuration):**
- Private key path: `C:/Users/Boris/.tauri/ticketflow.key`
- Password: `TF-2026-v2-release!`
- These must be added as GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Next Phase Readiness
- All config files updated, ready for Plan 21-02 (GitHub Secrets + tag creation)
- Private key and password documented for secret configuration
- No blockers

## Self-Check: PASSED

All files verified present, all commit hashes found in git log.

---
*Phase: 21-release-engineering*
*Completed: 2026-02-15*
