/**
 * Query module for history table operations.
 *
 * Provides delta-based and full-snapshot operations for storing
 * and retrieving backlog history. Delta storage reduces DB size
 * by ~90% for typical incremental edits.
 *
 * @module db/queries/history
 */

import { getDatabase } from '../database';
import type { DbHistory } from '../schema';
import * as jsondiffpatch from 'jsondiffpatch';

/** Maximum number of history entries to keep per project */
const MAX_HISTORY_ENTRIES = 50;

/** jsondiffpatch instance configured for backlog diffing */
const diffpatch = jsondiffpatch.create({
  // Detect array moves for better diffs on section/item reordering
  arrays: {
    detectMove: true,
  },
});

/**
 * Save a delta-based history entry.
 *
 * Computes the diff between previousState and currentState,
 * storing only the delta. This reduces storage by ~90% for
 * typical single-field edits.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param previousState - The state before the change (parsed object)
 * @param currentState - The state after the change (parsed object)
 * @param description - Human-readable description of the change
 * @returns The new history entry ID, or null if states are identical
 */
export async function saveDelta(
  projectPath: string,
  projectId: number,
  previousState: unknown,
  currentState: unknown,
  description: string
): Promise<number | null> {
  try {
    const delta = diffpatch.diff(previousState, currentState);

    // If no difference, skip saving
    if (!delta) {
      return null;
    }

    const db = await getDatabase(projectPath);
    const deltaJson = JSON.stringify(delta);

    const result = await db.execute(
      `INSERT INTO history (project_id, backlog_snapshot, description, delta_type, created_at)
       VALUES ($1, $2, $3, 'delta', datetime('now'))`,
      [projectId, deltaJson, description]
    );

    // Trim old entries to maintain limit
    await trimHistory(projectPath, projectId, MAX_HISTORY_ENTRIES);

    if (result.lastInsertId === undefined) {
      throw new Error('Failed to get lastInsertId after history insert');
    }
    return result.lastInsertId;
  } catch (error) {
    console.error('[history] Error saving delta:', error);
    throw error;
  }
}

/**
 * Save a full snapshot to history.
 *
 * Use this for the initial state capture or when no previous
 * state is available for delta computation.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param backlogJson - JSON serialization of the backlog state
 * @param description - Human-readable description of the change
 * @returns The new history entry ID
 */
export async function saveFullSnapshot(
  projectPath: string,
  projectId: number,
  backlogJson: string,
  description: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);

    const result = await db.execute(
      `INSERT INTO history (project_id, backlog_snapshot, description, delta_type, created_at)
       VALUES ($1, $2, $3, 'full', datetime('now'))`,
      [projectId, backlogJson, description]
    );

    // Trim old entries to maintain limit
    await trimHistory(projectPath, projectId, MAX_HISTORY_ENTRIES);

    if (result.lastInsertId === undefined) {
      throw new Error('Failed to get lastInsertId after history insert');
    }
    return result.lastInsertId;
  } catch (error) {
    console.error('[history] Error saving full snapshot:', error);
    throw error;
  }
}

/**
 * Apply undo using a delta entry.
 *
 * Uses jsondiffpatch.unpatch to reverse the delta on the current state.
 * Returns a deep clone so the caller's state is not mutated.
 *
 * @param currentState - The current backlog state (parsed object)
 * @param deltaJson - The JSON-serialized delta from the history entry
 * @returns The previous state after reversing the delta
 */
export function applyUndo(currentState: unknown, deltaJson: string): unknown {
  const delta = JSON.parse(deltaJson) as jsondiffpatch.Delta;
  const cloned = structuredClone(currentState);
  return diffpatch.unpatch(cloned, delta);
}

/**
 * Apply redo using a delta entry.
 *
 * Uses jsondiffpatch.patch to re-apply the delta on the current state.
 * Returns a deep clone so the caller's state is not mutated.
 *
 * @param currentState - The current backlog state (parsed object)
 * @param deltaJson - The JSON-serialized delta from the history entry
 * @returns The next state after applying the delta
 */
export function applyRedo(currentState: unknown, deltaJson: string): unknown {
  const delta = JSON.parse(deltaJson) as jsondiffpatch.Delta;
  const cloned = structuredClone(currentState);
  return diffpatch.patch(cloned, delta);
}

/**
 * Save a new snapshot to history.
 *
 * @deprecated Use saveDelta() for incremental changes or saveFullSnapshot() for initial state.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param backlogJson - JSON serialization of the backlog state
 * @param description - Human-readable description of the change
 * @returns The new history entry ID
 */
