/**
 * useMultiSelect - Multi-item selection hook
 *
 * Manages selection state for Ctrl+Click toggle, Shift+Click range,
 * Select All, and Clear. Used by KanbanBoard and ListView for bulk operations.
 *
 * @module hooks/useMultiSelect
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

interface UseMultiSelectOptions {
  /** Ordered list of all selectable item IDs (for Shift+Click range and Select All) */
  itemIds: string[];
}

interface UseMultiSelectReturn {
  /** Set of currently selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Check if a specific item is selected */
  isSelected: (id: string) => boolean;
  /** Handle click with modifier keys (Ctrl for toggle, Shift for range) */
  handleSelectionClick: (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Get array of selected IDs (stable reference via useMemo) */
  selectedIdsArray: string[];
}

// ============================================================
// HOOK
// ============================================================

export function useMultiSelect({ itemIds }: UseMultiSelectOptions): UseMultiSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Anchor for Shift+Click range selection (synchronous, not render-triggering)
  const lastClickedId = useRef<string | null>(null);

  // Track itemIds reference to detect view/filter changes
  const prevItemIdsRef = useRef(itemIds);

  // Clear selection when itemIds change (view mode switch, filter change)
  useEffect(() => {
    if (prevItemIdsRef.current !== itemIds) {
      prevItemIdsRef.current = itemIds;
      setSelectedIds(new Set());
      lastClickedId.current = null;
    }
  }, [itemIds]);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const handleSelectionClick = useCallback(
    (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
      // Shift+Click: range selection
      if (event.shiftKey && lastClickedId.current !== null) {
        const anchorIndex = itemIds.indexOf(lastClickedId.current);
        const currentIndex = itemIds.indexOf(id);

        if (anchorIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          const rangeIds = itemIds.slice(start, end + 1);

          setSelectedIds(prev => {
            const next = new Set(prev);
            for (const rangeId of rangeIds) {
              next.add(rangeId);
            }
            return next;
          });
          // Don't update lastClickedId on range select (keep anchor)
          return;
        }
        // Fall through to toggle if indices not found
      }

      // Ctrl+Click or Meta+Click (Mac): toggle single item
      // Also handles Shift+Click when there's no anchor (first selection)
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        lastClickedId.current = id;
      }
    },
    [itemIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(itemIds));
  }, [itemIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedId.current = null;
  }, []);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const selectedIdsArray = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    isSelected,
    handleSelectionClick,
    selectAll,
    clearSelection,
    selectedIdsArray,
  };
}
