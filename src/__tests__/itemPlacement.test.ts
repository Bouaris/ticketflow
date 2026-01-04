/**
 * Item Placement Service Tests
 *
 * 12 tests covering:
 * - findTargetSectionIndex (8 tests)
 * - generateItemId (4 tests)
 */

import { describe, test, expect } from 'vitest';
import { findTargetSectionIndex, generateItemId } from '../lib/itemPlacement';
import type { Section, BacklogItem, RawSection } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const createSection = (
  id: string,
  title: string,
  items: (BacklogItem | RawSection)[] = []
): Section => ({
  id,
  title,
  items,
  rawHeader: `## ${id}. ${title}`,
});

const createBacklogItem = (id: string, type: string): BacklogItem => ({
  id,
  type,
  title: `Test ${id}`,
  rawMarkdown: '',
  sectionIndex: 0,
} as BacklogItem);

const createRawSection = (): RawSection => ({
  type: 'raw-section',
  title: 'Légende',
  rawMarkdown: '## Légende\nContent',
  sectionIndex: 0,
});

// ============================================================
// findTargetSectionIndex TESTS (1-8)
// ============================================================

describe('findTargetSectionIndex', () => {
  test('1. finds section by existing item type', () => {
    const sections: Section[] = [
      createSection('1', 'BUGS', [createBacklogItem('BUG-001', 'BUG')]),
      createSection('2', 'FEATURES', [createBacklogItem('CT-001', 'CT')]),
    ];

    expect(findTargetSectionIndex(sections, 'BUG')).toBe(0);
    expect(findTargetSectionIndex(sections, 'CT')).toBe(1);
  });

  test('2. matches section by title when no items', () => {
    const sections: Section[] = [
      createSection('1', 'BUGS', []),
      createSection('2', 'COURT TERME', []),
    ];

    expect(findTargetSectionIndex(sections, 'BUG')).toBe(0);
    expect(findTargetSectionIndex(sections, 'CT')).toBe(1);
  });

  test('3. handles case-insensitive title matching', () => {
    const sections: Section[] = [
      createSection('1', 'bugs', []),
      createSection('2', 'Court Terme', []),
    ];

    expect(findTargetSectionIndex(sections, 'BUG')).toBe(0);
    expect(findTargetSectionIndex(sections, 'CT')).toBe(1);
  });

  test('4. returns first non-raw section as fallback', () => {
    const sections: Section[] = [
      createSection('1', 'Légende', [createRawSection()]),
      createSection('2', 'Unknown Section', [createBacklogItem('X-001', 'X')]),
    ];

    expect(findTargetSectionIndex(sections, 'NEW_TYPE')).toBe(1);
  });

  test('5. returns 0 when all sections are raw', () => {
    const sections: Section[] = [
      createSection('1', 'Légende', [createRawSection()]),
    ];

    expect(findTargetSectionIndex(sections, 'NEW_TYPE')).toBe(0);
  });

  test('6. returns 0 for empty sections array', () => {
    expect(findTargetSectionIndex([], 'BUG')).toBe(0);
  });

  test('7. prefers existing items over title match', () => {
    const sections: Section[] = [
      createSection('1', 'BUGS', []),  // Title matches
      createSection('2', 'Other', [createBacklogItem('BUG-001', 'BUG')]),  // Has item
    ];

    // Should find section with existing BUG item
    expect(findTargetSectionIndex(sections, 'BUG')).toBe(1);
  });

  test('8. handles LONG TERME variations', () => {
    const sections: Section[] = [
      createSection('1', 'LONG TERME', []),
    ];

    expect(findTargetSectionIndex(sections, 'LT')).toBe(0);
  });
});

// ============================================================
// generateItemId TESTS (9-12)
// ============================================================

describe('generateItemId', () => {
  test('9. generates first ID when no existing items', () => {
    const result = generateItemId([], 'BUG');
    expect(result).toBe('BUG-001');
  });

  test('10. increments from highest existing ID', () => {
    const existingIds = ['BUG-001', 'BUG-002', 'BUG-005'];
    const result = generateItemId(existingIds, 'BUG');
    expect(result).toBe('BUG-006');
  });

  test('11. handles mixed type IDs', () => {
    const existingIds = ['BUG-001', 'CT-001', 'CT-002', 'LT-001'];
    expect(generateItemId(existingIds, 'CT')).toBe('CT-003');
    expect(generateItemId(existingIds, 'LT')).toBe('LT-002');
    expect(generateItemId(existingIds, 'BUG')).toBe('BUG-002');
  });

  test('12. pads ID number with zeros', () => {
    const existingIds = ['TEST-099'];
    const result = generateItemId(existingIds, 'TEST');
    expect(result).toBe('TEST-100');
  });
});
