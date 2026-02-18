/**
 * Performance Benchmark Tests
 *
 * Benchmarks CRUD latency at 100/500/1000 item scales, measures UI data
 * processing throughput, and profiles memory consumption.
 *
 * All PERF: log lines are emitted via console.log so they appear in
 * --reporter=verbose output and can be transcribed into PERF-REPORT.md.
 *
 * Uses the same vi.mock('../db/database') stateful mock pattern established
 * in plans 30-01 and 30-02 — no Tauri IPC dependency.
 *
 * @group perf
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createStatefulSqlMock } from '../test-utils/stress-helpers';
import { insertItem, getAllItems, updateItem, deleteItem } from '../db/queries/items';
import { dbItemToBacklogItem } from '../db/transforms';
import type { DbBacklogItem } from '../db/schema';
import type { BacklogItem } from '../types/backlog';
import { BacklogSearchEngine } from '../lib/search';

// ============================================================
// MODULE MOCKS
// ============================================================

// Stateful mock instance — recreated in each beforeEach
let mock = createStatefulSqlMock();

// Stable DB handle that delegates to the current mock instance
const mockDb = {
  select: vi.fn(<T = unknown[]>(query: string, values?: unknown[]) =>
    Promise.resolve(mock.selectHandler(query, values ?? []) as T)
  ),
  execute: vi.fn((query: string, values?: unknown[]) =>
    Promise.resolve(mock.executeHandler(query, values ?? []))
  ),
};

// Mock the database module to bypass Tauri IPC entirely
vi.mock('../db/database', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
  closeDatabase: vi.fn(() => Promise.resolve()),
  getCurrentProjectPath: vi.fn(() => '/mock/project'),
  isDatabaseConnected: vi.fn(() => true),
}));

// Mock relations module — removeRelationsForItem is called by deleteItem
vi.mock('../db/queries/relations', () => ({
  removeRelationsForItem: vi.fn(() => Promise.resolve()),
}));

// Mock counters module
vi.mock('../db/queries/counters', () => ({
  allocateIdRange: vi.fn((_path: string, _projectId: number, type: string, count: number) =>
    Promise.resolve({ startNumber: 1, endNumber: count, type })
  ),
  getNextItemNumber: vi.fn(() => Promise.resolve(1)),
}));

// Mock sections module
vi.mock('../db/queries/sections', () => ({
  getAllSections: vi.fn(() => Promise.resolve([])),
  insertSection: vi.fn(() => Promise.resolve(1)),
  getSectionById: vi.fn(() => Promise.resolve(null)),
}));

// Mock itemPlacement module
vi.mock('../lib/itemPlacement', () => ({
  TYPE_TO_SECTION_LABELS: {
    BUG: ['Bugs', 'BUGS'],
    CT: ['Court Terme', 'COURT TERME'],
    LT: ['Long Terme', 'LONG TERME'],
  },
  findTargetSectionIndex: vi.fn(() => 0),
}));

// ============================================================
// CONSTANTS
// ============================================================

const PROJECT_PATH = '/mock/project';
const PROJECT_ID = 1;
const SECTION_ID = 1;

// ============================================================
// HELPERS
// ============================================================

/**
 * Measure elapsed time in milliseconds for an async operation.
 */
async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/**
 * Create a minimal valid BacklogItem for benchmarking.
 */
function makeItem(index: number, type = 'CT'): BacklogItem {
  const types = ['CT', 'LT', 'BUG'];
  const actualType = type === 'MIXED' ? types[index % 3] : type;
  const id = `${actualType}-${String(index).padStart(3, '0')}`;
  return {
    id,
    type: actualType,
    title: `Perf benchmark item ${index} — ${actualType}`,
    description: `Description for benchmark item ${index}`,
    rawMarkdown: `### ${id} | Perf benchmark item ${index}\n**Description:** Description for benchmark item ${index}`,
    sectionIndex: index,
    specs: [],
    criteria: [],
    dependencies: [],
    constraints: [],
    screenshots: [],
  };
}

