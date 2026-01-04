/**
 * Hook for managing the screenshots folder handle.
 *
 * - Stores folder handle in IndexedDB for persistence
 * - Requests permission on first use or page reload
 * - Provides functions to save, read, and delete screenshots
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getScreenshotsFolder,
  saveScreenshot,
  readScreenshot,
  deleteScreenshot,
  deleteScreenshotsForTicket,
  generateScreenshotFilename,
  convertToPng,
  isDirectoryPickerSupported,
} from '../lib/screenshots';
import { INDEXED_DB } from '../constants/storage';

// ============================================================
// INDEXEDDB PERSISTENCE
// ============================================================

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB.DB_NAME, INDEXED_DB.VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(INDEXED_DB.FILE_HANDLES_STORE)) {
        db.createObjectStore(INDEXED_DB.FILE_HANDLES_STORE);
      }
    };
  });
}

async function storeParentHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
    const request = store.put(handle, INDEXED_DB.SCREENSHOTS_FOLDER_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

async function getStoredParentHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readonly');
      const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
      const request = store.get(INDEXED_DB.SCREENSHOTS_FOLDER_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function clearStoredParentHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readwrite');
      const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
      const request = store.delete(INDEXED_DB.SCREENSHOTS_FOLDER_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Ignore
  }
}

// ============================================================
// HOOK TYPES
// ============================================================

export interface UseScreenshotFolderReturn {
  /** Is the folder handle available and ready */
  isReady: boolean;
  /** Is currently processing an operation */
  isProcessing: boolean;
  /** Error message if any */
  error: string | null;
  /** Folder access needs user permission */
  needsPermission: boolean;
  /** Is the feature supported */
  isSupported: boolean;

  /** Request user to select/grant folder access */
  requestFolderAccess: () => Promise<boolean>;

  /** Save a screenshot from blob */
  saveScreenshotBlob: (ticketId: string, blob: Blob) => Promise<string | null>;

  /** Import a screenshot from file (converts to PNG if needed) */
  importScreenshotFile: (ticketId: string, file: File) => Promise<string | null>;

  /** Read a screenshot and return as object URL */
  getScreenshotUrl: (filename: string) => Promise<string | null>;

  /** Delete a single screenshot */
  deleteScreenshotFile: (filename: string) => Promise<boolean>;

  /** Delete all screenshots for a ticket */
  deleteTicketScreenshots: (ticketId: string) => Promise<number>;

  /** Cleanup object URL to free memory */
  revokeObjectUrl: (url: string) => void;
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useScreenshotFolder(): UseScreenshotFolderReturn {
  const [screenshotsHandle, setScreenshotsHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const isSupported = isDirectoryPickerSupported();

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // CRITICAL: Store handle in ref for immediate access after permission grant
  // State updates are async/batched, but ref is synchronous
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Try to restore folder handle on mount
  useEffect(() => {
    if (!isSupported) return;

    async function restoreHandle() {
      const stored = await getStoredParentHandle();
      if (stored) {
        try {
          // Verify permission
          const permission = await stored.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            const handle = await getScreenshotsFolder(stored);
            if (handle) {
              handleRef.current = handle; // Immediate access
              setScreenshotsHandle(handle);
              setIsReady(true);
              return;
            }
          }
        } catch {
          // Handle invalid or permission denied
          await clearStoredParentHandle();
        }
      }
      setNeedsPermission(true);
    }

    restoreHandle();

    // Cleanup object URLs on unmount
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isSupported]);

  // Request folder access from user
  const requestFolderAccess = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('File System Access API non supporté. Utilisez Chrome ou Edge.');
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Ask user to select the folder containing the backlog
      const selected = await window.showDirectoryPicker({
        id: 'backlog-assets-parent',
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Store for persistence
      await storeParentHandle(selected);

      // Get or create screenshots folder
      const handle = await getScreenshotsFolder(selected);
      if (handle) {
        handleRef.current = handle; // Immediate access - critical for same-cycle operations
        setScreenshotsHandle(handle);
        setIsReady(true);
        setNeedsPermission(false);
        setIsProcessing(false);
        return true;
      }

      throw new Error('Impossible de créer le dossier screenshots');
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
      setIsProcessing(false);
      return false;
    }
  }, [isSupported]);

  // Save a blob as screenshot
  const saveScreenshotBlob = useCallback(
    async (ticketId: string, blob: Blob): Promise<string | null> => {
      // Use ref for immediate access after permission grant, fallback to state
      const handle = handleRef.current || screenshotsHandle;
      if (!handle) {
        setError('Dossier screenshots non disponible');
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const filename = generateScreenshotFilename(ticketId);
        const success = await saveScreenshot(handle, filename, blob);

        setIsProcessing(false);
        return success ? filename : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec de la sauvegarde');
        setIsProcessing(false);
        return null;
      }
    },
    [screenshotsHandle]
  );

  // Import a file (convert to PNG if needed)
  const importScreenshotFile = useCallback(
    async (ticketId: string, file: File): Promise<string | null> => {
      const handle = handleRef.current || screenshotsHandle;
      if (!handle) {
        setError('Dossier screenshots non disponible');
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Convert to PNG if needed
        const blob = file.type === 'image/png' ? file : await convertToPng(file);

        const filename = generateScreenshotFilename(ticketId);
        const success = await saveScreenshot(handle, filename, blob);

        setIsProcessing(false);
        return success ? filename : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec de l\'import');
        setIsProcessing(false);
        return null;
      }
    },
    [screenshotsHandle]
  );

  // Get screenshot as object URL
  const getScreenshotUrl = useCallback(
    async (filename: string): Promise<string | null> => {
      const handle = handleRef.current || screenshotsHandle;
      if (!handle) return null;

      try {
        const blob = await readScreenshot(handle, filename);
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.add(url);
          return url;
        }
        return null;
      } catch {
        return null;
      }
    },
    [screenshotsHandle]
  );

  // Delete a single screenshot
  const deleteScreenshotFile = useCallback(
    async (filename: string): Promise<boolean> => {
      const handle = handleRef.current || screenshotsHandle;
      if (!handle) return false;
      return deleteScreenshot(handle, filename);
    },
    [screenshotsHandle]
  );

  // Delete all screenshots for a ticket
  const deleteTicketScreenshots = useCallback(
    async (ticketId: string): Promise<number> => {
      const handle = handleRef.current || screenshotsHandle;
      if (!handle) return 0;
      return deleteScreenshotsForTicket(handle, ticketId);
    },
    [screenshotsHandle]
  );

  // Revoke object URL
  const revokeObjectUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);

  return {
    isReady,
    isProcessing,
    error,
    needsPermission,
    isSupported,
    requestFolderAccess,
    saveScreenshotBlob,
    importScreenshotFile,
    getScreenshotUrl,
    deleteScreenshotFile,
    deleteTicketScreenshots,
    revokeObjectUrl,
  };
}
