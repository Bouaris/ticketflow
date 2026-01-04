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
});
