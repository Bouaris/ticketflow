/**
 * Utility Functions
 *
 * Shared helper functions used across the application.
 */

// ============================================================
// FUNCTION UTILITIES
// ============================================================

/**
 * Creates a throttled function that only invokes the provided function at most once per wait period.
 * Unlike debounce, throttle guarantees the function executes at regular intervals.
 *
 * @param fn The function to throttle
 * @param wait Minimum time between invocations in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      return fn(...args);
    }
    return undefined;
  };
}

/**
 * Creates a debounced function that delays invoking the provided function until after
 * wait milliseconds have elapsed since the last time it was invoked.
 *
 * @param fn The function to debounce
 * @param wait Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };
}

// ============================================================
// COLOR UTILITIES
// ============================================================

/**
 * Convert hex color to rgba with alpha transparency.
 * Supports both #RGB and #RRGGBB formats.
 *
 * @param hex Hex color string (e.g., "#ff0000" or "#f00")
 * @param alpha Opacity value between 0 and 1
 * @returns RGBA color string (e.g., "rgba(255, 0, 0, 0.5)")
 */
export function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0;

  if (hex.length === 4) {
    // Short format: #RGB
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    // Long format: #RRGGBB
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
