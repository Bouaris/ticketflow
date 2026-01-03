/**
 * Hook pour gérer l'accès aux fichiers.
 * Supporte deux modes:
 * - Tauri: utilise le file system natif via tauri-bridge
 * - Web: utilise File System Access API (Chrome/Edge)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  openMarkdownFile,
  readFile,
  saveFile,
  saveAsMarkdownFile,
  getFileName,
  isFileSystemAccessSupported,
  storeHandle,
  getStoredHandle,
  verifyPermission,
  clearStoredHandle,
} from '../lib/fileSystem';
import {
  isTauri,
  openMarkdownFileDialog,
  saveMarkdownFileDialog,
  readTextFileContents,
  writeTextFileContents,
  getFileNameFromPath,
} from '../lib/tauri-bridge';

// ============================================================
// CONSTANTS
// ============================================================

const TAURI_LAST_FILE_KEY = 'ticketflow-last-file';

// ============================================================
// TYPES
// ============================================================

export interface UseFileAccessReturn {
  /** Nom du fichier ouvert */
  fileName: string | null;
  /** Handle du fichier (web mode) ou path (Tauri mode) */
  fileHandle: FileSystemFileHandle | null;
  /** Path du fichier (Tauri mode) */
  filePath: string | null;
  /** Contenu brut du fichier */
  content: string | null;
  /** État de chargement */
  isLoading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Fichier modifié (non sauvegardé) */
  isDirty: boolean;
  /** API supportée (toujours true en Tauri) */
  isSupported: boolean;
  /** Handle/path stocké disponible (pour auto-load) */
  hasStoredHandle: boolean;
  /** Mode Tauri actif */
  isTauriMode: boolean;
  /** Ouvrir un fichier */
  openFile: () => Promise<string | null>;
  /** Charger le fichier stocké */
  loadStoredFile: () => Promise<string | null>;
  /** Charger depuis un chemin spécifique (Tauri only) */
  loadFromPath: (path: string) => Promise<string | null>;
  /** Sauvegarder dans le fichier actuel */
  save: (content: string) => Promise<boolean>;
  /** Sauvegarder sous un nouveau nom */
  saveAs: (content: string, suggestedName?: string) => Promise<boolean>;
  /** Fermer le fichier */
  closeFile: () => void;
  /** Marquer comme modifié */
  setDirty: (dirty: boolean) => void;
}

// ============================================================
// HOOK
// ============================================================