/**
 * Seed N items into the mock database via insertItem.
 */
async function seedItems(count: number, type = 'CT'): Promise<BacklogItem[]> {
  const items: BacklogItem[] = [];
  for (let i = 0; i < count; i++) {
    const item = makeItem(i, type);
    await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    items.push(item);
  }
  return items;
}

/**
 * Create a raw DbBacklogItem row for transform benchmarks.
 */
function makeDbRow(index: number): DbBacklogItem {
  const types = ['CT', 'LT', 'BUG'];
  const type = types[index % 3];
  const id = `${type}-${String(index).padStart(3, '0')}`;
  return {
    id,
    project_id: 1,
    section_id: 1,
    type,
    title: `Transform benchmark item ${index}`,
    emoji: null,
    component: null,
    module: null,
    severity: null,
    priority: null,
    effort: null,
    description: `Description ${index}`,
    user_story: null,
    specs: null,
    reproduction: null,
    criteria: null,
    dependencies: null,
    constraints: null,
    screens: null,
    screenshots: null,
    position: index,
    raw_markdown: `### ${id} | Transform benchmark item ${index}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================
// SUITE 1: CRUD Latency Benchmarks (PERF-01)
// ============================================================

describe('Perf: CRUD Latency Benchmarks', { timeout: 120000 }, () => {
  beforeEach(() => {
    mock = createStatefulSqlMock();
    mockDb.select.mockImplementation(<T = unknown[]>(query: string, values?: unknown[]) =>
      Promise.resolve(mock.selectHandler(query, values ?? []) as T)
    );
    mockDb.execute.mockImplementation((query: string, values?: unknown[]) =>
      Promise.resolve(mock.executeHandler(query, values ?? []))
    );
  });

  const scales = [100, 500, 1000];

  // -------------------------------------------------------
  // INSERT latency at N items
  // -------------------------------------------------------
  test.each(scales)('INSERT latency at %i items', async (N) => {
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      const item = makeItem(i);
      await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    }
    const total = performance.now() - start;
    const avg = total / N;

    console.log(`PERF:INSERT:${N}:total=${total.toFixed(2)}ms,avg=${avg.toFixed(3)}ms`);

    expect(mock.backlogItems.length).toBe(N);
    // Generous budget: N * 10ms (mock layer is synchronous, should be much faster)
    expect(total).toBeLessThan(N * 10);
  });

  // -------------------------------------------------------
  // SELECT ALL latency at N items
  // -------------------------------------------------------
  test.each(scales)('SELECT ALL latency at %i items', async (N) => {
    await seedItems(N);

    const elapsed = await measureMs(async () => {
      const items = await getAllItems(PROJECT_PATH, PROJECT_ID);
      expect(items.length).toBe(N);
    });

    console.log(`PERF:SELECT_ALL:${N}:${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(1000);
  });

  // -------------------------------------------------------
  // UPDATE 10% at N items
  // -------------------------------------------------------
  test.each(scales)('UPDATE latency at %i items (10%%)', async (N) => {
    await seedItems(N);

    const updateCount = Math.max(1, Math.floor(N * 0.1));
    const updateIndices = Array.from({ length: updateCount }, (_, k) => (k * 7) % N);

    const start = performance.now();
    for (const idx of updateIndices) {
      const itemId = `CT-${String(idx).padStart(3, '0')}`;
      await updateItem(PROJECT_PATH, itemId, { title: `UPDATED-${idx}` });
    }
    const total = performance.now() - start;
    const avg = total / updateCount;

    console.log(`PERF:UPDATE:${N}:total=${total.toFixed(2)}ms,avg=${avg.toFixed(3)}ms`);
    expect(total).toBeLessThan(N * 10);
  });

  // -------------------------------------------------------
  // DELETE 10% at N items
  // -------------------------------------------------------
  test.each(scales)('DELETE latency at %i items (10%%)', async (N) => {
    await seedItems(N);

    const deleteCount = Math.max(1, Math.floor(N * 0.1));

    const start = performance.now();
    for (let i = 0; i < deleteCount; i++) {
      const itemId = `CT-${String(i).padStart(3, '0')}`;
      await deleteItem(PROJECT_PATH, itemId);
    }
    const total = performance.now() - start;
    const avg = total / deleteCount;

    console.log(`PERF:DELETE:${N}:total=${total.toFixed(2)}ms,avg=${avg.toFixed(3)}ms`);

    const remaining = mock.backlogItems.length;
    expect(remaining).toBe(N - deleteCount);
    expect(total).toBeLessThan(N * 10);
  });
});

