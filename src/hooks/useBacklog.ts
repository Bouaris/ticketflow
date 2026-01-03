/**
 * Hook principal pour gérer l'état du backlog.
 */

import { useState, useCallback, useMemo } from 'react';
import { parseBacklog, getAllItems } from '../lib/parser';
import { serializeBacklog, toggleCriterion, updateItem } from '../lib/serializer';
import { isBacklogItem } from '../types/guards';
import type {
  Backlog,
  BacklogItem,
  ItemType,
  Priority,
  Effort,
  Severity,
} from '../types/backlog';

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
  addSection: (typeId: string, label: string) => void;
  syncToc: () => void;
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

    // Update backlog sections
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

    // CRITICAL: Use functional update to avoid stale closure issues
    // This ensures the UI reflects the change immediately
    setSelectedItem(prev => {
      if (!prev || prev.id !== id) return prev;
      return toggleCriterion(prev, criterionIndex);
    });
  }, [backlog]);

  // ============================================================
  // ADD ITEM
  // ============================================================

  const addItem = useCallback((newItem: BacklogItem) => {
    if (!backlog) return;

    setBacklog(prev => {
      if (!prev) return prev;

      // If no sections exist, create a default one
      if (prev.sections.length === 0) {
        const defaultSection = {
          id: '1',
          title: 'Backlog',
          rawHeader: '## 1. Backlog',
          items: [newItem],
        };
        return { ...prev, sections: [defaultSection] };
      }

      // Find the right section using multi-strategy approach
      let targetSectionIndex = -1;

      // Strategy 1: Find section with existing items of same type
      for (let i = 0; i < prev.sections.length; i++) {
        const section = prev.sections[i];
        const hasMatchingType = section.items.some(item =>
          isBacklogItem(item) && item.type === newItem.type
        );
        if (hasMatchingType) {
          targetSectionIndex = i;
          break;
        }
      }

      // Strategy 2: Match section by title/label (for NEW types with no existing items)
      if (targetSectionIndex === -1) {
        const TYPE_LABEL_MAP: Record<string, string[]> = {
          'BUG': ['BUGS', 'BUG'],
          'CT': ['COURT TERME', 'CT', 'COURT-TERME'],
          'LT': ['LONG TERME', 'LT', 'LONG-TERME'],
          'AUTRE': ['AUTRES', 'AUTRE', 'IDÉES', 'IDEES', 'AUTRES IDÉES'],
          'TEST': ['TESTS', 'TEST'],
          'DFA': ['DADA', 'DFA'],
        };
        const matchLabels = TYPE_LABEL_MAP[newItem.type] || [newItem.type];

        for (let i = 0; i < prev.sections.length; i++) {
          const section = prev.sections[i];
          const titleUpper = section.title.toUpperCase();
          if (matchLabels.some(label => titleUpper.includes(label))) {
            targetSectionIndex = i;
            break;
          }
        }
      }

      // Strategy 3: Check for HTML comment marker <!-- Type: X -->
      if (targetSectionIndex === -1) {
        for (let i = 0; i < prev.sections.length; i++) {
          const section = prev.sections[i];
          // Check if any item in section has type marker in rawMarkdown
          const hasTypeMarker = section.items.some(item => {
            if ('rawMarkdown' in item) {
              const marker = `<!-- Type: ${newItem.type} -->`;
              return item.rawMarkdown.includes(marker);
            }
            return false;
          });
          if (hasTypeMarker) {
            targetSectionIndex = i;
            break;
          }
        }
      }

      // Strategy 4: Fallback to first non-raw section
      if (targetSectionIndex === -1) {
        for (let i = 0; i < prev.sections.length; i++) {
          const section = prev.sections[i];
          const isRawSection = section.items.length > 0 &&
            section.items[0] &&
            'type' in section.items[0] &&
            section.items[0].type === 'raw-section';
          if (!isRawSection) {
            targetSectionIndex = i;
            break;
          }
        }
      }

      // Ultimate fallback: section 0
      if (targetSectionIndex === -1) {
        targetSectionIndex = 0;
      }

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
  // ADD SECTION (for new types)
  // ============================================================

  const addSection = useCallback((typeId: string, label: string) => {
    if (!backlog) return;

    setBacklog(prev => {
      if (!prev) return prev;

      const displayLabel = label.toUpperCase();
      const tocAnchorLabel = label.toLowerCase().replace(/\s+/g, '-');

      // Check if section already exists
      const existingSectionIndex = prev.sections.findIndex(s => {
        const titleUpper = s.title.toUpperCase();
        return titleUpper.includes(typeId.toUpperCase()) ||
               titleUpper.includes(displayLabel);
      });

      // Check if TOC entry already exists for this type
      const tocHasEntry = prev.tableOfContents.toLowerCase().includes(tocAnchorLabel) ||
                          prev.tableOfContents.toUpperCase().includes(displayLabel);

      // If section exists AND TOC entry exists, nothing to do
      if (existingSectionIndex !== -1 && tocHasEntry) {
        return prev;
      }

      let newSections = [...prev.sections];
      let sectionNumber: number;

      // Create section if it doesn't exist
      if (existingSectionIndex === -1) {
        // Find the Légende section index (insert before it)
        let insertIndex = prev.sections.length;
        for (let i = 0; i < prev.sections.length; i++) {
          const section = prev.sections[i];
          if (section.title.toLowerCase().includes('légende') ||
              section.title.toLowerCase().includes('legende')) {
            insertIndex = i;
            break;
          }
        }

        sectionNumber = insertIndex + 1;
        const newSection = {
          id: String(sectionNumber),
          title: displayLabel,
          rawHeader: `## ${sectionNumber}. ${displayLabel}`,
          items: [{
            type: 'raw-section' as const,
            title: displayLabel,
            rawMarkdown: `\n<!-- Type: ${typeId} -->\n`,
            sectionIndex: 0,
          }],
        };

        newSections.splice(insertIndex, 0, newSection);

        // Renumber sections after insertion
        newSections = newSections.map((section, index) => {
          const newId = String(index + 1);
          const newRawHeader = section.rawHeader.replace(/^## \d+\./, `## ${newId}.`);
          return {
            ...section,
            id: newId,
            rawHeader: newRawHeader,
          };
        });
      } else {
        // Section exists, use its number
        sectionNumber = existingSectionIndex + 1;
      }

      // Update TOC if entry doesn't exist
      let newToc = prev.tableOfContents;
      if (!tocHasEntry) {
        const tocLines = newToc.split('\n');
        const newTocLines: string[] = [];
        let insertedInToc = false;

        for (const line of tocLines) {
          // Check if this line is the Légende entry
          if (!insertedInToc && (
            line.toLowerCase().includes('légende') ||
            line.toLowerCase().includes('legende')
          )) {
            // Insert new entry before Légende
            const anchor = `${sectionNumber}-${tocAnchorLabel}`;
            newTocLines.push(`${sectionNumber}. [${displayLabel}](#${anchor})`);
            insertedInToc = true;
          }

          // Update numbering if this is a numbered entry after the insertion point
          const numMatch = line.match(/^(\d+)\.\s*\[(.+?)\]\(#(.+?)\)$/);
          if (numMatch && insertedInToc) {
            const oldNum = parseInt(numMatch[1]);
            if (oldNum >= sectionNumber) {
              const newNum = oldNum + 1;
              const newAnchor = numMatch[3].replace(/^\d+-/, `${newNum}-`);
              newTocLines.push(`${newNum}. [${numMatch[2]}](#${newAnchor})`);
              continue;
            }
          }

          newTocLines.push(line);
        }

        // If we didn't find Légende, add at the end (before the last ---)
        if (!insertedInToc) {
          let lastDashIndex = -1;
          for (let i = newTocLines.length - 1; i >= 0; i--) {
            if (newTocLines[i].trim() === '---') {
              lastDashIndex = i;
              break;
            }
          }
          const newEntryNumber = newSections.length;
          const anchor = `${newEntryNumber}-${tocAnchorLabel}`;
          if (lastDashIndex > 0) {
            newTocLines.splice(lastDashIndex, 0, `${newEntryNumber}. [${displayLabel}](#${anchor})`);
          } else {
            newTocLines.push(`${newEntryNumber}. [${displayLabel}](#${anchor})`);
          }
        }

        newToc = newTocLines.join('\n');
      }

      return { ...prev, sections: newSections, tableOfContents: newToc };
    });
  }, [backlog]);

  // ============================================================
  // SYNC TOC - Synchronize TOC with existing sections
  // ============================================================

  const syncToc = useCallback(() => {
    if (!backlog) return;

    setBacklog(prev => {
      if (!prev) return prev;

      const tocLines = prev.tableOfContents.split('\n');
      const newTocLines: string[] = [];

      // Build list of sections (excluding Légende)
      const sectionsToInclude = prev.sections.filter(s =>
        !s.title.toLowerCase().includes('légende') &&
        !s.title.toLowerCase().includes('legende')
      );

      // Build new TOC
      let inEntries = false;
      let entriesAdded = false;

      for (let i = 0; i < tocLines.length; i++) {
        const line = tocLines[i];
        const isEntry = /^\d+\.\s*\[/.test(line);

        if (isEntry && !entriesAdded) {
          // Add all section entries
          sectionsToInclude.forEach((section, idx) => {
            const num = idx + 1;
            const anchor = `${num}-${section.title.toLowerCase().replace(/\s+/g, '-')}`;
            newTocLines.push(`${num}. [${section.title}](#${anchor})`);
          });

          // Add Légende entry
          const legendeSection = prev.sections.find(s =>
            s.title.toLowerCase().includes('légende') ||
            s.title.toLowerCase().includes('legende')
          );
          if (legendeSection) {
            const num = prev.sections.indexOf(legendeSection) + 1;
            newTocLines.push(`${num}. [Légende](#${num}-legende)`);
          }

          entriesAdded = true;
          inEntries = true;
        }

        if (inEntries && isEntry) {
          continue; // Skip old entries
        }

        if (inEntries && !isEntry) {
          inEntries = false;
        }

        if (!inEntries || !isEntry) {
          newTocLines.push(line);
        }
      }

      const newToc = newTocLines.join('\n');
      if (newToc === prev.tableOfContents) {
        return prev; // No changes needed
      }

      return { ...prev, tableOfContents: newToc };
    });
  }, [backlog]);

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
    addSection,
    syncToc,
    deleteItem,
    existingIds,
    reset,
  };
}
