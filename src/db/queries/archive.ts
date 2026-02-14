/**
 * Query module for archived_items table operations.
 *
 * Provides CRUD operations for archived backlog items.
 * Archives preserve all item data for potential restoration.
 *
 * @module db/queries/archive
 */

import { getDatabase } from '../database';
import type { DbArchivedItem, DbBacklogItem } from '../schema';
import type { BacklogItem } from '../../types/backlog';
import { dbArchivedItemToArchivedItem, type ArchivedItem } from '../transforms';

/**
 * Get all archived items for a project, ordered by archive date (newest first).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of ArchivedItems ordered by archived_at DESC
 */
export async function getArchivedItems(
  projectPath: string,
  projectId: number
): Promise<ArchivedItem[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbArchivedItem[]>(
      `SELECT * FROM archived_items
       WHERE project_id = $1
       ORDER BY archived_at DESC`,
      [projectId]
    );
    return rows.map(dbArchivedItemToArchivedItem);
  } catch (error) {
    console.error('[archive] Error getting archived items:', error);
    throw error;
  }
}

/**
 * Get a single archived item by its ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID (e.g., "BUG-001")
 * @returns The ArchivedItem or null if not found
 */
export async function getArchivedItemById(
  projectPath: string,
  itemId: string
): Promise<ArchivedItem | null> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbArchivedItem[]>(
      'SELECT * FROM archived_items WHERE id = $1 LIMIT 1',
      [itemId]
    );
    return rows.length > 0 ? dbArchivedItemToArchivedItem(rows[0]) : null;
  } catch (error) {
    console.error('[archive] Error getting archived item by id:', error);
    throw error;
  }
}

/**
 * Insert a BacklogItem into the archived_items table.
 * Captures the original created_at timestamp if available.
 *
 * @param projectPath - Absolute path to the project directory
 * @param item - The BacklogItem to archive
 * @param projectId - The project ID
 */
export async function insertArchivedItem(
  projectPath: string,
  item: BacklogItem,
  projectId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Try to fetch the original created_at from backlog_items
    let originalCreatedAt: string | null = null;
    try {
      const existingRows = await db.select<Pick<DbBacklogItem, 'created_at'>[]>(
        'SELECT created_at FROM backlog_items WHERE id = $1 LIMIT 1',
        [item.id]
      );
      if (existingRows.length > 0) {
        originalCreatedAt = existingRows[0].created_at;
      }
    } catch {
      // If query fails, continue without original_created_at
    }

    await db.execute(
      `INSERT INTO archived_items (
        id, project_id, type, title, emoji, component, module,
        severity, priority, effort, description, user_story, specs, reproduction,
        criteria, dependencies, constraints, screens, screenshots, raw_markdown,
        archived_at, original_created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, datetime('now'), $21
      )`,
      [
        item.id,
        projectId,
        item.type,
        item.title,
        item.emoji ?? null,
        item.component ?? null,
        item.module ?? null,
        item.severity ?? null,
        item.priority ?? null,
        item.effort ?? null,
        item.description ?? null,
        item.userStory ?? null,
        item.specs?.length ? JSON.stringify(item.specs) : null,
        item.reproduction?.length ? JSON.stringify(item.reproduction) : null,
        item.criteria?.length ? JSON.stringify(item.criteria) : null,
        item.dependencies?.length ? JSON.stringify(item.dependencies) : null,
        item.constraints?.length ? JSON.stringify(item.constraints) : null,
        item.screens?.length ? JSON.stringify(item.screens) : null,
        item.screenshots?.length ? JSON.stringify(item.screenshots) : null,
        item.rawMarkdown,
        originalCreatedAt,
      ]
    );
  } catch (error) {
    console.error('[DEBUG-ARCHIVE-DB] INSERT FAILED:', error);
    throw error;
  }
}

/**
 * Delete an archived item permanently.
 * Used for permanent deletion or when restoring to backlog.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID to delete
 */
