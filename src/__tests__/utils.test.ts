/**
 * Utils Module Tests
 *
 * Tests for utility functions:
 * - throttle (3 tests)
 * - debounce (3 tests)
 * - hexToRgba (4 tests)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle, debounce, hexToRgba } from '../lib/utils';

// ============================================================
// THROTTLE TESTS (1-3)
// ============================================================

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('1. executes immediately on first call', () => {
    const fn = vi.fn(() => 'result');
    const throttled = throttle(fn, 100);

    const result = throttled();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
  });

  test('2. blocks calls within wait period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('3. allows call after wait period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// DEBOUNCE TESTS (4-6)
// ============================================================

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('4. delays execution until after wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('5. resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('6. passes arguments to debounced function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

// ============================================================
// HEX TO RGBA TESTS (7-10)
// ============================================================

describe('hexToRgba', () => {
  test('7. converts long hex format (#RRGGBB)', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    expect(hexToRgba('#0000ff', 0)).toBe('rgba(0, 0, 255, 0)');
  });

  test('8. converts short hex format (#RGB)', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('#0f0', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    expect(hexToRgba('#00f', 0.25)).toBe('rgba(0, 0, 255, 0.25)');
  });

  test('9. handles white and black', () => {
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#fff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
    expect(hexToRgba('#000', 0.2)).toBe('rgba(0, 0, 0, 0.2)');
  });

  test('10. handles mixed colors', () => {
    expect(hexToRgba('#ef4444', 0.5)).toBe('rgba(239, 68, 68, 0.5)');
    expect(hexToRgba('#3b82f6', 0.75)).toBe('rgba(59, 130, 246, 0.75)');
  });
});
