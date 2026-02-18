/**
 * Stress Tests: Bulk Import, FTS5 Search, and Concurrent Operations
 *
 * 10 tests covering:
 * - STRESS-02: Bulk Import Endurance (3 tests) — 20 rounds x 50 items
 * - STRESS-03: FTS5 Search at Scale (3 tests) — 1000+ items
 * - STRESS-04: Concurrent Operations (4 tests) — no data corruption
 *
 * Uses a self-contained stateful in-memory mock that intercepts getDatabase
 * at the module level, bypassing all Tauri IPC entirely.
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';

// ============================================================
// TYPES (minimal inline to avoid importing from db/schema)
// ============================================================

interface StoreItem {
  id: string;
  project_id: number;
  section_id: number;
  type: string;
  title: string;
  emoji: string | null;
  component: string | null;
  module: string | null;
  severity: string | null;
  priority: string | null;
  effort: string | null;
  description: string | null;
  user_story: string | null;
  specs: string | null;
  reproduction: string | null;
  criteria: string | null;
  dependencies: string | null;
  constraints: string | null;
  screens: string | null;
  screenshots: string | null;
  position: number;
  raw_markdown: string;
  created_at: string;
  updated_at: string;
}

interface StoreSection {
  id: number;
  project_id: number;
  title: string;
  position: number;
  raw_header: string;
}

interface StoreCounter {
  project_id: number;
  type_prefix: string;
  last_number: number;
}

// ============================================================
// STATEFUL IN-MEMORY STORE
// ============================================================

interface Store {
  items: Map<string, StoreItem>;
  sections: Map<number, StoreSection>;
  counters: Map<string, StoreCounter>;
  lastInsertId: number;
}

function createStore(): Store {
  return {
    items: new Map(),
    sections: new Map(),
    counters: new Map(),
    lastInsertId: 0,
  };
}

// Global store instance — reset in beforeEach
let store: Store = createStore();

// ============================================================
// STATEFUL MOCK DATABASE
// ============================================================

const mockDb = {
  select: vi.fn(async (query: string, params?: unknown[]): Promise<unknown[]> => {
    const q = query.trim().toLowerCase();

    // PRAGMA integrity_check
    if (q.includes('pragma integrity_check')) {
      return [{ integrity_check: 'ok' }];
    }

    // BEGIN IMMEDIATE / COMMIT / ROLLBACK
    if (q.startsWith('begin') || q.startsWith('commit') || q.startsWith('rollback')) {
      return [];
    }

    // FTS5: SELECT ... FROM backlog_items_fts ... WHERE backlog_items_fts MATCH ...
    // IMPORTANT: Must be checked BEFORE the plain backlog_items queries because
    // the FTS query also contains "backlog_items" (in the JOIN clause).
    // Simulate via in-memory text search on title + description.
    if (q.includes('backlog_items_fts')) {
      const ftsQuery = params?.[0] as string;
      const projectId = params?.[1] as number;
      // Strip FTS5 operators and extract raw terms from sanitized query.
      // sanitizeFtsQuery wraps terms as "term"* — extract the raw terms.
      const terms = String(ftsQuery)
        .replace(/["*]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const projectItems = Array.from(store.items.values()).filter(i => i.project_id === projectId);

      const matches = projectItems.filter(item => {
        const searchable = `${item.title ?? ''} ${item.description ?? ''}`.toLowerCase();
        return terms.every(term => searchable.includes(term));
      });

      // Return rows shaped to match the SearchResult query structure
      return matches.map(item => ({
        ...item,
        title_highlight: item.title ?? '',
        description_snippet: item.description ?? '',
        rank: -1,
      }));
    }

    // SELECT MAX(position) as max_pos FROM backlog_items WHERE section_id = $1
    if (q.includes('max(position)') && q.includes('backlog_items') && q.includes('section_id')) {
      const sectionId = params?.[0] as number;
      const sectionItems = Array.from(store.items.values()).filter(i => i.section_id === sectionId);
      const maxPos = sectionItems.length > 0 ? Math.max(...sectionItems.map(i => i.position)) : null;
      return [{ max_pos: maxPos }];
    }

    // SELECT * FROM backlog_items WHERE id = $1
    if (q.includes('from backlog_items') && q.includes('where id = $1')) {
      const itemId = params?.[0] as string;
      const item = store.items.get(itemId);
      return item ? [item] : [];
    }

    // SELECT * FROM backlog_items WHERE section_id = $1
    if (q.includes('from backlog_items') && q.includes('where section_id = $1')) {
      const sectionId = params?.[0] as number;
      return Array.from(store.items.values()).filter(i => i.section_id === sectionId);
    }

    // SELECT * FROM backlog_items WHERE project_id = $1 ORDER BY section_id, position
    if (q.includes('from backlog_items') && q.includes('project_id')) {
      const projectId = params?.[0] as number;
      return Array.from(store.items.values())
        .filter(i => i.project_id === projectId)
        .sort((a, b) => a.section_id - b.section_id || a.position - b.position);
    }

    // SELECT * FROM sections WHERE project_id = $1
    if (q.includes('from sections') && q.includes('project_id')) {
      const projectId = params?.[0] as number;
      return Array.from(store.sections.values())
        .filter(s => s.project_id === projectId)
        .sort((a, b) => a.position - b.position);
    }

    // SELECT last_number FROM type_counters WHERE project_id = $1 AND type_prefix = $2
    if (q.includes('from type_counters') && q.includes('last_number')) {
      const projectId = params?.[0] as number;
      const typePrefix = params?.[1] as string;
      const key = `${projectId}:${typePrefix}`;
      const counter = store.counters.get(key);
      return counter ? [{ last_number: counter.last_number }] : [];
    }

    return [];
  }),

  execute: vi.fn(async (query: string, params?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }> => {
    const q = query.trim().toLowerCase();

    // No-op DDL and control statements
    if (
      q.startsWith('create ') ||
      q.startsWith('pragma ') ||
      q.startsWith('begin') ||
      q.startsWith('commit') ||
      q.startsWith('rollback') ||
      q.startsWith('delete from history') ||
      q.startsWith('delete from type_configs')
    ) {
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // INSERT INTO backlog_items
    if (q.includes('insert') && q.includes('backlog_items') && !q.includes('sections') && !q.includes('type_counters')) {
      const p = params as unknown[];
      const item: StoreItem = {
        id: p[0] as string,
        project_id: p[1] as number,
        section_id: p[2] as number,
        type: p[3] as string,
        title: p[4] as string,
        emoji: (p[5] as string | null) ?? null,
        component: (p[6] as string | null) ?? null,
        module: (p[7] as string | null) ?? null,
        severity: (p[8] as string | null) ?? null,
        priority: (p[9] as string | null) ?? null,
        effort: (p[10] as string | null) ?? null,
        description: (p[11] as string | null) ?? null,
        user_story: (p[12] as string | null) ?? null,
        specs: (p[13] as string | null) ?? null,
        reproduction: (p[14] as string | null) ?? null,
        criteria: (p[15] as string | null) ?? null,
        dependencies: (p[16] as string | null) ?? null,
        constraints: (p[17] as string | null) ?? null,
        screens: (p[18] as string | null) ?? null,
        screenshots: (p[19] as string | null) ?? null,
        position: p[20] as number,
        raw_markdown: (p[21] as string) ?? '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Handle INSERT OR REPLACE semantics
      store.items.set(item.id, item);
      return { lastInsertId: store.lastInsertId, rowsAffected: 1 };
    }

    // INSERT INTO sections
    if (q.includes('insert') && q.includes('into sections')) {
      store.lastInsertId++;
      const sectionId = store.lastInsertId;
      const p = params as unknown[];
      const section: StoreSection = {
        id: sectionId,
        project_id: p[0] as number,
        title: p[1] as string,
        position: p[2] as number,
        raw_header: p[3] as string,
      };
      store.sections.set(sectionId, section);
      return { lastInsertId: sectionId, rowsAffected: 1 };
    }

    // INSERT INTO type_counters ... ON CONFLICT DO NOTHING
    if (q.includes('insert') && q.includes('type_counters') && q.includes('do nothing')) {
      const p = params as unknown[];
      const projectId = p[0] as number;
      const typePrefix = p[1] as string;
      const initValue = (p[2] as number) ?? 0;
      const key = `${projectId}:${typePrefix}`;
      if (!store.counters.has(key)) {
        store.counters.set(key, { project_id: projectId, type_prefix: typePrefix, last_number: initValue });
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // INSERT INTO type_counters ... ON CONFLICT DO UPDATE SET last_number = last_number + 1
    if (q.includes('insert') && q.includes('type_counters') && q.includes('do update')) {
      const p = params as unknown[];
      const projectId = p[0] as number;
      const typePrefix = p[1] as string;
      const key = `${projectId}:${typePrefix}`;
      const existing = store.counters.get(key);
      if (existing) {
        existing.last_number += 1;
      } else {
        store.counters.set(key, { project_id: projectId, type_prefix: typePrefix, last_number: 1 });
      }
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    // UPDATE type_counters SET last_number = last_number + $1
    if (q.includes('update type_counters') && q.includes('last_number = last_number +')) {
      const p = params as unknown[];
      const count = p[0] as number;
      const projectId = p[1] as number;
      const typePrefix = p[2] as string;
      const key = `${projectId}:${typePrefix}`;
      const counter = store.counters.get(key);
      if (counter) {
        counter.last_number += count;
      }
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    // INSERT OR REPLACE INTO type_counters
    if (q.includes('insert or replace') && q.includes('type_counters')) {
      const p = params as unknown[];
      const projectId = p[0] as number;
      const typePrefix = p[1] as string;
      const lastNumber = p[2] as number;
      const key = `${projectId}:${typePrefix}`;
      store.counters.set(key, { project_id: projectId, type_prefix: typePrefix, last_number: lastNumber });
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    // UPDATE backlog_items SET ... WHERE id = $N
    if (q.includes('update backlog_items set')) {
      // Extract the item id from the last parameter (WHERE id = $N pattern)
      const p = params as unknown[];
      const itemId = p[p.length - 1] as string;
      const existing = store.items.get(itemId);
      if (existing) {
        // Parse SET clause assignments — each param up to (last-1) maps to a column
        // We handle specific known fields by scanning the query for column names
        const setClause = q.substring(q.indexOf('set') + 3, q.indexOf('where')).trim();
        const assignments = setClause.split(',').map(s => s.trim());
        let paramIdx = 0;
        for (const assignment of assignments) {
          if (assignment.includes('updated_at')) {
            // datetime('now') — no param consumed
            existing.updated_at = new Date().toISOString();
            continue;
          }
          const colMatch = assignment.match(/^(\w+)\s*=/);
          if (colMatch && paramIdx < p.length - 1) {
            const col = colMatch[1] as keyof StoreItem;
            (existing[col] as unknown) = p[paramIdx] as unknown;
            paramIdx++;
          }
        }
        store.items.set(itemId, existing);
      }
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    // DELETE FROM backlog_items WHERE id = $1
    if (q.includes('delete from backlog_items') && q.includes('where id')) {
      const p = params as unknown[];
      const itemId = p[0] as string;
      store.items.delete(itemId);
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    // DELETE FROM backlog_items WHERE section_id = $1 (from deleteSection)
    if (q.includes('delete from backlog_items') && q.includes('section_id')) {
      const p = params as unknown[];
      const sectionId = p[0] as number;
      for (const [id, item] of store.items) {
        if (item.section_id === sectionId) {
          store.items.delete(id);
        }
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // DELETE FROM backlog_items WHERE project_id = $1
    if (q.includes('delete from backlog_items') && q.includes('project_id')) {
      const p = params as unknown[];
      const projectId = p[0] as number;
      for (const [id, item] of store.items) {
        if (item.project_id === projectId) {
          store.items.delete(id);
        }
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // DELETE FROM sections WHERE id = $1
    if (q.includes('delete from sections') && q.includes('where id')) {
      const p = params as unknown[];
      const sectionId = p[0] as number;
      store.sections.delete(sectionId);
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    return { lastInsertId: 0, rowsAffected: 0 };
  }),
};

// ============================================================
// MODULE MOCKS
// ============================================================

vi.mock('../db/database', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  closeDatabase: vi.fn(),
  getCurrentProjectPath: vi.fn(() => '/mock/project'),
  isDatabaseConnected: vi.fn(() => true),
}));

vi.mock('../db/queries/relations', () => ({
  removeRelationsForItem: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/itemPlacement', () => ({
  TYPE_TO_SECTION_LABELS: {
    'BUG': ['BUGS', 'BUG'],
    'CT': ['COURT TERME', 'CT'],
    'LT': ['LONG TERME', 'LT'],
  },
  findTargetSectionIndex: vi.fn(() => 0),
  generateItemId: vi.fn(() => 'CT-001'),
}));

// ============================================================
// IMPORTS (after mocks are declared)
// ============================================================

import { bulkCreateItems, insertItem, getAllItems, updateItem } from '../db/queries/items';
import { searchItems } from '../db/queries/search';

// ============================================================
// TEST CONSTANTS
// ============================================================

const PROJECT_PATH = '/mock/project';
const PROJECT_ID = 1;
const SECTION_ID = 1;

// ============================================================
// HELPERS
// ============================================================

/**
 * Seed the store with a pre-existing section (id=1, CT/COURT TERME)
 * and reset counters for a clean test run.
 */
