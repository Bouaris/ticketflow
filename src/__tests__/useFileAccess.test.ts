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

// ============================================================
// TAURI MODE TESTS (11-16)
// ============================================================

import {
  readTextFileContents,
  writeTextFileContents,
  saveMarkdownFileDialog,
} from '../lib/tauri-bridge';

describe('useFileAccess - Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('11. loadFromPath loads file and updates state', async () => {
    const mockContent = '# Test Backlog\n\n## 1. BUGS\n\n---';
    vi.mocked(readTextFileContents).mockResolvedValue(mockContent);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadFromPath('/path/to/BACKLOG.md');
    });

    expect(content).toBe(mockContent);
    expect(result.current.content).toBe(mockContent);
    expect(result.current.filePath).toBe('/path/to/BACKLOG.md');
    expect(result.current.fileName).toBe('BACKLOG.md');
    expect(result.current.isDirty).toBe(false);
  });

  test('12. loadFromPath sets error on failure', async () => {
    vi.mocked(readTextFileContents).mockRejectedValue(new Error('File not found'));

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadFromPath('/nonexistent.md');
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('File not found');
  });

  test('13. loadFromPath returns null in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadFromPath('/path/file.md');
    });

    expect(content).toBeNull();
    expect(result.current.error).toContain('version desktop');
  });

  test('14. save writes to file and clears dirty flag', async () => {
    vi.mocked(readTextFileContents).mockResolvedValue('# Original');
    vi.mocked(writeTextFileContents).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    // First load a file
    await act(async () => {
      await result.current.loadFromPath('/path/BACKLOG.md');
    });

    // Mark as dirty
    act(() => {
      result.current.setDirty(true);
    });
    expect(result.current.isDirty).toBe(true);

    // Save
    let success;
    await act(async () => {
      success = await result.current.save('# Updated Content');
    });

    expect(success).toBe(true);
    expect(vi.mocked(writeTextFileContents)).toHaveBeenCalledWith('/path/BACKLOG.md', '# Updated Content');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.content).toBe('# Updated Content');
  });

  test('15. save returns false when no file is open', async () => {
    const { result } = renderHook(() => useFileAccess());

    let success;
    await act(async () => {
      success = await result.current.save('# Content');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('No file open');
  });

  test('16. saveAs opens dialog and saves to new path', async () => {
    vi.mocked(saveMarkdownFileDialog).mockResolvedValue('/new/path/NEWFILE.md');
    vi.mocked(writeTextFileContents).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    let success;
    await act(async () => {
      success = await result.current.saveAs('# New Content', 'NEWFILE.md');
    });

    expect(success).toBe(true);
    expect(vi.mocked(saveMarkdownFileDialog)).toHaveBeenCalledWith('NEWFILE.md');
    expect(vi.mocked(writeTextFileContents)).toHaveBeenCalledWith('/new/path/NEWFILE.md', '# New Content');
    expect(result.current.filePath).toBe('/new/path/NEWFILE.md');
    expect(result.current.fileName).toBe('NEWFILE.md');
    expect(localStorage.getItem('ticketflow-last-file')).toBe('/new/path/NEWFILE.md');
  });
});

// ============================================================
// TAURI OPENFILE TESTS (17-19)
// ============================================================

import { openMarkdownFileDialog } from '../lib/tauri-bridge';

