/**
 * Tauri Bridge Mocks
 *
 * Mocks for Tauri-specific functionality to enable testing
 * without the Tauri runtime.
 */

import { vi } from 'vitest';

// ============================================================
// MOCK: Tauri API
// ============================================================

export const mockTauriBridge = {
  isTauri: vi.fn(() => false),
  openMarkdownFileDialog: vi.fn(() => Promise.resolve(null)),
  saveMarkdownFileDialog: vi.fn(() => Promise.resolve(null)),
  readTextFileContents: vi.fn(() => Promise.resolve('')),
  writeTextFileContents: vi.fn(() => Promise.resolve(true)),
  fileExists: vi.fn(() => Promise.resolve(false)),
  getFileNameFromPath: vi.fn((path: string) => path.split(/[/\\]/).pop() || ''),
  getDirFromPath: vi.fn((path: string) => path.replace(/[/\\][^/\\]*$/, '')),
  readImageAsBase64: vi.fn(() => Promise.resolve('')),
  writeImageFromBase64: vi.fn(() => Promise.resolve(true)),
  openFolderDialog: vi.fn(() => Promise.resolve(null)),
  openExternalUrl: vi.fn(() => Promise.resolve()),
  setupExternalLinkHandler: vi.fn(() => () => {}),
  listMarkdownFiles: vi.fn(() => Promise.resolve([])),
  getFolderName: vi.fn((path: string) => path.split(/[/\\]/).pop() || ''),
  joinPath: vi.fn((...parts: string[]) => parts.join('/')),
  forceQuit: vi.fn(),
  listenTrayQuitRequested: vi.fn(() => Promise.resolve(() => {})),
};

// ============================================================
// APPLY MOCKS
// ============================================================

/**
 * Apply Tauri mocks to the module system.
 * Call this in your test setup if needed.
 */
export function applyTauriMocks() {
  vi.mock('../../lib/tauri-bridge', () => mockTauriBridge);
}

/**
 * Reset all Tauri mocks between tests.
 */
export function resetTauriMocks() {
  Object.values(mockTauriBridge).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
}
