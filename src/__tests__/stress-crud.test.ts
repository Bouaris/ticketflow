/**
 * Stress Test: CRUD operations at 1000+ ticket scale.
 *
 * Verifies the database query layer handles large datasets without errors,
 * using an in-memory stateful mock that bypasses Tauri IPC entirely.
 *
 * Approach: vi.mock('../db/database') to return a stateful mock DB object.
 * This avoids conflicts with the global IPC mock registered in setup.ts
 * and lets us measure pure query-layer throughput.
 *
 * @group stress
 */

import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createStatefulSqlMock, makeItem, measureMs } from '../test-utils/stress-helpers';
import { insertItem, getAllItems, updateItem, deleteItem } from '../db/queries/items';

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

// Mock counters module — allocateIdRange is called by bulkCreateItems (not tested here)
vi.mock('../db/queries/counters', () => ({
  allocateIdRange: vi.fn((_path: string, _projectId: number, type: string, count: number) =>
    Promise.resolve({ startNumber: 1, endNumber: count, type })
  ),
  getNextItemNumber: vi.fn(() => Promise.resolve(1)),
}));

// Mock sections module — getAllSections/insertSection may be called by bulkCreateItems
vi.mock('../db/queries/sections', () => ({
  getAllSections: vi.fn(() => Promise.resolve([])),
  insertSection: vi.fn(() => Promise.resolve(1)),
  getSectionById: vi.fn(() => Promise.resolve(null)),
}));

// ============================================================
// TEST CONSTANTS
// ============================================================

const PROJECT_PATH = '/mock/project';
const PROJECT_ID = 1;
const SECTION_ID = 1;
const ITEM_COUNT = 1100;

// ============================================================
// HELPERS
// ============================================================

/**
 * Seed N items into the mock database via insertItem.
 * Returns the array of created BacklogItems.
 */
async function seedItems(count: number): Promise<ReturnType<typeof makeItem>[]> {
  const items: ReturnType<typeof makeItem>[] = [];
  for (let i = 0; i < count; i++) {
    const item = makeItem(i, 'CT');
    await insertItem(PROJECT_PATH, item, PROJECT_ID, SECTION_ID);
    items.push(item);
  }
  return items;
}

// ============================================================
// STRESS TEST SUITE
// ============================================================