// ============================================================
// SUITE 2: UI Data Processing (PERF-02)
// ============================================================

describe('Perf: UI Data Processing', { timeout: 120000 }, () => {
  beforeEach(() => {
    mock = createStatefulSqlMock();
    mockDb.select.mockImplementation(<T = unknown[]>(query: string, values?: unknown[]) =>
      Promise.resolve(mock.selectHandler(query, values ?? []) as T)
    );
    mockDb.execute.mockImplementation((query: string, values?: unknown[]) =>
      Promise.resolve(mock.executeHandler(query, values ?? []))
    );
  });

  // -------------------------------------------------------
  // dbItemToBacklogItem transform at 1000 items
  // -------------------------------------------------------
  test('dbItemToBacklogItem transform at 1000 items', () => {
    const ITEM_COUNT = 1000;
    const rawRows = Array.from({ length: ITEM_COUNT }, (_, i) => makeDbRow(i));

    const start = performance.now();
    const transformed = rawRows.map(dbItemToBacklogItem);
    const elapsed = performance.now() - start;

    console.log(`PERF:TRANSFORM:1000:${elapsed.toFixed(2)}ms`);

    expect(transformed.length).toBe(ITEM_COUNT);
    expect(elapsed).toBeLessThan(100);
  });

  // -------------------------------------------------------
  // Array filter/sort at 1000 items
  // -------------------------------------------------------
  test('array filter/sort at 1000 items', () => {
    const ITEM_COUNT = 1000;
    const items = Array.from({ length: ITEM_COUNT }, (_, i) => makeItem(i, 'MIXED'));

    // Measure filter
    const filterStart = performance.now();
    const filtered = items.filter(it => it.type === 'CT');
    const filterElapsed = performance.now() - filterStart;

    // Measure sort
    const sortStart = performance.now();
    const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
    const sortElapsed = performance.now() - sortStart;

    console.log(`PERF:FILTER:1000:${filterElapsed.toFixed(2)}ms`);
    console.log(`PERF:SORT:1000:${sortElapsed.toFixed(2)}ms`);

    // ~333 CT items out of 1000 (1 out of 3 types)
    expect(filtered.length).toBeGreaterThan(300);
    expect(filtered.length).toBeLessThan(400);
    expect(sorted.length).toBe(ITEM_COUNT);

    expect(filterElapsed).toBeLessThan(50);
    expect(sortElapsed).toBeLessThan(50);
  });

  // -------------------------------------------------------
  // MiniSearch indexAll at 1000 items
  // -------------------------------------------------------
  test('search engine indexAll at 1000 items', () => {
    const ITEM_COUNT = 1000;
    const items = Array.from({ length: ITEM_COUNT }, (_, i) => makeItem(i, 'MIXED'));

    const engine = new BacklogSearchEngine();

    const start = performance.now();
    engine.indexAll(items);
    const elapsed = performance.now() - start;

    console.log(`PERF:INDEX:1000:${elapsed.toFixed(2)}ms`);

    expect(elapsed).toBeLessThan(500);
  });
});

// ============================================================
// SUITE 3: Memory Profile (PERF-03)
// ============================================================

