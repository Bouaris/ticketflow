---
phase: 27-telemetry-core-consent
plan: "03"
subsystem: telemetry-instrumentation
tags: [telemetry, posthog, track, events, tele-05, tele-06, projectworkspace, ai, onboarding]

# Dependency graph
requires:
  - phase: 27-telemetry-core-consent
    plan: "01"
    provides: track() consent-gated API in src/lib/telemetry.ts
provides:
  - project_opened event (ProjectWorkspace useEffect, fires once after load)
  - ticket_created event (ProjectWorkspace handleSaveItem, after addItem)
  - view_switched event (ProjectWorkspace handleViewModeChange wrapper)
  - settings_opened event (ProjectWorkspace 4 panel-specific wrappers: app/ai/type_config/project)
  - ai_generation_completed event (ai.ts refineItem + generateItemFromDescription success paths)
  - ai_generation_failed event (ai.ts refineItem + generateItemFromDescription failure paths + catch blocks)
  - ai_health_check_run event (ai-health.ts testProviderHealth, all result paths)
  - command_palette_opened event (CommandPalette useEffect when isOpen becomes true)
  - bulk_import_completed event (BulkImportWizard handleConfirm after bulkCreateItems)
  - onboarding_completed event (OnboardingWizard goNext final step + handleSkip)
