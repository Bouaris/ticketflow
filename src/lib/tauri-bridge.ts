/**
 * Tauri Bridge - API wrapper for Tauri file system operations
 *
 * Uses Tauri plugins for file dialogs and file system access.
 * Gracefully falls back to undefined when not in Tauri environment.
 */

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { open as openUrl } from '@tauri-apps/plugin-shell';

// ============================================================
// ENVIRONMENT DETECTION
// ============================================================

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return '__TAURI__' in window;
}

// ============================================================
// FILE OPERATIONS
// ============================================================

/**
 * Open a file dialog to select a Markdown file
 * @returns File path or null if cancelled
 */
export async function openMarkdownFileDialog(): Promise<string | null> {
  const file = await open({
    multiple: false,
    filters: [
      {
        name: 'Markdown',
        extensions: ['md', 'markdown'],
      },
    ],
  });

  return file ?? null;
}

/**
 * Open a save dialog for a Markdown file
 * @param suggestedName Suggested file name
 * @returns File path or null if cancelled
 */
export async function saveMarkdownFileDialog(suggestedName: string = 'BACKLOG.md'): Promise<string | null> {
  const file = await save({
    defaultPath: suggestedName,
    filters: [
      {
        name: 'Markdown',
        extensions: ['md', 'markdown'],
      },
    ],
  });

  return file ?? null;
}

/**
 * Read a text file
 * @param path Absolute file path
 * @returns File contents as string
 */
export async function readTextFileContents(path: string): Promise<string> {
  return readTextFile(path);
}

/**
 * Write a text file
 * @param path Absolute file path
 * @param content Content to write
 */
export async function writeTextFileContents(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

/**
 * Check if a file exists
 * @param path Absolute file path
 * @returns True if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  return exists(path);
}

/**
 * Get the file name from a path
 * @param path File path
 * @returns File name
 */
export function getFileNameFromPath(path: string): string {
  // Handle both Windows and Unix paths
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

/**
 * Get the directory from a path
 * @param path File path
 * @returns Directory path
 */
export function getDirFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join('/');
}

// ============================================================
// IMAGE OPERATIONS (for screenshots)
// ============================================================

/**
 * Read an image file as base64
 * @param path Absolute file path
 * @returns Base64 encoded image data
 */
export async function readImageAsBase64(path: string): Promise<string> {
  const bytes = await readFile(path);
  // Convert Uint8Array to base64
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Write base64 data to an image file
 * @param path Absolute file path
 * @param base64Data Base64 encoded image data
 */
export async function writeImageFromBase64(path: string, base64Data: string): Promise<void> {
  // Convert base64 to Uint8Array
  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  await writeFile(path, bytes);
}

/**
 * Open a folder dialog for screenshots
 * @returns Folder path or null if cancelled
 */
export async function openFolderDialog(): Promise<string | null> {
  const folder = await open({
    directory: true,
    multiple: false,
  });

  return folder ?? null;
}

// ============================================================
// EXTERNAL URLS
// ============================================================

/**
 * Open a URL in the default browser
 * @param url URL to open
 */
export async function openExternalUrl(url: string): Promise<void> {
  await openUrl(url);
}

/**
 * Setup global click handler for external links in Tauri
 * Call this once in your app initialization
 */
export function setupExternalLinkHandler(): void {
  if (!isTauri()) return;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor && anchor.href) {
      const url = anchor.href;
      // Check if it's an external URL (starts with http/https and not localhost)
      if ((url.startsWith('http://') || url.startsWith('https://')) &&
          !url.includes('localhost') &&
          !url.includes('127.0.0.1')) {
        e.preventDefault();
        openUrl(url).catch(console.error);
      }
    }
  });
}
