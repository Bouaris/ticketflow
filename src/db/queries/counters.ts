/**
 * Query module for type_counters table operations.
 *
 * Provides monotonic ID generation that never reuses numbers
 * even after items are archived or deleted.
 *
 * @module db/queries/counters
 */

import { getDatabase } from '../database';

/**
 * Get the next item number for a type, atomically incrementing the counter.
 *
 * This function ensures that:
 * - Numbers never get reused after archiving or deleting items
 * - Numbers increment monotonically even past 999 (BUG-1000, etc.)
 * - The operation is atomic (no race conditions)
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typePrefix - The type prefix (e.g., "BUG", "CT")
 * @returns The next number to use (already incremented)
 *
 * @example
 * ```typescript
 * const nextNum = await getNextItemNumber(projectPath, projectId, 'BUG');
 * const itemId = `BUG-${String(nextNum).padStart(3, '0')}`; // BUG-042
 * ```
 */
export async function getNextItemNumber(
  projectPath: string,
  projectId: number,
  typePrefix: string
): Promise<number> {
  // No explicit transaction needed: INSERT ON CONFLICT is atomic in SQLite,
  // and this is a single-user desktop app with no concurrent writers.
  // Using withTransaction/SAVEPOINT here caused "cannot start a transaction
  // within a transaction" errors because tauri-plugin-sql shares a singleton
  // connection that may already have an active transaction from fire-and-forget
  // history saves.
  const db = await getDatabase(projectPath);

  // Step 1: Insert or increment the counter (atomic upsert)
  await db.execute(
    `INSERT INTO type_counters (project_id, type_prefix, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (project_id, type_prefix)
     DO UPDATE SET last_number = last_number + 1`,
    [projectId, typePrefix]
  );

  // Step 2: Read the incremented value
  const rows = await db.select<{ last_number: number }[]>(
    `SELECT last_number FROM type_counters
     WHERE project_id = $1 AND type_prefix = $2`,
    [projectId, typePrefix]
  );

  if (rows.length === 0) {
    throw new Error(`Counter not found after insert for ${typePrefix} in project ${projectId}`);
  }

  return rows[0].last_number;
}

/**
 * Seed a counter from existing items (both backlog_items and archived_items).
 *
 * This is a safety net function that can be called manually if needed.
 * The migration already handles seeding for existing projects.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typePrefix - The type prefix (e.g., "BUG")
 * @returns The seeded counter value
 */
export async function seedCounterFromExisting(
  projectPath: string,
  projectId: number,
  typePrefix: string
): Promise<number> {
  const db = await getDatabase(projectPath);

  // Find max number from both active and archived items
  const rows = await db.select<{ max_num: number | null }[]>(
    `SELECT MAX(num) as max_num FROM (
      SELECT CAST(SUBSTR(id, INSTR(id, '-') + 1) AS INTEGER) as num
      FROM backlog_items
      WHERE project_id = $1 AND type = $2
      UNION ALL
      SELECT CAST(SUBSTR(id, INSTR(id, '-') + 1) AS INTEGER) as num
      FROM archived_items
      WHERE project_id = $1 AND type = $2
    )`,
    [projectId, typePrefix]
  );

  const maxNum = rows[0]?.max_num ?? 0;

  // Insert or replace the counter
  await db.execute(
    `INSERT OR REPLACE INTO type_counters (project_id, type_prefix, last_number)
     VALUES ($1, $2, $3)`,
    [projectId, typePrefix, maxNum]
  );

  return maxNum;
}

/**
 * Atomically allocate a range of IDs for bulk insertion.
 *
 * Increments the counter by `count` in a single operation and returns
 * the starting ID number. This prevents race conditions when multiple
 * items of the same type are created in bulk.
 *
 * IMPORTANT: This function must be called INSIDE a withTransaction block
 * when used with bulkCreateItems. It does not create its own transaction
 * (same pattern as getNextItemNumber).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typePrefix - The type prefix (e.g., "BUG", "CT")
 * @param count - Number of IDs to allocate (must be >= 1)
 * @returns Object with startNumber (first allocated) and endNumber (last allocated)
 *
 * @example
 * ```typescript
 * const { startNumber, endNumber } = await allocateIdRange(path, projId, 'BUG', 5);
 * // If counter was at 10: startNumber = 11, endNumber = 15
 * // Generated IDs: BUG-011, BUG-012, BUG-013, BUG-014, BUG-015
 * ```
 */
export async function allocateIdRange(
  projectPath: string,
  projectId: number,
  typePrefix: string,
  count: number
): Promise<{ startNumber: number; endNumber: number }> {
  if (count < 1) {
    throw new Error(`Count must be >= 1, got ${count}`);
  }

  const db = await getDatabase(projectPath);

  // Ensure counter exists (no-op if already present)
  await db.execute(
    `INSERT INTO type_counters (project_id, type_prefix, last_number)
     VALUES ($1, $2, 0)
     ON CONFLICT (project_id, type_prefix) DO NOTHING`,
    [projectId, typePrefix]
  );

  // Atomically increment by count and read the new value
  await db.execute(
    `UPDATE type_counters
     SET last_number = last_number + $1
     WHERE project_id = $2 AND type_prefix = $3`,
    [count, projectId, typePrefix]
  );

  const rows = await db.select<{ last_number: number }[]>(
    `SELECT last_number FROM type_counters
     WHERE project_id = $1 AND type_prefix = $2`,
    [projectId, typePrefix]
  );

  if (rows.length === 0) {
    throw new Error(`Counter not found after allocation for ${typePrefix} in project ${projectId}`);
  }

  const endNumber = rows[0].last_number;
  const startNumber = endNumber - count + 1;

  return { startNumber, endNumber };
}
