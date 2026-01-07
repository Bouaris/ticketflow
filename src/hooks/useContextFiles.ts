/**
 * useContextFiles - Hook for managing AI context files configuration
 *
 * Allows users to configure which markdown files are used as context
 * for AI generation, replacing the hardcoded CLAUDE.md and AGENTS.md.
 */

import { useState, useEffect, useCallback } from 'react';
import { isTauri, listMarkdownFiles, getDirFromPath } from '../lib/tauri-bridge';
import {
  loadContextFilesConfig,
  saveContextFilesConfig,
  clearContextCache,
} from '../lib/ai-context';

// ============================================================
// TYPES
// ============================================================

export interface UseContextFilesReturn {
  /** Currently configured context files */
  contextFiles: string[];
  /** Available markdown files in project directory (excluding backlog files) */
  availableFiles: string[];
  /** Loading state */
  isLoading: boolean;
  /** Add a file to context configuration */
  addFile: (filename: string) => void;
  /** Remove a file from context configuration */
  removeFile: (filename: string) => void;
  /** Reset to default files (CLAUDE.md, AGENTS.md) */
  resetToDefaults: () => void;
  /** Reload available files from project directory */
  loadAvailableFiles: () => Promise<void>;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_FILES = ['CLAUDE.md', 'AGENTS.md'];

// Files to exclude from the available list (backlog files)
const EXCLUDED_PATTERNS = [
  /^TICKETFLOW_/i,
];

// ============================================================
// HOOK
// ============================================================

export function useContextFiles(projectPath: string | null): UseContextFilesReturn {
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get normalized directory path
  const getNormalizedPath = useCallback(() => {
    if (!projectPath) return null;
    return projectPath.endsWith('.md')
      ? getDirFromPath(projectPath)
      : projectPath;
  }, [projectPath]);

  // Load available markdown files from project directory
  const loadAvailableFiles = useCallback(async () => {
    const dirPath = getNormalizedPath();
    if (!dirPath || !isTauri()) {
      setAvailableFiles([]);
      return;
    }

    setIsLoading(true);
    try {
      const files = await listMarkdownFiles(dirPath);
      // Filter out excluded patterns (TICKETFLOW_*.md)
      const filtered = files.filter(file =>
        !EXCLUDED_PATTERNS.some(pattern => pattern.test(file))
      );
      setAvailableFiles(filtered.sort());
    } catch (error) {
      console.warn('[useContextFiles] Failed to list files:', error);
      setAvailableFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [getNormalizedPath]);

  // Load configuration when project path changes
  useEffect(() => {
    const dirPath = getNormalizedPath();
    if (!dirPath) {
      setContextFiles([]);
      return;
    }

    // Load saved configuration
    const savedFiles = loadContextFilesConfig(dirPath);
    setContextFiles(savedFiles);

    // Load available files
    loadAvailableFiles();
  }, [getNormalizedPath, loadAvailableFiles]);

  // Add a file to context
  const addFile = useCallback((filename: string) => {
    const dirPath = getNormalizedPath();
    if (!dirPath || !filename) return;

    setContextFiles(prev => {
      // Don't add duplicates
      if (prev.includes(filename)) return prev;

      const newFiles = [...prev, filename];
      // Save immediately
      saveContextFilesConfig(dirPath, newFiles);
      // Clear cache so next AI request reloads
      clearContextCache(dirPath);
      return newFiles;
    });
  }, [getNormalizedPath]);

  // Remove a file from context
  const removeFile = useCallback((filename: string) => {
    const dirPath = getNormalizedPath();
    if (!dirPath) return;

    setContextFiles(prev => {
      const newFiles = prev.filter(f => f !== filename);
      // Save immediately
      saveContextFilesConfig(dirPath, newFiles);
      // Clear cache so next AI request reloads
      clearContextCache(dirPath);
      return newFiles;
    });
  }, [getNormalizedPath]);

  // Reset to default files
  const resetToDefaults = useCallback(() => {
    const dirPath = getNormalizedPath();
    if (!dirPath) return;

    setContextFiles(DEFAULT_FILES);
    saveContextFilesConfig(dirPath, DEFAULT_FILES);
    clearContextCache(dirPath);
  }, [getNormalizedPath]);

  return {
    contextFiles,
    availableFiles,
    isLoading,
    addFile,
    removeFile,
    resetToDefaults,
    loadAvailableFiles,
  };
}
