/**
 * Tauri Bridge Pure Functions Tests
 *
 * 16 tests covering path manipulation functions:
 * - getFileNameFromPath (4 tests)
 * - getDirFromPath (4 tests)
 * - getFolderName (4 tests)
 * - joinPath (4 tests)
 */

import { describe, test, expect } from 'vitest';
import {
  getFileNameFromPath,
  getDirFromPath,
  getFolderName,
  joinPath,
} from '../lib/tauri-bridge';

// ============================================================
// getFileNameFromPath TESTS (1-4)
// ============================================================

describe('getFileNameFromPath', () => {
  test('1. extracts filename from Unix path', () => {
    expect(getFileNameFromPath('/home/user/docs/BACKLOG.md')).toBe('BACKLOG.md');
  });

  test('2. extracts filename from Windows path', () => {
    expect(getFileNameFromPath('D:\\Projects\\ticketflow\\BACKLOG.md')).toBe('BACKLOG.md');
  });

  test('3. handles mixed separators', () => {
    expect(getFileNameFromPath('D:/Projects\\docs/file.md')).toBe('file.md');
  });

  test('4. returns empty string for empty path', () => {
    expect(getFileNameFromPath('')).toBe('');
  });
});

// ============================================================
// getDirFromPath TESTS (5-8)
// ============================================================

describe('getDirFromPath', () => {
  test('5. extracts directory from Unix path', () => {
    expect(getDirFromPath('/home/user/docs/BACKLOG.md')).toBe('/home/user/docs');
  });

  test('6. extracts directory from Windows path', () => {
    expect(getDirFromPath('D:\\Projects\\ticketflow\\BACKLOG.md')).toBe('D:/Projects/ticketflow');
  });

  test('7. handles path with single segment', () => {
    expect(getDirFromPath('file.md')).toBe('');
  });

  test('8. handles root path', () => {
    expect(getDirFromPath('/file.md')).toBe('');
  });
});

// ============================================================
// getFolderName TESTS (9-12)
// ============================================================

describe('getFolderName', () => {
  test('9. extracts folder name from Unix path', () => {
    expect(getFolderName('/home/user/projects')).toBe('projects');
  });

  test('10. extracts folder name from Windows path', () => {
    expect(getFolderName('D:\\Projects\\ticketflow')).toBe('ticketflow');
  });

  test('11. handles path with trailing separator', () => {
    expect(getFolderName('/home/user/projects/')).toBe('projects');
  });

  test('12. handles empty path', () => {
    expect(getFolderName('')).toBe('');
  });
});

// ============================================================
// joinPath TESTS (13-16)
// ============================================================

describe('joinPath', () => {
  test('13. joins Unix paths with forward slashes', () => {
    expect(joinPath('/home/user', 'docs', 'file.md')).toBe('/home/user/docs/file.md');
  });

  test('14. joins Windows paths with backslashes', () => {
    expect(joinPath('D:\\Projects', 'ticketflow', 'src')).toBe('D:\\Projects\\ticketflow\\src');
  });

  test('15. normalizes duplicate separators', () => {
    const result = joinPath('D:\\Projects\\', '\\subdir');
    expect(result).not.toContain('\\\\\\');
  });

  test('16. handles single segment', () => {
    expect(joinPath('/home')).toBe('/home');
  });
});

// ============================================================
// isTauri TESTS (17)
// ============================================================

import { isTauri } from '../lib/tauri-bridge';

describe('isTauri', () => {
  test('17. returns false when __TAURI_INTERNALS__ is not present', () => {
    // Temporarily remove __TAURI_INTERNALS__ (may be set by global setupTauriMocks)
    const original = (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_INTERNALS__;

    const result = isTauri();
    expect(result).toBe(false);

    // Restore
    (window as any).__TAURI_INTERNALS__ = original;
  });

  test('18. returns true when __TAURI_INTERNALS__ is present', () => {
    // Temporarily add __TAURI_INTERNALS__ to window
    const original = (window as any).__TAURI_INTERNALS__;
    (window as any).__TAURI_INTERNALS__ = { invoke: () => {} };

    const result = isTauri();
    expect(result).toBe(true);

    // Cleanup
    if (original === undefined) {
      delete (window as any).__TAURI_INTERNALS__;
    } else {
      (window as any).__TAURI_INTERNALS__ = original;
    }
  });
});

// ============================================================
// MOCKED TAURI OPERATIONS TESTS (19-32)
// ============================================================

import { vi, beforeEach } from 'vitest';

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, readFile, writeFile, readDir } from '@tauri-apps/plugin-fs';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import {
  openMarkdownFileDialog,
  saveMarkdownFileDialog,
  readTextFileContents,
  writeTextFileContents,
  fileExists,
  readImageAsBase64,
  writeImageFromBase64,
  openFolderDialog,
  openExternalUrl,
  listMarkdownFiles,
  forceQuit,
  listenTrayQuitRequested,
} from '../lib/tauri-bridge';

