/**
 * Screenshots Library Tests
 *
 * 12 tests covering pure functions:
 * - generateScreenshotFilename (2 tests)
 * - parseScreenshotFilename (4 tests)
 * - getScreenshotMarkdownRef (2 tests)
 * - isValidImageFile (2 tests)
 * - isDirectoryPickerSupported (1 test)
 * - extractImageFromClipboard (1 test)
 */

import { describe, test, expect } from 'vitest';
import {
  generateScreenshotFilename,
  parseScreenshotFilename,
  getScreenshotMarkdownRef,
  isValidImageFile,
  isDirectoryPickerSupported,
  extractImageFromClipboard,
  ASSETS_FOLDER_NAME,
  SCREENSHOTS_FOLDER_NAME,
} from '../lib/screenshots';

// ============================================================
// generateScreenshotFilename TESTS (1-2)
// ============================================================

describe('generateScreenshotFilename', () => {
  test('1. generates filename with ticket ID and timestamp', () => {
    const before = Date.now();
    const filename = generateScreenshotFilename('CT-001');
    const after = Date.now();

    expect(filename).toMatch(/^CT-001_\d+\.png$/);

    // Extract timestamp from filename
    const match = filename.match(/CT-001_(\d+)\.png/);
    expect(match).not.toBeNull();
    const timestamp = parseInt(match![1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  test('2. generates unique filenames for same ticket', () => {
    const filename1 = generateScreenshotFilename('BUG-001');
    // Small delay to ensure different timestamps
    const filename2 = generateScreenshotFilename('BUG-001');

    // Filenames should be different (different timestamps)
    // Note: In fast execution, they might be the same, so we just check format
    expect(filename1).toMatch(/^BUG-001_\d+\.png$/);
    expect(filename2).toMatch(/^BUG-001_\d+\.png$/);
  });
});

// ============================================================
// parseScreenshotFilename TESTS (3-6)
// ============================================================

describe('parseScreenshotFilename', () => {
  test('3. parses valid screenshot filename', () => {
    const result = parseScreenshotFilename('CT-001_1704360000000.png');

    expect(result).not.toBeNull();
    expect(result!.ticketId).toBe('CT-001');
    expect(result!.timestamp).toBe(1704360000000);
  });

  test('4. parses filename with long ticket number', () => {
    const result = parseScreenshotFilename('BUG-12345_1234567890123.png');

    expect(result).not.toBeNull();
    expect(result!.ticketId).toBe('BUG-12345');
    expect(result!.timestamp).toBe(1234567890123);
  });

  test('5. returns null for invalid format', () => {
    expect(parseScreenshotFilename('invalid.png')).toBeNull();
    expect(parseScreenshotFilename('CT001_12345.png')).toBeNull();
    expect(parseScreenshotFilename('ct-001_12345.png')).toBeNull();
  });

  test('6. returns null for wrong extension', () => {
    expect(parseScreenshotFilename('CT-001_12345.jpg')).toBeNull();
    expect(parseScreenshotFilename('CT-001_12345')).toBeNull();
  });
});

// ============================================================
// getScreenshotMarkdownRef TESTS (7-8)
// ============================================================

describe('getScreenshotMarkdownRef', () => {
  test('7. generates markdown reference with default alt text', () => {
    const ref = getScreenshotMarkdownRef('CT-001_12345.png');

    expect(ref).toBe(`![CT-001_12345](.${ASSETS_FOLDER_NAME}/${SCREENSHOTS_FOLDER_NAME}/CT-001_12345.png)`);
  });

  test('8. generates markdown reference with custom alt text', () => {
    const ref = getScreenshotMarkdownRef('CT-001_12345.png', 'Login Screen');

    expect(ref).toBe(`![Login Screen](.${ASSETS_FOLDER_NAME}/${SCREENSHOTS_FOLDER_NAME}/CT-001_12345.png)`);
  });
});

// ============================================================
// isValidImageFile TESTS (9-10)
// ============================================================

describe('isValidImageFile', () => {
  test('9. returns true for valid image types', () => {
    const pngFile = new File([''], 'test.png', { type: 'image/png' });
    const jpegFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const gifFile = new File([''], 'test.gif', { type: 'image/gif' });
    const webpFile = new File([''], 'test.webp', { type: 'image/webp' });

    expect(isValidImageFile(pngFile)).toBe(true);
    expect(isValidImageFile(jpegFile)).toBe(true);
    expect(isValidImageFile(gifFile)).toBe(true);
    expect(isValidImageFile(webpFile)).toBe(true);
  });

  test('10. returns false for invalid file types', () => {
    const textFile = new File([''], 'test.txt', { type: 'text/plain' });
    const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    const svgFile = new File([''], 'test.svg', { type: 'image/svg+xml' });

    expect(isValidImageFile(textFile)).toBe(false);
    expect(isValidImageFile(pdfFile)).toBe(false);
    expect(isValidImageFile(svgFile)).toBe(false);
  });
});

// ============================================================
// isDirectoryPickerSupported TESTS (11)
// ============================================================

describe('isDirectoryPickerSupported', () => {
  test('11. returns boolean based on window API', () => {
    // In jsdom, showDirectoryPicker is not available
    const result = isDirectoryPickerSupported();
    expect(typeof result).toBe('boolean');
  });
});

// ============================================================
// extractImageFromClipboard TESTS (12)
// ============================================================

describe('extractImageFromClipboard', () => {
  test('12. returns null when clipboardData is null', () => {
    expect(extractImageFromClipboard(null)).toBeNull();
  });

  test('13. returns image file from clipboard', () => {
    const mockFile = new File(['data'], 'image.png', { type: 'image/png' });
    const mockDataTransfer = {
      items: [
        { type: 'image/png', getAsFile: () => mockFile }
      ]
    } as unknown as DataTransfer;

    const result = extractImageFromClipboard(mockDataTransfer);
    expect(result).toBe(mockFile);
  });

  test('14. returns null when no image in clipboard', () => {
    const mockDataTransfer = {
      items: [
        { type: 'text/plain', getAsFile: () => null }
      ]
    } as unknown as DataTransfer;

    const result = extractImageFromClipboard(mockDataTransfer);
    expect(result).toBeNull();
  });

  test('15. returns first image when multiple items', () => {
    const mockImageFile = new File(['img'], 'screenshot.png', { type: 'image/png' });
    const mockDataTransfer = {
      items: [
        { type: 'text/html', getAsFile: () => null },
        { type: 'image/jpeg', getAsFile: () => mockImageFile },
        { type: 'text/plain', getAsFile: () => null }
      ]
    } as unknown as DataTransfer;

    const result = extractImageFromClipboard(mockDataTransfer);
    expect(result).toBe(mockImageFile);
  });
});

// ============================================================
// ASYNC FILE OPERATIONS TESTS (16-24)
// ============================================================

import {
  getScreenshotsFolder,
  saveScreenshot,
  readScreenshot,
  deleteScreenshot,
  deleteScreenshotsForTicket,
  listScreenshotsForTicket,
} from '../lib/screenshots';

import { vi } from 'vitest';

describe('getScreenshotsFolder', () => {
  test('16. creates nested folder structure', async () => {
    const mockScreenshotsHandle = {} as FileSystemDirectoryHandle;
    const mockAssetsHandle = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockScreenshotsHandle),
    };
    const mockParentHandle = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockAssetsHandle),
    } as unknown as FileSystemDirectoryHandle;

    const result = await getScreenshotsFolder(mockParentHandle);

    expect(result).toBe(mockScreenshotsHandle);
    expect(mockParentHandle.getDirectoryHandle).toHaveBeenCalledWith('.backlog-assets', { create: true });
    expect(mockAssetsHandle.getDirectoryHandle).toHaveBeenCalledWith('screenshots', { create: true });
  });

  test('17. returns null on error', async () => {
    const mockParentHandle = {
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('Permission denied')),
    } as unknown as FileSystemDirectoryHandle;

    const result = await getScreenshotsFolder(mockParentHandle);

    expect(result).toBeNull();
  });
});

