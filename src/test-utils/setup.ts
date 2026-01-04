/**
 * Vitest Setup File
 *
 * Configures the test environment before each test run.
 * This file is loaded by vitest.config.ts setupFiles option.
 */

import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// ============================================================
// MOCK: localStorage
// ============================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// ============================================================
// MOCK: IndexedDB (minimal)
// ============================================================

const indexedDBMock = {
  open: vi.fn(() => ({
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(() => ({ onsuccess: null, onerror: null })),
          get: vi.fn(() => ({ onsuccess: null, onerror: null, result: null })),
          delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
        })),
        oncomplete: null,
      })),
      close: vi.fn(),
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  })),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock,
});

// ============================================================
// MOCK: Clipboard API
// ============================================================

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
    read: vi.fn(() => Promise.resolve([])),
    write: vi.fn(() => Promise.resolve()),
  },
  writable: true,
});

// ============================================================
// MOCK: URL.createObjectURL
// ============================================================

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ============================================================
// CLEANUP
// ============================================================

afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