export async function saveSnapshot(
  projectPath: string,
  projectId: number,
  backlogJson: string,
  description: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);

    const result = await db.execute(
      `INSERT INTO history (project_id, backlog_snapshot, description, delta_type, created_at)
       VALUES ($1, $2, $3, 'full', datetime('now'))`,
      [projectId, backlogJson, description]
    );

    // Trim old entries to maintain limit
    await trimHistory(projectPath, projectId, MAX_HISTORY_ENTRIES);

    if (result.lastInsertId === undefined) {
      throw new Error('Failed to get lastInsertId after history insert');
    }
    return result.lastInsertId;
  } catch (error) {
    console.error('[history] Error saving snapshot:', error);
    throw error;
  }
}

/**
 * Get a specific snapshot by ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param snapshotId - The history entry ID
 * @returns The backlog JSON string or null if not found
 */
export async function getSnapshot(
  projectPath: string,
  snapshotId: number
): Promise<string | null> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ backlog_snapshot: string }[]>(
      'SELECT backlog_snapshot FROM history WHERE id = $1 LIMIT 1',
      [snapshotId]
    );
    return rows.length > 0 ? rows[0].backlog_snapshot : null;
  } catch (error) {
    console.error('[history] Error getting snapshot:', error);
    throw error;
  }
}

/**
 * Get the latest snapshots for a project, ordered by most recent first.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param limit - Maximum number of entries to return
 * @returns Array of history entries (most recent first)
 */
export async function getLatestSnapshots(
  projectPath: string,
  projectId: number,
  limit: number = MAX_HISTORY_ENTRIES
): Promise<DbHistory[]> {
  try {
    const db = await getDatabase(projectPath);
    return await db.select<DbHistory[]>(
      `SELECT * FROM history
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectId, limit]
    );
  } catch (error) {
    console.error('[history] Error getting latest snapshots:', error);
    throw error;
  }
}

/**
 * Get all history entries ordered by creation time (oldest first).
 * Used for undo/redo navigation.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of history entries (oldest first)
 */
export async function getHistoryStack(
  projectPath: string,
  projectId: number
): Promise<DbHistory[]> {
  try {
    const db = await getDatabase(projectPath);
    return await db.select<DbHistory[]>(
      `SELECT * FROM history
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );
  } catch (error) {
    console.error('[history] Error getting history stack:', error);
    throw error;
  }
}

/**
 * Trim history to keep only the most recent N entries.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param keepCount - Number of entries to keep
 */
export async function trimHistory(
  projectPath: string,
  projectId: number,
  keepCount: number = MAX_HISTORY_ENTRIES
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Delete entries older than the keepCount most recent
    await db.execute(
      `DELETE FROM history
       WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM history
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [projectId, keepCount]
    );
  } catch (error) {
    console.error('[history] Error trimming history:', error);
    throw error;
  }
}

/**
 * Clear all history for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 */
export async function clearHistory(
  projectPath: string,
  projectId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM history WHERE project_id = $1',
      [projectId]
    );
  } catch (error) {
    console.error('[history] Error clearing history:', error);
    throw error;
  }
}

/**
 * Get the count of history entries for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Number of history entries
 */
export async function getHistoryCount(
  projectPath: string,
  projectId: number
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM history WHERE project_id = $1',
      [projectId]
    );
    return rows.length > 0 ? rows[0].count : 0;
  } catch (error) {
    console.error('[history] Error getting history count:', error);
    throw error;
  }
}

/**
 * Get snapshot at a specific index in the history stack.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param index - The 0-based index (0 = oldest)
 * @returns The history entry or null if not found
 */
export async function getSnapshotAtIndex(
  projectPath: string,
  projectId: number,
  index: number
): Promise<DbHistory | null> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbHistory[]>(
      `SELECT * FROM history
       WHERE project_id = $1
       ORDER BY created_at ASC
       LIMIT 1 OFFSET $2`,
      [projectId, index]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('[history] Error getting snapshot at index:', error);
    throw error;
  }
}

/**
 * Delete history entries after a certain index (for redo cleanup).
 * When undoing and then making a new change, we need to clear the redo stack.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param afterIndex - Delete entries with index greater than this
 */
export async function deleteHistoryAfterIndex(
  projectPath: string,
  projectId: number,
  afterIndex: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Get the IDs to keep (everything up to and including afterIndex)
    const keepRows = await db.select<{ id: number }[]>(
      `SELECT id FROM history
       WHERE project_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [projectId, afterIndex + 1]
    );

    const keepIds = keepRows.map(r => r.id);

    if (keepIds.length > 0) {
      // Delete everything not in the keep list
      const placeholders = keepIds.map((_, i) => `$${i + 2}`).join(', ');
      await db.execute(
        `DELETE FROM history
         WHERE project_id = $1
         AND id NOT IN (${placeholders})`,
        [projectId, ...keepIds]
      );
    }
  } catch (error) {
    console.error('[history] Error deleting history after index:', error);
    throw error;
  }
}