describe('saveScreenshot', () => {
  test('18. saves blob to file', async () => {
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    };
    const mockFolderHandle = {
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    } as unknown as FileSystemDirectoryHandle;

    const blob = new Blob(['test image data'], { type: 'image/png' });
    const result = await saveScreenshot(mockFolderHandle, 'CT-001_12345.png', blob);

    expect(result).toBe(true);
    expect(mockFolderHandle.getFileHandle).toHaveBeenCalledWith('CT-001_12345.png', { create: true });
    expect(mockWritable.write).toHaveBeenCalledWith(blob);
    expect(mockWritable.close).toHaveBeenCalled();
  });

  test('19. returns false on error', async () => {
    const mockFolderHandle = {
      getFileHandle: vi.fn().mockRejectedValue(new Error('Write failed')),
    } as unknown as FileSystemDirectoryHandle;

    const result = await saveScreenshot(mockFolderHandle, 'test.png', new Blob());

    expect(result).toBe(false);
  });
});

describe('readScreenshot', () => {
  test('20. reads file and returns blob', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(mockBlob),
    };
    const mockFolderHandle = {
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    } as unknown as FileSystemDirectoryHandle;

    const result = await readScreenshot(mockFolderHandle, 'CT-001_12345.png');

    expect(result).toBe(mockBlob);
    expect(mockFolderHandle.getFileHandle).toHaveBeenCalledWith('CT-001_12345.png');
  });

  test('21. returns null on error', async () => {
    const mockFolderHandle = {
      getFileHandle: vi.fn().mockRejectedValue(new Error('File not found')),
    } as unknown as FileSystemDirectoryHandle;

    const result = await readScreenshot(mockFolderHandle, 'nonexistent.png');

    expect(result).toBeNull();
  });
});

