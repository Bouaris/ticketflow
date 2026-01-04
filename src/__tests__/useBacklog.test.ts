/**
 * useBacklog Hook Tests
 *
 * 25+ tests covering the central hook:
 * - Initial state
 * - Load & parse Markdown
 * - Serialization
 * - Filtering (type, priority, severity, effort, search)
 * - Item CRUD (add, update, delete)
 * - Criterion toggle
 * - Move item to type (cross-column drag & drop)
 * - Section management
 * - Undo/Redo integration
 * - Edge cases
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBacklog } from '../hooks/useBacklog';
import type { BacklogItem, ItemType } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const MINIMAL_BACKLOG = `# Test Project - Product Backlog

> Test document

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)

---

## 1. BUGS

### BUG-001 | Test Bug
**Sévérité:** P2 - Moyenne
**Description:** A test bug

---

## 2. COURT TERME

### CT-001 | Test Feature
**Priorité:** P1 - Haute
**Description:** A test feature

---

## 3. Légende

### Légende Effort
Some content here
`;

const BACKLOG_WITH_CRITERIA = `# Test

---

## 1. BUGS

### BUG-001 | Bug with Criteria
**Description:** Test
**Critères d'acceptation:**
- [ ] First criterion
- [x] Second criterion checked
- [ ] Third criterion

---
`;

const MULTI_TYPE_BACKLOG = `# Multi-Type

---

## 1. BUGS

### BUG-001 | Bug One
**Sévérité:** P1 - Critique

### BUG-002 | Bug Two
**Sévérité:** P3 - Basse

---

## 2. COURT TERME

### CT-001 | Feature One
**Priorité:** Haute
**Effort:** M

### CT-002 | Feature Two
**Priorité:** Moyenne
**Effort:** S

---

## 3. LONG TERME

### LT-001 | Long Term One
**Priorité:** Faible

---

## 4. Légende

Content
`;

// Helper to create a mock BacklogItem
const createMockItem = (id: string, type: ItemType, title: string): BacklogItem => ({
  id,
  type,
  title,
  description: `Description for ${id}`,
  rawMarkdown: '',
  sectionIndex: 0,
  _modified: true,
} as BacklogItem);

// ============================================================
// INITIAL STATE TESTS (1-3)
// ============================================================

describe('useBacklog - Initial State', () => {
  test('1. backlog is null initially', () => {
    const { result } = renderHook(() => useBacklog());
    expect(result.current.backlog).toBeNull();
  });

  test('2. allItems is empty initially', () => {
    const { result } = renderHook(() => useBacklog());
    expect(result.current.allItems).toEqual([]);
  });

  test('3. default filters are empty arrays', () => {
    const { result } = renderHook(() => useBacklog());
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.filters.priorities).toEqual([]);
    expect(result.current.filters.severities).toEqual([]);
    expect(result.current.filters.efforts).toEqual([]);
    expect(result.current.filters.search).toBe('');
  });
});

// ============================================================
// LOAD & PARSE TESTS (4-7)
// ============================================================

describe('useBacklog - Load & Parse', () => {
  test('4. loadFromMarkdown parses backlog correctly', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    expect(result.current.backlog).not.toBeNull();
    expect(result.current.allItems.length).toBe(2);
  });

  test('5. parsed items have correct IDs and types', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');
    const feature = result.current.allItems.find(i => i.id === 'CT-001');

    expect(bug?.type).toBe('BUG');
    expect(bug?.title).toBe('Test Bug');
    expect(feature?.type).toBe('CT');
    expect(feature?.title).toBe('Test Feature');
  });

  test('6. loadFromMarkdown clears previous error', () => {
    const { result } = renderHook(() => useBacklog());

    // Load valid markdown
    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('7. multi-type backlog groups items correctly', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    expect(result.current.allItems.length).toBe(5);
    expect(result.current.itemsByType['BUG']?.length).toBe(2);
    expect(result.current.itemsByType['CT']?.length).toBe(2);
    expect(result.current.itemsByType['LT']?.length).toBe(1);
  });
});

// ============================================================
// SERIALIZATION TESTS (8-9)
// ============================================================

describe('useBacklog - Serialization', () => {
  test('8. toMarkdown returns empty string when backlog is null', () => {
    const { result } = renderHook(() => useBacklog());
    expect(result.current.toMarkdown()).toBe('');
  });

  test('9. toMarkdown returns valid Markdown after load', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const markdown = result.current.toMarkdown();
    expect(markdown).toContain('### BUG-001');
    expect(markdown).toContain('### CT-001');
  });
});

// ============================================================
// FILTER TESTS (10-14)
// ============================================================

describe('useBacklog - Filtering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('10. filter by type returns only matching items', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ types: ['BUG'] });
    });

    expect(result.current.filteredItems.length).toBe(2);
    expect(result.current.filteredItems.every(i => i.type === 'BUG')).toBe(true);
  });

  test('11. filter by multiple types returns all matching', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ types: ['BUG', 'LT'] });
    });

    expect(result.current.filteredItems.length).toBe(3);
  });

  test('12. filter by priority returns matching items', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      // Priority values are 'Haute', 'Moyenne', 'Faible' (not P1, P2, P3)
      result.current.setFilters({ priorities: ['Haute'] });
    });

    // CT-001 has Haute priority (parsed from "P1 - Haute")
    expect(result.current.filteredItems.some(i => i.id === 'CT-001')).toBe(true);
  });

  test('13. resetFilters clears all filters', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
      result.current.setFilters({ types: ['BUG'], search: 'test' });
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.types).toEqual([]);
    expect(result.current.filters.search).toBe('');
    expect(result.current.filteredItems.length).toBe(5);
  });

  test('14. search filter finds items by title', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ search: 'Long Term' });
    });

    // Fallback search should find LT-001
    expect(result.current.filteredItems.some(i => i.id === 'LT-001')).toBe(true);
  });
});

// ============================================================
// ITEM CRUD TESTS (15-18)
// ============================================================

describe('useBacklog - Item CRUD', () => {
  test('15. addItem adds item to correct section', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;
    const newItem = createMockItem('BUG-002', 'BUG', 'New Bug');

    act(() => {
      result.current.addItem(newItem);
    });

    expect(result.current.allItems.length).toBe(initialCount + 1);
    expect(result.current.allItems.find(i => i.id === 'BUG-002')).toBeDefined();
  });

  test('16. updateItemById updates item properties', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    act(() => {
      result.current.updateItemById('BUG-001', { title: 'Updated Title' });
    });

    const updated = result.current.allItems.find(i => i.id === 'BUG-001');
    expect(updated?.title).toBe('Updated Title');
  });

  test('17. deleteItem removes item from backlog', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;

    act(() => {
      result.current.deleteItem('BUG-001');
    });

    expect(result.current.allItems.length).toBe(initialCount - 1);
    expect(result.current.allItems.find(i => i.id === 'BUG-001')).toBeUndefined();
  });

  test('18. deleteItem clears selectedItem if it was selected', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');

    act(() => {
      result.current.selectItem(bug!);
    });

    expect(result.current.selectedItem?.id).toBe('BUG-001');

    act(() => {
      result.current.deleteItem('BUG-001');
    });

    expect(result.current.selectedItem).toBeNull();
  });
});

// ============================================================
// CRITERION TOGGLE TESTS (19-20)
// ============================================================

describe('useBacklog - Criterion Toggle', () => {
  test('19. toggleItemCriterion toggles criterion state', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(BACKLOG_WITH_CRITERIA);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');
    expect(bug?.criteria?.[0].checked).toBe(false);

    act(() => {
      result.current.toggleItemCriterion('BUG-001', 0);
    });

    const updatedBug = result.current.allItems.find(i => i.id === 'BUG-001');
    expect(updatedBug?.criteria?.[0].checked).toBe(true);
  });

  test('20. toggleItemCriterion updates selectedItem if selected', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(BACKLOG_WITH_CRITERIA);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');

    act(() => {
      result.current.selectItem(bug!);
    });

    act(() => {
      result.current.toggleItemCriterion('BUG-001', 0);
    });

    expect(result.current.selectedItem?.criteria?.[0].checked).toBe(true);
  });
});

// ============================================================
// MOVE ITEM TO TYPE TESTS (21-22)
// ============================================================

describe('useBacklog - Move Item to Type', () => {
  test('21. moveItemToType changes item type and generates new ID', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.moveItemToType('BUG-001', 'CT');
    });

    // BUG-001 should no longer exist
    expect(result.current.allItems.find(i => i.id === 'BUG-001')).toBeUndefined();
    // A new CT-003 should exist (CT-001, CT-002 already exist)
    expect(result.current.allItems.find(i => i.id === 'CT-003')).toBeDefined();
  });

  test('22. moveItemToType clears selection', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');

    act(() => {
      result.current.selectItem(bug!);
    });

    act(() => {
      result.current.moveItemToType('BUG-001', 'LT');
    });

    expect(result.current.selectedItem).toBeNull();
  });
});

// ============================================================
// UNDO/REDO TESTS (23-24)
// ============================================================

describe('useBacklog - Undo/Redo', () => {
  test('23. undo restores previous state after delete', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;

    act(() => {
      result.current.deleteItem('BUG-001');
    });

    expect(result.current.allItems.length).toBe(initialCount - 1);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.allItems.length).toBe(initialCount);
    expect(result.current.allItems.find(i => i.id === 'BUG-001')).toBeDefined();
  });

  test('24. redo re-applies undone action', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;

    act(() => {
      result.current.deleteItem('BUG-001');
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.allItems.length).toBe(initialCount - 1);
  });
});

// ============================================================
// SELECTION & VIEW TESTS (25-26)
// ============================================================

describe('useBacklog - Selection & View', () => {
  test('25. selectItem sets selectedItem', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const bug = result.current.allItems.find(i => i.id === 'BUG-001');

    act(() => {
      result.current.selectItem(bug!);
    });

    expect(result.current.selectedItem?.id).toBe('BUG-001');

    act(() => {
      result.current.selectItem(null);
    });

    expect(result.current.selectedItem).toBeNull();
  });

  test('26. setViewMode changes view mode', () => {
    const { result } = renderHook(() => useBacklog());

    expect(result.current.viewMode).toBe('kanban');

    act(() => {
      result.current.setViewMode('list');
    });

    expect(result.current.viewMode).toBe('list');
  });
});

// ============================================================
// RESET & EDGE CASES (27-28)
// ============================================================

describe('useBacklog - Reset & Edge Cases', () => {
  test('27. reset clears all state', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
      result.current.setFilters({ types: ['BUG'] });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.backlog).toBeNull();
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  test('28. existingIds returns all item IDs', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    expect(result.current.existingIds).toContain('BUG-001');
    expect(result.current.existingIds).toContain('CT-001');
    expect(result.current.existingIds).toContain('LT-001');
    expect(result.current.existingIds.length).toBe(5);
  });
});

// ============================================================
// FILTER BY EFFORT & SEVERITY TESTS (29-32)
// ============================================================

describe('useBacklog - Filter by Effort & Severity', () => {
  test('29. filter by severity returns matching items', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ severities: ['P1'] });
    });

    expect(result.current.filteredItems.some(i => i.id === 'BUG-001')).toBe(true);
  });

  test('30. filter by effort returns matching items', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ efforts: ['M'] });
    });

    expect(result.current.filteredItems.some(i => i.id === 'CT-001')).toBe(true);
  });

  test('31. combined filters narrow down results', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ types: ['CT'], efforts: ['S'] });
    });

    // Only CT-002 has effort S
    expect(result.current.filteredItems.length).toBe(1);
    expect(result.current.filteredItems[0].id).toBe('CT-002');
  });

  test('32. filter by multiple severities', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    act(() => {
      result.current.setFilters({ severities: ['P1', 'P3'] });
    });

    expect(result.current.filteredItems.length).toBe(2);
  });
});

// ============================================================
// ADDITIONAL EDGE CASES (33-36)
// ============================================================

describe('useBacklog - Additional Edge Cases', () => {
  test('33. updateItemById does nothing for non-existent ID', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;

    act(() => {
      result.current.updateItemById('NONEXISTENT-001', { title: 'New Title' });
    });

    expect(result.current.allItems.length).toBe(initialCount);
  });

  test('34. deleteItem does nothing for non-existent ID', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MINIMAL_BACKLOG);
    });

    const initialCount = result.current.allItems.length;

    act(() => {
      result.current.deleteItem('NONEXISTENT-001');
    });

    expect(result.current.allItems.length).toBe(initialCount);
  });

  test('35. toggleItemCriterion does nothing for non-existent item', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(BACKLOG_WITH_CRITERIA);
    });

    // Should not throw
    act(() => {
      result.current.toggleItemCriterion('NONEXISTENT', 0);
    });

    expect(result.current.allItems.length).toBe(1);
  });

  test('36. empty filters returns all items', () => {
    const { result } = renderHook(() => useBacklog());

    act(() => {
      result.current.loadFromMarkdown(MULTI_TYPE_BACKLOG);
    });

    expect(result.current.filteredItems.length).toBe(5);

    act(() => {
      result.current.setFilters({ types: [], priorities: [], severities: [], efforts: [] });
    });

    expect(result.current.filteredItems.length).toBe(5);
  });
});
