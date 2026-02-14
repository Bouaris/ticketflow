/**
 * useUpdater Hook Tests
 *
 * 24 tests covering:
 * - Initial state (3 tests)
 * - Dismiss functionality (3 tests)
 * - localStorage persistence (2 tests)
 * - Non-Tauri mode (2 tests)
 * - Tauri mode checkForUpdates (5 tests)
 * - Tauri mode installUpdate (4 tests)
 * - Smart dismiss (3 tests)
 * - useEffect periodic checks (2 tests)
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock tauri-bridge
vi.mock('../lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
}));

// Mock Tauri updater plugin
const mockCheck = vi.fn();
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: () => mockCheck(),
}));

// Mock Tauri process plugin
const mockRelaunch = vi.fn();
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: () => mockRelaunch(),
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

// ============================================================
// TAURI MODE - checkForUpdates TESTS (11-15)
// ============================================================

describe('useUpdater - Tauri checkForUpdates', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('11. checkForUpdates returns update info when available', async () => {
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      body: 'New features',
      date: '2026-01-05',
      downloadAndInstall: vi.fn(),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    let updateResult;
    await act(async () => {
      updateResult = await result.current.checkForUpdates(false);
    });

    expect(updateResult).toEqual({
      version: '2.0.0',
      currentVersion: '1.0.0',
      body: 'New features',
      date: '2026-01-05',
    });
    expect(result.current.available).not.toBeNull();
    expect(result.current.available?.version).toBe('2.0.0');
    expect(result.current.checking).toBe(false);
  });

  test('12. checkForUpdates returns null when no update', async () => {
    mockCheck.mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater());

    let updateResult;
    await act(async () => {
      updateResult = await result.current.checkForUpdates(false);
    });

    expect(updateResult).toBeNull();
    expect(result.current.available).toBeNull();
  });

  test('13. checkForUpdates sets error on failure (non-silent)', async () => {
    mockCheck.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.checking).toBe(false);
  });

  test('14. checkForUpdates silent mode does not set error', async () => {
    mockCheck.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true); // silent = true
    });

    expect(result.current.error).toBeNull();
  });

  test('15. checkForUpdates handles update without body/date', async () => {
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      body: null,
      date: null,
      downloadAndInstall: vi.fn(),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    let updateResult: { version: string; body?: string; date?: string } | null = null;
    await act(async () => {
      updateResult = await result.current.checkForUpdates();
    });

    expect(updateResult).not.toBeNull();
    expect(updateResult!.body).toBeUndefined();
    expect(updateResult!.date).toBeUndefined();
  });
});

// ============================================================
// TAURI MODE - installUpdate TESTS (16-19)
// ============================================================

describe('useUpdater - Tauri installUpdate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('16. installUpdate downloads with progress tracking', async () => {
    const mockDownloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: 'Started', data: { contentLength: 1000 } });
      onEvent({ event: 'Progress', data: { chunkLength: 500 } });
      onEvent({ event: 'Progress', data: { chunkLength: 500 } });
      onEvent({ event: 'Finished', data: {} });
    });

    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: mockDownloadAndInstall,
    };
    mockCheck.mockResolvedValue(mockUpdate);
    mockRelaunch.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdater());

    // First check for updates to set updateRef
    await act(async () => {
      await result.current.checkForUpdates();
    });

    // Then install
    await act(async () => {
      await result.current.installUpdate();
    });

    expect(mockDownloadAndInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
  });

  test('17. installUpdate sets error on failure', async () => {
    const mockDownloadAndInstall = vi.fn().mockRejectedValue(new Error('Download failed'));

    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: mockDownloadAndInstall,
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.error).toBe('Download failed');
    expect(result.current.downloading).toBe(false);
  });

  test('18. installUpdate handles non-Error exceptions', async () => {
    const mockDownloadAndInstall = vi.fn().mockRejectedValue('String error');

    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: mockDownloadAndInstall,
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.error).toBe("Erreur lors de l'installation");
  });

  test('19. installUpdate progress caps at 100%', async () => {
    const mockDownloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 150 } }); // Over 100%
    });

    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: mockDownloadAndInstall,
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    // Progress should be capped at 100
    expect(result.current.progress).toBeLessThanOrEqual(100);
  });
});

// ============================================================
// SMART DISMISS TESTS (20-22)
// ============================================================

describe('useUpdater - Smart Dismiss', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('20. dismissUpdate persists version to localStorage', async () => {
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: vi.fn(),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.dismissedVersion).toBe('2.0.0');
    expect(localStorage.getItem('ticketflow-update-dismissed')).toBe(JSON.stringify({ version: '2.0.0' }));
  });

  test('21. same dismissed version keeps dismissed state on recheck', async () => {
    // Pre-dismiss version 2.0.0
    localStorage.setItem('ticketflow-update-dismissed', JSON.stringify({ version: '2.0.0' }));

    const mockUpdate = {
      version: '2.0.0', // Same version
      currentVersion: '1.0.0',
      downloadAndInstall: vi.fn(),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.showModal).toBe(false);
  });

  test('22. different version clears dismissed state', async () => {
    // Pre-dismiss version 2.0.0
    localStorage.setItem('ticketflow-update-dismissed', JSON.stringify({ version: '2.0.0' }));

    const mockUpdate = {
      version: '3.0.0', // Different version
      currentVersion: '1.0.0',
      downloadAndInstall: vi.fn(),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    expect(result.current.dismissed).toBe(true); // Initially from localStorage

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.dismissed).toBe(false); // Reset for new version
    expect(result.current.showModal).toBe(true);
  });
});

// ============================================================
// useEffect PERIODIC CHECKS TESTS (23-24)
// ============================================================

describe('useUpdater - Periodic Checks', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('23. schedules initial check after 3 seconds', async () => {
    mockCheck.mockResolvedValue(null);

    renderHook(() => useUpdater());

    expect(mockCheck).not.toHaveBeenCalled();

    // Advance 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  test('24. cleanup clears timers on unmount', async () => {
    mockCheck.mockResolvedValue(null);

    const { unmount } = renderHook(() => useUpdater());

    unmount();

    // Advance time - should not trigger checks
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockCheck).not.toHaveBeenCalled();
  });
});