describe('useFileAccess - Tauri openFile', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('17. openFile returns null when dialog is cancelled', async () => {
    vi.mocked(openMarkdownFileDialog).mockResolvedValue(null);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('18. openFile loads file and stores path in localStorage', async () => {
    vi.mocked(openMarkdownFileDialog).mockResolvedValue('/path/to/BACKLOG.md');
    vi.mocked(readTextFileContents).mockResolvedValue('# Test Content');

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBe('# Test Content');
    expect(result.current.content).toBe('# Test Content');
    expect(result.current.filePath).toBe('/path/to/BACKLOG.md');
    expect(result.current.fileName).toBe('BACKLOG.md');
    expect(result.current.isDirty).toBe(false);
    expect(localStorage.getItem('ticketflow-last-file')).toBe('/path/to/BACKLOG.md');
  });

  test('19. openFile sets error on failure', async () => {
    vi.mocked(openMarkdownFileDialog).mockRejectedValue(new Error('Dialog error'));

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Dialog error');
    expect(result.current.isLoading).toBe(false);
  });
});

// ============================================================
// TAURI LOADSTOREDFILE TESTS (20-23)
// ============================================================

describe('useFileAccess - Tauri loadStoredFile', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('20. loadStoredFile returns null when no stored path', async () => {
    // No localStorage item set
    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
    expect(result.current.hasStoredHandle).toBe(false);
  });

  test('21. loadStoredFile loads from stored path', async () => {
    localStorage.setItem('ticketflow-last-file', '/stored/path/FILE.md');
    vi.mocked(readTextFileContents).mockResolvedValue('# Stored Content');

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBe('# Stored Content');
    expect(result.current.filePath).toBe('/stored/path/FILE.md');
    expect(result.current.fileName).toBe('FILE.md');
    expect(result.current.isDirty).toBe(false);
  });

  test('22. loadStoredFile clears localStorage on error', async () => {
    localStorage.setItem('ticketflow-last-file', '/invalid/path.md');
    vi.mocked(readTextFileContents).mockRejectedValue(new Error('File not found'));

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('File not found');
    expect(localStorage.getItem('ticketflow-last-file')).toBeNull();
    expect(result.current.hasStoredHandle).toBe(false);
  });

  test('23. loadStoredFile returns null when not supported', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(false);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
  });
});

// ============================================================
// WEB OPENFILE TESTS (24-26)
// ============================================================

import {
  openMarkdownFile,
  readFile,
  storeHandle,
  getStoredHandle,
  verifyPermission,
  clearStoredHandle,
  saveFile,
  saveAsMarkdownFile,
} from '../lib/fileSystem';

describe('useFileAccess - Web openFile', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
  });

  test('24. openFile returns null when dialog is cancelled (Web)', async () => {
    vi.mocked(openMarkdownFile).mockResolvedValue(null);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('25. openFile loads file and stores handle (Web)', async () => {
    const mockHandle = { name: 'WEBFILE.md' } as FileSystemFileHandle;
    vi.mocked(openMarkdownFile).mockResolvedValue(mockHandle);
    vi.mocked(readFile).mockResolvedValue('# Web Content');
    vi.mocked(storeHandle).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBe('# Web Content');
    expect(result.current.content).toBe('# Web Content');
    expect(result.current.fileHandle).toBe(mockHandle);
    expect(result.current.fileName).toBe('WEBFILE.md');
    expect(result.current.isDirty).toBe(false);
    expect(vi.mocked(storeHandle)).toHaveBeenCalledWith(mockHandle);
  });

  test('26. openFile sets error on failure (Web)', async () => {
    vi.mocked(openMarkdownFile).mockRejectedValue(new Error('User aborted'));

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.openFile();
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('User aborted');
    expect(result.current.isLoading).toBe(false);
  });
});

// ============================================================
// WEB LOADSTOREDFILE TESTS (27-30)
// ============================================================

describe('useFileAccess - Web loadStoredFile', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
  });

  test('27. loadStoredFile returns null when no stored handle (Web)', async () => {
    vi.mocked(getStoredHandle).mockResolvedValue(null);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
    expect(result.current.hasStoredHandle).toBe(false);
  });

  test('28. loadStoredFile returns null when permission denied (Web)', async () => {
    const mockHandle = { name: 'STORED.md' } as FileSystemFileHandle;
    vi.mocked(getStoredHandle).mockResolvedValue(mockHandle);
    vi.mocked(verifyPermission).mockResolvedValue(false);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Permission refusée pour accéder au fichier');
  });

  test('29. loadStoredFile loads from stored handle (Web)', async () => {
    const mockHandle = { name: 'STORED.md' } as FileSystemFileHandle;
    vi.mocked(getStoredHandle).mockResolvedValue(mockHandle);
    vi.mocked(verifyPermission).mockResolvedValue(true);
    vi.mocked(readFile).mockResolvedValue('# Stored Web Content');

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBe('# Stored Web Content');
    expect(result.current.fileHandle).toBe(mockHandle);
    expect(result.current.fileName).toBe('STORED.md');
    expect(result.current.isDirty).toBe(false);
  });

  test('30. loadStoredFile clears handle on error (Web)', async () => {
    const mockHandle = { name: 'BROKEN.md' } as FileSystemFileHandle;
    vi.mocked(getStoredHandle).mockResolvedValue(mockHandle);
    vi.mocked(verifyPermission).mockResolvedValue(true);
    vi.mocked(readFile).mockRejectedValue(new Error('Read error'));
    vi.mocked(clearStoredHandle).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    let content;
    await act(async () => {
      content = await result.current.loadStoredFile();
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Read error');
    expect(vi.mocked(clearStoredHandle)).toHaveBeenCalled();
    expect(result.current.hasStoredHandle).toBe(false);
  });
});

