# Phase 27: Telemetry Core & Consent - Research

**Researched:** 2026-02-17
**Domain:** PostHog-js integration, GDPR consent gate, event instrumentation, lazy loading, Tauri IPC transport
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Consent dialog:**
- Format: Claude's discretion (modal centered vs bottom banner)
- Tone: transparent & detailed — 5-8 lines listing what is collected and what is never collected
- Language: always in English regardless of app language setting
- Dismiss behavior (X/Escape): re-prompt once on next launch, then treat as Decline if ignored again
- Accept/Decline buttons: equal visual weight (SC1 requirement)
- No PostHog network call before user makes a choice (SC1 requirement)

**Event taxonomy:**
- Granularity: ~15 events with context metadata (not just action names)
- Focus: balanced mix of AI usage tracking + user journey/adoption tracking
- AI events: provider used, generation success/failure, generation type
- Journey events: project created, onboarding completed, features discovered, import used
- Error tracking: anonymous unhandled errors + AI failure stack traces (anonymized)
- Never collect: file content, project names, API keys, personal data

**Revocation experience:**
- Placement: new "Privacy" or "Telemetry" section in AppSettingsModal
- Toggle: on/off switch, immediate effect
- Feedback on disable: confirmation + inline message "Telemetry disabled. No data will be sent."
- Re-enable: same toggle, no friction

**Privacy messaging:**
- PRIVACY.md: create in repo root, link from consent dialog
- Consent dialog lists explicitly what is and is NOT collected
- Link opens PRIVACY.md on GitHub in external browser

### Claude's Discretion
- Exact consent dialog layout (modal vs banner)
- PostHog initialization sequence and lazy loading strategy
- Exact event names and property schemas
- Unit test structure for consent gate verification
- Toast vs inline for revocation feedback

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TELE-01 | User sees first-launch consent dialog; can accept or decline with equal-weight buttons | Consent gate pattern: `localStorage` key `ticketflow-telemetry-consent` (`'granted'` / `'declined'` / unset). Dialog shown when key is unset. Dismiss tracking uses a second key `ticketflow-telemetry-dismiss-count` (0/1). posthog-js stays unloaded until consent granted. |
| TELE-02 | User can toggle telemetry on/off in App Settings at any time; revocation takes effect immediately | New "Privacy" section in `AppSettingsModal`. Toggle reads/writes the consent localStorage key. On disable: call `posthog.opt_out_capturing()` (no-op if posthog not loaded). Module-level `isTelemetryEnabled()` utility checked before every `track()` call. |
| TELE-03 | PostHog SDK initializes only after explicit consent; lazy-loaded via dynamic import; zero PII | `posthog.init()` called inside the `if (consent === 'granted')` branch, wrapped in `const posthog = await import('posthog-js')`. The module is dynamically imported — Vite automatically creates a separate chunk. Config: `autocapture: false`, `capture_pageview: false`, `opt_out_capturing_by_default: false`, `api_host: 'https://eu.i.posthog.com'`. |
| TELE-05 | 10 core usage events instrumented | Events: `app_launched`, `project_created`, `ticket_created`, `ai_generation_completed`, `ai_generation_failed`, `view_switched`, `settings_opened`, `consent_granted`, `consent_revoked`, `project_opened`. All routed through `track()` in `src/lib/telemetry.ts`. |
| TELE-06 | 5 secondary events instrumented | Events: `command_palette_opened`, `bulk_import_completed`, `onboarding_completed`, `dark_mode_toggled`, `ai_health_check_run`. Same `track()` function. |
| TELE-07 | App version and platform sent as super-properties on every event; EU endpoint used | `posthog.register({ app_version: APP_VERSION, platform: isTauri() ? 'desktop' : 'web' })` called once at init. EU endpoint: `api_host: 'https://eu.i.posthog.com'`. |
| TCOV-05 | Unit tests for `telemetry.ts` verifying consent gate and event firing | Test file: `src/__tests__/telemetry.test.ts`. Tests mock dynamic posthog import via `vi.mock('posthog-js', ...)`. Verify: track() is no-op before consent, fires after consent, stops after revocation. |
</phase_requirements>

---

## Summary