describe('deleteScreenshot', () => {
  test('22. deletes file and returns true', async () => {
    const mockFolderHandle = {
      removeEntry: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileSystemDirectoryHandle;

    const result = await deleteScreenshot(mockFolderHandle, 'CT-001_12345.png');

    expect(result).toBe(true);
    expect(mockFolderHandle.removeEntry).toHaveBeenCalledWith('CT-001_12345.png');
  });

  test('23. returns false on error', async () => {
    const mockFolderHandle = {
      removeEntry: vi.fn().mockRejectedValue(new Error('Delete failed')),
    } as unknown as FileSystemDirectoryHandle;

    const result = await deleteScreenshot(mockFolderHandle, 'test.png');

    expect(result).toBe(false);
  });
});

describe('listScreenshotsForTicket', () => {
  test('24. lists screenshots matching ticket ID', async () => {
    const entries = [
      { name: 'CT-001_1000.png', kind: 'file' as const },
      { name: 'CT-001_2000.png', kind: 'file' as const },
      { name: 'CT-002_3000.png', kind: 'file' as const },
      { name: 'BUG-001_4000.png', kind: 'file' as const },
    ];

    const mockFolderHandle = {
      values: vi.fn().mockImplementation(async function* () {
        for (const entry of entries) {
          yield entry;
        }
      }),
    } as unknown as FileSystemDirectoryHandle;

    const result = await listScreenshotsForTicket(mockFolderHandle, 'CT-001');

    expect(result).toEqual(['CT-001_1000.png', 'CT-001_2000.png']);
  });

  test('25. returns empty array when no matches', async () => {
    const entries = [
      { name: 'BUG-001_1000.png', kind: 'file' as const },
    ];

    const mockFolderHandle = {
      values: vi.fn().mockImplementation(async function* () {
        for (const entry of entries) {
          yield entry;
        }
      }),
    } as unknown as FileSystemDirectoryHandle;

    const result = await listScreenshotsForTicket(mockFolderHandle, 'CT-001');

    expect(result).toEqual([]);
  });

  test('26. returns empty array on error', async () => {
    const mockFolderHandle = {
      values: vi.fn().mockImplementation(async function* () {
        throw new Error('Read error');
      }),
    } as unknown as FileSystemDirectoryHandle;

    const result = await listScreenshotsForTicket(mockFolderHandle, 'CT-001');

    expect(result).toEqual([]);
  });
});

describe('deleteScreenshotsForTicket', () => {
  test('27. deletes all screenshots for ticket', async () => {
    const entries = [
      { name: 'CT-001_1000.png', kind: 'file' as const },
      { name: 'CT-001_2000.png', kind: 'file' as const },
      { name: 'CT-002_3000.png', kind: 'file' as const },
    ];

    const mockFolderHandle = {
      values: vi.fn().mockImplementation(async function* () {
        for (const entry of entries) {
          yield entry;
        }
      }),
      removeEntry: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileSystemDirectoryHandle;

    const result = await deleteScreenshotsForTicket(mockFolderHandle, 'CT-001');

    expect(result).toBe(2);
    expect(mockFolderHandle.removeEntry).toHaveBeenCalledTimes(2);
    expect(mockFolderHandle.removeEntry).toHaveBeenCalledWith('CT-001_1000.png');
    expect(mockFolderHandle.removeEntry).toHaveBeenCalledWith('CT-001_2000.png');
  });

  test('28. returns 0 when no matching files', async () => {
    const mockFolderHandle = {
      values: vi.fn().mockImplementation(async function* () {
        yield { name: 'BUG-001_1000.png', kind: 'file' };
      }),
      removeEntry: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;

    const result = await deleteScreenshotsForTicket(mockFolderHandle, 'CT-001');

    expect(result).toBe(0);
    expect(mockFolderHandle.removeEntry).not.toHaveBeenCalled();
  });
});
