/**
 * useSavedViews - Persistent saved filter views.
 *
 * Provides CRUD for saved views with default suggested views computed on the fly.
 * User-saved views are persisted in SQLite; default views are computed, not stored.
 *
 * @module hooks/useSavedViews
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { BacklogFilters } from './useBacklogDB';
import type { Translations } from '../i18n/types';
import {
  loadSavedViews,
  insertSavedView,
  deleteSavedView as dbDeleteSavedView,
} from '../db/queries/saved-views';

// ============================================================
// TYPES
// ============================================================

export interface SavedView {
  id: number;
  name: string;
  filters: BacklogFilters;
  position: number;
  isDefault: boolean;
}

export interface UseSavedViewsReturn {
  /** User-persisted saved views */
  savedViews: SavedView[];
  /** Computed default views (not stored in DB) */
  defaultViews: SavedView[];
  /** Save the current filter as a new named view */
  saveCurrentView: (name: string, filters: BacklogFilters) => Promise<void>;
  /** Delete a user-saved view */
  deleteView: (viewId: number) => Promise<void>;
  /** Whether views are still loading */
  isLoading: boolean;
}

// ============================================================
// DEFAULT VIEWS (computed, not stored)
// ============================================================

/**
 * Build the list of default suggested views.
 * These are computed from well-known filter combinations and
 * do NOT appear in the saved_views table.
 */
function getDefaultViews(t: Translations): SavedView[] {
  const emptyFilters: BacklogFilters = {
    types: [],
    priorities: [],
    efforts: [],
    severities: [],
    search: '',
  };

  return [
    {
      id: -1,
      name: t.views.all,
      filters: { ...emptyFilters },
      position: 0,
      isDefault: true,
    },
    {
      id: -2,
      name: t.views.criticalBugs,
      filters: {
        ...emptyFilters,
        types: ['BUG'],
        severities: ['P0', 'P1'],
      },
      position: 1,
      isDefault: true,
    },
    {
      id: -3,
      name: t.views.inProgress,
      filters: {
        ...emptyFilters,
        priorities: ['Haute'],
      },
      position: 2,
      isDefault: true,
    },
    {
      id: -4,
      name: t.views.toDo,
      filters: {
        ...emptyFilters,
        priorities: ['Moyenne', 'Faible'],
      },
      position: 3,
      isDefault: true,
    },
  ];
}

// ============================================================
// HOOK
// ============================================================

export function useSavedViews(
  projectPath: string,
  projectId: number | null,
  t: Translations
): UseSavedViewsReturn {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load views from DB
  const loadViews = useCallback(async () => {
    if (!projectId) {
      setSavedViews([]);
      setIsLoading(false);
      return;
    }

    try {
      const rows = await loadSavedViews(projectPath, projectId);
      const views: SavedView[] = rows.map(row => ({
        id: row.id,
        name: row.name,
        filters: JSON.parse(row.filters_json) as BacklogFilters,
        position: row.position,
        isDefault: false,
      }));
      setSavedViews(views);
    } catch (error) {
      console.error('[useSavedViews] Error loading views:', error);
      setSavedViews([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, projectId]);

  // Load on mount and when project changes
  useEffect(() => {
    loadViews();
  }, [loadViews]);

  // Save current filter as a named view
  const saveCurrentView = useCallback(async (name: string, filters: BacklogFilters) => {
    if (!projectId) return;

    const filtersJson = JSON.stringify(filters);
    await insertSavedView(projectPath, projectId, name, filtersJson);
    await loadViews();
  }, [projectPath, projectId, loadViews]);

  // Delete a user-saved view
  const deleteView = useCallback(async (viewId: number) => {
    await dbDeleteSavedView(projectPath, viewId);
    await loadViews();
  }, [projectPath, loadViews]);

  // Default views (computed)
  const defaultViews = useMemo(() => getDefaultViews(t), [t]);

  return {
    savedViews,
    defaultViews,
    saveCurrentView,
    deleteView,
    isLoading,
  };
}
