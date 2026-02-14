/**
 * Tauri Bridge - API wrapper for Tauri file system operations
 *
 * Uses Tauri plugins for file dialogs and file system access.
 * Gracefully falls back to undefined when not in Tauri environment.
 */

import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, readFile, writeFile, readDir } from '@tauri-apps/plugin-fs';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ============================================================
// ENVIRONMENT DETECTION
// ============================================================

/**
 * Check if running in Tauri environment
 * Tauri v2 uses __TAURI_INTERNALS__ instead of __TAURI__
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
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
 * Uses readTextFile as fallback since exists() can be unreliable on Windows
 * @param path Absolute file path
 * @returns True if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  // Try exists() first
  try {
    const result = await exists(path);
    if (result) return true;
  } catch {
    // Ignore, try fallback
  }

  // Fallback: try to read the file
  try {
    await readTextFile(path);
    return true;
  } catch {
    return false;
  }
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
 * @returns Cleanup function to remove the event listener
 */
export function setupExternalLinkHandler(): () => void {
  if (!isTauri()) return () => {};

  const handleClick = (e: MouseEvent) => {
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
  };

  document.addEventListener('click', handleClick);

  // Return cleanup function
  return () => document.removeEventListener('click', handleClick);
}

// ============================================================
// PROJECT/DIRECTORY OPERATIONS
// ============================================================

/**
 * List markdown files in a directory
 * @param dirPath Directory path
 * @returns Array of markdown file names (not full paths)
 */
export async function listMarkdownFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readDir(dirPath);
    return entries
      .filter(entry => {
        const name = entry.name?.toLowerCase() || '';
        return !entry.isDirectory && (name.endsWith('.md') || name.endsWith('.markdown'));
      })
      .map(entry => entry.name || '')
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to list markdown files:', error);
    return [];
  }
}

/**
 * List markdown files recursively in a directory
 * Returns relative paths from the given dirPath (e.g., "codebase/STACK.md")
 * @param dirPath Root directory to search
 * @param _prefix Internal prefix for recursion (do not pass)
 * @returns Sorted array of relative .md file paths
 */
export async function listMarkdownFilesRecursive(dirPath: string, _prefix: string = ''): Promise<string[]> {
  try {
    const entries = await readDir(dirPath);
    const results: string[] = [];

    for (const entry of entries) {
      const name = entry.name || '';
      if (!name) continue;

      const relativePath = _prefix ? `${_prefix}/${name}` : name;

      if (entry.isDirectory) {
        const subPath = joinPath(dirPath, name);
        const subFiles = await listMarkdownFilesRecursive(subPath, relativePath);
        results.push(...subFiles);
      } else {
        const lower = name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
          results.push(relativePath);
        }
      }
    }

    return results.sort();
  } catch (error) {
    console.warn('[tauri-bridge] Failed to list markdown files recursively:', error);
    return [];
  }
}

/**
 * Get folder name from a path
 * @param path Full path
 * @returns Folder name (last segment)
 */
export function getFolderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * Join path segments
 * @param parts Path parts to join
 * @returns Joined path (preserves Windows backslashes)
 */
export function joinPath(...parts: string[]): string {
  // Detect if first part is a Windows path (e.g., D:\)
  const isWindows = parts[0]?.match(/^[A-Za-z]:\\/);

  if (isWindows) {
    // For Windows: normalize to backslashes
    return parts
      .map(p => p.replace(/\//g, '\\'))
      .join('\\')
      .replace(/\\+/g, '\\');
  }

  // For Unix-like: use forward slashes
  return parts.join('/').replace(/\\/g, '/');
}

// ============================================================
// APPLICATION LIFECYCLE
// ============================================================

/**
 * Force quit the application
 * Bypasses the tray minimize behavior
 */
export async function forceQuit(): Promise<void> {
  await invoke('force_quit');
}

/**
 * Listen for tray quit request
 * Called when user clicks "Quitter" in tray menu
 * @param callback Function to call when quit is requested
 * @returns Unlisten function
 */
export async function listenTrayQuitRequested(callback: () => void): Promise<UnlistenFn> {
  return listen('tray:quit-requested', callback);
}
