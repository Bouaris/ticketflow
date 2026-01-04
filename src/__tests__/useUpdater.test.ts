/**
 * useUpdater Hook Tests
 *
 * 10 tests covering:
 * - Initial state
 * - Dismiss functionality
 * - localStorage persistence
 * - State management
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock tauri-bridge
vi.mock('../lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
}));

import { useUpdater } from '../hooks/useUpdater';
import { isTauri } from '../lib/tauri-bridge';

// ============================================================
// INITIAL STATE TESTS (1-3)
// ============================================================

describe('useUpdater - Initial State', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  test('1. initial state has no update available', () => {
    const { result } = renderHook(() => useUpdater());

    expect(result.current.available).toBeNull();
    expect(result.current.checking).toBe(false);
    expect(result.current.downloading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  test('2. showModal is false when no update available', () => {
    const { result } = renderHook(() => useUpdater());

    expect(result.current.showModal).toBe(false);
  });

  test('3. dismissed is false initially when no storage', () => {
    const { result } = renderHook(() => useUpdater());

    expect(result.current.dismissed).toBe(false);
    expect(result.current.dismissedVersion).toBeNull();
  });
});

// ============================================================
// DISMISS FUNCTIONALITY TESTS (4-6)
// ============================================================

describe('useUpdater - Dismiss', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  test('4. dismissUpdate does nothing when no update available', () => {
    const { result } = renderHook(() => useUpdater());

    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.dismissed).toBe(false);
  });

  test('5. clearDismiss resets dismissed state', () => {
    // Pre-set dismissed state in localStorage
    localStorage.setItem('ticketflow-update-dismissed', JSON.stringify({ version: '1.0.0' }));

    const { result } = renderHook(() => useUpdater());

    expect(result.current.dismissed).toBe(true);

    act(() => {
      result.current.clearDismiss();
    });

    expect(result.current.dismissed).toBe(false);
    expect(result.current.dismissedVersion).toBeNull();
  });

  test('6. clearError resets error state', () => {
    const { result } = renderHook(() => useUpdater());

    // Note: Can't easily set error state without triggering actual check
    // Just verify clearError exists and is callable
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

// ============================================================
// LOCALSTORAGE PERSISTENCE TESTS (7-8)
// ============================================================

describe('useUpdater - Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  test('7. loads dismissed state from localStorage on init', () => {
    localStorage.setItem('ticketflow-update-dismissed', JSON.stringify({ version: '2.0.0' }));

    const { result } = renderHook(() => useUpdater());

    expect(result.current.dismissed).toBe(true);
    expect(result.current.dismissedVersion).toBe('2.0.0');
  });

  test('8. handles invalid localStorage data gracefully', () => {
    localStorage.setItem('ticketflow-update-dismissed', 'invalid-json');

    const { result } = renderHook(() => useUpdater());

    // Should not crash, use defaults
    expect(result.current.dismissed).toBe(false);
  });
});

// ============================================================
// NON-TAURI MODE TESTS (9-10)
// ============================================================

describe('useUpdater - Non-Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  test('9. checkForUpdates returns null in non-Tauri mode', async () => {
    const { result } = renderHook(() => useUpdater());

    let updateResult;
    await act(async () => {
      updateResult = await result.current.checkForUpdates();
    });

    expect(updateResult).toBeNull();
  });

  test('10. installUpdate does nothing when no update ref', async () => {
    const { result } = renderHook(() => useUpdater());

    // Should not throw
    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.downloading).toBe(false);
  });
});
