/**
 * Search Engine Tests
 *
 * 15 tests covering:
 * - BacklogSearchEngine class (12 tests)
 * - Singleton functions (3 tests)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  BacklogSearchEngine,
  getSearchEngine,
  resetSearchEngine,
} from '../lib/search';
import type { BacklogItem } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const createMockItem = (id: string, title: string, description?: string): BacklogItem => ({
  id,
  type: id.startsWith('BUG') ? 'BUG' : 'CT',
  title,
  description: description || `Description for ${id}`,
  rawMarkdown: '',
  sectionIndex: 0,
} as BacklogItem);

const MOCK_ITEMS: BacklogItem[] = [
  createMockItem('BUG-001', 'Login button not working', 'Button does not respond to clicks'),
  createMockItem('BUG-002', 'Password validation error', 'Regex pattern fails'),
  createMockItem('CT-001', 'Add dark mode', 'Implement theme switching'),
  createMockItem('CT-002', 'User profile page', 'Display user information'),
];

// ============================================================
// BACKLOG SEARCH ENGINE TESTS (1-12)
// ============================================================

describe('BacklogSearchEngine', () => {
  let engine: BacklogSearchEngine;

  beforeEach(() => {
    engine = new BacklogSearchEngine();
  });

  test('1. isEmpty is true when no items indexed', () => {
    expect(engine.isEmpty).toBe(true);
    expect(engine.count).toBe(0);
  });

  test('2. indexAll adds all items', () => {
    engine.indexAll(MOCK_ITEMS);

    expect(engine.isEmpty).toBe(false);
    expect(engine.count).toBe(4);
  });

  test('3. search finds items by title', () => {
    engine.indexAll(MOCK_ITEMS);

    const results = engine.search('login');

    expect(results).toContain('BUG-001');
  });

  test('4. search finds items by description', () => {
    engine.indexAll(MOCK_ITEMS);

    const results = engine.search('theme');

    expect(results).toContain('CT-001');
  });

  test('5. search returns empty array for empty query', () => {
    engine.indexAll(MOCK_ITEMS);

    expect(engine.search('')).toEqual([]);
    expect(engine.search('   ')).toEqual([]);
  });

  test('6. addItem adds single item to index', () => {
    engine.indexAll(MOCK_ITEMS);
    const newItem = createMockItem('CT-003', 'New feature', 'Brand new');

    engine.addItem(newItem);

    expect(engine.count).toBe(5);
    expect(engine.search('brand new')).toContain('CT-003');
  });

  test('7. addItem replaces existing item with same ID', () => {
    engine.indexAll(MOCK_ITEMS);
    const updatedItem = createMockItem('BUG-001', 'Updated title', 'New description');

    engine.addItem(updatedItem);

    expect(engine.count).toBe(4);
    expect(engine.search('Updated title')).toContain('BUG-001');
  });

  test('8. removeItem removes item from index', () => {
    engine.indexAll(MOCK_ITEMS);

    engine.removeItem('BUG-001');

    expect(engine.count).toBe(3);
    expect(engine.search('login')).not.toContain('BUG-001');
  });

  test('9. removeItem does nothing for non-existent ID', () => {
    engine.indexAll(MOCK_ITEMS);

    engine.removeItem('NONEXISTENT');

    expect(engine.count).toBe(4);
  });

  test('10. updateItem updates existing item', () => {
    engine.indexAll(MOCK_ITEMS);
    const updatedItem = createMockItem('CT-001', 'Light mode only', 'Completely different');

    engine.updateItem(updatedItem);

    expect(engine.count).toBe(4);
    expect(engine.search('light mode')).toContain('CT-001');
    // Old terms should still work due to fuzzy matching, just verify count unchanged
  });

  test('11. suggest returns autocomplete suggestions', () => {
    engine.indexAll(MOCK_ITEMS);

    const suggestions = engine.suggest('log');

    expect(suggestions.length).toBeGreaterThan(0);
  });

  test('12. suggest returns empty array for empty query', () => {
    engine.indexAll(MOCK_ITEMS);

    expect(engine.suggest('')).toEqual([]);
    expect(engine.suggest('   ')).toEqual([]);
  });
});

// ============================================================
// SINGLETON TESTS (13-15)
// ============================================================

describe('Search Engine Singleton', () => {
  beforeEach(() => {
    resetSearchEngine();
  });

  test('13. getSearchEngine returns same instance', () => {
    const engine1 = getSearchEngine();
    const engine2 = getSearchEngine();

    expect(engine1).toBe(engine2);
  });

  test('14. resetSearchEngine clears the singleton', () => {
    const engine1 = getSearchEngine();
    resetSearchEngine();
    const engine2 = getSearchEngine();

    expect(engine1).not.toBe(engine2);
  });

  test('15. getSearchEngine creates new instance after reset', () => {
    const engine1 = getSearchEngine();
    engine1.indexAll(MOCK_ITEMS);
    expect(engine1.count).toBe(4);

    resetSearchEngine();

    const engine2 = getSearchEngine();
    expect(engine2.count).toBe(0);
  });
});
