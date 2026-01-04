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
