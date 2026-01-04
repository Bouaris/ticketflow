/**
 * useFileAccess Hook Tests
 *
 * 10 tests covering:
 * - Initial state
 * - Mode detection (Tauri vs Web)
 * - isDirty management
 * - closeFile cleanup
 * - Error handling
 *
 * Note: File operations (open, save) require native API mocking.
 * These tests focus on state management and basic logic.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock tauri-bridge before importing the hook
vi.mock('../lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
  openMarkdownFileDialog: vi.fn(),
  saveMarkdownFileDialog: vi.fn(),
  readTextFileContents: vi.fn(),
  writeTextFileContents: vi.fn(),
  getFileNameFromPath: vi.fn((path: string) => path.split('/').pop() || ''),
}));

// Mock fileSystem module
vi.mock('../lib/fileSystem', () => ({
  openMarkdownFile: vi.fn(),
  readFile: vi.fn(),
  saveFile: vi.fn(),
  saveAsMarkdownFile: vi.fn(),
  getFileName: vi.fn((handle: { name: string }) => handle?.name || ''),
  isFileSystemAccessSupported: vi.fn(() => false),
  storeHandle: vi.fn(),
  getStoredHandle: vi.fn(() => Promise.resolve(null)),
  verifyPermission: vi.fn(),
  clearStoredHandle: vi.fn(),
}));

import { useFileAccess } from '../hooks/useFileAccess';
import { isTauri } from '../lib/tauri-bridge';
import { isFileSystemAccessSupported } from '../lib/fileSystem';

// ============================================================
// INITIAL STATE TESTS (1-3)
// ============================================================

describe('useFileAccess - Initial State', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('1. fileName is null initially', () => {
    const { result } = renderHook(() => useFileAccess());
    expect(result.current.fileName).toBeNull();
  });

  test('2. fileHandle is null initially', () => {
    const { result } = renderHook(() => useFileAccess());
    expect(result.current.fileHandle).toBeNull();
  });

  test('3. content is null and isDirty is false initially', () => {
    const { result } = renderHook(() => useFileAccess());
    expect(result.current.content).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ============================================================
// MODE DETECTION TESTS (4-5)
// ============================================================

describe('useFileAccess - Mode Detection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('4. detects web mode when isTauri returns false', () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useFileAccess());

    expect(result.current.isTauriMode).toBe(false);
  });

  test('5. isSupported reflects File System Access API availability', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);

    const { result } = renderHook(() => useFileAccess());

    expect(result.current.isSupported).toBe(true);
  });
});

// ============================================================
// DIRTY STATE TESTS (6-7)
// ============================================================

describe('useFileAccess - Dirty State', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('6. setDirty updates isDirty state', () => {
    const { result } = renderHook(() => useFileAccess());

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setDirty(true);
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.setDirty(false);
    });

    expect(result.current.isDirty).toBe(false);
  });

  test('7. setDirty is stable (same reference across renders)', () => {
    const { result, rerender } = renderHook(() => useFileAccess());

    const setDirtyRef = result.current.setDirty;
    rerender();

    expect(result.current.setDirty).toBe(setDirtyRef);
  });
});

// ============================================================
// CLOSE FILE TESTS (8-9)
// ============================================================

describe('useFileAccess - Close File', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('8. closeFile resets all state', async () => {
    const { result } = renderHook(() => useFileAccess());

    // Manually set dirty to verify it gets reset
    act(() => {
      result.current.setDirty(true);
    });

    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      result.current.closeFile();
    });

    expect(result.current.fileName).toBeNull();
    expect(result.current.fileHandle).toBeNull();
    expect(result.current.filePath).toBeNull();
    expect(result.current.content).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('9. closeFile clears localStorage in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    localStorage.setItem('ticketflow-last-file', '/path/to/file.md');

    const { result } = renderHook(() => useFileAccess());

    await act(async () => {
      result.current.closeFile();
    });

    expect(localStorage.getItem('ticketflow-last-file')).toBeNull();
  });
});

// ============================================================
// STORED HANDLE DETECTION TEST (10)
// ============================================================

describe('useFileAccess - Stored Handle Detection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('10. hasStoredHandle is true when localStorage has last file (Tauri mode)', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    localStorage.setItem('ticketflow-last-file', '/path/to/file.md');

    const { result } = renderHook(() => useFileAccess());

    // Wait for useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.hasStoredHandle).toBe(true);
  });
});
