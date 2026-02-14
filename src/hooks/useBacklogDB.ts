/**
 * useBacklogDB - SQLite-backed backlog state management.
 *
 * This hook provides the same interface as useBacklog but persists
 * all data to SQLite instead of Markdown files.
 *
 * Key differences from useBacklog:
 * - Data is loaded from SQLite on project change
 * - Mutations write to DB immediately
 * - History uses useHistoryDB for persistent undo/redo
 * - No loadFromMarkdown/toMarkdown (import/export in Plan 03)
 *
 * @module hooks/useBacklogDB
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  Backlog,
  BacklogItem,
  Section,
  ItemType,
  Priority,
  Effort,
  Severity,
} from '../types/backlog';
import { isBacklogItem } from '../types/guards';
import { findTargetSectionIndex, TYPE_TO_SECTION_LABELS } from '../lib/itemPlacement';
import { toggleCriterion, updateItem as serializerUpdateItem } from '../lib/serializer';

// DB queries
import { getOrCreateProject } from '../db/queries/projects';
import { getAllSections, insertSection, deleteSection as dbDeleteSection } from '../db/queries/sections';
import { getAllItems, insertItem, updateItem as dbUpdateItem, deleteItem as dbDeleteItem } from '../db/queries/items';
import { getNextItemNumber } from '../db/queries/counters';
import { searchItemIds } from '../db/queries/search';
import { getTypeConfigs, getDefaultTypeConfigs, bulkUpsertTypeConfigs } from '../db/queries/type-configs';
import { getArchivedItemIds } from '../db/queries/archive';
import { dbSectionToSection, type TypeConfig } from '../db/transforms';

// History hook
import { useHistoryDB } from './useHistoryDB';

// Markdown export
import { exportDbToMarkdown } from '../lib/markdown-export';

// ============================================================
// FILTER STATE
// ============================================================

export interface BacklogFilters {
  types: ItemType[];
  priorities: Priority[];
  efforts: Effort[];
  severities: Severity[];
  search: string;
}

const DEFAULT_FILTERS: BacklogFilters = {
  types: [],
  priorities: [],
  efforts: [],
  severities: [],
  search: '',
};

// ============================================================
// VIEW STATE
// ============================================================

export type ViewMode = 'kanban' | 'list' | 'graph' | 'dashboard' | 'archive';

// ============================================================
// HOOK RETURN TYPE
// ============================================================

export interface UseBacklogDBReturn {
  // State
  backlog: Backlog | null;
  isLoading: boolean;
  error: string | null;

  // Project
  projectId: number | null;
  typeConfigs: TypeConfig[];

  // Filters
  filters: BacklogFilters;
  setFilters: (filters: Partial<BacklogFilters>) => void;
  resetFilters: () => void;

  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Items
  allItems: BacklogItem[];
  filteredItems: BacklogItem[];
  itemsByType: Record<string, BacklogItem[]>;

  // Selected item
  selectedItem: BacklogItem | null;
  selectItem: (item: BacklogItem | null) => void;

  // Actions (matching useBacklog interface)
  updateItemById: (id: string, updates: Partial<BacklogItem>) => Promise<void>;
  toggleItemCriterion: (id: string, criterionIndex: number) => Promise<void>;
  addItem: (item: BacklogItem) => Promise<void>;
  addSection: (typeId: string, label: string) => Promise<void>;
  removeSection: (typeId: string) => Promise<void>;
  syncToc: () => void;
  deleteItem: (id: string) => Promise<void>;
  moveItemToType: (itemId: string, targetType: ItemType) => Promise<void>;
  existingIds: string[];
  refreshArchivedIds: () => Promise<void>;
  reset: () => void;

  // Reload data from DB
  reload: () => Promise<void>;

  // Export to Markdown (for file save compatibility)
  toMarkdown: () => Promise<string>;

  // History (Undo/Redo)
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useBacklogDB(projectPath: string | null): UseBacklogDBReturn {
  // Core state
  const [backlog, setBacklog] = useState<Backlog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  // UI state
  const [filters, setFiltersState] = useState<BacklogFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);

  // Refs for avoiding stale closures
  const backlogRef = useRef<Backlog | null>(null);
  const projectIdRef = useRef<number | null>(null);

  // Keep refs in sync
  useEffect(() => {
    backlogRef.current = backlog;
    projectIdRef.current = projectId;
  }, [backlog, projectId]);

  // History hook (persistent undo/redo)
  const history = useHistoryDB(projectPath, projectId);

  // ============================================================
  // DATA LOADING
  // ============================================================

  /**
   * Load backlog data from SQLite.
   */
  const loadFromDB = useCallback(async () => {
    if (!projectPath) {
      setBacklog(null);
      setProjectId(null);
      setTypeConfigs([]);
      setArchivedIds([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get or create project
      const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
      const pid = await getOrCreateProject(projectPath, projectName);
      setProjectId(pid);
      projectIdRef.current = pid;

      // Load type configs (or create defaults)
      let configs = await getTypeConfigs(projectPath, pid);
      if (configs.length === 0) {
        configs = getDefaultTypeConfigs();
        await bulkUpsertTypeConfigs(projectPath, pid, configs);
      }
      setTypeConfigs(configs);

      // Load sections and items
      const dbSections = await getAllSections(projectPath, pid);
      const allDbItems = await getAllItems(projectPath, pid);

      // Build the Backlog object with items grouped by section
      const loadedBacklog: Backlog = {
        header: '',
        tableOfContents: '',
        sections: dbSections.map((dbSection, index) => {
          // Get items for this section based on their sectionIndex matching section position
          const sectionItems = allDbItems.filter(
            item => item.sectionIndex === index || item.sectionIndex === dbSection.position
          );
          return dbSectionToSection(dbSection, sectionItems);
        }),
        footer: undefined,
      };

      setBacklog(loadedBacklog);
      backlogRef.current = loadedBacklog;

      // Load archived item IDs to prevent ID collisions in generateTempId/validation
      const archIds = await getArchivedItemIds(projectPath, pid);
      setArchivedIds(archIds);

    } catch (err) {
      // Tauri IPC errors are often plain strings, not Error instances
      const message = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Failed to load backlog from database';
      setError(message);
      console.error('[useBacklogDB] Error loading backlog:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // Load on project change
  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  /**
   * Reload data from DB (public method).
   */
  const reload = useCallback(async () => {
    await loadFromDB();
  }, [loadFromDB]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const allItems = useMemo(() => {
    if (!backlog) return [];
    const items: BacklogItem[] = [];
    for (const section of backlog.sections) {
      for (const item of section.items) {
        if (isBacklogItem(item)) {
          items.push(item);
        }
      }
    }
    return items;
  }, [backlog]);

  // FTS5 search state (async results from SQLite)
  const [searchResultIds, setSearchResultIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!filters.search.trim()) {
      setSearchResultIds(null);
      return;
    }

    if (!projectPath || projectIdRef.current === null) {
      setSearchResultIds(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const resultIds = await searchItemIds(
          projectPath,
          projectIdRef.current!,
          filters.search
        );
        if (!cancelled) {
          setSearchResultIds(new Set(resultIds));
        }
      } catch (error) {
        console.error('[useBacklogDB] FTS5 search error:', error);
        if (!cancelled) {
          setSearchResultIds(new Set());
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters.search, projectPath]);

  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by type
    if (filters.types.length > 0) {
      items = items.filter(item => filters.types.includes(item.type));
    }

    // Filter by priority
    if (filters.priorities.length > 0) {
      items = items.filter(item => item.priority && filters.priorities.includes(item.priority));
    }

    // Filter by effort
    if (filters.efforts.length > 0) {
      items = items.filter(item => item.effort && filters.efforts.includes(item.effort));
    }

    // Filter by severity
    if (filters.severities.length > 0) {
      items = items.filter(item => item.severity && filters.severities.includes(item.severity));
    }

    // Filter by search (FTS5-backed)
    if (filters.search.trim()) {
      if (searchResultIds !== null && searchResultIds.size > 0) {
        items = items.filter(item => searchResultIds.has(item.id));
      } else if (searchResultIds !== null && searchResultIds.size === 0) {
        // FTS5 returned empty -- fallback to simple string matching
        const search = filters.search.toLowerCase();
        items = items.filter(item =>
          item.id.toLowerCase().includes(search) ||
          item.title.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search) ||
          item.userStory?.toLowerCase().includes(search)
        );
      }
      // searchResultIds === null means search hasn't resolved yet; show all items
    }

    return items;
  }, [allItems, filters, searchResultIds]);

  const itemsByType = useMemo(() => {
    const grouped: Record<string, BacklogItem[]> = {};
    for (const item of filteredItems) {
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      grouped[item.type].push(item);
    }
    return grouped;
  }, [filteredItems]);

  const existingIds = useMemo(() => {
    const activeIds = allItems.map(item => item.id);
    // Include archived IDs to prevent ID collisions in generateTempId and validation
    return [...activeIds, ...archivedIds];
  }, [allItems, archivedIds]);

  /**
   * Refresh the cached archived item IDs.
   * Call after archive/restore operations to keep existingIds accurate.
   */
  const refreshArchivedIds = useCallback(async () => {
    if (!projectPath || projectIdRef.current === null) return;
    const archIds = await getArchivedItemIds(projectPath, projectIdRef.current);
    setArchivedIds(archIds);
  }, [projectPath]);

  // ============================================================
  // FILTERS
  // ============================================================

  const setFilters = useCallback((newFilters: Partial<BacklogFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // ============================================================
  // ITEM SELECTION
  // ============================================================

  const selectItem = useCallback((item: BacklogItem | null) => {
    setSelectedItem(item);
  }, []);

  // ============================================================
  // HISTORY HELPERS
  // ============================================================

  const pushCurrentToHistory = useCallback(async (description: string) => {
    if (!backlogRef.current) return;
    const json = JSON.stringify(backlogRef.current);
    await history.pushToHistory(json, description);
  }, [history]);

  // ============================================================
  // MUTATIONS
  // ============================================================

  /**
   * Update an item by ID.
   */
  const updateItemById = useCallback(async (id: string, updates: Partial<BacklogItem>) => {
    if (!projectPath || !backlogRef.current) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Update item ${id}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    // Update in DB
    await dbUpdateItem(projectPath, id, updates);

    // Update local state
    setBacklog(prev => {
      if (!prev) return prev;

      const newSections = prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          if (isBacklogItem(item) && item.id === id) {
            return serializerUpdateItem(item, updates);
          }
          return item;
        }),
      }));

      return { ...prev, sections: newSections };
    });

    // Update selected item if needed
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, ...updates } as BacklogItem : null);
    }
  }, [projectPath, selectedItem, pushCurrentToHistory]);

  /**
   * Toggle a criterion checkbox on an item.
   */
  const toggleItemCriterion = useCallback(async (id: string, criterionIndex: number) => {
    if (!projectPath || !backlogRef.current) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Toggle criterion on ${id}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    // Update local state
    setBacklog(prev => {
      if (!prev) return prev;

      const newSections = prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          if (isBacklogItem(item) && item.id === id) {
            return toggleCriterion(item, criterionIndex);
          }
          return item;
        }),
      }));

      return { ...prev, sections: newSections };
    });

    // Find the updated item and persist to DB
    const item = allItems.find(i => i.id === id);
    if (item?.criteria) {
      const newCriteria = item.criteria.map((c, idx) =>
        idx === criterionIndex ? { ...c, checked: !c.checked } : c
      );
      await dbUpdateItem(projectPath, id, { criteria: newCriteria });
    }

    // Update selected item
    setSelectedItem(prev => {
      if (!prev || prev.id !== id) return prev;
      return toggleCriterion(prev, criterionIndex);
    });
  }, [projectPath, allItems, pushCurrentToHistory]);

  /**
   * Add a new item.
   */
  const addItem = useCallback(async (newItem: BacklogItem) => {
    if (!projectPath || !backlogRef.current || projectIdRef.current === null) {
      return;
    }

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Add item ${newItem.id}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    // Find target section
    const targetSectionIndex = findTargetSectionIndex(backlogRef.current.sections, newItem.type);
    const section = backlogRef.current.sections[targetSectionIndex];

    if (!section) {
      throw new Error(`No section found for type "${newItem.type}". Available sections: ${backlogRef.current.sections.map(s => s.title).join(', ')}`);
    }

    // Get section ID (numeric from DB)
    const sectionId = parseInt(section.id, 10);

    // Insert into DB (with error handling to prevent silent failures)
    try {
      await insertItem(projectPath, newItem, projectIdRef.current, sectionId);
    } catch (error) {
      console.error('[DEBUG-ADD] insertItem FAILED:', error);
      // Re-throw to propagate error to caller
      throw error;
    }

    // Update local state (only if DB insert succeeded)
    setBacklog(prev => {
      if (!prev) return prev;

      if (prev.sections.length === 0) {
        const defaultSection: Section = {
          id: '1',
          title: 'Backlog',
          rawHeader: '## 1. Backlog',
          items: [newItem],
        };
        return { ...prev, sections: [defaultSection] };
      }

      const newSections = prev.sections.map((s, index) => {
        if (index === targetSectionIndex) {
          return { ...s, items: [...s.items, newItem] };
        }
        return s;
      });

      return { ...prev, sections: newSections };
    });
  }, [projectPath, pushCurrentToHistory]);

  /**
   * Delete an item.
   */
  const deleteItem = useCallback(async (id: string) => {
    if (!projectPath || !backlogRef.current) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Delete item ${id}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    // Delete from DB
    await dbDeleteItem(projectPath, id);

    // Update local state
    setBacklog(prev => {
      if (!prev) return prev;

      const newSections = prev.sections.map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (isBacklogItem(item)) {
            return item.id !== id;
          }
          return true;
        }),
      }));

      return { ...prev, sections: newSections };
    });

    // Clear selection if deleted
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  }, [projectPath, selectedItem, pushCurrentToHistory]);

  /**
   * Move an item to a different type (cross-column drag).
   */
  const moveItemToType = useCallback(async (itemId: string, targetType: ItemType) => {
    if (!projectPath || !backlogRef.current || projectIdRef.current === null) return;

    const item = allItems.find(i => i.id === itemId);
    if (!item || item.type === targetType) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Move item ${itemId} to ${targetType}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    // Generate new ID using monotonic counter
    const nextNum = await getNextItemNumber(projectPath, projectIdRef.current, targetType);
    const newId = `${targetType}-${String(nextNum).padStart(3, '0')}`;

    // Find target section
    const targetSectionIndex = findTargetSectionIndex(backlogRef.current.sections, targetType);
    const targetSection = backlogRef.current.sections[targetSectionIndex];
    const targetSectionId = targetSection ? parseInt(targetSection.id, 10) : 1;

    // Delete old item and insert new one with updated type/id
    await dbDeleteItem(projectPath, itemId);
    const movedItem: BacklogItem = {
      ...item,
      id: newId,
      type: targetType,
      rawMarkdown: '',
    };
    await insertItem(projectPath, movedItem, projectIdRef.current, targetSectionId);

    // Update local state
    setBacklog(prev => {
      if (!prev) return prev;

      // Remove from original section
      const sectionsWithoutItem = prev.sections.map(section => ({
        ...section,
        items: section.items.filter(sItem =>
          !(isBacklogItem(sItem) && sItem.id === itemId)
        ),
      }));

      // Add to target section
      const newSections = sectionsWithoutItem.map((section, index) => {
        if (index === targetSectionIndex) {
          return { ...section, items: [...section.items, movedItem] };
        }
        return section;
      });

      return { ...prev, sections: newSections };
    });

    setSelectedItem(null);
  }, [projectPath, allItems, pushCurrentToHistory]);

  /**
   * Add a new section for a type.
   */
  const addSection = useCallback(async (typeId: string, label: string) => {
    if (!projectPath || !backlogRef.current || projectIdRef.current === null) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Add section for ${typeId}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    const displayLabel = label.toUpperCase();

    // Check if section already exists
    const existingIndex = backlogRef.current.sections.findIndex(s => {
      const titleUpper = s.title.toUpperCase();
      return titleUpper.includes(typeId.toUpperCase()) || titleUpper.includes(displayLabel);
    });

    if (existingIndex !== -1) return;

    // Find insert position (before Légende)
    let insertIndex = backlogRef.current.sections.length;
    for (let i = 0; i < backlogRef.current.sections.length; i++) {
      const section = backlogRef.current.sections[i];
      if (section.title.toLowerCase().includes('légende') ||
          section.title.toLowerCase().includes('legende')) {
        insertIndex = i;
        break;
      }
    }

    const sectionNumber = insertIndex + 1;
    const rawHeader = `## ${sectionNumber}. ${displayLabel}`;

    // Insert into DB
    await insertSection(projectPath, projectIdRef.current, displayLabel, insertIndex, rawHeader);

    // Reload to get fresh state
    await loadFromDB();
  }, [projectPath, pushCurrentToHistory, loadFromDB]);

  /**
   * Remove a section.
   */
  const removeSection = useCallback(async (typeId: string) => {
    if (!projectPath || !backlogRef.current || projectIdRef.current === null) return;

    // Push current state to history (non-blocking - history is not critical path)
    pushCurrentToHistory(`Remove section for ${typeId}`).catch(err =>
      console.error('[useBacklogDB] History save failed:', err)
    );

    const typeIdUpper = typeId.toUpperCase();
    const possibleLabels = TYPE_TO_SECTION_LABELS[typeIdUpper] || [typeIdUpper, typeId.replace(/_/g, ' ')];

    // Find section to remove
    const sectionIndex = backlogRef.current.sections.findIndex(s => {
      const titleUpper = s.title.toUpperCase().trim();
      return possibleLabels.some(label =>
        titleUpper === label ||
        titleUpper.startsWith(label + ' ') ||
        titleUpper === typeIdUpper
      );
    });

    if (sectionIndex === -1) return;

    const section = backlogRef.current.sections[sectionIndex];
    const sectionId = parseInt(section.id, 10);

    // Delete from DB (will cascade delete items)
    await dbDeleteSection(projectPath, sectionId);

    // Reload
    await loadFromDB();
  }, [projectPath, pushCurrentToHistory, loadFromDB]);

  /**
   * Sync TOC (no-op for DB-backed, TOC is generated on export).
   */
  const syncToc = useCallback(() => {
    // TOC synchronization is handled during Markdown export
    // For DB-backed storage, this is a no-op
  }, []);

  /**
   * Reset all state.
   */
  const reset = useCallback(() => {
    setBacklog(null);
    setSelectedItem(null);
    setFiltersState(DEFAULT_FILTERS);
    setError(null);
    setProjectId(null);
    setTypeConfigs([]);
    setArchivedIds([]);
  }, []);

  // ============================================================
  // MARKDOWN EXPORT
  // ============================================================

  /**
   * Export backlog data to Markdown format.
   * Used for file saving and compatibility with Markdown-based workflows.
   */
  const toMarkdown = useCallback(async (): Promise<string> => {
    if (!projectPath || projectIdRef.current === null) {
      return '';
    }
    return exportDbToMarkdown(projectPath, projectIdRef.current, true);
  }, [projectPath]);

  // ============================================================
  // UNDO/REDO
  // ============================================================

  const undo = useCallback(async () => {
    const snapshotJson = await history.undo();
    if (snapshotJson) {
      try {
        const restoredBacklog = JSON.parse(snapshotJson) as Backlog;
        setBacklog(restoredBacklog);
        setSelectedItem(null);
      } catch (error) {
        console.error('[useBacklogDB] Error parsing undo snapshot:', error);
      }
    }
  }, [history]);

  const redo = useCallback(async () => {
    const snapshotJson = await history.redo();
    if (snapshotJson) {
      try {
        const restoredBacklog = JSON.parse(snapshotJson) as Backlog;
        setBacklog(restoredBacklog);
        setSelectedItem(null);
      } catch (error) {
        console.error('[useBacklogDB] Error parsing redo snapshot:', error);
      }
    }
  }, [history]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // State
    backlog,
    isLoading,
    error,

    // Project
    projectId,
    typeConfigs,

    // Filters
    filters,
    setFilters,
    resetFilters,

    // View
    viewMode,
    setViewMode,

    // Items
    allItems,
    filteredItems,
    itemsByType,

    // Selected item
    selectedItem,
    selectItem,

    // Actions
    updateItemById,
    toggleItemCriterion,
    addItem,
    addSection,
    removeSection,
    syncToc,
    deleteItem,
    moveItemToType,
    existingIds,
    refreshArchivedIds,
    reset,

    // Reload
    reload,

    // Export
    toMarkdown,

    // History
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
  };
}