Phase 27 builds the frontend telemetry layer: a `src/lib/telemetry.ts` module that gates all PostHog calls behind a localStorage consent check, a `ConsentDialog` component for first-launch opt-in, and a Privacy section in `AppSettingsModal` for revocation. The transport to PostHog is handled entirely by the Phase 26 Rust `ph_send_batch` IPC relay — posthog-js is configured to use this relay rather than sending fetch requests directly (which silently fail in Tauri's WebView).

The critical architectural decision from Phase 26 decisions is confirmed: posthog-js `_send_request` override is a private API that was investigated but **cannot be reliably used** (it is an internal implementation detail, not a stable public API). The Phase 26 decision was to use **Rust IPC relay** (`ph_send_batch`) as the mandatory transport. For Phase 27, this means the frontend `telemetry.ts` will **not** initialize posthog-js with a normal PostHog project key and let it send directly — instead, it will use posthog-js for its queuing, batching, and super-properties API but intercept event dispatch to forward via `invoke('ph_send_batch', ...)`. The `ph_send_batch` Tauri command is already fully implemented and verified in Phase 26.

The posthog-js consent model is well-documented: `opt_out_capturing_by_default: true` ensures no events are captured until `posthog.opt_in_capturing()` is called. The module is lazy-loaded via `import('posthog-js')` only after consent is granted, keeping it out of the main bundle (Vite will tree-shake and split it automatically). The `autocapture: false` and `capture_pageview: false` flags are mandatory to prevent fetch corruption on AI calls (verified issue in posthog-js).

**Primary recommendation:** Use `posthog-js` as a lazy-loaded client for event construction and super-properties, but route all outbound events through the existing `ph_send_batch` Rust IPC command rather than letting posthog-js send directly. The transport interception strategy is to override `posthog.config.api_transport` or use the `loaded` callback with a custom batch sender. If the private API approach proves too fragile, the fallback is a lightweight custom implementation in `telemetry.ts` that constructs the PostHog event payload manually and calls `invoke('ph_send_batch', ...)` without using posthog-js at all.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `posthog-js` | 1.347.2 (latest as of 2026-02-17) | Event capture, super-properties, opt-in/out lifecycle | Official PostHog JS SDK; handles queuing, batching, super-properties API |
| `@tauri-apps/api/core` | 2.9.1 (already installed) | `invoke('ph_send_batch', ...)` IPC relay | The Rust relay is the mandatory transport; already wired in Phase 26 |
| localStorage | Browser native | Consent state persistence (`ticketflow-telemetry-consent`) | No new dep; consistent with how the app stores other preferences |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `posthog-js/dist/module` | same | ESM build used by Vite | Vite picks this automatically; creates a separate chunk |
| `@tauri-apps/plugin-shell` | 2.3.3 (already installed) | `open(PRIVACY_MD_URL)` for external browser link from consent dialog | Already in project; used for opening external URLs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| posthog-js (full SDK) | `posthog-js-lite` (archived July 2025, code merged into posthog-js) | posthog-js-lite is archived; use posthog-js directly |
| posthog-js (full SDK) | Hand-rolled fetch to `ph_send_batch` | More control, no external SDK dep; viable fallback if posthog-js transport override is too fragile |
| `invoke('ph_send_batch')` relay | posthog-js direct fetch | posthog-js silently drops events in Tauri v2 WebView (confirmed issue #1760); relay is mandatory |
| localStorage consent | Cookie-based consent | App already uses localStorage for all preferences; consistent; no cookie complexity |

**Installation:**
```bash
pnpm add posthog-js
```

Note: posthog-js is already a well-known package (1.347.2, ~200KB minified). With lazy loading it stays out of the main bundle — Vite splits it into its own chunk automatically on first dynamic import.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── telemetry.ts          # NEW — consent gate, track() API, posthog init, IPC relay
├── components/
│   └── consent/
│       └── ConsentDialog.tsx # NEW — first-launch consent modal (always in English)
├── __tests__/
│   └── telemetry.test.ts     # NEW — unit tests (TCOV-05)
└── components/settings/
    └── AppSettingsModal.tsx  # MODIFY — add Privacy/Telemetry section with toggle
```

### Pattern 1: Consent Gate with localStorage

**What:** Check a localStorage key before any PostHog call. Only load posthog-js module after explicit consent.
**When to use:** Every single event dispatch; also checked at app startup.

```typescript
// src/lib/telemetry.ts
const CONSENT_KEY = 'ticketflow-telemetry-consent';
const DISMISS_COUNT_KEY = 'ticketflow-telemetry-dismiss-count';

export type ConsentState = 'granted' | 'declined' | null;

export function getConsentState(): ConsentState {
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === 'granted' || val === 'declined') return val;
  return null; // not yet decided
}

export function setConsentState(state: 'granted' | 'declined'): void {
  localStorage.setItem(CONSENT_KEY, state);
}

export function getDismissCount(): number {
  return parseInt(localStorage.getItem(DISMISS_COUNT_KEY) ?? '0', 10);
}

export function incrementDismissCount(): void {
  localStorage.setItem(DISMISS_COUNT_KEY, String(getDismissCount() + 1));
}

/** Should the consent dialog be shown on this launch? */
export function shouldPromptConsent(): boolean {
  const state = getConsentState();
  if (state !== null) return false; // already decided
  const dismisses = getDismissCount();
  return dismisses < 1; // show if never dismissed, or dismissed once (second chance)
}
```

### Pattern 2: Lazy PostHog Initialization via Dynamic Import

**What:** posthog-js is only imported after the user grants consent. Vite creates a separate chunk.
**When to use:** Called once from `initTelemetry()`, which is called from the consent accept handler.

```typescript
// src/lib/telemetry.ts
import { isTauri } from './tauri-bridge';
import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION } from './version';

