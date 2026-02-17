/**
 * Telemetry Unit Tests — TCOV-05
 *
 * Tests for src/lib/telemetry.ts consent gate and event firing.
 *
 * Coverage scenarios:
 * 1. track() is a no-op before consent is granted
 * 2. track() fires after consent is granted
 * 3. track() stops after consent is revoked
 * 4. shouldPromptConsent() returns true on first launch
 * 5. shouldPromptConsent() returns true after one dismiss (re-prompt once)
 * 6. shouldPromptConsent() returns false after two dismisses (permanent decline)
 * 7. shouldPromptConsent() returns false when consent already granted
 * 8. getDeviceId() generates and persists a UUID
 * 9. track() batches multiple events in a single flush
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// MOCK: @tauri-apps/api/core — intercept invoke() for assertions
// ============================================================

// We mock at module level so that telemetry.ts picks up the spy invoke
// when dynamically imported in each test.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve({ sent: 1, queued: 0 })),
}));

// ============================================================
// MOCK: import.meta.env.VITE_POSTHOG_KEY
// ============================================================

// Stub the env variable so track() doesn't short-circuit on missing key.
vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key_123');

// ============================================================
// HELPERS
// ============================================================

// telemetry is dynamically imported in each test to get fresh module state
// (pendingEvents, flushTimer are module-level — resetModules clears them)
type TelemetryModule = typeof import('../lib/telemetry');

// ============================================================
// TESTS
// ============================================================

describe('Telemetry — Consent Gate', () => {
  let telemetry: TelemetryModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
    // Re-import after resetModules to get fresh module state
    telemetry = await import('../lib/telemetry');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Test 1: track() is a no-op before consent is granted
  // ----------------------------------------------------------
  test('1. track() is a no-op before consent is granted', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);

    // No consent set — state is null
    expect(telemetry.getConsentState()).toBeNull();

    telemetry.track('test_event', { foo: 'bar' });

    // Advance timers past the 100ms debounce
    vi.runAllTimers();
    await Promise.resolve();

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // Test 2: track() fires after consent is granted
  // ----------------------------------------------------------
  test('2. track() fires after consent is granted', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);

    telemetry.setConsentState('granted');
    telemetry.track('test_event', { foo: 'bar' });

    vi.runAllTimers();
    // Flush async microtasks (invoke returns a promise)
    await Promise.resolve();

    expect(mockInvoke).toHaveBeenCalledWith(
      'ph_send_batch',
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            event: 'test_event',
            properties: expect.objectContaining({
              foo: 'bar',
              app_version: expect.any(String),
              platform: expect.any(String),
              distinct_id: expect.any(String),
            }),
            timestamp: expect.any(String),
          }),
        ]),
        apiKey: 'phc_test_key_123',
      }),
    );
  });

  // ----------------------------------------------------------
  // Test 3: track() stops after consent is revoked
  // ----------------------------------------------------------
  test('3. track() stops after consent is revoked', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);

    // Grant then immediately revoke
    telemetry.setConsentState('granted');
    telemetry.setConsentState('declined');

    telemetry.track('should_not_fire');

    vi.runAllTimers();
    await Promise.resolve();

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // Test 4: shouldPromptConsent() returns true on first launch
  // ----------------------------------------------------------
  test('4. shouldPromptConsent() returns true on first launch', () => {
    // No localStorage keys set — fresh first launch
    expect(telemetry.shouldPromptConsent()).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 5: shouldPromptConsent() returns true after one dismiss (re-prompt once)
  // ----------------------------------------------------------
  test('5. shouldPromptConsent() returns true after one dismiss', () => {
    telemetry.incrementDismissCount();
    // dismiss count is 1 — still show (re-prompt once per locked decision)
    expect(telemetry.getDismissCount()).toBe(1);
    expect(telemetry.shouldPromptConsent()).toBe(true);
  });

  // ----------------------------------------------------------
  // Test 6: shouldPromptConsent() returns false after two dismisses
  // ----------------------------------------------------------
  test('6. shouldPromptConsent() returns false after two dismisses', () => {
    telemetry.incrementDismissCount();
    telemetry.incrementDismissCount();
    // dismiss count is 2 — permanent decline (stop showing)
    expect(telemetry.getDismissCount()).toBe(2);
    expect(telemetry.shouldPromptConsent()).toBe(false);
  });

  // ----------------------------------------------------------
  // Test 7: shouldPromptConsent() returns false when consent already granted
  // ----------------------------------------------------------
  test('7. shouldPromptConsent() returns false when consent already granted', () => {
    telemetry.setConsentState('granted');
    expect(telemetry.shouldPromptConsent()).toBe(false);
  });

  // ----------------------------------------------------------
  // Test 8: getDeviceId() generates and persists a UUID
  // ----------------------------------------------------------
  test('8. getDeviceId() generates and persists a UUID', () => {
    const id1 = telemetry.getDeviceId();

    // Should be a valid UUID-like string
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Calling again should return the same value (persisted to localStorage)
    const id2 = telemetry.getDeviceId();
    expect(id2).toBe(id1);
  });

  // ----------------------------------------------------------
  // Test 9: track() batches multiple events in a single flush
  // ----------------------------------------------------------
  test('9. track() batches multiple events in a single flush', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);

    telemetry.setConsentState('granted');

    // Fire 3 events before the 100ms timer fires
    telemetry.track('event_one', { n: 1 });
    telemetry.track('event_two', { n: 2 });
    telemetry.track('event_three', { n: 3 });

    // Advance timers — should batch all 3 in one invoke call
    vi.runAllTimers();
    await Promise.resolve();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const callArgs = mockInvoke.mock.calls[0];
    expect(callArgs[0]).toBe('ph_send_batch');

    const payload = callArgs[1] as { events: unknown[]; apiKey: string };
    expect(payload.events).toHaveLength(3);
    expect(payload.events[0]).toMatchObject({ event: 'event_one' });
    expect(payload.events[1]).toMatchObject({ event: 'event_two' });
    expect(payload.events[2]).toMatchObject({ event: 'event_three' });
  });
});

// ============================================================
// ADDITIONAL: shouldPromptConsent with declined state
// ============================================================

describe('Telemetry — shouldPromptConsent with declined state', () => {
  let telemetry: TelemetryModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    localStorage.clear();
    telemetry = await import('../lib/telemetry');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('10. shouldPromptConsent() returns false when consent is declined', () => {
    telemetry.setConsentState('declined');
    expect(telemetry.shouldPromptConsent()).toBe(false);
  });
});
