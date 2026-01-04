/**
 * useKanbanColumnWidths - Hook for managing Kanban column width multipliers
 *
 * Simple 1x/2x toggle system with localStorage persistence.
 * 1x = single card width, 2x = double card width
 */

import { useState, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants/storage';

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

const STORAGE_KEY = `${STORAGE_KEYS.COLUMN_WIDTHS}-kanban`;

// ============================================================
// PERSISTENCE
// ============================================================

function loadMultipliers(): KanbanColumnMultipliers {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate all values are 1 or 2
      const result: KanbanColumnMultipliers = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value === 1 || value === 2) {
          result[key] = value as WidthMultiplier;
        }
      }
      return result;
    }
  } catch (error) {
    console.warn('[KanbanColumnWidths] Failed to load:', error);
  }
  return {};
}

function saveMultipliers(multipliers: KanbanColumnMultipliers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(multipliers));
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

export function useKanbanColumnWidths(): UseKanbanColumnWidthsReturn {
  const [multipliers, setMultipliers] = useState<KanbanColumnMultipliers>(loadMultipliers);

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
    setMultipliers(prev => {
      const current = prev[typeId] || 1;
      const newMultipliers = {
        ...prev,
        [typeId]: current === 1 ? 2 : 1,
      } as KanbanColumnMultipliers;
      saveMultipliers(newMultipliers);
      return newMultipliers;
    });
  }, []);

  /**
   * Reset all multipliers to default (1x)
   */
  const resetWidths = useCallback(() => {
    setMultipliers({});
    saveMultipliers({});
  }, []);

  return {
    multipliers,
    getMultiplier,
    getWidth,
    toggleWidth,
    resetWidths,
  };
}