export function useFileAccess(): UseFileAccessReturn {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasStoredHandle, setHasStoredHandle] = useState(false);

  const isTauriMode = isTauri();
  const isSupported = isTauriMode || isFileSystemAccessSupported();

  // Check for stored handle/path on mount
  useEffect(() => {
    if (isTauriMode) {
      // Tauri mode: check localStorage for last file path
      const lastPath = localStorage.getItem(TAURI_LAST_FILE_KEY);
      if (lastPath) {
        setHasStoredHandle(true);
      }
    } else if (isSupported) {
      // Web mode: check IndexedDB for stored handle
      getStoredHandle().then(handle => {
        if (handle) {
          setHasStoredHandle(true);
        }
      });
    }
  }, [isTauriMode, isSupported]);

  // Load stored file (called from App after user interaction)
  const loadStoredFile = useCallback(async (): Promise<string | null> => {
    if (!isSupported) return null;

    setIsLoading(true);
    setError(null);

    try {
      if (isTauriMode) {
        // Tauri mode: load from localStorage path
        const lastPath = localStorage.getItem(TAURI_LAST_FILE_KEY);
        if (!lastPath) {
          setIsLoading(false);
          setHasStoredHandle(false);
          return null;
        }

        const fileContent = await readTextFileContents(lastPath);
        setFilePath(lastPath);
        setFileName(getFileNameFromPath(lastPath));
        setContent(fileContent);
        setIsDirty(false);
        setHasStoredHandle(false);
        setIsLoading(false);
        return fileContent;
      } else {
        // Web mode: use IndexedDB handle
        const handle = await getStoredHandle();
        if (!handle) {
          setIsLoading(false);
          setHasStoredHandle(false);
          return null;
        }

        const hasPermission = await verifyPermission(handle);
        if (!hasPermission) {
          setIsLoading(false);
          setError('Permission refusée pour accéder au fichier');
          return null;
        }

        const fileContent = await readFile(handle);
        setFileHandle(handle);
        setFileName(getFileName(handle));
        setContent(fileContent);
        setIsDirty(false);
        setHasStoredHandle(false);
        setIsLoading(false);
        return fileContent;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stored file';
      setError(message);
      setIsLoading(false);
      setHasStoredHandle(false);
      if (!isTauriMode) {
        await clearStoredHandle();
      } else {
        localStorage.removeItem(TAURI_LAST_FILE_KEY);
      }
      return null;
    }
  }, [isSupported, isTauriMode]);

  const openFile = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isTauriMode) {
        // Tauri mode: use native dialog
        const path = await openMarkdownFileDialog();
        if (!path) {
          setIsLoading(false);
          return null; // User cancelled
        }

        const fileContent = await readTextFileContents(path);
        setFilePath(path);
        setFileName(getFileNameFromPath(path));
        setContent(fileContent);
        setIsDirty(false);
        setHasStoredHandle(false);

        // Store path for next session
        localStorage.setItem(TAURI_LAST_FILE_KEY, path);

        setIsLoading(false);
        return fileContent;
      } else {
        // Web mode: use File System Access API
        const handle = await openMarkdownFile();
        if (!handle) {
          setIsLoading(false);
          return null; // User cancelled
        }

        const fileContent = await readFile(handle);
        setFileHandle(handle);
        setFileName(getFileName(handle));
        setContent(fileContent);
        setIsDirty(false);
        setHasStoredHandle(false);

        // Store handle for next session
        await storeHandle(handle);

        setIsLoading(false);
        return fileContent;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open file';
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, [isTauriMode]);

  // Load from a specific path (Tauri mode only, used by WelcomePage)
  const loadFromPath = useCallback(async (path: string): Promise<string | null> => {
    if (!isTauriMode) {
      setError('Cette fonctionnalité nécessite la version desktop.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await readTextFileContents(path);
      setFilePath(path);
      setFileName(getFileNameFromPath(path));
      setContent(fileContent);
      setIsDirty(false);
      setHasStoredHandle(false);

      // Store path for next session
      localStorage.setItem(TAURI_LAST_FILE_KEY, path);

      setIsLoading(false);
      return fileContent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file';
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, [isTauriMode]);

  const save = useCallback(async (newContent: string): Promise<boolean> => {
    if (isTauriMode) {
      if (!filePath) {
        setError('No file open');
        return false;
      }
    } else {
      if (!fileHandle) {
        setError('No file open');
        return false;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isTauriMode) {
        await writeTextFileContents(filePath!, newContent);
      } else {
        await saveFile(fileHandle!, newContent);
      }
      setContent(newContent);
      setIsDirty(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save file';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, [isTauriMode, fileHandle, filePath]);

  const saveAs = useCallback(async (newContent: string, suggestedName?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isTauriMode) {
        // Tauri mode: use native save dialog
        const path = await saveMarkdownFileDialog(suggestedName);
        if (!path) {
          setIsLoading(false);
          return false; // User cancelled
        }

        await writeTextFileContents(path, newContent);
        setFilePath(path);
        setFileName(getFileNameFromPath(path));
        setContent(newContent);
        setIsDirty(false);

        // Store path for next session
        localStorage.setItem(TAURI_LAST_FILE_KEY, path);

        setIsLoading(false);
        return true;
      } else {
        // Web mode: use File System Access API
        const handle = await saveAsMarkdownFile(newContent, suggestedName);
        if (!handle) {
          setIsLoading(false);
          return false; // User cancelled
        }

        setFileHandle(handle);
        setFileName(getFileName(handle));
        setContent(newContent);
        setIsDirty(false);

        // Store handle for next session
        await storeHandle(handle);

        setIsLoading(false);
        return true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save file';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, [isTauriMode]);

  const closeFile = useCallback(async () => {
    setFileHandle(null);
    setFilePath(null);
    setFileName(null);
    setContent(null);
    setIsDirty(false);
    setError(null);
    setHasStoredHandle(false);

    if (isTauriMode) {
      localStorage.removeItem(TAURI_LAST_FILE_KEY);
    } else {
      await clearStoredHandle();
    }
  }, [isTauriMode]);

  const setDirtyCallback = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  return {
    fileName,
    fileHandle,
    filePath,
    content,
    isLoading,
    error,
    isDirty,
    isSupported,
    hasStoredHandle,
    isTauriMode,
    openFile,
    loadStoredFile,
    loadFromPath,
    save,
    saveAs,
    closeFile,
    setDirty: setDirtyCallback,
  };
}
