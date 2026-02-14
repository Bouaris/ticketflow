/**
 * useKanbanColumnWidths - Hook for managing Kanban column width multipliers
 *
 * Simple 1x/2x toggle system with localStorage persistence.
 * 1x = single card width, 2x = double card width
 *
 * Storage is PER PROJECT to avoid cross-project interference.
 */

import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS, hashPath } from '../constants/storage';

// ============================================================
// TYPES
// ============================================================

export type WidthMultiplier = 1 | 2;

export type KanbanColumnMultipliers = Record<string, WidthMultiplier>;

// ============================================================
// CONFIGURATION
// ============================================================

// Base width for a single card column
export const KANBAN_BASE_WIDTH = 320; // px

// ============================================================
// HELPERS
// ============================================================

/**
 * Get storage key for a specific project
 */
function getStorageKey(projectPath: string): string {
  return `${STORAGE_KEYS.COLUMN_WIDTHS}-kanban-${hashPath(projectPath)}`;
}

// ============================================================
// PERSISTENCE
// ============================================================

function loadMultipliers(projectPath: string): KanbanColumnMultipliers {
  if (!projectPath) return {};

  try {
    const key = getStorageKey(projectPath);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate all values are 1 or 2
      const result: KanbanColumnMultipliers = {};
      for (const [k, value] of Object.entries(parsed)) {
        if (value === 1 || value === 2) {
          result[k] = value as WidthMultiplier;
        }
      }
      return result;
    }
  } catch (error) {
    console.warn('[KanbanColumnWidths] Failed to load:', error);
  }
  return {};
}

function saveMultipliers(projectPath: string, multipliers: KanbanColumnMultipliers): void {
  if (!projectPath) return;

  try {
    const key = getStorageKey(projectPath);
    localStorage.setItem(key, JSON.stringify(multipliers));
  } catch (error) {
    console.warn('[KanbanColumnWidths] Failed to save:', error);
  }
}

// ============================================================
// HOOK
// ============================================================

export interface UseKanbanColumnWidthsReturn {
  multipliers: KanbanColumnMultipliers;
  getMultiplier: (typeId: string) => WidthMultiplier;
  getWidth: (typeId: string) => number;
  toggleWidth: (typeId: string) => void;
  resetWidths: () => void;
}

export function useKanbanColumnWidths(projectPath: string | undefined): UseKanbanColumnWidthsReturn {
  const [multipliers, setMultipliers] = useState<KanbanColumnMultipliers>(() =>
    projectPath ? loadMultipliers(projectPath) : {}
  );

  // Reload multipliers when project changes
  useEffect(() => {
    if (projectPath) {
      setMultipliers(loadMultipliers(projectPath));
    } else {
      setMultipliers({});
    }
  }, [projectPath]);

  /**
   * Get multiplier for a column (default 1x)
   */
  const getMultiplier = useCallback((typeId: string): WidthMultiplier => {
    return multipliers[typeId] || 1;
  }, [multipliers]);

  /**
   * Get computed width for a column
   */
  const getWidth = useCallback((typeId: string): number => {
    return KANBAN_BASE_WIDTH * getMultiplier(typeId);
  }, [getMultiplier]);

  /**
   * Toggle column width between 1x and 2x
   */
  const toggleWidth = useCallback((typeId: string) => {
    if (!projectPath) return;

    setMultipliers(prev => {
      const current = prev[typeId] || 1;
      const newMultipliers = {
        ...prev,
        [typeId]: current === 1 ? 2 : 1,
      } as KanbanColumnMultipliers;
      saveMultipliers(projectPath, newMultipliers);
      return newMultipliers;
    });
  }, [projectPath]);

  /**
   * Reset all multipliers to default (1x)
   */
  const resetWidths = useCallback(() => {
    if (!projectPath) return;

    setMultipliers({});
    saveMultipliers(projectPath, {});
  }, [projectPath]);

  return {
    multipliers,
    getMultiplier,
    getWidth,
    toggleWidth,
    resetWidths,
  };
}
