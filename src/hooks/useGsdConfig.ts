/**
 * useGsdConfig - Hook for managing GSD (Get Shit Done) integration config
 *
 * Manages per-project GSD integration settings: toggle, depth level,
 * and detected .planning/ files for AI context injection.
 *
 * @module hooks/useGsdConfig
 */

import { useState, useEffect, useCallback } from 'react';
import { isTauri, fileExists, joinPath, getDirFromPath, listMarkdownFilesRecursive } from '../lib/tauri-bridge';
import { getGsdConfigKey } from '../constants/storage';
import { clearContextCache } from '../lib/ai-context';

// ============================================================
// TYPES
// ============================================================

export type GsdLevel = 'essential' | 'complete';

export interface GsdConfig {
  enabled: boolean;
  level: GsdLevel;
  version: number;
}

export interface UseGsdConfigReturn {
  config: GsdConfig;
  detectedFiles: string[];
  allDetectedFiles: string[];
  isDetecting: boolean;
  planningDirExists: boolean;
  setEnabled: (enabled: boolean) => void;
  setLevel: (level: GsdLevel) => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_GSD_CONFIG: GsdConfig = { enabled: false, level: 'essential', version: 1 };

/** File patterns included per GSD level (curated whitelists) */
export const GSD_LEVEL_PATTERNS: Record<GsdLevel, RegExp[]> = {
  essential: [/^PROJECT\.md$/i, /^REQUIREMENTS\.md$/i, /^ROADMAP\.md$/i],
  complete: [
    /^PROJECT\.md$/i, /^REQUIREMENTS\.md$/i, /^ROADMAP\.md$/i,
    /^STATE\.md$/i,
    /^codebase\/ARCHITECTURE\.md$/i,
    /^codebase\/STRUCTURE\.md$/i,
    /^codebase\/CONVENTIONS\.md$/i,
    /^codebase\/STACK\.md$/i,
  ],
};

// ============================================================
// HOOK
// ============================================================

export function useGsdConfig(projectPath: string | null): UseGsdConfigReturn {
  const [config, setConfig] = useState<GsdConfig>(DEFAULT_GSD_CONFIG);
  const [allDetectedFiles, setAllDetectedFiles] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [planningDirExists, setPlanningDirExists] = useState(false);

  // Get normalized directory path
  const getNormalizedPath = useCallback(() => {
    if (!projectPath) return null;
    return projectPath.endsWith('.md')
      ? getDirFromPath(projectPath)
      : projectPath;
  }, [projectPath]);

  // Load config from localStorage on mount / project change
  useEffect(() => {
    const dirPath = getNormalizedPath();
    if (!dirPath) {
      setConfig(DEFAULT_GSD_CONFIG);
      setAllDetectedFiles([]);
      setPlanningDirExists(false);
      return;
    }

    try {
      const key = getGsdConfigKey(dirPath);
      const stored = localStorage.getItem(key);
      if (stored) {
        const raw = JSON.parse(stored);
        // Migrate old levels (light -> essential, mid/full -> complete)
        let level: GsdLevel = raw.level ?? 'essential';
        if (level === 'light' as string) level = 'essential';
        if (level === 'mid' as string || level === 'full' as string) level = 'complete';
        const parsed: GsdConfig = {
          enabled: raw.enabled ?? false,
          level,
          version: raw.version ?? 1,
        };
        setConfig(parsed);
      } else {
        setConfig(DEFAULT_GSD_CONFIG);
      }
    } catch {
      setConfig(DEFAULT_GSD_CONFIG);
    }
  }, [getNormalizedPath]);

  // Detect .planning/ folder and list files when enabled
  useEffect(() => {
    const dirPath = getNormalizedPath();
    if (!dirPath || !isTauri() || !config.enabled) {
      setAllDetectedFiles([]);
      setPlanningDirExists(false);
      return;
    }

    let cancelled = false;

    async function detect() {
      setIsDetecting(true);
      try {
        const planningDir = joinPath(dirPath!, '.planning');
        const dirExists = await fileExists(planningDir);
        if (cancelled) return;

        setPlanningDirExists(dirExists);

        if (!dirExists) {
          setAllDetectedFiles([]);
          return;
        }

        const files = await listMarkdownFilesRecursive(planningDir);
        if (cancelled) return;

        setAllDetectedFiles(files);
      } catch (error) {
        console.warn('[useGsdConfig] Detection failed:', error);
        if (!cancelled) {
          setAllDetectedFiles([]);
          setPlanningDirExists(false);
        }
      } finally {
        if (!cancelled) {
          setIsDetecting(false);
        }
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [getNormalizedPath, config.enabled]);

  // Filter detected files by current level patterns (curated whitelists)
  const detectedFiles = allDetectedFiles.filter(file => {
    return GSD_LEVEL_PATTERNS[config.level].some(pattern => pattern.test(file));
  });

  // Save config helper
  const saveConfig = useCallback((newConfig: GsdConfig) => {
    const dirPath = getNormalizedPath();
    if (!dirPath) return;

    try {
      const key = getGsdConfigKey(dirPath);
      localStorage.setItem(key, JSON.stringify(newConfig));
      clearContextCache(dirPath);
    } catch (error) {
      console.warn('[useGsdConfig] Failed to save config:', error);
    }
  }, [getNormalizedPath]);

  const setEnabled = useCallback((enabled: boolean) => {
    setConfig(prev => {
      const next = { ...prev, enabled };
      saveConfig(next);
      return next;
    });
  }, [saveConfig]);

  const setLevel = useCallback((level: GsdLevel) => {
    setConfig(prev => {
      const next = { ...prev, level };
      saveConfig(next);
      return next;
    });
  }, [saveConfig]);

  return {
    config,
    detectedFiles,
    allDetectedFiles,
    isDetecting,
    planningDirExists,
    setEnabled,
    setLevel,
  };
}
