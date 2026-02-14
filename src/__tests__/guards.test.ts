/**
 * Type Guards Tests
 *
 * 15 tests covering:
 * - isBacklogItem (4 tests)
 * - isTableGroup (3 tests)
 * - isRawSection (3 tests)
 * - isValidItemType (3 tests)
 * - hasProperty (2 tests)
 */

import { describe, test, expect } from 'vitest';
import {
  isBacklogItem,
  isTableGroup,
  isRawSection,
  isValidItemType,
  hasProperty,
} from '../types/guards';
import type { BacklogItem, TableGroup, RawSection } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const createBacklogItem = (): BacklogItem => ({
  id: 'BUG-001',
  type: 'BUG',
  title: 'Test Bug',
  rawMarkdown: '',
  sectionIndex: 0,
} as BacklogItem);

const createTableGroup = (): TableGroup => ({
  type: 'table-group',
  title: 'Legend Table',
  items: [{ id: '1', description: 'Item 1', action: 'Action 1' }],
  rawMarkdown: '',
  sectionIndex: 0,
});

const createRawSection = (): RawSection => ({
  type: 'raw-section',
  title: 'Légende',
  rawMarkdown: '## Légende\nContent',
  sectionIndex: 0,
});

// ============================================================
// isBacklogItem TESTS (1-4)
// ============================================================

describe('isBacklogItem', () => {
  test('1. returns true for BacklogItem', () => {
    expect(isBacklogItem(createBacklogItem())).toBe(true);
  });

  test('2. returns false for TableGroup', () => {
    expect(isBacklogItem(createTableGroup())).toBe(false);
  });

  test('3. returns false for RawSection', () => {
    expect(isBacklogItem(createRawSection())).toBe(false);
  });

  test('4. returns true for custom uppercase types', () => {
    const customItem = { ...createBacklogItem(), type: 'CUSTOM', id: 'CUSTOM-001' };
    expect(isBacklogItem(customItem as BacklogItem)).toBe(true);
  });
});

// ============================================================
// isTableGroup TESTS (5-7)
// ============================================================

describe('isTableGroup', () => {
  test('5. returns true for TableGroup', () => {
    expect(isTableGroup(createTableGroup())).toBe(true);
  });

  test('6. returns false for BacklogItem', () => {
    expect(isTableGroup(createBacklogItem())).toBe(false);
  });

  test('7. returns false for RawSection', () => {
    expect(isTableGroup(createRawSection())).toBe(false);
  });
});

// ============================================================
// isRawSection TESTS (8-10)
// ============================================================

describe('isRawSection', () => {
  test('8. returns true for RawSection', () => {
    expect(isRawSection(createRawSection())).toBe(true);
  });

  test('9. returns false for BacklogItem', () => {
    expect(isRawSection(createBacklogItem())).toBe(false);
  });

  test('10. returns false for TableGroup', () => {
    expect(isRawSection(createTableGroup())).toBe(false);
  });
});

// ============================================================
// isValidItemType TESTS (11-13)
// ============================================================

describe('isValidItemType', () => {
  test('11. returns true for uppercase types', () => {
    expect(isValidItemType('BUG')).toBe(true);
    expect(isValidItemType('CT')).toBe(true);
    expect(isValidItemType('LT')).toBe(true);
    expect(isValidItemType('AUTRE')).toBe(true);
  });

  test('12. returns false for lowercase types', () => {
    expect(isValidItemType('bug')).toBe(false);
    expect(isValidItemType('Bug')).toBe(false);
  });

  test('13. returns false for non-string values', () => {
    expect(isValidItemType(123)).toBe(false);
    expect(isValidItemType(null)).toBe(false);
    expect(isValidItemType(undefined)).toBe(false);
    expect(isValidItemType({ type: 'BUG' })).toBe(false);
  });
});

// ============================================================
// hasProperty TESTS (14-15)
// ============================================================

describe('hasProperty', () => {
  test('14. returns true when property exists', () => {
    expect(hasProperty({ name: 'test' }, 'name')).toBe(true);
    expect(hasProperty({ id: 1, type: 'BUG' }, 'type')).toBe(true);
  });

  test('15. returns false when property missing or not object', () => {
    expect(hasProperty({ name: 'test' }, 'id')).toBe(false);
    expect(hasProperty(null, 'id')).toBe(false);
    expect(hasProperty(undefined, 'id')).toBe(false);
    expect(hasProperty('string', 'length')).toBe(false);
  });
});
