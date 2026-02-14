/**
 * Screenshot Management Library
 *
 * Handles reading/writing screenshots using File System Access API.
 * Stores images in .backlog-assets/screenshots/ relative to the markdown file.
 */

// Type augmentation for File System Access API (directory iteration)
declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

// ============================================================
// CONSTANTS
// ============================================================

export const ASSETS_FOLDER_NAME = '.backlog-assets';
export const SCREENSHOTS_FOLDER_NAME = 'screenshots';

// ============================================================
// TYPES
// ============================================================

export interface ScreenshotInfo {
  ticketId: string;
  timestamp: number;
}

// ============================================================
// FILENAME UTILITIES
// ============================================================

/**
 * Generate a unique filename for a screenshot.
 * Format: {TICKET-ID}_{TIMESTAMP}.png
 */
export function generateScreenshotFilename(ticketId: string): string {
  const timestamp = Date.now();
  return `${ticketId}_${timestamp}.png`;
}

/**
 * Parse a screenshot filename to extract ticket ID and timestamp.
 */
export function parseScreenshotFilename(filename: string): ScreenshotInfo | null {
  const match = filename.match(/^([A-Z]+-\d+)_(\d+)\.png$/);
  if (!match) return null;
  return {
    ticketId: match[1],
    timestamp: parseInt(match[2], 10),
  };
}

/**
 * Generate markdown reference for a screenshot.
 * Uses relative path: .backlog-assets/screenshots/{filename}
 */
export function getScreenshotMarkdownRef(filename: string, alt?: string): string {
  const altText = alt || filename.replace('.png', '');
  return `![${altText}](.${ASSETS_FOLDER_NAME}/${SCREENSHOTS_FOLDER_NAME}/${filename})`;
}

// ============================================================
// FOLDER OPERATIONS
// ============================================================

/**
 * Get or create the screenshots directory handle.
 * Creates .backlog-assets/screenshots/ structure if needed.
 */
export async function getScreenshotsFolder(
  parentHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle | null> {
  try {
    // Get or create .backlog-assets
    const assetsHandle = await parentHandle.getDirectoryHandle(
      ASSETS_FOLDER_NAME,
      { create: true }
    );

    // Get or create screenshots subfolder
    const screenshotsHandle = await assetsHandle.getDirectoryHandle(
      SCREENSHOTS_FOLDER_NAME,
      { create: true }
    );

    return screenshotsHandle;
  } catch (error) {
    console.error('Failed to get screenshots folder:', error);
    return null;
  }
}

// ============================================================
// FILE OPERATIONS
// ============================================================

/**
 * Save a screenshot blob to the screenshots folder.
 */
export async function saveScreenshot(
  folderHandle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<boolean> {
  try {
    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    console.error('Failed to save screenshot:', error);
    return false;
  }
}

/**
 * Read a screenshot from the screenshots folder.
 */
export async function readScreenshot(
  folderHandle: FileSystemDirectoryHandle,
  filename: string
): Promise<Blob | null> {
  try {
    const fileHandle = await folderHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file;
  } catch (error) {
    console.error('Failed to read screenshot:', error);
    return null;
  }
}

/**
 * Delete a screenshot from the screenshots folder.
 */
export async function deleteScreenshot(
  folderHandle: FileSystemDirectoryHandle,
  filename: string
): Promise<boolean> {
  try {
    await folderHandle.removeEntry(filename);
    return true;
  } catch (error) {
    console.error('Failed to delete screenshot:', error);
    return false;
  }
}

/**
 * Delete all screenshots for a given ticket ID.
 * Returns the count of deleted files.
 */
export async function deleteScreenshotsForTicket(
  folderHandle: FileSystemDirectoryHandle,
  ticketId: string
): Promise<number> {
  let deletedCount = 0;

  try {
    const entries: string[] = [];

    // Collect entries first (can't modify while iterating)
    for await (const entry of folderHandle.values()) {
      if (entry.kind === 'file') {
        const parsed = parseScreenshotFilename(entry.name);
        if (parsed && parsed.ticketId === ticketId) {
          entries.push(entry.name);
        }
      }
    }

    // Delete collected entries
    for (const name of entries) {
      try {
        await folderHandle.removeEntry(name);
        deletedCount++;
      } catch {
        // Continue on individual delete failure
      }
    }
  } catch (error) {
    console.error('Failed to delete screenshots for ticket:', error);
  }

  return deletedCount;
}

/**
 * List all screenshots for a ticket.
 */
export async function listScreenshotsForTicket(
  folderHandle: FileSystemDirectoryHandle,
  ticketId: string
): Promise<string[]> {
  const filenames: string[] = [];

  try {
    for await (const entry of folderHandle.values()) {
      if (entry.kind === 'file') {
        const parsed = parseScreenshotFilename(entry.name);
        if (parsed && parsed.ticketId === ticketId) {
          filenames.push(entry.name);
        }
      }
    }
  } catch (error) {
    console.error('Failed to list screenshots:', error);
  }

  return filenames.sort();
}

// ============================================================
// IMAGE CONVERSION
// ============================================================

/**
 * Convert an image file to PNG blob.
 * Handles JPEG, WebP, GIF, etc.
 */
export async function convertToPng(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert to PNG'));
        },
        'image/png'
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Extract image from clipboard paste event.
 */
export function extractImageFromClipboard(
  clipboardData: DataTransfer | null
): File | null {
  if (!clipboardData) return null;

  for (const item of clipboardData.items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }

  return null;
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Check if a file is a valid image.
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
}

/**
 * Check if File System Access API is supported.
 */
export function isDirectoryPickerSupported(): boolean {
  return 'showDirectoryPicker' in window;
}