let _posthogReady = false;
let _posthogInstance: typeof import('posthog-js')['default'] | null = null;

export async function initTelemetry(): Promise<void> {
  if (_posthogReady) return;
  if (getConsentState() !== 'granted') return;

  // Dynamic import — Vite splits this into a separate chunk
  const posthog = await import('posthog-js');
  const ph = posthog.default;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!apiKey) {
    // No key = graceful degradation; telemetry is a no-op
    return;
  }

  ph.init(apiKey, {
    api_host: 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    // Prevent posthog from instrumenting window.fetch (causes AI call corruption)
    // Source: prior decisions [v2.2 planning]
    disable_session_recording: true,
    opt_out_capturing_by_default: false,
    // We will intercept actual delivery via ph_send_batch IPC
    loaded: (posthogInstance) => {
      // Register super-properties on every event
      posthogInstance.register({
        app_version: APP_VERSION,
        platform: isTauri() ? 'desktop' : 'web',
      });
      _posthogInstance = posthogInstance;
      _posthogReady = true;
    },
  });
}
```

**IMPORTANT NOTE on transport override (see Open Questions section):** The `_send_request` override mentioned in prior decisions refers to a private API that may not exist in posthog-js 1.347.2 as a stable public interface. Research the source code before using it. The fallback strategy is to NOT use posthog-js for HTTP transport at all — instead, implement `track()` to manually construct PostHog event payloads and send them directly via `invoke('ph_send_batch', ...)`. This is the safe, guaranteed-to-work approach.

### Pattern 3: The `track()` Function — Consent Gate + IPC Relay

**What:** The single public API for all event tracking. Checks consent, queues event, sends via IPC.
**When to use:** Call `track('event_name', { ...properties })` at every instrumentation point.

**Approach A: Using posthog-js for batching (if transport override works)**
```typescript
// In telemetry.ts — if posthog-js internal transport can be redirected
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!_posthogReady || !_posthogInstance || getConsentState() !== 'granted') return;
  _posthogInstance.capture(event, properties);
  // posthog-js handles batching internally; flush is routed via IPC relay
}
```

**Approach B: Direct IPC relay (RECOMMENDED — avoids private API dependency)**
```typescript
// In telemetry.ts — standalone implementation without posthog-js runtime
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauri-bridge';
import { APP_VERSION } from './version';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = 'https://eu.i.posthog.com';