// ============================================================
// WEB SAVE/SAVEAS TESTS (31-34)
// ============================================================

describe('useFileAccess - Web save/saveAs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
  });

  test('31. save returns false when no file open (Web)', async () => {
    const { result } = renderHook(() => useFileAccess());

    let success;
    await act(async () => {
      success = await result.current.save('# Content');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('No file open');
  });

  test('32. save writes to file handle (Web)', async () => {
    const mockHandle = { name: 'WEBFILE.md' } as FileSystemFileHandle;
    vi.mocked(openMarkdownFile).mockResolvedValue(mockHandle);
    vi.mocked(readFile).mockResolvedValue('# Original');
    vi.mocked(storeHandle).mockResolvedValue(undefined);
    vi.mocked(saveFile).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    // First open a file
    await act(async () => {
      await result.current.openFile();
    });

    // Mark dirty and save
    act(() => {
      result.current.setDirty(true);
    });

    let success;
    await act(async () => {
      success = await result.current.save('# Updated Web Content');
    });

    expect(success).toBe(true);
    expect(vi.mocked(saveFile)).toHaveBeenCalledWith(mockHandle, '# Updated Web Content');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.content).toBe('# Updated Web Content');
  });

  test('33. saveAs opens dialog and saves (Web)', async () => {
    const mockHandle = { name: 'NEWWEB.md' } as FileSystemFileHandle;
    vi.mocked(saveAsMarkdownFile).mockResolvedValue(mockHandle);
    vi.mocked(storeHandle).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    let success;
    await act(async () => {
      success = await result.current.saveAs('# New Web Content', 'NEWWEB.md');
    });

    expect(success).toBe(true);
    expect(vi.mocked(saveAsMarkdownFile)).toHaveBeenCalledWith('# New Web Content', 'NEWWEB.md');
    expect(result.current.fileHandle).toBe(mockHandle);
    expect(result.current.fileName).toBe('NEWWEB.md');
    expect(vi.mocked(storeHandle)).toHaveBeenCalledWith(mockHandle);
  });

  test('34. saveAs returns false when cancelled (Web)', async () => {
    vi.mocked(saveAsMarkdownFile).mockResolvedValue(null);

    const { result } = renderHook(() => useFileAccess());

    let success;
    await act(async () => {
      success = await result.current.saveAs('# Content', 'FILE.md');
    });

    expect(success).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

// ============================================================
// CLOSE FILE WEB MODE (35)
// ============================================================

describe('useFileAccess - Close File Web', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
  });

  test('35. closeFile clears handle in Web mode', async () => {
    vi.mocked(clearStoredHandle).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileAccess());

    await act(async () => {
      result.current.closeFile();
    });

    expect(vi.mocked(clearStoredHandle)).toHaveBeenCalled();
    expect(result.current.fileHandle).toBeNull();
  });
});

// ============================================================
// USEEFFECT WEB MODE (36)
// ============================================================

describe('useFileAccess - useEffect Web Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('36. detects stored handle in Web mode on mount', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(isFileSystemAccessSupported).mockReturnValue(true);
    const mockHandle = { name: 'STORED.md' } as FileSystemFileHandle;
    vi.mocked(getStoredHandle).mockResolvedValue(mockHandle);

    const { result } = renderHook(() => useFileAccess());

    // Wait for useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.hasStoredHandle).toBe(true);
  });
});