describe('openMarkdownFileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('19. returns selected file path', async () => {
    vi.mocked(open).mockResolvedValue('/path/to/BACKLOG.md');

    const result = await openMarkdownFileDialog();

    expect(result).toBe('/path/to/BACKLOG.md');
    expect(open).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
  });

  test('20. returns null when cancelled', async () => {
    vi.mocked(open).mockResolvedValue(null);

    const result = await openMarkdownFileDialog();

    expect(result).toBeNull();
  });
});

describe('saveMarkdownFileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('21. returns selected save path', async () => {
    vi.mocked(save).mockResolvedValue('/path/to/NEW.md');

    const result = await saveMarkdownFileDialog('NEW.md');

    expect(result).toBe('/path/to/NEW.md');
    expect(save).toHaveBeenCalledWith({
      defaultPath: 'NEW.md',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
  });

  test('22. uses default name when not provided', async () => {
    vi.mocked(save).mockResolvedValue('/path/to/BACKLOG.md');

    await saveMarkdownFileDialog();

    expect(save).toHaveBeenCalledWith({
      defaultPath: 'BACKLOG.md',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
  });
});

describe('readTextFileContents', () => {
  test('23. reads file content', async () => {
    vi.mocked(readTextFile).mockResolvedValue('# Test Content');

    const result = await readTextFileContents('/path/file.md');

    expect(result).toBe('# Test Content');
    expect(readTextFile).toHaveBeenCalledWith('/path/file.md');
  });
});

describe('writeTextFileContents', () => {
  test('24. writes content to file', async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    await writeTextFileContents('/path/file.md', '# Content');

    expect(writeTextFile).toHaveBeenCalledWith('/path/file.md', '# Content');
  });
});

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('25. returns true when exists() returns true', async () => {
    vi.mocked(exists).mockResolvedValue(true);

    const result = await fileExists('/path/file.md');

    expect(result).toBe(true);
  });

  test('26. falls back to readTextFile when exists() returns false', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    vi.mocked(readTextFile).mockResolvedValue('content');

    const result = await fileExists('/path/file.md');

    expect(result).toBe(true);
    expect(readTextFile).toHaveBeenCalledWith('/path/file.md');
  });

  test('27. returns false when both methods fail', async () => {
    vi.mocked(exists).mockRejectedValue(new Error('Error'));
    vi.mocked(readTextFile).mockRejectedValue(new Error('Not found'));

    const result = await fileExists('/path/nonexistent.md');

    expect(result).toBe(false);
  });
});

describe('openFolderDialog', () => {
  test('28. returns selected folder path', async () => {
    vi.mocked(open).mockResolvedValue('/path/to/folder');

    const result = await openFolderDialog();

    expect(result).toBe('/path/to/folder');
    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
  });
});

describe('listMarkdownFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('29. returns markdown files from directory', async () => {
    vi.mocked(readDir).mockResolvedValue([
      { name: 'BACKLOG.md', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'README.md', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'notes.txt', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'docs', isDirectory: true, isFile: false, isSymlink: false },
    ]);

    const result = await listMarkdownFiles('/path');

    expect(result).toEqual(['BACKLOG.md', 'README.md']);
  });

  test('30. returns empty array on error', async () => {
    vi.mocked(readDir).mockRejectedValue(new Error('Access denied'));

    const result = await listMarkdownFiles('/invalid');

    expect(result).toEqual([]);
  });
});

describe('openExternalUrl', () => {
  test('31. opens URL with shell plugin', async () => {
    vi.mocked(openUrl).mockResolvedValue(undefined);

    await openExternalUrl('https://example.com');

    expect(openUrl).toHaveBeenCalledWith('https://example.com');
  });
});

describe('forceQuit', () => {
  test('32. invokes force_quit command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await forceQuit();

    expect(invoke).toHaveBeenCalledWith('force_quit');
  });
});

describe('listenTrayQuitRequested', () => {
  test('33. registers event listener', async () => {
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(mockUnlisten);
    const callback = vi.fn();

    const unlisten = await listenTrayQuitRequested(callback);

    expect(listen).toHaveBeenCalledWith('tray:quit-requested', callback);
    expect(unlisten).toBe(mockUnlisten);
  });
});

describe('readImageAsBase64', () => {
  test('34. reads image and converts to base64', async () => {
    // Create a simple byte array
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in bytes
    vi.mocked(readFile).mockResolvedValue(bytes);

    const result = await readImageAsBase64('/path/image.png');

    expect(readFile).toHaveBeenCalledWith('/path/image.png');
    expect(result).toBe(btoa('Hello'));
  });
});

describe('writeImageFromBase64', () => {
  test('35. writes base64 data to file', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const base64Data = btoa('Hello');

    await writeImageFromBase64('/path/image.png', base64Data);

    expect(writeFile).toHaveBeenCalledWith(
      '/path/image.png',
      expect.any(Uint8Array)
    );

    // Verify the bytes
    const calledBytes = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
    const expectedBytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(calledBytes).toEqual(expectedBytes);
  });
});
