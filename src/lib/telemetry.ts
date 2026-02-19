/**
 * Telemetry Module — Consent Gate + IPC Relay
 *
 * Approach B: Direct IPC relay without posthog-js at runtime.
 * - Zero external PostHog SDK dependency (SC4 satisfied trivially)
 * - All events routed through ph_send_batch Rust IPC in Tauri mode
 * - Direct fetch to eu.i.posthog.com in web mode (GDPR — TELE-07)
 * - Consent gate blocks ALL event dispatch when consent is not 'granted'
 * - Anonymous device ID via crypto.randomUUID() (no PII)
 * - Super-properties (app_version, platform, distinct_id) on every event
 *
 * Requirements: TELE-03, TELE-07, TCOV-05
 */

import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauri-bridge';
import { APP_VERSION } from './version';

// ============================================================
// CONSTANTS
// ============================================================

const CONSENT_KEY = 'ticketflow-telemetry-consent';
const DISMISS_COUNT_KEY = 'ticketflow-telemetry-dismiss-count';
const DEVICE_ID_KEY = 'ticketflow-telemetry-device-id';

/** EU PostHog endpoint — GDPR compliance (TELE-07) */
const POSTHOG_HOST = 'https://eu.i.posthog.com';

/** Maximum characters captured from error messages (privacy: limit PII exposure per PRIVACY.md) */
const MAX_ERROR_MESSAGE_CHARS = 200;

/** PostHog project key — read from env at module load time.
 *  If undefined, all telemetry is a graceful no-op. */
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

// ============================================================
// TYPES
// ============================================================

export type ConsentState = 'granted' | 'declined' | null;

interface TelemetryEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// MODULE-LEVEL STATE (event queue)
// ============================================================

const pendingEvents: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Guard to prevent duplicate error tracking listeners (SMELL-010 fix) */
let errorTrackingSetUp = false;

// ============================================================
// CONSENT STATE
// ============================================================

/**
 * Read the current consent state from localStorage.
 * Returns null if the user has not yet made a choice.
 */
export function getConsentState(): ConsentState {
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === 'granted' || val === 'declined') return val;
  return null;
}

/**
 * Persist the user's consent decision to localStorage.
 * Calling this with 'declined' immediately stops all future track() calls.
 */
export function setConsentState(state: 'granted' | 'declined'): void {
  localStorage.setItem(CONSENT_KEY, state);
}

// ============================================================
// DISMISS COUNT
// ============================================================

/**
 * Get how many times the consent dialog was dismissed (X / Escape).
 * Default 0 if key is not set.
 */
export function getDismissCount(): number {
  return parseInt(localStorage.getItem(DISMISS_COUNT_KEY) ?? '0', 10);
}

/**
 * Increment the dismiss counter (persists across sessions via localStorage).
 */
export function incrementDismissCount(): void {
  localStorage.setItem(DISMISS_COUNT_KEY, String(getDismissCount() + 1));
}

/**
 * Should the consent dialog be shown on this launch?
 *
 * Logic (from locked decision):
 * - Show if consent is null AND dismissCount <= 1
 * - Re-prompt once on next launch if dismissed (dismissCount === 1 → still show)
 * - After 2 dismisses, treat as permanent Decline (stop showing)
 */
export function shouldPromptConsent(): boolean {
  if (getConsentState() !== null) return false; // already decided
  const hasBeenDismissedTooManyTimes = getDismissCount() > 1;
  return !hasBeenDismissedTooManyTimes;
}

// ============================================================
// DEVICE ID (anonymous distinct_id)
// ============================================================

/**
 * Get the anonymous device identifier.
 * Generates a cryptographically random UUID on first call, then persists it.
 * This is NOT linked to any personal identity — it is used only for deduplication.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ============================================================
// EVENT BATCHING + FLUSH
// ============================================================

/**
 * Schedule a flush of pending events after a 100ms debounce.
 * PostHog events are low-frequency; simple debounce is sufficient.
 * The Rust ph_send_batch relay handles durability, retry, and WAL persistence.
 */
