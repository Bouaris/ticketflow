/**
 * Stress Test Utilities
 *
 * Provides stateful SQL mock infrastructure and helper functions for
 * stress-testing the database layer at 1000+ item scale.
 *
 * Design: The stateful mock maintains an in-memory representation of the
 * database so tests can verify correctness of CRUD operations without
 * a real SQLite instance.
 *
 * @module test-utils/stress-helpers
 */

import type { BacklogItem } from '../types/backlog';

// ============================================================
// INTERNAL TYPES
// ============================================================

/** Minimal in-memory representation of a backlog_items row */
interface MockBacklogItemRow {
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

/** Minimal in-memory representation of a sections row */
interface MockSectionRow {
  id: number;
  project_id: number;
  title: string;
  position: number;
  raw_header: string;
}

/** Return type of createStatefulSqlMock */
export interface StatefulSqlMock {
  /** In-memory store for backlog_items rows */
  backlogItems: MockBacklogItemRow[];
  /** In-memory store for sections rows */
  sections: MockSectionRow[];
  /** Auto-incrementing ID counter shared across tables */
  lastInsertId: number;
  /** Handler for plugin:sql|select — stateful, reads from in-memory store */
  selectHandler: (query: string, bindValues: unknown[]) => unknown[];
  /** Handler for plugin:sql|execute — stateful, writes to in-memory store */
  executeHandler: (query: string, bindValues: unknown[]) => { lastInsertId: number; rowsAffected: number };
  /** Reset all state to empty */
  reset: () => void;
}

// ============================================================
// STATEFUL SQL MOCK
// ============================================================

/**
 * Create a stateful SQL mock that maintains an in-memory representation
 * of the backlog_items and sections tables.
 *
 * The mock handles:
 * - INSERT INTO backlog_items — stores row in memory
 * - INSERT INTO sections — stores row in memory with auto-increment ID
 * - SELECT * FROM backlog_items WHERE project_id = $1 — returns matching rows
 * - SELECT * FROM backlog_items WHERE id = $1 — returns single row
 * - SELECT COUNT(*) — returns count
 * - PRAGMA integrity_check — returns ok
 * - UPDATE backlog_items — updates matching row in place
 * - DELETE FROM backlog_items WHERE id = $1 — removes matching row
 * - SELECT * FROM sections — returns stored sections
 *
 * @returns StatefulSqlMock with handlers and in-memory state
 */
export function createStatefulSqlMock(): StatefulSqlMock {
  const state: {
    backlogItems: MockBacklogItemRow[];
    sections: MockSectionRow[];
    idCounter: number;
  } = {
    backlogItems: [],
    sections: [],
    idCounter: 1,
  };

  function reset(): void {
    state.backlogItems = [];
    state.sections = [];
    state.idCounter = 1;
  }

  function selectHandler(query: string, bindValues: unknown[]): unknown[] {
    const q = query.trim().toUpperCase();

    // PRAGMA integrity_check
    if (q.includes('PRAGMA INTEGRITY_CHECK')) {
      return [{ integrity_check: 'ok' }];
    }

    // SELECT COUNT(*)
    if (q.includes('SELECT COUNT(*)')) {
      if (q.includes('BACKLOG_ITEMS')) {
        const projectId = bindValues[0] as number;
        const count = projectId != null
          ? state.backlogItems.filter(r => r.project_id === projectId).length
          : state.backlogItems.length;
        return [{ 'COUNT(*)': count }];
      }
      return [{ 'COUNT(*)': 0 }];
    }

    // SELECT MAX(position) ...
    if (q.includes('MAX(POSITION)') || q.includes('SELECT MAX(POSITION)')) {
      const sectionId = bindValues[0] as number;
      const rows = state.backlogItems.filter(r => r.section_id === sectionId);
      const maxPos = rows.length === 0 ? null : Math.max(...rows.map(r => r.position));
      return [{ max_pos: maxPos }];
    }

    // SELECT * FROM sections
    if (q.includes('FROM SECTIONS')) {
      if (q.includes('WHERE PROJECT_ID')) {
        const projectId = bindValues[0] as number;
        return state.sections.filter(s => s.project_id === projectId);
      }
      return state.sections;
    }

    // SELECT * FROM backlog_items WHERE id = $1
    if (q.includes('FROM BACKLOG_ITEMS') && q.includes('WHERE ID = ')) {
      const id = bindValues[0] as string;
      return state.backlogItems.filter(r => r.id === id);
    }

    // SELECT * FROM backlog_items WHERE project_id = $1 (ordered)
    if (q.includes('FROM BACKLOG_ITEMS') && q.includes('WHERE PROJECT_ID')) {
      const projectId = bindValues[0] as number;
      return state.backlogItems
        .filter(r => r.project_id === projectId)
        .slice()
        .sort((a, b) => a.section_id - b.section_id || a.position - b.position);
    }

    // SELECT * FROM backlog_items WHERE section_id = $1
    if (q.includes('FROM BACKLOG_ITEMS') && q.includes('WHERE SECTION_ID')) {
      const sectionId = bindValues[0] as number;
      return state.backlogItems
        .filter(r => r.section_id === sectionId)
        .slice()
        .sort((a, b) => a.position - b.position);
    }

    // SELECT id FROM backlog_items (for getMaxItemNumber)
    if (q.includes('FROM BACKLOG_ITEMS') && q.includes('SELECT ID')) {
      if (q.includes('WHERE PROJECT_ID') && q.includes('AND TYPE')) {
        const projectId = bindValues[0] as number;
        const type = bindValues[1] as string;
        return state.backlogItems
          .filter(r => r.project_id === projectId && r.type === type)
          .map(r => ({ id: r.id }));
      }
      return state.backlogItems.map(r => ({ id: r.id }));
    }

    // SELECT type, COUNT(*) (countItemsByType)
    if (q.includes('GROUP BY TYPE')) {
      const projectId = bindValues[0] as number;
      const grouped: Record<string, number> = {};
      state.backlogItems
        .filter(r => r.project_id === projectId)
        .forEach(r => { grouped[r.type] = (grouped[r.type] || 0) + 1; });
      return Object.entries(grouped).map(([type, count]) => ({ type, count }));
    }

    // Fallback: SELECT * FROM backlog_items (general)
    if (q.includes('FROM BACKLOG_ITEMS')) {
      return state.backlogItems;
    }

    // item_counters table (allocateIdRange)
    if (q.includes('ITEM_COUNTERS')) {
      return [];
    }

    return [];
  }

  function executeHandler(
    query: string,
    bindValues: unknown[]
  ): { lastInsertId: number; rowsAffected: number } {
    const q = query.trim().toUpperCase();

    // INSERT INTO backlog_items
    if (q.includes('INSERT') && q.includes('BACKLOG_ITEMS')) {
      // Values order from backlogItemToDbValues:
      // $1=id, $2=project_id, $3=section_id, $4=type, $5=title, $6=emoji,
      // $7=component, $8=module, $9=severity, $10=priority, $11=effort,
      // $12=description, $13=user_story, $14=specs, $15=reproduction,
      // $16=criteria, $17=dependencies, $18=constraints, $19=screens,
      // $20=screenshots, $21=position, $22=raw_markdown
      const [
        id, project_id, section_id, type, title, emoji, component, module_,
        severity, priority, effort, description, user_story, specs, reproduction,
        criteria, dependencies, constraints, screens, screenshots, position, raw_markdown,
      ] = bindValues;

      // Handle INSERT OR REPLACE: remove existing if same id
      const existingIdx = state.backlogItems.findIndex(r => r.id === id);
      if (existingIdx >= 0) {
        state.backlogItems.splice(existingIdx, 1);
      }

      const now = new Date().toISOString();
      const row: MockBacklogItemRow = {
        id: id as string,
        project_id: project_id as number,
        section_id: section_id as number,
        type: type as string,
        title: title as string,
        emoji: (emoji as string | null) ?? null,
        component: (component as string | null) ?? null,
        module: (module_ as string | null) ?? null,
        severity: (severity as string | null) ?? null,
        priority: (priority as string | null) ?? null,
        effort: (effort as string | null) ?? null,
        description: (description as string | null) ?? null,
        user_story: (user_story as string | null) ?? null,
        specs: (specs as string | null) ?? null,
        reproduction: (reproduction as string | null) ?? null,
        criteria: (criteria as string | null) ?? null,
        dependencies: (dependencies as string | null) ?? null,
        constraints: (constraints as string | null) ?? null,
        screens: (screens as string | null) ?? null,
        screenshots: (screenshots as string | null) ?? null,
        position: (position as number) ?? 0,
        raw_markdown: (raw_markdown as string) ?? '',
        created_at: now,
        updated_at: now,
      };
      state.backlogItems.push(row);
      const insertId = ++state.idCounter;
      return { lastInsertId: insertId, rowsAffected: 1 };
    }

    // INSERT INTO sections
    if (q.includes('INSERT') && q.includes('SECTIONS')) {
      const [project_id, title, position, raw_header] = bindValues;
      const id = ++state.idCounter;
      state.sections.push({
        id,
        project_id: project_id as number,
        title: title as string,
        position: position as number,
        raw_header: raw_header as string,
      });
      return { lastInsertId: id, rowsAffected: 1 };
    }

    // INSERT INTO item_counters / UPDATE item_counters (allocateIdRange)
    if (q.includes('ITEM_COUNTERS')) {
      return { lastInsertId: ++state.idCounter, rowsAffected: 1 };
    }

    // UPDATE backlog_items SET ... WHERE id = $N
    if (q.includes('UPDATE BACKLOG_ITEMS')) {
      // The id is the last bind value (appended in updateItem)
      const itemId = bindValues[bindValues.length - 1] as string;
      const rowIdx = state.backlogItems.findIndex(r => r.id === itemId);
      if (rowIdx >= 0) {
        // Parse SET clauses to update fields
        // We re-parse the query to find which columns are being set.
        // The approach: iterate over SET clause segments and match params.
        const setMatch = query.match(/SET\s+(.+?)\s+WHERE/is);
        if (setMatch) {
          const setClauses = setMatch[1].split(',').map(s => s.trim());
          let paramIdx = 0;
          const row = state.backlogItems[rowIdx];
          for (const clause of setClauses) {
            // Skip updated_at = datetime('now') — no bind param
            if (clause.toLowerCase().includes("datetime('now')")) continue;
            const colMatch = clause.match(/^(\w+)\s*=\s*\$\d+/i);
            if (colMatch) {
              const col = colMatch[1].toLowerCase() as keyof MockBacklogItemRow;
              (row as unknown as Record<string, unknown>)[col] = bindValues[paramIdx] ?? null;
              paramIdx++;
            }
          }
          row.updated_at = new Date().toISOString();
        }
        return { lastInsertId: 0, rowsAffected: 1 };
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // DELETE FROM backlog_items WHERE id = $1
    if (q.includes('DELETE FROM BACKLOG_ITEMS')) {
      const itemId = bindValues[0] as string;
      const before = state.backlogItems.length;
      state.backlogItems = state.backlogItems.filter(r => r.id !== itemId);
      const rowsAffected = before - state.backlogItems.length;
      return { lastInsertId: 0, rowsAffected };
    }

    // DELETE FROM item_relations (removeRelationsForItem)
    if (q.includes('DELETE FROM ITEM_RELATIONS')) {
      return { lastInsertId: 0, rowsAffected: 0 };
    }

    // Fallback
    return { lastInsertId: ++state.idCounter, rowsAffected: 1 };
  }

  return {
    get backlogItems() { return state.backlogItems; },
    get sections() { return state.sections; },
    get lastInsertId() { return state.idCounter; },
    selectHandler,
    executeHandler,
    reset,
  };
}

// ============================================================
// ITEM FACTORY
// ============================================================

/**
 * Create a minimal valid BacklogItem for stress testing.
 *
 * @param index - Numeric index used to generate the ID and title
 * @param type - Item type prefix (default: 'CT')
 * @returns A minimal valid BacklogItem
 */
export function makeItem(index: number, type: string = 'CT'): BacklogItem {
  const id = `${type}-${String(index).padStart(3, '0')}`;
  return {
    id,
    type,
    title: `Stress test item ${index}`,
    description: `Description for stress item ${index}`,
    rawMarkdown: `### ${id} | Stress test item ${index}\n**Description:** Description for stress item ${index}`,
    sectionIndex: 0,
    specs: [],
    criteria: [],
    dependencies: [],
    constraints: [],
    screenshots: [],
  };
}

// ============================================================
// TIMING UTILITY
// ============================================================

/**
 * Measure the elapsed time in milliseconds for an async operation.
 *
 * @param fn - The async function to measure
 * @returns Elapsed time in milliseconds
 */
export async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

