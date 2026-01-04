/**
 * Centralized Tauri Mock
 *
 * Complete mock for tauri-bridge.ts functions.
 * Use this in tests that need Tauri functionality.
 */

import { vi } from 'vitest';

// ============================================================
// MOCK STATE (can be modified in tests)
// ============================================================

export const mockTauriState = {
  isTauri: false,
  files: new Map<string, string>(),
  images: new Map<string, string>(),
  dialogResult: null as string | null,
  folderDialogResult: null as string | null,
};

// ============================================================
// MOCK FUNCTIONS
// ============================================================

export const mockTauriFunctions = {
  isTauri: vi.fn(() => mockTauriState.isTauri),

  // File dialogs
  openMarkdownFileDialog: vi.fn(() => Promise.resolve(mockTauriState.dialogResult)),
  saveMarkdownFileDialog: vi.fn(() => Promise.resolve(mockTauriState.dialogResult)),
  openFolderDialog: vi.fn(() => Promise.resolve(mockTauriState.folderDialogResult)),

  // File operations
  readTextFileContents: vi.fn((path: string) => {
    const content = mockTauriState.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`File not found: ${path}`));
    }
    return Promise.resolve(content);
  }),

  writeTextFileContents: vi.fn((path: string, content: string) => {
    mockTauriState.files.set(path, content);
    return Promise.resolve();
  }),

  fileExists: vi.fn((path: string) => {
    return Promise.resolve(mockTauriState.files.has(path));
  }),

  // Path utilities (pure functions, no mock needed but included for completeness)
  getFileNameFromPath: vi.fn((path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }),

  getDirFromPath: vi.fn((path: string) => {
    const parts = path.split(/[/\\]/);
    parts.pop();
    return parts.join('/');
  }),

  joinPath: vi.fn((...parts: string[]) => {
    return parts.join('/').replace(/\/+/g, '/');
  }),

  getFolderName: vi.fn((path: string) => {
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || '';
  }),

  // Image operations
  readImageAsBase64: vi.fn((path: string) => {
    const data = mockTauriState.images.get(path);
    if (data === undefined) {
      return Promise.reject(new Error(`Image not found: ${path}`));
    }
    return Promise.resolve(data);
  }),

  writeImageFromBase64: vi.fn((path: string, base64Data: string) => {
    mockTauriState.images.set(path, base64Data);
    return Promise.resolve();
  }),

  // Directory operations
  listMarkdownFiles: vi.fn((dirPath: string) => {
    const files: string[] = [];
    for (const path of mockTauriState.files.keys()) {
      if (path.startsWith(dirPath) && (path.endsWith('.md') || path.endsWith('.markdown'))) {
        const fileName = path.split('/').pop() || '';
        if (fileName) files.push(fileName);
      }
    }
    return Promise.resolve(files);
  }),

  // External URL
  openExternalUrl: vi.fn(() => Promise.resolve()),
  setupExternalLinkHandler: vi.fn(() => () => {}),

  // Application lifecycle
  forceQuit: vi.fn(() => Promise.resolve()),
  listenTrayQuitRequested: vi.fn(() => Promise.resolve(() => {})),
};

// ============================================================
// HELPER FUNCTIONS FOR TESTS
// ============================================================

/**
 * Reset all mock state and functions
 */
export function resetTauriMock() {
  mockTauriState.isTauri = false;
  mockTauriState.files.clear();
  mockTauriState.images.clear();
  mockTauriState.dialogResult = null;
  mockTauriState.folderDialogResult = null;

  Object.values(mockTauriFunctions).forEach(fn => {
    if (typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
  });
}

/**
 * Set up Tauri mode with optional file fixtures
 */
export function setupTauriMode(files?: Record<string, string>) {
  mockTauriState.isTauri = true;
  if (files) {
    Object.entries(files).forEach(([path, content]) => {
      mockTauriState.files.set(path, content);
    });
  }
}

/**
 * Set dialog result for next dialog call
 */
export function setDialogResult(path: string | null) {
  mockTauriState.dialogResult = path;
}

/**
 * Set folder dialog result for next dialog call
 */
export function setFolderDialogResult(path: string | null) {
  mockTauriState.folderDialogResult = path;
}

// ============================================================
// VI.MOCK FACTORY
// ============================================================

/**
 * Use this to mock tauri-bridge in your test file:
 *
 * vi.mock('../lib/tauri-bridge', () => tauriMockFactory());
 */
export function tauriMockFactory() {
  return mockTauriFunctions;
}
