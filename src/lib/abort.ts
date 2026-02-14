/**
 * AbortController utilities for async operation cancellation.
 *
 * Provides standardized patterns for:
 * - Creating abort controllers with cleanup
 * - Detecting abort errors (vs real errors)
 * - Timeout-based abort signals
 *
 * @module lib/abort
 */

/**
 * Check if an error is an AbortError (cancelled operation).
 * Use this to silently ignore cancellation vs showing error to user.
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.code === 20)
  );
}

/**
 * Create an AbortController that automatically aborts after timeout.
 * Useful for preventing indefinitely hanging requests.
 *
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs = 30000): AbortController {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Store timeout ID for potential cleanup
  (controller as AbortController & { _timeoutId?: ReturnType<typeof setTimeout> })._timeoutId = timeoutId;

  return controller;
}

/**
 * Clear timeout associated with a timeout controller.
 * Call this when operation completes before timeout.
 */
export function clearControllerTimeout(controller: AbortController): void {
  const timeoutId = (controller as AbortController & { _timeoutId?: ReturnType<typeof setTimeout> })._timeoutId;
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a linked abort controller that aborts when ANY of the source signals abort.
 * Useful for combining user cancellation + timeout.
 *
 * @param signals - Source signals to link
 * @returns New controller that aborts when any source aborts
 */
export function linkAbortSignals(...signals: (AbortSignal | undefined)[]): AbortController {
  const controller = new AbortController();

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller;
}