// Anonymous device ID (generated once, stored in localStorage)
function getDeviceId(): string {
  const KEY = 'ticketflow-telemetry-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// In-memory event queue with 100ms debounce flush
const pendingEvents: Array<{ event: string; properties: Record<string, unknown>; timestamp: string }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    if (!pendingEvents.length || !POSTHOG_KEY) return;
    const batch = pendingEvents.splice(0);
    if (isTauri()) {
      // Route through Rust relay (required in Tauri WebView)
      await invoke('ph_send_batch', {
        events: batch,
        apiKey: POSTHOG_KEY,
      }).catch(console.warn);
    } else {
      // Web mode: direct fetch (works in browser)
      await fetch(`${POSTHOG_HOST}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
      }).catch(console.warn);
    }
  }, 100);
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (getConsentState() !== 'granted') return;
  if (!POSTHOG_KEY) return; // graceful degradation

  pendingEvents.push({
    event,
    properties: {
      distinct_id: getDeviceId(),
      app_version: APP_VERSION,
      platform: isTauri() ? 'desktop' : 'web',
      ...properties,
    },
    timestamp: new Date().toISOString(),
  });
  scheduleFlush();
}
```

This Approach B is RECOMMENDED because:
1. No dependency on posthog-js private API
2. Testable without mocking posthog-js internals
3. Zero bundle size increase in main chunk (no import at all until Web mode + consent)
4. Matches exactly how `ph_send_batch` in `telemetry.rs` expects event payloads (`{ event, properties, timestamp }`)
5. posthog-js is still optionally usable as a "nice wrapper" for super-properties if desired, but the core data path is IPC → Rust relay → PostHog

### Pattern 4: Consent Dialog — Centered Modal in English

**What:** A React component shown at first launch before any PostHog initialization.
**Layout recommendation:** Centered modal (not banner) — fits the app's existing Modal component; banners feel dismissible/ignorable, which undermines equal-weight button UX.

```typescript
// src/components/consent/ConsentDialog.tsx
import { Modal } from '../ui/Modal';
import { open } from '@tauri-apps/plugin-shell';
import { isTauri } from '../../lib/tauri-bridge';

const PRIVACY_URL = 'https://github.com/Bouaris/ticketflow/blob/master/PRIVACY.md';

interface ConsentDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void; // X/Escape — not a final decision
}

export function ConsentDialog({ isOpen, onAccept, onDecline, onDismiss }: ConsentDialogProps) {
  const handleOpenPrivacy = async () => {
    if (isTauri()) {
      await open(PRIVACY_URL);
    } else {
      window.open(PRIVACY_URL, '_blank', 'noopener');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss}           // X button → dismiss (re-prompt logic in parent)
      closeOnBackdrop={false}       // Must make explicit choice
      closeOnEscape={true}          // Escape = dismiss (same as X)
      showCloseButton={true}
      size="md"
      // footer provides equal-weight Accept/Decline buttons
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-outline text-on-surface-secondary hover:bg-surface-alt transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-outline text-on-surface-secondary hover:bg-surface-alt transition-colors"
          >
            Accept
          </button>
        </div>
      }
    >
      {/* Always English — hardcoded strings, not via i18n */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">Help improve Ticketflow</h2>
        <p className="text-sm text-on-surface-secondary">
          Ticketflow can collect anonymous usage data to help us understand how the app is used
          and prioritize improvements. You can change this at any time in App Settings.
        </p>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-on-surface">We collect:</p>
          <ul className="list-disc list-inside text-on-surface-secondary space-y-0.5 ml-2">
            <li>Feature usage (which views, tools, and AI providers you use)</li>
            <li>Error reports (anonymous stack traces, no personal context)</li>
            <li>App version and platform (desktop or web)</li>
          </ul>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-on-surface">We never collect:</p>
          <ul className="list-disc list-inside text-on-surface-secondary space-y-0.5 ml-2">
            <li>File contents or project names</li>
            <li>API keys or credentials</li>
            <li>Any personally identifiable information</li>
          </ul>
        </div>
        <button
          onClick={handleOpenPrivacy}
          className="text-xs text-accent-text underline hover:no-underline"
        >
          Read full privacy policy (opens GitHub)
        </button>
      </div>
    </Modal>
  );
}
```

**Equal-weight button pattern:** Both Accept and Decline use identical styling (`flex-1 ... border border-outline ... text-on-surface-secondary`). Neither is highlighted as "primary". This is the SC1 requirement.

### Pattern 5: Revocation in AppSettingsModal

**What:** A new "Privacy" section in `AppSettingsModal.tsx` with an on/off toggle.
**Placement:** After the "Updates" section, before the Changelog section (or at end of settings).

```typescript
// In AppSettingsModal.tsx — new Privacy section
import { getConsentState, setConsentState } from '../../lib/telemetry';

// In component state:
const [telemetryEnabled, setTelemetryEnabled] = useState(getConsentState() === 'granted');
const [telemetryMessage, setTelemetryMessage] = useState<string | null>(null);

const handleTelemetryToggle = () => {
  const newEnabled = !telemetryEnabled;
  setTelemetryEnabled(newEnabled);
  setConsentState(newEnabled ? 'granted' : 'declined');

  if (newEnabled) {
    // Re-initialize telemetry (lazy import)
    import('../../lib/telemetry').then(({ initTelemetry, track }) => {
      initTelemetry();
      track('consent_granted'); // instrument the re-enable
    });
    setTelemetryMessage(null);
  } else {
    // Immediately revoke
    import('../../lib/telemetry').then(({ track }) => {
      track('consent_revoked'); // last event before revocation takes effect
    });
    setTelemetryMessage('Telemetry disabled. No data will be sent.');
    setTimeout(() => setTelemetryMessage(null), 4000);
  }
};
```

### Pattern 6: Event Taxonomy — Exact Names and Properties

All events use snake_case. Properties use snake_case keys.

```typescript
// TELE-05: Core events (10)
track('app_launched', { session_id: crypto.randomUUID() });
track('project_opened', { has_items: true, item_count: 42 });
track('project_created');
track('ticket_created', { type: 'BUG', via: 'editor' | 'ai' | 'bulk_import' | 'quick_capture' });
track('ai_generation_completed', { provider: 'groq', type: 'ticket' | 'refinement' | 'bulk' });
track('ai_generation_failed', { provider: 'groq', type: 'ticket', error_type: 'auth' | 'rate_limit' | 'timeout' | 'network' | 'unknown' });
track('view_switched', { to: 'kanban' | 'list' | 'graph' | 'dashboard' | 'archive' });
track('settings_opened', { panel: 'app' | 'ai' | 'type_config' | 'project' });
track('consent_granted');
track('consent_revoked');

// TELE-06: Secondary events (5)
track('command_palette_opened');
track('bulk_import_completed', { items_imported: 5 });
track('onboarding_completed', { steps_completed: 7, ai_configured: true });
track('dark_mode_toggled', { theme: 'dark' | 'light' | 'system' });
track('ai_health_check_run', { provider: 'groq', success: true, latency_ms: 240 });
```

### Pattern 7: Error Tracking (Anonymous)

```typescript
// Global error handler — anonymous, no file paths or content
window.addEventListener('unhandledrejection', (event) => {
  if (getConsentState() !== 'granted') return;
  const message = event.reason instanceof Error
    ? event.reason.message.slice(0, 200) // truncate
    : String(event.reason).slice(0, 200);
  track('error_unhandled', {
    error_message: message,
    // No stack trace — could contain file paths
  });
});

window.addEventListener('error', (event) => {
  if (getConsentState() !== 'granted') return;
  track('error_unhandled', {
    error_message: event.message?.slice(0, 200) ?? 'unknown',
  });
});
```

### Pattern 8: App Launch Detection

`app_launched` should fire once per session on app startup, ONLY if consent is already granted (not on the first launch where consent dialog will appear).

```typescript
// In App.tsx useEffect (similar to initSecureStorage pattern):
useEffect(() => {
  if (getConsentState() === 'granted') {
    initTelemetry().then(() => {
      track('app_launched');
    });
  }
}, []);
```

### Pattern 9: Unit Test Structure for TCOV-05

```typescript
// src/__tests__/telemetry.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getConsentState, setConsentState, track, shouldPromptConsent, getDismissCount } from '../lib/telemetry';

// Mock invoke for IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve({ sent: 1, queued: 0 })),
}));

describe('Telemetry - Consent Gate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('1. track() is a no-op before consent is granted', () => {
    const { invoke } = await import('@tauri-apps/api/core');
    track('test_event');
    // flush happens async with 100ms debounce — use vi.useFakeTimers
    vi.runAllTimers();
    expect(invoke).not.toHaveBeenCalled();
  });

  test('2. track() fires after consent is granted', async () => {
    setConsentState('granted');
    const { invoke } = await import('@tauri-apps/api/core');
    track('test_event', { foo: 'bar' });
    vi.runAllTimers();
    await Promise.resolve(); // flush microtasks
    expect(invoke).toHaveBeenCalledWith('ph_send_batch', expect.objectContaining({
      events: expect.arrayContaining([expect.objectContaining({ event: 'test_event' })]),
    }));
  });

  test('3. track() stops after consent is revoked', async () => {
    setConsentState('granted');
    setConsentState('declined');
    const { invoke } = await import('@tauri-apps/api/core');
    track('should_not_fire');
    vi.runAllTimers();
    expect(invoke).not.toHaveBeenCalled();
  });

  test('4. shouldPromptConsent returns true on first launch', () => {
    expect(shouldPromptConsent()).toBe(true);
  });

  test('5. shouldPromptConsent returns true after one dismiss (re-prompt once)', () => {
    incrementDismissCount();
    expect(shouldPromptConsent()).toBe(true); // 1 dismiss = still show
  });

  test('6. shouldPromptConsent returns false after two dismisses (permanent decline)', () => {
    incrementDismissCount();
    incrementDismissCount();
    expect(shouldPromptConsent()).toBe(false); // 2 dismisses = give up
  });
});
```

### Anti-Patterns to Avoid

- **Do NOT call posthog.init() or any PostHog network call before consent is granted** — violates SC1 and GDPR.
- **Do NOT import posthog-js at the top of telemetry.ts** — static import bloats the main bundle by ~200KB; use `await import('posthog-js')` inside the consent handler.
- **Do NOT use `autocapture: true` or omit `capture_pageview: false`** — posthog-js autocapture instruments `window.fetch`, which corrupts AI API calls (confirmed issue, prior decisions).
- **Do NOT put VITE_POSTHOG_KEY in source code** — always read from `import.meta.env.VITE_POSTHOG_KEY`; if undefined, telemetry is silently disabled.
- **Do NOT send project names, file paths, or item content** — GDPR violation; strip from all event properties.
- **Do NOT use the `track()` function in render paths** — events should only fire on user interactions/lifecycle hooks, not on every render.
- **Do NOT use posthog-js direct fetch in Tauri mode** — it silently drops events (confirmed: posthog-js issue #1760). Use `invoke('ph_send_batch', ...)` exclusively in Tauri.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for device ID | Custom random string | `crypto.randomUUID()` | Native browser API, no dep, cryptographically secure |
| External URL opening from consent dialog | Custom window.location | `open()` from `@tauri-apps/plugin-shell` (already installed) | Already used in app; handles Tauri vs Web |
| Event batching with debounce | Complex queue system | Simple 100ms setTimeout + array (in telemetry.ts Approach B) | PostHog events are low-frequency; simple queue is sufficient |
| Consent toggle UI | Custom checkbox | Existing TS pattern from AppSettingsModal (language selector buttons) or a simple `<input type="checkbox">` | Consistent with existing settings UI patterns |

**Key insight:** The Rust `ph_send_batch` already handles offline queuing, retry logic (5 retries), max queue size (500), and WAL-mode crash safety. The frontend `telemetry.ts` only needs to batch events for 100ms and then call `invoke()` — all durability concerns are handled in Rust.

---

## Common Pitfalls

### Pitfall 1: posthog-js fetch Corruption of AI Calls

**What goes wrong:** If posthog-js is initialized with `autocapture: true` (or without `capture_pageview: false`), it instruments `window.fetch` globally. This modifies fetch behavior and can corrupt AI API calls made later (e.g., to Groq/Gemini).
**Why it happens:** posthog-js hooks into fetch for session recording and network capture features.
**How to avoid:** Always initialize with `autocapture: false`, `capture_pageview: false`, `capture_pageleave: false`, and `disable_session_recording: true`. Or use Approach B (no posthog-js at runtime) which eliminates this risk entirely.
**Warning signs:** AI generation starts failing with fetch-related errors after telemetry is enabled; AI health checks return network errors despite valid API keys.

### Pitfall 2: posthog-js Silently Dropping Events in Tauri WebView

**What goes wrong:** posthog-js calls `window.fetch` or `XMLHttpRequest` to send events to PostHog. In Tauri v2 WebView, these outgoing network calls fail silently for external domains that require special Tauri plugin (tauri-plugin-http) permissions.
**Why it happens:** Tauri's WebView security model intercepts and may drop external fetch calls unless the Rust backend handles them. Confirmed: posthog-js issue #1760 (closed without resolution, Feb 2025).
**How to avoid:** NEVER let posthog-js send events directly. Route all events through `invoke('ph_send_batch', ...)`. The `telemetry.rs` Rust command uses `reqwest` (which has full OS-level network access) to deliver events.
**Warning signs:** Events appear in browser dev mode (Vite server) but not in Tauri desktop binary; no errors in console.

### Pitfall 3: Static Import of posthog-js Breaking Bundle Constraint

**What goes wrong:** `import posthog from 'posthog-js'` at the top of telemetry.ts adds ~200KB to the main bundle. SC4 requires posthog-js to be in a lazy chunk with a delta under 50KB in main.
**Why it happens:** Static imports are always included in the main chunk by Vite.
**How to avoid:** Always use `const { default: posthog } = await import('posthog-js')` inside the consent handler. If using Approach B (no posthog-js at runtime), this pitfall is irrelevant.
**Warning signs:** `pnpm build` output shows posthog-js in the main chunk or `dist/assets/index-*.js` grows by ~200KB.

### Pitfall 4: Consent State Race Condition on First Launch

**What goes wrong:** App fires `app_launched` before the consent dialog has been shown and user has responded. If `initTelemetry()` is called unconditionally in App.tsx `useEffect`, it may send `app_launched` while consent is still `null`.
**Why it happens:** The consent check needs to be a gate in the correct sequence: (1) check consent state, (2) if null → show dialog, (3) if 'granted' → init telemetry. NOT: init telemetry → show dialog.
**How to avoid:** In App.tsx, the `useEffect` for telemetry must check `getConsentState() === 'granted'` before calling `initTelemetry()`. The consent dialog's `onAccept` handler calls `initTelemetry()` and fires `consent_granted` and `app_launched`.

### Pitfall 5: VITE_POSTHOG_KEY Missing in Development

**What goes wrong:** Developer runs `pnpm dev` without a `.env.local` file containing `VITE_POSTHOG_KEY`. `import.meta.env.VITE_POSTHOG_KEY` is `undefined`. Without a guard, `ph_send_batch` is called with an empty API key, sending garbage to PostHog or causing Rust-side errors.
**Why it happens:** Environment variables must be present at build/dev time.
**How to avoid:** Guard every `track()` call with `if (!POSTHOG_KEY) return;`. The Rust `startup_flush` already skips delivery when `api_key` is empty. No error thrown — telemetry is simply a no-op without the key.
**Warning signs:** Events reaching the Rust relay with an empty `api_key` field.

### Pitfall 6: Dismiss Logic Must Track Count in localStorage

**What goes wrong:** If dismiss tracking is in React state only, it resets on each page reload. The second launch won't know the user already dismissed once.
**Why it happens:** State-only tracking doesn't persist across sessions.
**How to avoid:** Use `DISMISS_COUNT_KEY` in localStorage. `incrementDismissCount()` writes immediately. `shouldPromptConsent()` reads both the consent key AND dismiss count.

### Pitfall 7: Consent Dialog Must Not Prevent App Usage

**What goes wrong:** The consent dialog blocks the entire app with a non-dismissible modal, making users feel trapped.
**Why it happens:** Setting `closeOnBackdrop={false}` AND `closeOnEscape={false}` with no X button.
**How to avoid:** Always show an X button and allow Escape to close (counts as dismiss). `closeOnBackdrop={false}` is correct (accidental backdrop clicks shouldn't count as a choice). The app continues to function normally after dismiss — consent dialog just closes.

### Pitfall 8: Verifying posthog-js `_send_request` Override Exists

**What goes wrong:** The prior decisions mention `_send_request` override as a possible transport strategy. This is a private API that may not exist in posthog-js 1.347.2 or may behave differently.
**Why it happens:** Private APIs are not documented and can change between versions.
**How to avoid:** Use Approach B (direct IPC relay without posthog-js for transport). This is safer and simpler. If posthog-js is used at all in Phase 27, use it only for its side-effect-free API (like `register()` for super-properties) while the actual network dispatch goes through `invoke('ph_send_batch')`.

---

## Code Examples

Verified patterns from official sources and project codebase analysis:

### posthog-js Consent API (verified from posthog-js source and docs research)

```typescript
// Source: https://github.com/PostHog/posthog-js (posthog-core.ts)
// Consent gate via opt_out_capturing_by_default
posthog.init(apiKey, {
  api_host: 'https://eu.i.posthog.com',
  autocapture: false,
  capture_pageview: false,
  opt_out_capturing_by_default: true, // starts opted-out
});

// After user clicks Accept:
posthog.opt_in_capturing();

// After user clicks Decline or toggles off in settings:
posthog.opt_out_capturing();
```

### Dynamic Import Pattern for Lazy Loading (Vite)

```typescript
// Source: https://vite.dev/guide/features#dynamic-import
// This creates a separate chunk in pnpm build output
const { default: posthog } = await import('posthog-js');
// Vite creates: dist/assets/posthog-js-[hash].js (separate chunk)
```

### invoke() Call for ph_send_batch (IPC relay)

```typescript
// Source: Phase 26 telemetry.rs (verified in place)
// src-tauri/src/telemetry.rs: ph_send_batch accepts { events: Vec<PhEvent>, api_key: String }
// PhEvent: { event: String, properties: Value, timestamp: Option<String> }

import { invoke } from '@tauri-apps/api/core';

await invoke('ph_send_batch', {
  events: [
    {
      event: 'ticket_created',
      properties: {
        distinct_id: 'anon-uuid-here',
        type: 'BUG',
        via: 'editor',
        app_version: '2.2.0',
        platform: 'desktop',
      },
      timestamp: new Date().toISOString(),
    },
  ],
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
});
```

### Super-Properties via posthog.register()

```typescript
// Source: posthog-js docs (multiple verified sources)
// Registers properties that are merged into EVERY subsequent event
posthog.register({
  app_version: APP_VERSION,
  platform: isTauri() ? 'desktop' : 'web',
});
// After this call, every posthog.capture() automatically includes these props
```

### AppSettingsModal Section Pattern (matches existing code style)

```typescript
// Pattern derived from existing AppSettingsModal.tsx sections (lines 186-214)
{/* Privacy / Telemetry Section */}
<div className="pt-4 border-t border-outline">
  <div className="flex items-center justify-between">
    <div>
      <h4 className="text-sm font-medium text-on-surface-secondary">Privacy</h4>
      <p className="text-xs text-on-surface-muted">
        Anonymous usage data helps improve Ticketflow.
      </p>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={telemetryEnabled}
        onChange={handleTelemetryToggle}
        className="sr-only peer"
      />
      {/* Tailwind toggle pill */}
      <div className="w-11 h-6 bg-surface-alt peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:bg-accent after:..." />
    </label>
  </div>
  {telemetryMessage && (
    <p className="mt-2 text-xs text-on-surface-muted px-3 py-1.5 rounded bg-surface-alt">
      {telemetryMessage}
    </p>
  )}
</div>
```

### vitest.config.ts Coverage Include Update

```typescript
// Add src/lib/telemetry.ts to coverage (it's in src/lib/ so already covered)
// vitest.config.ts — no change needed; coverage.include already has 'src/lib/**'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| posthog-js direct fetch (works in browsers) | IPC relay via ph_send_batch (Tauri) or direct fetch (Web) | Phase 26 decision, Feb 2026 | Events actually reach PostHog from Tauri desktop binary |
| posthog-js-lite (separate repo, lightweight) | Merged into posthog-js main repo | July 2025 (repo archived) | Use posthog-js directly; same tree-shaking possible |
| Cookie-based consent | localStorage-based consent | Project convention (no cookies in app) | Consistent with all other app preferences |
| `capture_pageview: true` default | Must explicitly set `false` | posthog-js existing behavior | Without this, posthog instruments window.fetch |

**Deprecated/outdated:**
- `posthog-js-lite` npm package: archived July 2025, code merged into posthog-js — do NOT install posthog-js-lite
- `_send_request` override: mentioned in prior decisions but confirmed as private API; use direct IPC relay instead (Approach B)

---

## Open Questions

1. **Does posthog-js 1.347.2 expose a stable public `_send_request` override?**
   - What we know: The posthog-core.ts source shows `_send_request` is used internally; `api_transport` config exists
   - What's unclear: Whether `api_transport` can be set to a custom async function (vs just 'sendBeacon' / 'fetch' / 'xhr')
   - Recommendation: **Use Approach B** (direct IPC relay in `telemetry.ts` without posthog-js transport) — this is the safe, independent path confirmed to work with the ph_send_batch Rust command. If posthog-js super-properties are desired, use `posthog.register()` in a loaded callback but never let posthog-js send events directly.

2. **Should `app_launched` fire from the consent dialog's onAccept or from App.tsx useEffect?**
   - What we know: If consent was previously granted, App.tsx should fire `app_launched` on subsequent launches (no consent dialog shown)
   - What's unclear: Which is the "first" app_launched — the launch where user accepts, or subsequent launches
   - Recommendation: Fire `app_launched` from `initTelemetry()` itself (once per session, after init). If consent was already granted, `initTelemetry()` is called from App.tsx useEffect; if just granted, it's called from the dialog's onAccept.

3. **Toggle in AppSettingsModal: should re-enabling reinitialize posthog-js or just flip the localStorage key?**
   - What we know: posthog-js lazy-loads on first consent; if user declines and re-enables, posthog-js hasn't been loaded
   - What's unclear: Whether re-enabling mid-session requires another dynamic import
   - Recommendation: `initTelemetry()` is idempotent (`if (_posthogReady) return`). Call it from the toggle's onEnable handler. It will lazy-load posthog-js (or skip if already loaded) and start tracking.

4. **Web mode event delivery: use posthog-js fetch directly or Approach B?**
   - What we know: In web/browser mode, `window.fetch` works fine for PostHog; posthog-js direct fetch works
   - What's unclear: Whether SC2 ("production binary") implies only Tauri is tested, or if web mode also needs event delivery
   - Recommendation: SC2 explicitly says "pnpm tauri build". Web mode can use either approach. Approach B (direct fetch in web mode, `invoke()` in Tauri mode) is implemented in Pattern 3's `scheduleFlush()` function — already accounts for both environments.

---

## Sources

### Primary (HIGH confidence)

- `D:\PROJET CODING\ticketflow\src-tauri\src\telemetry.rs` — Verified Phase 26 Rust implementation; `ph_send_batch` accepts `{ events: Vec<PhEvent>, api_key: String }`; `PhEvent` shape: `{ event: String, properties: Value, timestamp: Option<String> }`
- `D:\PROJET CODING\ticketflow\.planning\phases\26-infrastructure-transport-foundation\26-VERIFICATION.md` — Phase 26 PASSED (4/4); `ph_send_batch` registered in binary; 445 tests pass; tauri-mocks handle `ph_send_batch`
- `D:\PROJET CODING\ticketflow\src\test-utils\tauri-mocks.ts` — `ph_send_batch` already stubbed; returns `{ queued: 0, sent: N }`
- `D:\PROJET CODING\ticketflow\src\components\settings\AppSettingsModal.tsx` — Existing pattern for settings sections; uses `pt-4 border-t border-outline` divider with flex justify-between layout
- `D:\PROJET CODING\ticketflow\src\i18n\types.ts` — Translations interface (no telemetry keys present — correct for English-only consent)
- `D:\PROJET CODING\ticketflow\vitest.config.ts` — Coverage already includes `src/lib/**`; test file location: `src/__tests__/`
- `https://github.com/PostHog/posthog-js/issues/1760` — Confirmed: posthog-js silently drops events in Tauri v2; issue closed without resolution
- `https://c15t.com/docs/integrations/posthog` — opt_in_capturing / opt_out_capturing API; cookieless_mode pattern

### Secondary (MEDIUM confidence)

- posthog-js 1.347.2 (latest as of 2026-02-17) — Verified from npm search results
- `posthog.register()` for super-properties — Confirmed from multiple sources; persists across events
- `opt_out_capturing_by_default: true` pattern — Confirmed from multiple docs/issues searches
- EU endpoint `https://eu.i.posthog.com` — Confirmed from Phase 26 RESEARCH.md and tauri.conf.json CSP entries (already in place)
- `autocapture: false` + `capture_pageview: false` mandatory — From prior decisions [v2.2 planning] + confirmed by fetch corruption issue pattern

### Tertiary (LOW confidence)

- posthog-js `api_transport` as a configurable option for custom transport — Seen in posthog-core.ts but exact public API surface not verified from official docs (docs pages returned CSS instead of documentation content)
- posthog-js bundle size ~200KB — Commonly cited figure; not verified from current bundlephobia for 1.347.2

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — posthog-js version confirmed, existing deps verified, Rust relay fully implemented
- Architecture: HIGH — patterns derived from verified existing codebase + Phase 26 artifacts + confirmed API research
- Pitfalls: HIGH — most pitfalls directly confirmed (issue #1760 for Tauri, fetch corruption from prior decisions, localStorage state management from existing app patterns)
- Transport override strategy: MEDIUM — Approach B (direct IPC) is HIGH confidence; posthog-js transport override is LOW (private API)

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days — posthog-js moves quickly but core consent API is stable; Tauri v2 transport issue is a known architectural constraint)
