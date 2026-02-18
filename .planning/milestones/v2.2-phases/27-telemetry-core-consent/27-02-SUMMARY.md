---
phase: 27-telemetry-core-consent
plan: "02"
subsystem: telemetry
tags: [posthog, consent, gdpr, modal, settings, privacy, react]

# Dependency graph
requires:
  - phase: 27-telemetry-core-consent
    plan: "01"
    provides: telemetry.ts consent gate (track, getConsentState, setConsentState, shouldPromptConsent, incrementDismissCount, initTelemetry)
provides:
  - ConsentDialog component (src/components/consent/ConsentDialog.tsx): first-launch GDPR consent modal with equal-weight Accept/Decline buttons, hardcoded English, PRIVACY.md link
  - App.tsx consent wiring: startup consent check, initTelemetry on prior grant, showConsent state, accept/decline/dismiss handlers, project_created event
  - AppSettingsModal.tsx Privacy section: telemetry toggle with inline confirmation, dark_mode_toggled event, consent_revoked event
affects: [27-03, app-startup, settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConsentDialog uses existing Modal component with closeOnBackdrop=false for required explicit choice"
    - "Equal-weight button pattern: both Accept and Decline use identical class strings (no primary highlight)"
    - "Privacy toggle syncs from localStorage on modal open (useEffect on isOpen) to stay in sync with consent dialog"
    - "consent_revoked fires BEFORE setConsentState('declined') — ensures last event is captured before gate closes"

key-files:
  created:
    - src/components/consent/ConsentDialog.tsx
  modified:
    - src/App.tsx
    - src/components/settings/AppSettingsModal.tsx

key-decisions:
  - "ConsentDialog uses Modal component (not banner) — consistent with app's existing modal pattern, closeOnBackdrop=false prevents accidental dismissal"
  - "Privacy section placed after Changelog, before Export — cross-cutting concern ordering"
  - "All Privacy/consent strings hardcoded English — per locked decision from plan frontmatter"
  - "consent_revoked fires before setConsentState to capture the last event before the gate closes"

patterns-established:
  - "Consent check pattern in App.tsx useEffect: granted → initTelemetry + track; null + shouldPromptConsent → show dialog; else → no-op"
  - "Settings toggle sync pattern: useEffect on isOpen refreshes state from localStorage (handles cross-modal state changes)"

requirements-completed: [TELE-01, TELE-02]

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 27 Plan 02: Consent Dialog & Settings Privacy Toggle Summary

**GDPR consent dialog with equal-weight Accept/Decline buttons wired into App.tsx startup, plus Privacy section in AppSettingsModal with telemetry toggle, dark_mode_toggled and project_created instrumentation**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-17T22:30:00Z
- **Completed:** 2026-02-17T22:38:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `src/components/consent/ConsentDialog.tsx`: centered modal using existing Modal component, `closeOnBackdrop={false}` for required explicit choice, equal-weight Accept/Decline buttons (identical class strings — SC1), hardcoded English content listing what is/never collected, external browser link to PRIVACY.md via `openExternalUrl` (Tauri) or `window.open` (web)
- Wired ConsentDialog in `src/App.tsx`: imports all consent/telemetry functions, adds `showConsent` state, startup useEffect checks consent (`initTelemetry + track('app_launched')` if granted, `setShowConsent(true)` if null + `shouldPromptConsent()`), three handlers (accept/decline/dismiss with proper localStorage calls), `track('project_created')` in `handleProjectSelect` when types are provided, ConsentDialog rendered before UpdateModal
- Added Privacy section to `src/components/settings/AppSettingsModal.tsx`: toggle switch synced with localStorage, `handleTelemetryToggle` fires `consent_revoked` before declining and `consent_granted` on re-enable, shows "Telemetry disabled. No data will be sent." for 4 seconds, `dark_mode_toggled` event fires with `{ theme }` metadata when user changes theme
- All 455 tests pass — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ConsentDialog and wire consent flow into App.tsx** - `29032c7` (feat)
2. **Task 2: Add Privacy section with telemetry toggle to AppSettingsModal** - `6cb5947` (feat)

**Plan metadata:** (docs commit — next)

## Files Created/Modified

- `src/components/consent/ConsentDialog.tsx` — First-launch GDPR consent modal. Equal-weight Accept/Decline buttons (identical class strings), hardcoded English strings (never via i18n), `closeOnBackdrop={false}`, PRIVACY.md link opens in external browser via Tauri shell or `window.open`
- `src/App.tsx` — Added ConsentDialog import + telemetry imports, `showConsent` state, startup telemetry useEffect, three consent handlers (accept/decline/dismiss), `track('project_created')` in handleProjectSelect, ConsentDialog rendered before UpdateModal
- `src/components/settings/AppSettingsModal.tsx` — Added telemetry imports, `telemetryEnabled` and `telemetryMessage` state, `handleTelemetryToggle` handler, sync useEffect on `isOpen`, Privacy section with toggle switch and inline confirmation message, `track('dark_mode_toggled', { theme })` on theme change

## Decisions Made

- **ConsentDialog uses Modal (not banner)**: consistent with app's existing modal pattern; plan specified size="md" centered modal. The `closeOnBackdrop={false}` prevents accidental dismissal while `closeOnEscape={true}` maps Escape to the dismiss handler (re-prompt once, then permanent decline).
- **Privacy section placement**: after Changelog, before Export — privacy is a cross-cutting concern, not data-specific. Consistent `pt-4 border-t border-outline` divider with other sections.
- **consent_revoked fires before setConsentState('declined')**: ensures the revocation event is captured by the consent gate before it closes. This is the last event that can fire when declining.
- **Strings hardcoded English**: per locked decision in plan frontmatter — consent/privacy text is always English regardless of app language setting.

## Deviations from Plan

None — plan executed exactly as written. All locked decisions honored, all instrumentation points wired as specified.

## Issues Encountered

None — `pnpm build` and full test suite (455 tests) passed first attempt for both tasks.

## User Setup Required

None — no external service configuration required for this plan's code changes.

## Next Phase Readiness

- TELE-01 (first-launch consent) and TELE-02 (revocation toggle) are both fully implemented
- 27-03 can now add instrumentation for all remaining events (TELE-04, TELE-05, TELE-06, TELE-08) knowing the consent gate is in place
- `track('dark_mode_toggled')` and `track('project_created')` are already wired from this plan (TELE-06 and TELE-05 partial) — 27-03 should not duplicate these

---
*Phase: 27-telemetry-core-consent*
*Completed: 2026-02-17*

## Self-Check: PASSED

- `src/components/consent/ConsentDialog.tsx` — EXISTS (created, 110 lines)
- `src/App.tsx` — EXISTS (modified, imports + state + handlers + ConsentDialog render)
- `src/components/settings/AppSettingsModal.tsx` — EXISTS (modified, Privacy section + dark_mode_toggled)
- `.planning/phases/27-telemetry-core-consent/27-02-SUMMARY.md` — EXISTS
- Commit `29032c7` — EXISTS (Task 1: ConsentDialog + App.tsx)
- Commit `6cb5947` — EXISTS (Task 2: AppSettingsModal Privacy section)
- All 455 tests pass (verified via pnpm test)
- `pnpm build` passes (verified twice, chunk size warning expected)
