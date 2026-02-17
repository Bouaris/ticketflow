# Phase 27: Telemetry Core & Consent - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Full PostHog integration with GDPR-compliant opt-in consent. Users are prompted on first launch before any network call, can accept or decline with equal-weight buttons, and can revoke at any time from App Settings. The app captures ~15 core+secondary usage events with context metadata, plus anonymous error tracking. Rust IPC relay (ph_send_batch from Phase 26) handles transport.

</domain>

<decisions>
## Implementation Decisions

### Consent dialog
- Format: Claude's discretion (modal centered vs bottom banner — choose what fits TicketFlow best)
- Tone: transparent & detailed — 5-8 lines listing what is collected and what is never collected
- Language: always in English regardless of app language setting
- Dismiss behavior (X/Escape): re-prompt once on next launch, then treat as Decline if ignored again
- Accept/Decline buttons: equal visual weight (SC1 requirement)
- No PostHog network call before user makes a choice (SC1 requirement)

### Event taxonomy
- Granularity: ~15 events with context metadata (not just action names)
- Focus: balanced mix of AI usage tracking + user journey/adoption tracking
- AI events: provider used, generation success/failure, generation type
- Journey events: project created, onboarding completed, features discovered, import used
- Error tracking: anonymous unhandled errors + AI failure stack traces (anonymized)
- Never collect: file content, project names, API keys, personal data

### Revocation experience
- Placement: new "Privacy" or "Telemetry" section in AppSettingsModal, alongside Language/Theme/Updates
- Toggle: on/off switch, immediate effect
- Feedback on disable: confirmation + inline message "Telemetry disabled. No data will be sent."
- Re-enable: same toggle, no friction

### Privacy messaging
- PRIVACY.md: create in repo root, link from consent dialog
- Consent dialog lists explicitly: what we collect (feature usage, AI provider choice, error reports) AND what we never collect (file content, project names, API keys)
- Link opens PRIVACY.md on GitHub in external browser

### Claude's Discretion
- Exact consent dialog layout (modal vs banner)
- PostHog initialization sequence and lazy loading strategy
- Exact event names and property schemas
- Unit test structure for consent gate verification
- Toast vs inline for revocation feedback

</decisions>

<specifics>
## Specific Ideas

- Consent dialog always in English — even when app is in French
- "Transparent & detailed" means the dialog itself shows what is/isn't collected, not hidden behind a link
- PRIVACY.md on GitHub serves as the full policy reference, dialog is the summary
- Re-prompt on dismiss: only one retry, then permanent Decline — no nagging
- Error tracking includes AI health check failures (already classified in ai-health.ts)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-telemetry-core-consent*
*Context gathered: 2026-02-17*
