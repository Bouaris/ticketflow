/**
 * Query module for item_relations table operations.
 *
 * Provides CRUD operations for managing relations between backlog items.
 * All queries use $1, $2 placeholders per tauri-plugin-sql requirements.
 *
 * @module db/queries/relations
 */

import { getDatabase } from '../database';
import type { DbItemRelation } from '../schema';
import type { ItemRelation, RelationType } from '../../types/relations';

// ============================================================
// TRANSFORM
// ============================================================

/** Convert a DB row to a domain ItemRelation (snake_case -> camelCase) */
function dbRowToItemRelation(row: DbItemRelation): ItemRelation {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceId: row.source_id,
    targetId: row.target_id,
    relationType: row.relation_type as RelationType,
    confidence: row.confidence,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all relations involving a specific item (as source or target).
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID (e.g., "BUG-001")
 * @returns Array of ItemRelation ordered by creation date (newest first)
 */
export async function getRelationsForItem(
  projectPath: string,
  itemId: string
): Promise<ItemRelation[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbItemRelation[]>(
      `SELECT * FROM item_relations
       WHERE source_id = $1 OR target_id = $1
       ORDER BY created_at DESC`,
      [itemId]
    );
    return rows.map(dbRowToItemRelation);
  } catch (error) {
    console.error('[relations] Error getting relations for item:', error);
    throw error;
  }
}

/**
 * Get all relations for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of all ItemRelation for the project
 */
export async function getAllRelationsForProject(
  projectPath: string,
  projectId: number
): Promise<ItemRelation[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbItemRelation[]>(
      `SELECT * FROM item_relations
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    return rows.map(dbRowToItemRelation);
  } catch (error) {
    console.error('[relations] Error getting all relations for project:', error);
    throw error;
  }
}

/**
 * Add a relation between two items.
 *
 * Uses INSERT OR IGNORE to silently skip duplicates (same source, target, type).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param sourceId - Source item ID
 * @param targetId - Target item ID
 * @param relationType - Type of relation
 * @param confidence - AI confidence score (null for manual)
 * @param reason - Optional explanation
 * @returns The inserted row ID, or 0 if duplicate was ignored
 */
export async function addRelation(
  projectPath: string,
  projectId: number,
  sourceId: string,
  targetId: string,
  relationType: RelationType,
  confidence?: number,
  reason?: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const result = await db.execute(
      `INSERT OR IGNORE INTO item_relations
       (project_id, source_id, target_id, relation_type, confidence, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, sourceId, targetId, relationType, confidence ?? null, reason ?? null]
    );
    return result.lastInsertId ?? 0;
  } catch (error) {
    console.error('[relations] Error adding relation:', error);
    throw error;
  }
}

/**
 * Remove a relation by its ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param relationId - The relation row ID
 */
export async function removeRelation(
  projectPath: string,
  relationId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM item_relations WHERE id = $1',
      [relationId]
    );
  } catch (error) {
    console.error('[relations] Error removing relation:', error);
    throw error;
  }
}

/**
 * Remove all relations involving an item (cascade cleanup).
 *
 * Called before deleting an item to prevent orphaned relations.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID being deleted
 */
export async function removeRelationsForItem(
  projectPath: string,
  itemId: string
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM item_relations WHERE source_id = $1 OR target_id = $1',
      [itemId]
    );
  } catch (error) {
    console.error('[relations] Error removing relations for item:', error);
    throw error;
  }
}
