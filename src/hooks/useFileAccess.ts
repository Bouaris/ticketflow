/**
 * Hook pour gérer l'accès aux fichiers via File System Access API.
 * Supporte la persistance du handle pour rechargement automatique.
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

export interface UseFileAccessReturn {
  /** Nom du fichier ouvert */
  fileName: string | null;
  /** Handle du fichier (pour sauvegarde) */
  fileHandle: FileSystemFileHandle | null;
  /** Contenu brut du fichier */
  content: string | null;
  /** État de chargement */
  isLoading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Fichier modifié (non sauvegardé) */
  isDirty: boolean;
  /** API supportée */
  isSupported: boolean;
  /** Handle stocké disponible (pour auto-load) */
  hasStoredHandle: boolean;
  /** Ouvrir un fichier */
  openFile: () => Promise<string | null>;
  /** Charger le fichier stocké */
  loadStoredFile: () => Promise<string | null>;
  /** Sauvegarder dans le fichier actuel */
  save: (content: string) => Promise<boolean>;
  /** Sauvegarder sous un nouveau nom */
  saveAs: (content: string, suggestedName?: string) => Promise<boolean>;
  /** Fermer le fichier */
  closeFile: () => void;
  /** Marquer comme modifié */
  setDirty: (dirty: boolean) => void;
}

export function useFileAccess(): UseFileAccessReturn {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasStoredHandle, setHasStoredHandle] = useState(false);

  const isSupported = isFileSystemAccessSupported();

  // Check for stored handle on mount
  useEffect(() => {
    if (!isSupported) return;

    getStoredHandle().then(handle => {
      if (handle) {
        setHasStoredHandle(true);
      }
    });
  }, [isSupported]);

  // Load stored file (called from App after user interaction)
  const loadStoredFile = useCallback(async (): Promise<string | null> => {
    if (!isSupported) return null;

    setIsLoading(true);
    setError(null);

    try {
      const handle = await getStoredHandle();
      if (!handle) {
        setIsLoading(false);
        setHasStoredHandle(false);
        return null;
      }

      // Request permission
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stored file';
      setError(message);
      setIsLoading(false);
      setHasStoredHandle(false);
      // Clear invalid handle
      await clearStoredHandle();
      return null;
    }
  }, [isSupported]);

  const openFile = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open file';
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, []);

  const save = useCallback(async (newContent: string): Promise<boolean> => {
    if (!fileHandle) {
      setError('No file open');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await saveFile(fileHandle, newContent);
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
  }, [fileHandle]);

  const saveAs = useCallback(async (newContent: string, suggestedName?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save file';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const closeFile = useCallback(async () => {
    setFileHandle(null);
    setFileName(null);
    setContent(null);
    setIsDirty(false);
    setError(null);
    setHasStoredHandle(false);
    await clearStoredHandle();
  }, []);

  const setDirtyCallback = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  return {
    fileName,
    fileHandle,
    content,
    isLoading,
    error,
    isDirty,
    isSupported,
    hasStoredHandle,
    openFile,
    loadStoredFile,
    save,
    saveAs,
    closeFile,
    setDirty: setDirtyCallback,
  };
}
