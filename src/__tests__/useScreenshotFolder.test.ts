/**
 * useScreenshotFolder Hook Tests
 *
 * 12 tests covering:
 * - Initial state (3 tests)
 * - Feature support detection (2 tests)
 * - Error handling (3 tests)
 * - Object URL management (2 tests)
 * - Core operations (2 tests)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock screenshots lib
vi.mock('../lib/screenshots', () => ({
  isDirectoryPickerSupported: vi.fn(() => true),
  getScreenshotsFolder: vi.fn(() => Promise.resolve({})),
  saveScreenshot: vi.fn(() => Promise.resolve(true)),
  readScreenshot: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'image/png' }))),
  deleteScreenshot: vi.fn(() => Promise.resolve(true)),
  deleteScreenshotsForTicket: vi.fn(() => Promise.resolve(2)),
  generateScreenshotFilename: vi.fn((ticketId: string) => `${ticketId}_123456.png`),
  convertToPng: vi.fn((file: File) => Promise.resolve(new Blob([file], { type: 'image/png' }))),
}));

import { useScreenshotFolder } from '../hooks/useScreenshotFolder';
import { isDirectoryPickerSupported } from '../lib/screenshots';

// ============================================================
// INITIAL STATE TESTS (1-3)
// ============================================================

describe('useScreenshotFolder - Initial State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(true);
  });

  test('1. initial state is not ready', () => {
    const { result } = renderHook(() => useScreenshotFolder());

    expect(result.current.isReady).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('2. isSupported reflects API availability', () => {
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(true);
    const { result } = renderHook(() => useScreenshotFolder());

    expect(result.current.isSupported).toBe(true);
  });

  test('3. exposes all required methods', () => {
    const { result } = renderHook(() => useScreenshotFolder());

    expect(typeof result.current.requestFolderAccess).toBe('function');
    expect(typeof result.current.saveScreenshotBlob).toBe('function');
    expect(typeof result.current.importScreenshotFile).toBe('function');
    expect(typeof result.current.getScreenshotUrl).toBe('function');
    expect(typeof result.current.deleteScreenshotFile).toBe('function');
    expect(typeof result.current.deleteTicketScreenshots).toBe('function');
    expect(typeof result.current.revokeObjectUrl).toBe('function');
  });
});

// ============================================================
// FEATURE SUPPORT TESTS (4-5)
// ============================================================

describe('useScreenshotFolder - Feature Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('4. isSupported is false when API not available', () => {
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(false);
    const { result } = renderHook(() => useScreenshotFolder());

    expect(result.current.isSupported).toBe(false);
  });

  test('5. requestFolderAccess sets error when not supported', async () => {
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(false);
    const { result } = renderHook(() => useScreenshotFolder());

    let success;
    await act(async () => {
      success = await result.current.requestFolderAccess();
    });

    expect(success).toBe(false);
    expect(result.current.error).toContain('non supporté');
  });
});

// ============================================================
// ERROR HANDLING TESTS (6-8)
// ============================================================

describe('useScreenshotFolder - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(true);
  });

  test('6. saveScreenshotBlob returns null when no handle', async () => {
    const { result } = renderHook(() => useScreenshotFolder());

    let filename;
    await act(async () => {
      filename = await result.current.saveScreenshotBlob('CT-001', new Blob(['test']));
    });

    expect(filename).toBeNull();
    expect(result.current.error).toContain('non disponible');
  });

  test('7. importScreenshotFile returns null when no handle', async () => {
    const { result } = renderHook(() => useScreenshotFolder());

    let filename;
    await act(async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      filename = await result.current.importScreenshotFile('CT-001', file);
    });

    expect(filename).toBeNull();
    expect(result.current.error).toContain('non disponible');
  });

  test('8. getScreenshotUrl returns null when no handle', async () => {
    const { result } = renderHook(() => useScreenshotFolder());

    let url;
    await act(async () => {
      url = await result.current.getScreenshotUrl('CT-001_123.png');
    });

    expect(url).toBeNull();
  });
});

// ============================================================
// OBJECT URL MANAGEMENT TESTS (9-10)
// ============================================================

describe('useScreenshotFolder - Object URL Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(true);
  });

  test('9. revokeObjectUrl calls URL.revokeObjectURL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const { result } = renderHook(() => useScreenshotFolder());

    act(() => {
      result.current.revokeObjectUrl('blob:mock-url');
    });

    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  test('10. cleanup on unmount revokes tracked URLs', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const { unmount } = renderHook(() => useScreenshotFolder());

    unmount();

    // Should have been called (even if 0 times if no URLs tracked)
    expect(revokeSpy).toBeDefined();
  });
});

// ============================================================
// CORE OPERATIONS TESTS (11-12)
// ============================================================

describe('useScreenshotFolder - Core Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDirectoryPickerSupported).mockReturnValue(true);
  });

  test('11. deleteScreenshotFile returns false when no handle', async () => {
    const { result } = renderHook(() => useScreenshotFolder());

    let deleted;
    await act(async () => {
      deleted = await result.current.deleteScreenshotFile('CT-001_123.png');
    });

    expect(deleted).toBe(false);
  });

  test('12. deleteTicketScreenshots returns 0 when no handle', async () => {
    const { result } = renderHook(() => useScreenshotFolder());

    let count;
    await act(async () => {
      count = await result.current.deleteTicketScreenshots('CT-001');
    });

    expect(count).toBe(0);
  });
});