function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (pendingEvents.length === 0 || !POSTHOG_KEY) return;

    const batch = pendingEvents.splice(0);

    if (isTauri()) {
      // Route through Rust relay — required in Tauri WebView
      // (posthog-js direct fetch silently drops events in Tauri v2, issue #1760)
      invoke('ph_send_batch', {
        events: batch,
        apiKey: POSTHOG_KEY,
      }).catch(console.warn);
    } else {
      // Web mode: direct fetch to EU endpoint (TELE-07)
      fetch(`${POSTHOG_HOST}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
      }).catch(console.warn);
    }
  }, 100);
}

// ============================================================
// PUBLIC TRACK() API
// ============================================================

/**
 * Track a telemetry event.
 *
 * This is the single public API for all event tracking in the app.
 * Call it at instrumentation points: `track('event_name', { ...properties })`
 *
 * Consent gate: returns immediately (no-op) if consent is not 'granted'.
 * Key gate: returns immediately (no-op) if VITE_POSTHOG_KEY is not set.
 *
 * Super-properties attached to every event: distinct_id, app_version, platform.
 */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  // Consent gate — must be first check
  if (getConsentState() !== 'granted') return;

  // API key gate — graceful degradation in development without key
  if (!POSTHOG_KEY) return;

  pendingEvents.push({
    event,
    properties: {
      // Super-properties (TELE-07)
      distinct_id: getDeviceId(),
      app_version: APP_VERSION,
      platform: isTauri() ? 'desktop' : 'web',
      // Caller-provided properties (may override super-props if needed)
      ...properties,
    },
    timestamp: new Date().toISOString(),
  });

  scheduleFlush();
}

// ============================================================
// ERROR TRACKING (anonymous unhandled errors)
// ============================================================

/**
 * Error severity policy:
 * - console.error: User-visible failures that degrade functionality (e.g., screenshot failed, file save failed)
 * - console.warn: Best-effort background operations where silent failure is acceptable (e.g., telemetry flush, analytics)
 *
 * Telemetry operations intentionally use console.warn — telemetry is non-critical
 * and must never block or alarm users. See PRIVACY.md for data handling details.
 */

/**
 * Register global error handlers to capture anonymous unhandled errors.
 * Called from initTelemetry(). Handlers check consent before firing track().
 *
 * Privacy: Only the first MAX_ERROR_MESSAGE_CHARS chars of the error message are captured.
 * No stack traces (could contain file paths or PII).
 */
function setupErrorTracking(): void {
  if (errorTrackingSetUp) return;
  errorTrackingSetUp = true;

  window.addEventListener('unhandledrejection', (event) => {
    if (getConsentState() !== 'granted') return;
    const message =
      event.reason instanceof Error
        ? event.reason.message.slice(0, MAX_ERROR_MESSAGE_CHARS)
        : String(event.reason).slice(0, MAX_ERROR_MESSAGE_CHARS);
    track('error_unhandled', { error_message: message });
  });

  window.addEventListener('error', (event) => {
    if (getConsentState() !== 'granted') return;
    track('error_unhandled', {
      error_message: event.message?.slice(0, MAX_ERROR_MESSAGE_CHARS) ?? 'unknown',
    });
  });
}

// ============================================================
// LIFECYCLE
// ============================================================

/**
 * Initialize telemetry.
 *
 * Call this:
 * - From App.tsx useEffect when consent is already 'granted' on startup
 * - From the consent dialog's onAccept handler immediately after setConsentState('granted')
 *
 * This function is safe to call multiple times (idempotent — module-level guard
 * prevents duplicate error tracking listeners).
 * For Approach B, no external SDK needs initialization.
 */
export function initTelemetry(): void {
  if (getConsentState() !== 'granted') return;
  setupErrorTracking();
}

// shutdownTelemetry removed (DEAD-004): Rust-side WAL persistence in telemetry.rs
// ensures events survive app quit without explicit JS-side shutdown. If needed in
// the future, wire to window 'beforeunload' or Tauri 'close-requested' event.