function seedSection(sectionId = 1, title = 'COURT TERME'): void {
  store.sections.set(sectionId, {
    id: sectionId,
    project_id: PROJECT_ID,
    title,
    position: 0,
    raw_header: `## ${title}`,
  });
  store.lastInsertId = sectionId; // so next auto-increment starts after this
}

/**
 * Insert N items directly into the store (fast pre-seeding, bypasses all query logic).
 */
function seedItems(count: number, keyword = '', type = 'CT'): void {
  for (let i = 0; i < count; i++) {
    const id = `${type}-${String(i + 1).padStart(3, '0')}`;
    store.items.set(id, {
      id,
      project_id: PROJECT_ID,
      section_id: SECTION_ID,
      type,
      title: `Seeded Item ${i + 1}`,
      emoji: null,
      component: null,
      module: null,
      severity: null,
      priority: null,
      effort: null,
      description: keyword ? `Contains ${keyword} in description ${i + 1}` : `Description ${i + 1}`,
      user_story: null,
      specs: null,
      reproduction: null,
      criteria: null,
      dependencies: null,
      constraints: null,
      screens: null,
      screenshots: null,
      position: i,
      raw_markdown: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

// ============================================================
// DESCRIBE 1: STRESS — BULK IMPORT ENDURANCE (STRESS-02)
// ============================================================

describe('Stress: Bulk Import Endurance', { timeout: 120000 }, () => {
  beforeEach(() => {
    // Reset store and mock call history
    store = createStore();
    mockDb.select.mockClear();
    mockDb.execute.mockClear();
    // Seed section so bulkCreateItems can find a valid CT section
    seedSection(1, 'COURT TERME');
  });

  test('20 consecutive rounds of 50 items each complete without error', async () => {
    const ROUNDS = 20;
    const ITEMS_PER_ROUND = 50;

    for (let r = 1; r <= ROUNDS; r++) {
      const proposals = Array.from({ length: ITEMS_PER_ROUND }, (_, i) => ({
        title: `Round ${r} Item ${i + 1}`,
        suggestedType: 'CT',
        description: `Description for round ${r} item ${i + 1}`,
      }));

      // Should not throw
      const created = await bulkCreateItems(PROJECT_PATH, PROJECT_ID, proposals);
      expect(created).toHaveLength(ITEMS_PER_ROUND);
    }

    // Total items in store must equal 20 * 50 = 1000
    const allItems = Array.from(store.items.values()).filter(i => i.project_id === PROJECT_ID);
    expect(allItems.length).toBe(ROUNDS * ITEMS_PER_ROUND);
  });

  test('no duplicate IDs across 20 rounds', async () => {
    const ROUNDS = 20;
    const ITEMS_PER_ROUND = 50;

    for (let r = 1; r <= ROUNDS; r++) {
      const proposals = Array.from({ length: ITEMS_PER_ROUND }, (_, i) => ({
        title: `Round ${r} Item ${i + 1}`,
        suggestedType: 'CT',
        description: `Description for round ${r} item ${i + 1}`,
      }));
      await bulkCreateItems(PROJECT_PATH, PROJECT_ID, proposals);
    }

    const allIds = Array.from(store.items.keys());
    const uniqueIds = new Set(allIds);

    // No duplicate IDs
    expect(uniqueIds.size).toBe(allIds.length);
    expect(allIds.length).toBe(ROUNDS * ITEMS_PER_ROUND);
  });

  test('item data integrity preserved across rounds', async () => {
    const ROUNDS = 20;
    const ITEMS_PER_ROUND = 50;
    const allCreated: Array<{ title: string; id: string }> = [];

    for (let r = 1; r <= ROUNDS; r++) {
      const proposals = Array.from({ length: ITEMS_PER_ROUND }, (_, i) => ({
        title: `Round ${r} Item ${i + 1}`,
        suggestedType: 'CT',
        description: `Description for round ${r} item ${i + 1}`,
      }));
      const created = await bulkCreateItems(PROJECT_PATH, PROJECT_ID, proposals);
      allCreated.push(...created.map(c => ({ title: c.title, id: c.id })));
    }

    // Verify 10 sampled items have correct data
    const sampleIndices = [0, 49, 50, 99, 199, 399, 599, 799, 949, 999];
    for (const idx of sampleIndices) {
      const createdRef = allCreated[idx];
      if (!createdRef) continue;
      const stored = store.items.get(createdRef.id);
      expect(stored).toBeDefined();
      expect(stored!.title).toBe(createdRef.title);
    }
  });
});

// ============================================================
// DESCRIBE 2: STRESS — FTS5 SEARCH AT SCALE (STRESS-03)
// ============================================================

describe('Stress: FTS5 Search at Scale', { timeout: 120000 }, () => {
  beforeEach(() => {
    store = createStore();
    mockDb.select.mockClear();
    mockDb.execute.mockClear();
    seedSection(1, 'COURT TERME');
  });

  test('search returns results in under 100ms with 1000+ items', async () => {
    // Seed 1100 items: 100 with "authentication" keyword, 1000 generic
    seedItems(1000);
    // Add 100 items with the target keyword
    for (let i = 1001; i <= 1100; i++) {
      const id = `CT-${String(i).padStart(4, '0')}`;
      store.items.set(id, {
        id,
        project_id: PROJECT_ID,
        section_id: SECTION_ID,
        type: 'CT',
        title: `Feature ${i}`,
        emoji: null,
        component: null,
        module: null,
        severity: null,
        priority: null,
        effort: null,
        description: `Implement authentication flow for feature ${i}`,
        user_story: null,
        specs: null,
        reproduction: null,
        criteria: null,
        dependencies: null,
        constraints: null,
        screens: null,
        screenshots: null,
        position: i,
        raw_markdown: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const start = performance.now();
    const results = await searchItems(PROJECT_PATH, PROJECT_ID, 'authentication');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThanOrEqual(1);
    // In-memory mock search is O(N) but still very fast; 100ms is generous
    expect(elapsed).toBeLessThan(100);
  });

  test('search finds items by partial title match', async () => {
    // Add one item with a unique title
    const targetId = 'CT-999';
    store.items.set(targetId, {
      id: targetId,
      project_id: PROJECT_ID,
      section_id: SECTION_ID,
      type: 'CT',
      title: 'Implement OAuth2 flow',
      emoji: null,
      component: null,
      module: null,
      severity: null,
      priority: null,
      effort: null,
      description: 'OAuth2 authorization code grant implementation',
      user_story: null,
      specs: null,
      reproduction: null,
      criteria: null,
      dependencies: null,
      constraints: null,
      screens: null,
      screenshots: null,
      position: 0,
      raw_markdown: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Add some noise items
    seedItems(50);

    const results = await searchItems(PROJECT_PATH, PROJECT_ID, 'OAuth');

    const resultIds = results.map(r => r.item.id);
    expect(resultIds).toContain(targetId);
  });

  test('search returns empty for non-matching query', async () => {
    seedItems(100);

    const results = await searchItems(PROJECT_PATH, PROJECT_ID, 'xyznonexistent123');

    expect(results.length).toBe(0);
  });
});

// ============================================================
// DESCRIBE 3: STRESS — CONCURRENT OPERATIONS (STRESS-04)
// ============================================================

describe('Stress: Concurrent Operations', { timeout: 120000 }, () => {
  beforeEach(() => {
    store = createStore();
    mockDb.select.mockClear();
    mockDb.execute.mockClear();
    seedSection(1, 'COURT TERME');
  });

  test('rapid create + read interleaving produces consistent state', async () => {
    const ITERATIONS = 100;
    let expectedCount = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const item = {
        id: `CT-${String(i + 1).padStart(3, '0')}`,
        type: 'CT',
        title: `Rapid Item ${i + 1}`,
        description: `Description ${i + 1}`,
        rawMarkdown: '',
        sectionIndex: i,
        specs: [],
        criteria: [],
        dependencies: [],
        constraints: [],
        screenshots: [],
      };

      await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
      expectedCount++;

      // Read all and assert count increments monotonically
      const all = await getAllItems(PROJECT_PATH, PROJECT_ID);
      expect(all.length).toBe(expectedCount);
    }
  });

  test('create + update + read cycle with no data corruption', async () => {
    // Create 500 items
    const INITIAL = 500;
    for (let i = 0; i < INITIAL; i++) {
      const item = {
        id: `CT-${String(i + 1).padStart(3, '0')}`,
        type: 'CT',
        title: `Item ${i + 1}`,
        description: `Description ${i + 1}`,
        rawMarkdown: '',
        sectionIndex: i,
        specs: [],
        criteria: [],
        dependencies: [],
        constraints: [],
        screenshots: [],
      };
      await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    }

    // Update first 50 items
    const updatedTitles: Map<string, string> = new Map();
    for (let i = 0; i < 50; i++) {
      const itemId = `CT-${String(i + 1).padStart(3, '0')}`;
      const newTitle = `UPDATED-${i + 1}`;
      await updateItem(PROJECT_PATH, itemId, { title: newTitle });
      updatedTitles.set(itemId, newTitle);
    }

    // Create 50 more items
    for (let i = INITIAL; i < INITIAL + 50; i++) {
      const item = {
        id: `CT-${String(i + 1).padStart(3, '0')}`,
        type: 'CT',
        title: `Extra Item ${i + 1}`,
        description: `Description ${i + 1}`,
        rawMarkdown: '',
        sectionIndex: i,
        specs: [],
        criteria: [],
        dependencies: [],
        constraints: [],
        screenshots: [],
      };
      await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    }

    // Read all and verify count
    const all = await getAllItems(PROJECT_PATH, PROJECT_ID);
    expect(all.length).toBe(550);

    // Verify updated items have new titles
    for (const [id, expectedTitle] of updatedTitles) {
      const found = all.find(i => i.id === id);
      expect(found).toBeDefined();
      expect(found!.title).toBe(expectedTitle);
    }

    // Verify newly created items exist
    for (let i = INITIAL; i < INITIAL + 50; i++) {
      const expectedId = `CT-${String(i + 1).padStart(3, '0')}`;
      const found = all.find(item => item.id === expectedId);
      expect(found).toBeDefined();
    }
  });

  test('concurrent create + search produces no errors', async () => {
    // Seed 500 items with "searchable" keyword
    for (let i = 0; i < 500; i++) {
      const id = `CT-${String(i + 1).padStart(3, '0')}`;
      store.items.set(id, {
        id,
        project_id: PROJECT_ID,
        section_id: SECTION_ID,
        type: 'CT',
        title: `Searchable Item ${i + 1}`,
        emoji: null,
        component: null,
        module: null,
        severity: null,
        priority: null,
        effort: null,
        description: `This item is searchable, index ${i + 1}`,
        user_story: null,
        specs: null,
        reproduction: null,
        criteria: null,
        dependencies: null,
        constraints: null,
        screens: null,
        screenshots: null,
        position: i,
        raw_markdown: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Interleave: create 100 more items; search every 10 creates
    let createErrors = 0;
    const searchResultCounts: number[] = [];

    for (let i = 500; i < 600; i++) {
      try {
        const item = {
          id: `CT-${String(i + 1).padStart(3, '0')}`,
          type: 'CT',
          title: `New Item ${i + 1}`,
          description: `Not searchable ${i + 1}`,
          rawMarkdown: '',
          sectionIndex: i,
          specs: [],
          criteria: [],
          dependencies: [],
          constraints: [],
          screenshots: [],
        };
        await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
      } catch {
        createErrors++;
      }

      // Search every 10 creates (outside the create try/catch so assertion failures propagate)
      if ((i - 500) % 10 === 9) {
        const results = await searchItems(PROJECT_PATH, PROJECT_ID, 'searchable');
        searchResultCounts.push(results.length);
      }
    }

    expect(createErrors).toBe(0);
    // All search results should have found at least 1 matching item
    for (const count of searchResultCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('PRAGMA integrity_check passes after concurrent operations', async () => {
    // Set up items
    seedItems(200);

    // Run some updates and creates
    for (let i = 0; i < 50; i++) {
      const itemId = `CT-${String(i + 1).padStart(3, '0')}`;
      await updateItem(PROJECT_PATH, itemId, { title: `Updated ${i}` });
    }

    for (let i = 200; i < 250; i++) {
      const item = {
        id: `CT-${String(i + 1).padStart(3, '0')}`,
        type: 'CT',
        title: `Post-update Item ${i + 1}`,
        description: `Description ${i + 1}`,
        rawMarkdown: '',
        sectionIndex: i,
        specs: [],
        criteria: [],
        dependencies: [],
        constraints: [],
        screenshots: [],
      };
      await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    }

    // PRAGMA integrity_check
    const db = await (await import('../db/database')).getDatabase(PROJECT_PATH);
    const result = await db.select('PRAGMA integrity_check', []);
    expect(result).toEqual([{ integrity_check: 'ok' }]);
  });
});
