/**
 * Hook principal pour gérer l'état du backlog.
 */

import { useState, useCallback, useMemo } from 'react';
import { parseBacklog, getAllItems } from '../lib/parser';
import { serializeBacklog, toggleCriterion, updateItem } from '../lib/serializer';
import type {
  Backlog,
  BacklogItem,
  TableGroup,
  RawSection,
  ItemType,
  Priority,
  Effort,
  Severity,
} from '../types/backlog';

// Type guard to check if item is a BacklogItem (not TableGroup or RawSection)
function isBacklogItem(item: BacklogItem | TableGroup | RawSection): item is BacklogItem {
  // TableGroup has 'items' array, RawSection has type 'raw-section'
  // BacklogItem has 'id' but no 'items' array
  if (!('id' in item)) return false;
  if ('items' in item) return false; // TableGroup
  // Check if type is one of the BacklogItem types
  const validTypes = ['BUG', 'EXT', 'ADM', 'COS', 'LT'];
  return validTypes.includes(item.type as string);
}

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

export type ViewMode = 'kanban' | 'list';

// ============================================================
// HOOK RETURN TYPE
// ============================================================

export interface UseBacklogReturn {
  // State
  backlog: Backlog | null;
  isLoading: boolean;
  error: string | null;

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

  // Actions
  loadFromMarkdown: (markdown: string) => void;
  toMarkdown: () => string;
  updateItemById: (id: string, updates: Partial<BacklogItem>) => void;
  toggleItemCriterion: (id: string, criterionIndex: number) => void;
  addItem: (item: BacklogItem) => void;
  deleteItem: (id: string) => void;
  existingIds: string[];
  reset: () => void;
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useBacklog(): UseBacklogReturn {
  const [backlog, setBacklog] = useState<Backlog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<BacklogFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);

  // ============================================================
  // LOAD & SERIALIZE
  // ============================================================

  const loadFromMarkdown = useCallback((markdown: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = parseBacklog(markdown);
      setBacklog(parsed);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse backlog';
      setError(message);
      setIsLoading(false);
    }
  }, []);

  const toMarkdown = useCallback((): string => {
    if (!backlog) return '';
    return serializeBacklog(backlog);
  }, [backlog]);

  // ============================================================
  // ITEMS
  // ============================================================

  const allItems = useMemo(() => {
    if (!backlog) return [];
    return getAllItems(backlog);
  }, [backlog]);

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

    // Filter by search
    if (filters.search.trim()) {
      const search = filters.search.toLowerCase();
      items = items.filter(item =>
        item.id.toLowerCase().includes(search) ||
        item.title.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.userStory?.toLowerCase().includes(search)
      );
    }

    return items;
  }, [allItems, filters]);

  const itemsByType = useMemo(() => {
    // Dynamic grouping - group by whatever types exist in the items
    const grouped: Record<string, BacklogItem[]> = {};

    for (const item of filteredItems) {
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      grouped[item.type].push(item);
    }

    return grouped;
  }, [filteredItems]);

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
  // ITEM MUTATIONS
  // ============================================================

  const updateItemById = useCallback((id: string, updates: Partial<BacklogItem>) => {
    if (!backlog) return;

    setBacklog(prev => {
      if (!prev) return prev;

      const newSections = prev.sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          if (isBacklogItem(item) && item.id === id) {
            return updateItem(item, updates);
          }
          return item;
        }),
      }));

      return { ...prev, sections: newSections };
    });

    // Update selected item if it's the one being modified
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, ...updates } as BacklogItem : null);
    }
  }, [backlog, selectedItem]);

  const toggleItemCriterion = useCallback((id: string, criterionIndex: number) => {
    if (!backlog) return;

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

    // Update selected item
    if (selectedItem?.id === id && selectedItem.criteria) {
      setSelectedItem(prev => {
        if (!prev || !prev.criteria) return prev;
        const newCriteria = [...prev.criteria];
        newCriteria[criterionIndex] = {
          ...newCriteria[criterionIndex],
          checked: !newCriteria[criterionIndex].checked,
        };
        return { ...prev, criteria: newCriteria };
      });
    }
  }, [backlog, selectedItem]);

  // ============================================================
  // ADD ITEM
  // ============================================================

  const addItem = useCallback((newItem: BacklogItem) => {
    if (!backlog) return;

    setBacklog(prev => {
      if (!prev) return prev;

      // Find the right section based on item type
      const sectionMap: Record<ItemType, number> = {
        'BUG': 0,
        'EXT': 1,
        'ADM': 2,
        'COS': 3,
        'LT': 4,
      };

      const targetSectionIndex = sectionMap[newItem.type] ?? 0;

      const newSections = prev.sections.map((section, index) => {
        if (index === targetSectionIndex) {
          return {
            ...section,
            items: [...section.items, newItem],
          };
        }
        return section;
      });

      return { ...prev, sections: newSections };
    });
  }, [backlog]);

  // ============================================================
  // DELETE ITEM
  // ============================================================

  const deleteItem = useCallback((id: string) => {
    if (!backlog) return;

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

    // Clear selection if deleted item was selected
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  }, [backlog, selectedItem]);

  // ============================================================
  // EXISTING IDS
  // ============================================================

  const existingIds = useMemo(() => {
    return allItems.map(item => item.id);
  }, [allItems]);

  // ============================================================
  // RESET
  // ============================================================

  const reset = useCallback(() => {
    setBacklog(null);
    setSelectedItem(null);
    setFiltersState(DEFAULT_FILTERS);
    setError(null);
  }, []);

  return {
    // State
    backlog,
    isLoading,
    error,

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
    loadFromMarkdown,
    toMarkdown,
    updateItemById,
    toggleItemCriterion,
    addItem,
    deleteItem,
    existingIds,
    reset,
  };
}