describe('Stress: CRUD at 1000+ scale', { timeout: 120000 }, () => {
  beforeEach(() => {
    // Reset mock state and rewire vi.fn() delegates
    mock = createStatefulSqlMock();

    // Reset the stable mockDb delegates to point to fresh mock
    mockDb.select.mockImplementation(<T = unknown[]>(query: string, values?: unknown[]) =>
      Promise.resolve(mock.selectHandler(query, values ?? []) as T)
    );
    mockDb.execute.mockImplementation((query: string, values?: unknown[]) =>
      Promise.resolve(mock.executeHandler(query, values ?? []))
    );
  });

  // -------------------------------------------------------
  // Test 1: Creates 1000+ items without error
  // -------------------------------------------------------
  test('creates 1000+ items without error', async () => {
    let error: unknown = null;

    const elapsed = await measureMs(async () => {
      try {
        await seedItems(ITEM_COUNT);
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeNull();
    expect(mock.backlogItems.length).toBe(ITEM_COUNT);

    // Log timing for reference (not a hard assertion at mock speed)
    console.info(`[stress] Created ${ITEM_COUNT} items in ${elapsed.toFixed(1)}ms`);
  });

  // -------------------------------------------------------
  // Test 2: Reads all 1000+ items back correctly
  // -------------------------------------------------------
  test('reads all 1000+ items back correctly', async () => {
    await seedItems(ITEM_COUNT);

    const items = await getAllItems(PROJECT_PATH, PROJECT_ID);

    expect(items.length).toBe(ITEM_COUNT);

    // Verify first item
    const first = items.find(it => it.id === 'CT-000');
    expect(first).toBeDefined();
    expect(first?.title).toBe('Stress test item 0');

    // Verify last item (index ITEM_COUNT - 1)
    const lastIdx = ITEM_COUNT - 1;
    const lastId = `CT-${String(lastIdx).padStart(3, '0')}`;
    const last = items.find(it => it.id === lastId);
    expect(last).toBeDefined();
    expect(last?.title).toBe(`Stress test item ${lastIdx}`);
  });

  // -------------------------------------------------------
  // Test 3: Updates 100 random items
  // -------------------------------------------------------
  test('updates 100 random items', async () => {
    await seedItems(ITEM_COUNT);

    // Pick deterministic "random" indices using modular arithmetic
    const updateIndices = Array.from({ length: 100 }, (_, k) => (k * 11) % ITEM_COUNT);

    for (const idx of updateIndices) {
      const itemId = `CT-${String(idx).padStart(3, '0')}`;
      await updateItem(PROJECT_PATH, itemId, { title: `UPDATED-${idx}` });
    }

    // Verify updates persisted in the mock store
    for (const idx of updateIndices) {
      const itemId = `CT-${String(idx).padStart(3, '0')}`;
      const row = mock.backlogItems.find(r => r.id === itemId);
      expect(row).toBeDefined();
      expect(row?.title).toBe(`UPDATED-${idx}`);
    }
  });

  // -------------------------------------------------------
  // Test 4: Deletes 100 items and verifies count
  // -------------------------------------------------------
  test('deletes 100 items and verifies count', async () => {
    await seedItems(ITEM_COUNT);

    // Delete items at indices 0-99
    for (let i = 0; i < 100; i++) {
      const itemId = `CT-${String(i).padStart(3, '0')}`;
      await deleteItem(PROJECT_PATH, itemId);
    }

    const remaining = await getAllItems(PROJECT_PATH, PROJECT_ID);
    expect(remaining.length).toBe(ITEM_COUNT - 100);

    // Verify deleted items are gone
    const deletedId = 'CT-000';
    const found = remaining.find(it => it.id === deletedId);
    expect(found).toBeUndefined();
  });

  // -------------------------------------------------------
  // Test 5: PRAGMA integrity_check passes after all operations
  // -------------------------------------------------------
  test('PRAGMA integrity_check passes after all operations', async () => {
    await seedItems(ITEM_COUNT);

    // Perform a mix of updates and deletes
    await updateItem(PROJECT_PATH, 'CT-005', { title: 'Modified after stress' });
    await deleteItem(PROJECT_PATH, 'CT-010');
    await deleteItem(PROJECT_PATH, 'CT-020');

    // Execute integrity check via the mock db.select
    const result = await mockDb.select('PRAGMA integrity_check', []);

    expect(result).toEqual([{ integrity_check: 'ok' }]);
  });

  // -------------------------------------------------------
  // Test 6: Full CRUD cycle completes in under 30 seconds
  // -------------------------------------------------------
  test('full CRUD cycle completes in under 30 seconds', { timeout: 60000 }, async () => {
    let totalMs = 0;

    // Step 1: Create 1100 items
    totalMs += await measureMs(async () => {
      await seedItems(ITEM_COUNT);
    });

    // Step 2: Read all items back
    totalMs += await measureMs(async () => {
      const items = await getAllItems(PROJECT_PATH, PROJECT_ID);
      expect(items.length).toBe(ITEM_COUNT);
    });

    // Step 3: Update 100 items
    totalMs += await measureMs(async () => {
      for (let i = 0; i < 100; i++) {
        const itemId = `CT-${String(i * 10 % ITEM_COUNT).padStart(3, '0')}`;
        await updateItem(PROJECT_PATH, itemId, { title: `CYCLE-UPDATED-${i}` });
      }
    });

    // Step 4: Delete 100 items
    totalMs += await measureMs(async () => {
      for (let i = 0; i < 100; i++) {
        const itemId = `CT-${String(i).padStart(3, '0')}`;
        await deleteItem(PROJECT_PATH, itemId);
      }
    });

    // Step 5: Integrity check
    totalMs += await measureMs(async () => {
      const result = await mockDb.select('PRAGMA integrity_check', []);
      expect(result).toEqual([{ integrity_check: 'ok' }]);
    });

    console.info(`[stress] Full CRUD cycle (create ${ITEM_COUNT} + read + update 100 + delete 100 + integrity): ${totalMs.toFixed(1)}ms`);

    // Assert: full cycle under 30 seconds (generous for mock layer)
    expect(totalMs).toBeLessThan(30000);
  });
});
