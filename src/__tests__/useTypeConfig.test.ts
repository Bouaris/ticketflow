/**
 * useTypeConfig & typeConfig Module Tests
 *
 * 15 tests covering:
 * - Initial state
 * - Type detection from Markdown
 * - Type CRUD operations
 * - Type reordering
 * - Visibility toggle
 * - Merge and storage functions
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypeConfig } from '../hooks/useTypeConfig';
import {
  DEFAULT_TYPE_CONFIG,
  detectTypesFromMarkdown,
  mergeTypesWithDetected,
  addType,
  removeType,
  updateType,
  reorderTypes,
  getSortedTypes,
} from '../types/typeConfig';
import type { TypeConfig, TypeDefinition } from '../types/typeConfig';

// ============================================================
// TEST FIXTURES
// ============================================================

const MARKDOWN_WITH_TYPES = `# Test Project

## 1. BUGS

### BUG-001 | Test Bug
Description

## 2. COURT TERME

### CT-001 | Test Feature
Description

## 3. CUSTOM TYPE

### CUSTOM-001 | Custom Item
Description
`;

const MARKDOWN_WITH_COMMENTS = `# Test Project

## 1. FEATURES
<!-- Type: FEAT -->

### FEAT-001 | Feature
Description
`;

// ============================================================
// PURE FUNCTIONS TESTS (1-8)
// ============================================================

describe('typeConfig Pure Functions', () => {
  test('1. detectTypesFromMarkdown extracts types from item IDs and section headers', () => {
    const types = detectTypesFromMarkdown(MARKDOWN_WITH_TYPES);

    // From item IDs: BUG, CT, CUSTOM
    expect(types).toContain('BUG');
    expect(types).toContain('CT');
    expect(types).toContain('CUSTOM');
    // Section "CUSTOM TYPE" also detected as CUSTOM_TYPE
    expect(types).toContain('CUSTOM_TYPE');
    expect(types.length).toBe(4);
  });

  test('2. detectTypesFromMarkdown extracts types from HTML comments', () => {
    const types = detectTypesFromMarkdown(MARKDOWN_WITH_COMMENTS);

    expect(types).toContain('FEAT');
  });

  test('3. mergeTypesWithDetected preserves existing customizations', () => {
    const existingConfig: TypeConfig = {
      types: [
        { id: 'BUG', label: 'My Bugs', color: '#custom', order: 0, visible: false },
      ],
      version: 1,
    };
    const detected = ['BUG', 'CT'];

    const merged = mergeTypesWithDetected(existingConfig, detected);

    // BUG should keep custom label and color
    const bugType = merged.types.find(t => t.id === 'BUG');
    expect(bugType?.label).toBe('My Bugs');
    expect(bugType?.color).toBe('#custom');
    expect(bugType?.visible).toBe(false);

    // CT should be added with defaults
    const ctType = merged.types.find(t => t.id === 'CT');
    expect(ctType).toBeDefined();
  });

  test('4. addType adds new type with correct order', () => {
    const config: TypeConfig = {
      types: [
        { id: 'BUG', label: 'Bugs', color: '#red', order: 0, visible: true },
      ],
      version: 1,
    };

    const newType = { id: 'CT', label: 'Court Terme', color: '#blue', visible: true };
    const updated = addType(config, newType);

    expect(updated.types.length).toBe(2);
    expect(updated.types[1].id).toBe('CT');
    expect(updated.types[1].order).toBe(1);
  });

  test('5. removeType removes type and tracks in deletedTypes', () => {
    const config: TypeConfig = {
      types: [
        { id: 'BUG', label: 'Bugs', color: '#red', order: 0, visible: true },
        { id: 'CT', label: 'CT', color: '#blue', order: 1, visible: true },
        { id: 'LT', label: 'LT', color: '#green', order: 2, visible: true },
      ],
      version: 1,
    };

    const updated = removeType(config, 'CT');

    expect(updated.types.length).toBe(2);
    expect(updated.types.find(t => t.id === 'CT')).toBeUndefined();
    // LT keeps its original order (no auto-reorder)
    expect(updated.types.find(t => t.id === 'LT')?.order).toBe(2);
    // CT should be tracked in deletedTypes
    expect(updated.deletedTypes).toContain('CT');
  });

  test('6. updateType updates specific type properties', () => {
    const config: TypeConfig = {
      types: [
        { id: 'BUG', label: 'Bugs', color: '#red', order: 0, visible: true },
      ],
      version: 1,
    };

    const updated = updateType(config, 'BUG', { label: 'Issues', color: '#orange' });

    expect(updated.types[0].label).toBe('Issues');
    expect(updated.types[0].color).toBe('#orange');
    expect(updated.types[0].id).toBe('BUG'); // ID unchanged
  });

  test('7. reorderTypes moves type from one position to another', () => {
    const config: TypeConfig = {
      types: [
        { id: 'A', label: 'A', color: '#a', order: 0, visible: true },
        { id: 'B', label: 'B', color: '#b', order: 1, visible: true },
        { id: 'C', label: 'C', color: '#c', order: 2, visible: true },
      ],
      version: 1,
    };

    // Move A (index 0) to index 2
    const updated = reorderTypes(config, 0, 2);
    const sorted = getSortedTypes(updated);

    expect(sorted[0].id).toBe('B');
    expect(sorted[1].id).toBe('C');
    expect(sorted[2].id).toBe('A');
  });

  test('8. getSortedTypes returns types sorted by order', () => {
    const config: TypeConfig = {
      types: [
        { id: 'C', label: 'C', color: '#c', order: 2, visible: true },
        { id: 'A', label: 'A', color: '#a', order: 0, visible: true },
        { id: 'B', label: 'B', color: '#b', order: 1, visible: true },
      ],
      version: 1,
    };

    const sorted = getSortedTypes(config);

    expect(sorted[0].id).toBe('A');
    expect(sorted[1].id).toBe('B');
    expect(sorted[2].id).toBe('C');
  });
});

// ============================================================
// HOOK TESTS (9-15)
// ============================================================

describe('useTypeConfig Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('9. initial state is DEFAULT_TYPE_CONFIG', () => {
    const { result } = renderHook(() => useTypeConfig());

    expect(result.current.config.types.length).toBe(DEFAULT_TYPE_CONFIG.types.length);
    expect(result.current.projectPath).toBeNull();
  });

  test('10. initializeForProject detects types from markdown', () => {
    const { result } = renderHook(() => useTypeConfig());

    act(() => {
      result.current.initializeForProject('/test/project', MARKDOWN_WITH_TYPES);
    });

    expect(result.current.projectPath).toBe('/test/project');
    expect(result.current.hasType('BUG')).toBe(true);
    expect(result.current.hasType('CT')).toBe(true);
    expect(result.current.hasType('CUSTOM')).toBe(true);
  });

  test('11. initializeWithTypes sets types directly', () => {
    const { result } = renderHook(() => useTypeConfig());
    const customTypes: TypeDefinition[] = [
      { id: 'X', label: 'Type X', color: '#x', order: 0, visible: true },
      { id: 'Y', label: 'Type Y', color: '#y', order: 1, visible: true },
    ];

    act(() => {
      result.current.initializeWithTypes('/test/project', customTypes);
    });

    expect(result.current.config.types.length).toBe(2);
    expect(result.current.getType('X')?.label).toBe('Type X');
  });

  test('12. addNewType adds a type', () => {
    const { result } = renderHook(() => useTypeConfig());

    act(() => {
      result.current.addNewType({ id: 'NEW', label: 'New Type', color: '#new', visible: true });
    });

    expect(result.current.hasType('NEW')).toBe(true);
  });

  test('13. removeTypeById removes a type', () => {
    const { result } = renderHook(() => useTypeConfig());

    expect(result.current.hasType('BUG')).toBe(true);

    act(() => {
      result.current.removeTypeById('BUG');
    });

    expect(result.current.hasType('BUG')).toBe(false);
  });

  test('14. toggleTypeVisibility toggles visible flag', () => {
    const { result } = renderHook(() => useTypeConfig());

    // Default visible should be true
    expect(result.current.getType('BUG')?.visible).toBe(true);

    act(() => {
      result.current.toggleTypeVisibility('BUG');
    });

    expect(result.current.getType('BUG')?.visible).toBe(false);

    act(() => {
      result.current.toggleTypeVisibility('BUG');
    });

    expect(result.current.getType('BUG')?.visible).toBe(true);
  });

  test('15. sortedTypes is memoized and sorted', () => {
    const { result } = renderHook(() => useTypeConfig());

    const sorted = result.current.sortedTypes;

    // Should be sorted by order
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].order).toBeGreaterThanOrEqual(sorted[i - 1].order);
    }

    // Same reference if config hasn't changed
    expect(result.current.sortedTypes).toBe(sorted);
  });
});
