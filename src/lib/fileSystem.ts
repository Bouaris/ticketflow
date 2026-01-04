/**
 * File System Access API Wrapper
 *
 * Permet d'ouvrir, lire et sauvegarder des fichiers locaux.
 * Chrome/Edge only (pas Firefox/Safari).
 */

// Type augmentation for File System Access API
declare global {
  interface Window {
    showOpenFilePicker: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }
}

// ============================================================
// CONSTANTS
// ============================================================

const MARKDOWN_FILE_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Markdown files',
    accept: {
      'text/markdown': ['.md', '.markdown'],
    },
  },
];

// ============================================================
// FEATURE DETECTION
// ============================================================

export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

// ============================================================
// FILE OPERATIONS
// ============================================================

/**
 * Ouvre un dialogue pour sélectionner un fichier Markdown.
 * @returns FileSystemFileHandle ou null si annulé
 */
export async function openMarkdownFile(): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API not supported. Use Chrome or Edge.');
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: MARKDOWN_FILE_TYPES,
    });
    return handle;
  } catch (error) {
    // User cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Lit le contenu d'un fichier.
 * @param handle FileSystemFileHandle
 * @returns Contenu du fichier en string
 */
export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/**
 * Sauvegarde du contenu dans un fichier existant.
 * @param handle FileSystemFileHandle
 * @param content Contenu à écrire
 */
export async function saveFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  // Vérifier les permissions d'écriture
  const options = { mode: 'readwrite' as const };

  if ((await handle.queryPermission(options)) !== 'granted') {
    if ((await handle.requestPermission(options)) !== 'granted') {
      throw new Error('Permission denied to write file');
    }
  }

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Ouvre un dialogue "Save As" pour sauvegarder dans un nouveau fichier.
 * @param content Contenu à écrire
 * @param suggestedName Nom suggéré pour le fichier
 * @returns FileSystemFileHandle du nouveau fichier ou null si annulé
 */
export async function saveAsMarkdownFile(
  content: string,
  suggestedName: string = 'PRODUCT_BACKLOG.md'
): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API not supported. Use Chrome or Edge.');
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: MARKDOWN_FILE_TYPES,
    });

    await saveFile(handle, content);
    return handle;
  } catch (error) {
    // User cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Obtient le nom du fichier depuis un handle.
 */
export function getFileName(handle: FileSystemFileHandle): string {
  return handle.name;
}

// ============================================================
// HANDLE PERSISTENCE (IndexedDB)
// ============================================================

import { INDEXED_DB } from '../constants/storage';

/**
 * Ouvre la base IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
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

/**
 * Stocke le FileSystemFileHandle dans IndexedDB
 */
export async function storeHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
    const request = store.put(handle, INDEXED_DB.LAST_FILE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Récupère le FileSystemFileHandle depuis IndexedDB
 */
export async function getStoredHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readonly');
      const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
      const request = store.get(INDEXED_DB.LAST_FILE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);

      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('[FileSystem] Failed to get stored handle:', error);
    return null;
  }
}

/**
 * Supprime le handle stocké
 */
export async function clearStoredHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INDEXED_DB.FILE_HANDLES_STORE, 'readwrite');
      const store = tx.objectStore(INDEXED_DB.FILE_HANDLES_STORE);
      const request = store.delete(INDEXED_DB.LAST_FILE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();

      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('[FileSystem] Failed to clear stored handle:', error);
  }
}

/**
 * Vérifie et demande les permissions pour un handle stocké
 */
export async function verifyPermission(handle: FileSystemFileHandle): Promise<boolean> {
  const options = { mode: 'readwrite' as const };

  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}

