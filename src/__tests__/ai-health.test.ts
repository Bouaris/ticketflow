/**
 * AI Health Module Tests — TCOV-04
 *
 * Tests for src/lib/ai-health.ts:
 * - testProviderHealth: 5-type error classification (auth, rate_limit, timeout, network, unknown)
 * - Success path with latencyMs
 * - Telemetry tracking (track() called for every outcome)
 * - Cleanup in finally block (clearControllerTimeout always called)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ============================================================
// MOCKS (hoisted by Vitest — must be at top level)
// ============================================================

vi.mock('../lib/ai', () => ({
  testProviderConnection: vi.fn(),
}));

vi.mock('../lib/telemetry', () => ({
  track: vi.fn(),
}));

vi.mock('../lib/abort', () => ({
  createTimeoutController: vi.fn(() => {
    const controller = new AbortController();
    // Attach a mock _timeoutId for clearControllerTimeout
    (controller as AbortController & { _timeoutId?: number })._timeoutId = 123;
    return controller;
  }),
  clearControllerTimeout: vi.fn(),
  // isAbortError: actually checks DOMException + AbortError name so timeout test works
  isAbortError: vi.fn((err: unknown) =>
    err instanceof DOMException && (err as DOMException).name === 'AbortError'
  ),
}));

// ============================================================
// IMPORTS (after mocks)
// ============================================================

import { testProviderHealth } from '../lib/ai-health';
import { testProviderConnection } from '../lib/ai';
import { track } from '../lib/telemetry';
import { clearControllerTimeout } from '../lib/abort';

// ============================================================
// SUITE: testProviderHealth — Error Classification
// ============================================================

describe('testProviderHealth — Error Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. returns success with latencyMs on healthy provider', async () => {
    vi.mocked(testProviderConnection).mockResolvedValue(undefined);

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.errorType).toBeUndefined();
  });

  test('2. classifies 401 error as auth', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('401 Unauthorized'));

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('auth');
    expect(result.error).toBe('Invalid API key');
  });

  test('3. classifies 403 error as auth', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('403 Forbidden'));

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('auth');
  });

  test('4. classifies "invalid api key" error as auth', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(
      new Error('invalid api key provided')
    );

    const result = await testProviderHealth('groq');

    expect(result.errorType).toBe('auth');
  });

  test('5. classifies 429 error as rate_limit', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(
      new Error('429 rate limit exceeded')
    );

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('rate_limit');
    expect(result.error).toBe('Rate limit reached');
  });

  test('6. classifies resource exhausted as rate_limit', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(
      new Error('resource exhausted')
    );

    const result = await testProviderHealth('gemini');

    expect(result.errorType).toBe('rate_limit');
  });

  test('7. classifies AbortError as timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(testProviderConnection).mockRejectedValue(abortError);

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('timeout');
    expect(result.error).toBe('Connection timeout');
  });

  test('8. classifies ECONNREFUSED as network', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('network');
    expect(result.error).toBe('Network error');
  });

  test('9. classifies ENOTFOUND as network', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('ENOTFOUND'));

    const result = await testProviderHealth('groq');

    expect(result.errorType).toBe('network');
  });

  test('10. classifies fetch error as network', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('fetch failed'));

    const result = await testProviderHealth('groq');

    expect(result.errorType).toBe('network');
  });

  test('11. classifies unrecognized error as unknown', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(
      new Error('Something completely unexpected')
    );

    const result = await testProviderHealth('groq');

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('unknown');
    expect(result.error).toContain('Something completely unexpected');
  });

  test('12. calls track() for success outcome with correct event name', async () => {
    vi.mocked(testProviderConnection).mockResolvedValue(undefined);

    await testProviderHealth('groq');

    expect(vi.mocked(track)).toHaveBeenCalledWith(
      'ai_health_check_run',
      expect.objectContaining({ success: true })
    );
  });

  test('12b. calls track() for error outcome with success: false', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('401 Unauthorized'));

    await testProviderHealth('groq');

    expect(vi.mocked(track)).toHaveBeenCalledWith(
      'ai_health_check_run',
      expect.objectContaining({ success: false })
    );
  });

  test('13. always calls clearControllerTimeout in finally block', async () => {
    vi.mocked(testProviderConnection).mockResolvedValue(undefined);

    await testProviderHealth('groq');

    expect(vi.mocked(clearControllerTimeout)).toHaveBeenCalledTimes(1);
  });

  test('13b. calls clearControllerTimeout even when connection throws', async () => {
    vi.mocked(testProviderConnection).mockRejectedValue(new Error('network error'));

    await testProviderHealth('groq');

    expect(vi.mocked(clearControllerTimeout)).toHaveBeenCalledTimes(1);
  });
});
