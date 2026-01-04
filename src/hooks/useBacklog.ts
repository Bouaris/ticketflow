/**
 * Hook principal pour gérer l'état du backlog.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { parseBacklog, getAllItems } from '../lib/parser';
import { serializeBacklog, toggleCriterion, updateItem } from '../lib/serializer';
import { isBacklogItem } from '../types/guards';
import { getSearchEngine } from '../lib/search';

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
// HISTORY CONFIG
// ============================================================

const MAX_HISTORY = 50;

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
  removeSection: (typeId: string) => void;
  syncToc: () => void;
  deleteItem: (id: string) => void;
  moveItemToType: (itemId: string, targetType: ItemType) => void;
  existingIds: string[];
  reset: () => void;

  // History (Undo/Redo)
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
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

  // History for undo/redo
  const [past, setPast] = useState<Backlog[]>([]);
  const [future, setFuture] = useState<Backlog[]>([]);
  const isUndoRedoRef = useRef(false); // Flag to skip history push during undo/redo

  // Push current state to history before mutations
  const pushToHistory = useCallback(() => {
    if (backlog && !isUndoRedoRef.current) {
      setPast(prev => {
        const newPast = [...prev, backlog];
        return newPast.length > MAX_HISTORY ? newPast.slice(-MAX_HISTORY) : newPast;
      });
      setFuture([]); // Clear future on new change
    }
  }, [backlog]);

  // Undo: restore previous state
  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    isUndoRedoRef.current = true;
    setPast(newPast);
    if (backlog) {
      setFuture(prev => [backlog, ...prev]);
    }
    setBacklog(previous);
    setSelectedItem(null); // Clear selection on undo
    isUndoRedoRef.current = false;
  }, [past, backlog]);

  // Redo: restore next state
  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    isUndoRedoRef.current = true;
    setFuture(newFuture);
    if (backlog) {
      setPast(prev => [...prev, backlog]);
    }
    setBacklog(next);
    setSelectedItem(null); // Clear selection on redo
    isUndoRedoRef.current = false;
  }, [future, backlog]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // ============================================================
  // LOAD & SERIALIZE
  // ============================================================

  // Helper to synchronize TOC immediately on a backlog
  const syncTocOnBacklog = (bl: Backlog): Backlog => {
    const tocLines = bl.tableOfContents.split('\n');
    const newTocLines: string[] = [];

    // Build list of sections (excluding Légende)
    const sectionsToInclude = bl.sections.filter(s =>
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
        const legendeSection = bl.sections.find(s =>
          s.title.toLowerCase().includes('légende') ||
          s.title.toLowerCase().includes('legende')
        );
        if (legendeSection) {
          const num = bl.sections.indexOf(legendeSection) + 1;
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
    if (newToc === bl.tableOfContents) {
      return bl; // No changes needed
    }

    return { ...bl, tableOfContents: newToc };
  };

  const loadFromMarkdown = useCallback((markdown: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = parseBacklog(markdown);
      // Sync TOC immediately to avoid race condition
      const synced = syncTocOnBacklog(parsed);
      setBacklog(synced);
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

  // Index items for fast search
  useEffect(() => {
    if (allItems.length > 0) {
      const searchEngine = getSearchEngine();
      searchEngine.indexAll(allItems);
    }
  }, [allItems]);

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

    // Filter by search (using MiniSearch for fast indexed search)
    if (filters.search.trim()) {
      const searchEngine = getSearchEngine();
      const matchingIds = new Set(searchEngine.search(filters.search));

      // If search engine has results, use them; otherwise fallback to basic search
      if (matchingIds.size > 0) {
        items = items.filter(item => matchingIds.has(item.id));
      } else {
        // Fallback for edge cases (new items not yet indexed)
        const search = filters.search.toLowerCase();
        items = items.filter(item =>
          item.id.toLowerCase().includes(search) ||
          item.title.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search) ||
          item.userStory?.toLowerCase().includes(search)
        );
      }
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

    pushToHistory(); // Save state before mutation

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
  }, [backlog, selectedItem, pushToHistory]);

  const toggleItemCriterion = useCallback((id: string, criterionIndex: number) => {
    if (!backlog) return;

    pushToHistory(); // Save state before mutation

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
  }, [backlog, pushToHistory]);

  // ============================================================
  // ADD ITEM
  // ============================================================

  const addItem = useCallback((newItem: BacklogItem) => {
    if (!backlog) return;

    pushToHistory(); // Save state before mutation

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
  }, [backlog, pushToHistory]);

  // ============================================================
  // DELETE ITEM
  // ============================================================

  const deleteItem = useCallback((id: string) => {
    if (!backlog) return;

    pushToHistory(); // Save state before mutation

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
  }, [backlog, selectedItem, pushToHistory]);

  // ============================================================
  // MOVE ITEM TO TYPE (Cross-column drag & drop)
  // ============================================================

  const moveItemToType = useCallback((itemId: string, targetType: ItemType) => {
    if (!backlog) return;

    // Find the item
    const item = allItems.find(i => i.id === itemId);
    if (!item || item.type === targetType) return;

    pushToHistory(); // Save state before mutation

    // Generate new ID for target type (compute from allItems to avoid circular dependency)
    const allIds = allItems.map(i => i.id);
    const prefix = targetType;
    const existingNumbers = allIds
      .filter(id => id.startsWith(prefix + '-'))
      .map(id => parseInt(id.split('-')[1], 10))
      .filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const newId = `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;

    // Create modified item with new type and ID (use item found above, not from callback)
    const movedItem: BacklogItem = {
      ...item,
      id: newId,
      type: targetType,
      rawMarkdown: '', // Will be rebuilt by serializer
      _modified: true,
    } as BacklogItem & { _modified: boolean };

    setBacklog(prev => {
      if (!prev) return prev;

      // 1. Remove item from original section
      const sectionsWithoutItem = prev.sections.map(section => ({
        ...section,
        items: section.items.filter(sItem => {
          if (isBacklogItem(sItem) && sItem.id === itemId) {
            return false;
          }
          return true;
        }),
      }));

      // 3. Find target section for new type
      // Strategy 1: Find section with existing items of same type
      let targetSectionIndex = sectionsWithoutItem.findIndex(section =>
        section.items.some(sItem => isBacklogItem(sItem) && sItem.type === targetType)
      );

      // Strategy 2: Match section by title/label
      if (targetSectionIndex === -1) {
        const TYPE_LABEL_MAP: Record<string, string[]> = {
          'BUG': ['BUGS', 'BUG'],
          'CT': ['COURT TERME', 'CT', 'COURT-TERME'],
          'LT': ['LONG TERME', 'LT', 'LONG-TERME'],
          'AUTRE': ['AUTRES', 'AUTRE', 'IDÉES', 'IDEES', 'AUTRES IDÉES'],
          'TEST': ['TESTS', 'TEST'],
          'DFA': ['DADA', 'DFA'],
        };
        const matchLabels = TYPE_LABEL_MAP[targetType] || [targetType];

        targetSectionIndex = sectionsWithoutItem.findIndex(section => {
          const titleUpper = section.title.toUpperCase();
          return matchLabels.some(label => titleUpper.includes(label));
        });
      }

      // Strategy 3: Check for HTML comment marker
      if (targetSectionIndex === -1) {
        targetSectionIndex = sectionsWithoutItem.findIndex(section =>
          section.items.some(sItem => {
            if ('rawMarkdown' in sItem) {
              const marker = `<!-- Type: ${targetType} -->`;
              return sItem.rawMarkdown.includes(marker);
            }
            return false;
          })
        );
      }

      // Fallback: first non-raw section
      if (targetSectionIndex === -1) {
        for (let i = 0; i < sectionsWithoutItem.length; i++) {
          const section = sectionsWithoutItem[i];
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

      // 4. Add item to target section
      const newSections = sectionsWithoutItem.map((section, index) => {
        if (index === targetSectionIndex) {
          return {
            ...section,
            items: [...section.items, movedItem],
          };
        }
        return section;
      });

      return { ...prev, sections: newSections };
    });

    // Clear selection after move
    setSelectedItem(null);
  }, [backlog, allItems, pushToHistory]);

  // ============================================================
  // ADD SECTION (for new types)
  // ============================================================

  const addSection = useCallback((typeId: string, label: string) => {
    if (!backlog) return;

    pushToHistory(); // Save state before mutation

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
  }, [backlog, pushToHistory]);

  // ============================================================
  // REMOVE SECTION (for type deletion)
  // ============================================================

  const removeSection = useCallback((typeId: string) => {
    if (!backlog) return;

    pushToHistory(); // Save state before mutation

    setBacklog(prev => {
      if (!prev) return prev;

      const typeIdUpper = typeId.toUpperCase();

      // Mapping of type IDs to possible section labels
      const TYPE_TO_LABELS: Record<string, string[]> = {
        'BUG': ['BUGS', 'BUG'],
        'CT': ['COURT TERME', 'COURT-TERME', 'CT'],
        'LT': ['LONG TERME', 'LONG-TERME', 'LT'],
        'AUTRE': ['AUTRES IDÉES', 'AUTRES IDEES', 'AUTRES', 'AUTRE'],
        'TEST': ['TESTS', 'TEST'],
      };

      const possibleLabels = TYPE_TO_LABELS[typeIdUpper] || [typeIdUpper, typeId.replace(/_/g, ' ')];

      // Find section to remove
      const sectionIndex = prev.sections.findIndex(s => {
        const titleUpper = s.title.toUpperCase().trim();
        return possibleLabels.some(label =>
          titleUpper === label ||
          titleUpper.startsWith(label + ' ') ||
          titleUpper === typeIdUpper
        );
      });

      // Section not found
      if (sectionIndex === -1) {
        return prev;
      }

      // Remove the section
      let newSections = prev.sections.filter((_, idx) => idx !== sectionIndex);

      // Renumber remaining sections
      newSections = newSections.map((section, index) => {
        const newId = String(index + 1);
        const newRawHeader = section.rawHeader.replace(/^## \d+\./, `## ${newId}.`);
        return {
          ...section,
          id: newId,
          rawHeader: newRawHeader,
        };
      });

      // Update TOC - rebuild from sections
      const tocHeader = '## Table des matières';
      const newTocEntries: string[] = [];

      for (let i = 0; i < newSections.length; i++) {
        const section = newSections[i];
        const num = i + 1;
        const label = section.title;
        const anchor = `${num}-${label.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')}`;
        newTocEntries.push(`${num}. [${label}](#${anchor})`);
      }

      const newToc = `${tocHeader}\n${newTocEntries.join('\n')}\n`;

      return { ...prev, sections: newSections, tableOfContents: newToc };
    });
  }, [backlog, pushToHistory]);

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
    removeSection,
    syncToc,
    deleteItem,
    moveItemToType,
    existingIds,
    reset,

    // History (Undo/Redo)
    canUndo,
    canRedo,
    undo,
    redo,
  };
}