affects: [app-telemetry-pipeline, posthog-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasFiredRef guard pattern for one-shot useEffect telemetry (project_opened)"
    - "Callback wrapper pattern for settings_opened (handleOpenSettings/AI/TypeConfig/ProjectSettings)"
    - "handleViewModeChange wrapper replaces direct backlog.setViewMode for view_switched tracking"
    - "Error type classification inline (auth/rate_limit/network/unknown) reusing existing regex patterns from ai.ts"

key-files:
  created: []
  modified:
    - src/components/workspace/ProjectWorkspace.tsx
    - src/lib/ai.ts
    - src/lib/ai-health.ts
    - src/components/palette/CommandPalette.tsx
    - src/components/import/BulkImportWizard.tsx
    - src/components/onboarding/OnboardingWizard.tsx

key-decisions:
  - "handleViewModeChange wrapper centralizes view_switched tracking — replaces all direct backlog.setViewMode calls (Header, shortcuts, workspaceActions)"
  - "settings_opened uses 4 separate wrappers (handleOpenSettings/AI/TypeConfig/ProjectSettings) rather than a single generic one — panel metadata is known at each call site"
  - "ai_health_check_run fires at every return path in testProviderHealth (success + all error classifications) to avoid missing events on early returns"
  - "onboarding_completed fires in both goNext (full flow) and handleSkip (early exit) — steps_completed reflects actual steps seen"
  - "hasApiKey(getProvider()) used for ai_configured in OnboardingWizard — checks post-AI-setup state at completion time without requiring wizard-internal state"

requirements-completed: [TELE-05, TELE-06]

# Metrics
duration: 7min
completed: 2026-02-17
---

# Phase 27 Plan 03: Event Instrumentation Summary

**10 core + secondary telemetry events instrumented across 6 files — all events in callbacks/effects (zero render-path violations), 455 tests pass, pnpm build clean**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-17T21:31:52Z
- **Completed:** 2026-02-17T21:38:xx Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

### Task 1: Core events (ProjectWorkspace, ai.ts, ai-health.ts)

**ProjectWorkspace.tsx:**
- Added `import { track } from '../../lib/telemetry'`
- `project_opened`: useEffect with `hasFiredProjectOpened` ref — fires once after `backlog.isLoading` becomes false with `has_items` and `item_count` metadata
- `ticket_created`: inside `handleSaveItem` after `backlog.addItem(item)` succeeds — fires with `type` and `via: 'editor'`
- `settings_opened`: 4 wrapper callbacks (`handleOpenSettings/AI/TypeConfig/ProjectSettings`) each calling `track('settings_opened', { panel: '...' })` before delegating to the prop callback. All downstream consumers (Header, toolbar buttons, workspaceActions) updated to use wrappers
- `view_switched`: `handleViewModeChange` wrapper replaces all direct `backlog.setViewMode` usages across Header prop, shortcut handlers, and workspaceActions

**ai.ts:**
- Added `import { track } from './telemetry'`
- `ai_generation_completed`: fires in both `refineItem` and `generateItemFromDescription` success paths with `provider` and `type` (refinement/ticket)
- `ai_generation_failed`: fires in validation failure paths and catch blocks with classified `error_type` (auth/rate_limit/network/unknown) using existing regex patterns

**ai-health.ts:**
- Added `import { track } from './telemetry'`
- `ai_health_check_run`: fires at every return point in `testProviderHealth` (success + timeout + auth + rate_limit + network + unknown) with `provider`, `success`, and `latency_ms`

### Task 2: Secondary events (CommandPalette, BulkImportWizard, OnboardingWizard)

**CommandPalette.tsx:**
- Added `import { track } from '../../lib/telemetry'`
- `command_palette_opened`: useEffect watching `isOpen` — fires when `isOpen` becomes true, no metadata needed

**BulkImportWizard.tsx:**
- Added `import { track } from '../../lib/telemetry'`
- `bulk_import_completed`: fires in `handleConfirm` after `bulkCreateItems` succeeds, before `onCreated()` — includes `items_imported: created.length`

**OnboardingWizard.tsx:**
- Added `import { track } from '../../lib/telemetry'` and `import { hasApiKey, getProvider } from '../../lib/ai'`
- `onboarding_completed`: fires in both `goNext` (when step === TOTAL_STEPS - 1) and `handleSkip` with `steps_completed` (TOTAL_STEPS or current step) and `ai_configured: hasApiKey(getProvider())`

## Task Commits

Each task was committed atomically:

1. **Task 1: Instrument core telemetry events in workspace and AI modules** - `6dc01de` (feat)
2. **Task 2: Instrument secondary telemetry events in UI components** - `692941f` (feat)

## Files Modified

- `src/components/workspace/ProjectWorkspace.tsx` — 4 events: project_opened, ticket_created, view_switched, settings_opened
- `src/lib/ai.ts` — 2 events: ai_generation_completed, ai_generation_failed (in refineItem + generateItemFromDescription)
- `src/lib/ai-health.ts` — 1 event: ai_health_check_run (all return paths)
- `src/components/palette/CommandPalette.tsx` — 1 event: command_palette_opened
- `src/components/import/BulkImportWizard.tsx` — 1 event: bulk_import_completed
- `src/components/onboarding/OnboardingWizard.tsx` — 1 event: onboarding_completed

## Event Coverage Verification

All 15 events from TELE-05 + TELE-06 are accounted for:

| Event | Handler | File | Plan |
|-------|---------|------|------|
| app_launched | initTelemetry in useEffect | App.tsx | 27-02 |
| consent_granted | ConsentDialog/AppSettingsModal | App.tsx + ConsentDialog | 27-02 |
| consent_revoked | AppSettingsModal privacy toggle | AppSettingsModal | 27-02 |
| project_opened | hasFiredRef + useEffect | ProjectWorkspace | **27-03** |
| project_created | handleProjectSelect | App.tsx | 27-02 |
| ticket_created | handleSaveItem after addItem | ProjectWorkspace | **27-03** |
| ai_generation_completed | refineItem + generateItemFromDescription | ai.ts | **27-03** |
| ai_generation_failed | refineItem + generateItemFromDescription catch | ai.ts | **27-03** |
| view_switched | handleViewModeChange wrapper | ProjectWorkspace | **27-03** |
| settings_opened | 4 wrapper callbacks | ProjectWorkspace | **27-03** |
| command_palette_opened | useEffect on isOpen | CommandPalette | **27-03** |
| bulk_import_completed | handleConfirm after success | BulkImportWizard | **27-03** |
| onboarding_completed | goNext (last step) + handleSkip | OnboardingWizard | **27-03** |
| dark_mode_toggled | theme selector click | AppSettingsModal | 27-02 |
| ai_health_check_run | testProviderHealth all paths | ai-health.ts | **27-03** |

## Decisions Made

- **handleViewModeChange wrapper**: Centralizing view tracking through a single wrapper ensures all view switches (keyboard shortcuts, Header tabs, workspaceActions via command palette) are captured without duplication. Clean single responsibility.
- **settings_opened 4-panel approach**: Each settings callback knows which panel it opens at the call site, so individual wrappers provide richer metadata than a generic wrapper with an `unknown` panel.
- **ai_health_check_run on all paths**: Instead of a single track at the end, we fire at each `return` statement to avoid missing the event if early returns occur (especially timeout/abort branches).
- **hasApiKey(getProvider()) for ai_configured**: Reading AI config state at completion time (not tracking it through wizard state) is simpler and accurate — if the user configured AI in AISetupStep, it's persisted to localStorage, so hasApiKey() returns true.

## Deviations from Plan

None — plan executed exactly as written. All 10 events for this plan were instrumented at their specified action points with the specified metadata.

## Issues Encountered

None.

---
*Phase: 27-telemetry-core-consent*
*Completed: 2026-02-17*

## Self-Check: PASSED

- `src/components/workspace/ProjectWorkspace.tsx` — EXISTS
- `src/lib/ai.ts` — EXISTS
- `src/lib/ai-health.ts` — EXISTS
- `src/components/palette/CommandPalette.tsx` — EXISTS
- `src/components/import/BulkImportWizard.tsx` — EXISTS
- `src/components/onboarding/OnboardingWizard.tsx` — EXISTS
- `.planning/phases/27-telemetry-core-consent/27-03-SUMMARY.md` — EXISTS
- Commit `6dc01de` — EXISTS (Task 1: core events)
- Commit `692941f` — EXISTS (Task 2: secondary events)
- All 455 tests pass (`pnpm test --run` verified)
- `pnpm build` passes (verified after each task)