export async function deleteArchivedItem(
  projectPath: string,
  itemId: string
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM archived_items WHERE id = $1',
      [itemId]
    );
  } catch (error) {
    console.error('[archive] Error deleting archived item:', error);
    throw error;
  }
}

/**
 * Count archived items for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Number of archived items
 */
export async function countArchivedItems(
  projectPath: string,
  projectId: number
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM archived_items WHERE project_id = $1',
      [projectId]
    );
    return rows[0]?.count ?? 0;
  } catch (error) {
    console.error('[archive] Error counting archived items:', error);
    throw error;
  }
}

/**
 * Get all item IDs from the archived_items table for a project.
 *
 * Used to prevent ID collisions when generating new item IDs:
 * both active and archived IDs must be considered to avoid reuse.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of archived item ID strings (e.g., ["BUG-002", "CT-001"])
 */
export async function getArchivedItemIds(
  projectPath: string,
  projectId: number
): Promise<string[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ id: string }[]>(
      'SELECT id FROM archived_items WHERE project_id = $1',
      [projectId]
    );
    return rows.map(r => r.id);
  } catch (error) {
    console.error('[archive] Error getting archived item IDs:', error);
    return [];
  }
}

/**
 * Get all screenshot filenames referenced by archived items for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of screenshot filenames
 */
export async function getArchivedScreenshotFilenames(
  projectPath: string,
  projectId: number
): Promise<string[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ screenshots: string }[]>(
      `SELECT screenshots FROM archived_items
       WHERE project_id = $1
       AND screenshots IS NOT NULL AND length(screenshots) > 2`,
      [projectId]
    );
    const filenames: string[] = [];
    for (const row of rows) {
      try {
        const arr = JSON.parse(row.screenshots) as { filename: string }[];
        for (const s of arr) {
          if (s.filename) filenames.push(s.filename);
        }
      } catch { /* skip malformed JSON */ }
    }
    return filenames;
  } catch (error) {
    console.error('[archive] Error getting archived screenshot filenames:', error);
    return [];
  }
}

/**
 * Get screenshot filenames for a single archived item.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID
 * @returns Array of screenshot filenames
 */
export async function getArchivedItemScreenshots(
  projectPath: string,
  itemId: string
): Promise<string[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ screenshots: string }[]>(
      `SELECT screenshots FROM archived_items
       WHERE id = $1
       AND screenshots IS NOT NULL AND length(screenshots) > 2`,
      [itemId]
    );
    if (rows.length === 0) return [];
    try {
      const arr = JSON.parse(rows[0].screenshots) as { filename: string }[];
      return arr.map((s) => s.filename).filter(Boolean);
    } catch { return []; }
  } catch (error) {
    console.error('[archive] Error getting archived item screenshots:', error);
    return [];
  }
}

/**
 * Delete all archived items for a project (purge archive).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Number of deleted items
 */
export async function purgeAllArchivedItems(
  projectPath: string,
  projectId: number
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const result = await db.execute(
      'DELETE FROM archived_items WHERE project_id = $1',
      [projectId]
    );
    return result.rowsAffected;
  } catch (error) {
    console.error('[archive] Error purging archived items:', error);
    throw error;
  }
}

/**
 * Search archived items by query string.
 * Searches in id, title, and description fields.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param query - Search query string
 * @returns Array of matching ArchivedItems
 */
export async function searchArchivedItems(
  projectPath: string,
  projectId: number,
  query: string
): Promise<ArchivedItem[]> {
  try {
    const db = await getDatabase(projectPath);
    const searchPattern = `%${query}%`;
    const rows = await db.select<DbArchivedItem[]>(
      `SELECT * FROM archived_items
       WHERE project_id = $1
       AND (id LIKE $2 OR title LIKE $2 OR description LIKE $2)
       ORDER BY archived_at DESC`,
      [projectId, searchPattern]
    );
    return rows.map(dbArchivedItemToArchivedItem);
  } catch (error) {
    console.error('[archive] Error searching archived items:', error);
    throw error;
  }
}