describe('Perf: Memory Profile', { timeout: 120000 }, () => {
  beforeEach(() => {
    mock = createStatefulSqlMock();
    mockDb.select.mockImplementation(<T = unknown[]>(query: string, values?: unknown[]) =>
      Promise.resolve(mock.selectHandler(query, values ?? []) as T)
    );
    mockDb.execute.mockImplementation((query: string, values?: unknown[]) =>
      Promise.resolve(mock.executeHandler(query, values ?? []))
    );
  });

  // -------------------------------------------------------
  // Memory consumption with 1000 items in-memory
  // -------------------------------------------------------
  test('memory consumption with 1000 items in-memory', () => {
    const ITEM_COUNT = 1000;
    const baseline = process.memoryUsage();
    const baseMB = baseline.heapUsed / 1024 / 1024;

    // Allocate 1000 BacklogItem objects
    const items: BacklogItem[] = [];
    for (let i = 0; i < ITEM_COUNT; i++) {
      items.push(makeItem(i, 'MIXED'));
    }

    const peak = process.memoryUsage();
    const peakMB = peak.heapUsed / 1024 / 1024;
    const deltaMB = peakMB - baseMB;

    console.log(
      `PERF:MEMORY:1000_items:baseline=${baseMB.toFixed(2)}MB,peak=${peakMB.toFixed(2)}MB,delta=${deltaMB.toFixed(2)}MB`
    );

    expect(items.length).toBe(ITEM_COUNT);
    // Generous budget: 50MB delta for 1000 objects with all string fields
    expect(deltaMB).toBeLessThan(50);
  });

  // -------------------------------------------------------
  // Memory after bulk operations (seed 1000, update 100, delete 100)
  // -------------------------------------------------------
  test('memory after bulk operations', async () => {
    const ITEM_COUNT = 1000;

    const baselineUsage = process.memoryUsage();
    const baselineMB = baselineUsage.heapUsed / 1024 / 1024;

    // Seed 1000 items
    await seedItems(ITEM_COUNT);

    const afterSeedUsage = process.memoryUsage();
    const afterSeedMB = afterSeedUsage.heapUsed / 1024 / 1024;

    // Read all items
    const readItems = await getAllItems(PROJECT_PATH, PROJECT_ID);
    const afterReadUsage = process.memoryUsage();
    const afterReadMB = afterReadUsage.heapUsed / 1024 / 1024;

    // Update 100 items
    const updateCount = 100;
    for (let i = 0; i < updateCount; i++) {
      const itemId = `CT-${String(i).padStart(3, '0')}`;
      await updateItem(PROJECT_PATH, itemId, { title: `UPDATED-${i}` });
    }
    const afterUpdateUsage = process.memoryUsage();
    const afterUpdateMB = afterUpdateUsage.heapUsed / 1024 / 1024;

    // Delete 100 items
    const deleteCount = 100;
    for (let i = 0; i < deleteCount; i++) {
      const itemId = `CT-${String(i).padStart(3, '0')}`;
      await deleteItem(PROJECT_PATH, itemId);
    }
    const afterDeleteUsage = process.memoryUsage();
    const afterDeleteMB = afterDeleteUsage.heapUsed / 1024 / 1024;

    const peakDeltaMB = Math.max(afterSeedMB, afterReadMB, afterUpdateMB, afterDeleteMB) - baselineMB;

    console.log(`PERF:MEMORY:BULK_OPS:baseline=${baselineMB.toFixed(2)}MB`);
    console.log(`PERF:MEMORY:BULK_OPS:after_seed=${afterSeedMB.toFixed(2)}MB`);
    console.log(`PERF:MEMORY:BULK_OPS:after_read=${afterReadMB.toFixed(2)}MB`);
    console.log(`PERF:MEMORY:BULK_OPS:after_update=${afterUpdateMB.toFixed(2)}MB`);
    console.log(`PERF:MEMORY:BULK_OPS:after_delete=${afterDeleteMB.toFixed(2)}MB`);
    console.log(`PERF:MEMORY:BULK_OPS:peak_delta=${peakDeltaMB.toFixed(2)}MB`);

    expect(readItems.length).toBe(ITEM_COUNT);
    expect(mock.backlogItems.length).toBe(ITEM_COUNT - deleteCount);
    expect(peakDeltaMB).toBeLessThan(100);
  });
});
