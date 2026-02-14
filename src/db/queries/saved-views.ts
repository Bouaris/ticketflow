/**
 * Query module for saved_views table operations.
 *
 * Provides CRUD operations for saved filter views.
 * Each view stores a JSON-serialized BacklogFilters object.
 *
 * @module db/queries/saved-views
 */

import { getDatabase } from '../database';

// ============================================================
// DB ROW TYPE
// ============================================================

export interface SavedViewRow {
  id: number;
  project_id: number;
  name: string;
  filters_json: string;
  position: number;
  is_default: number;
  created_at: string;
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Load all saved views for a project, ordered by position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of SavedViewRow ordered by position ASC
 */
export async function loadSavedViews(
  projectPath: string,
  projectId: number
): Promise<SavedViewRow[]> {
  try {
    const db = await getDatabase(projectPath);
    return await db.select<SavedViewRow[]>(
      `SELECT * FROM saved_views
       WHERE project_id = $1
       ORDER BY position ASC`,
      [projectId]
    );
  } catch (error) {
    console.error('[saved-views] Error loading views:', error);
    throw error;
  }
}

/**
 * Insert a new saved view.
 *
 * Position is auto-set to the next available (max + 1).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param name - Display name of the view
 * @param filtersJson - JSON-serialized BacklogFilters
 * @returns The ID of the inserted view
 */
export async function insertSavedView(
  projectPath: string,
  projectId: number,
  name: string,
  filtersJson: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);

    // Get next position
    const posRows = await db.select<{ max_pos: number | null }[]>(
      'SELECT MAX(position) as max_pos FROM saved_views WHERE project_id = $1',
      [projectId]
    );
    const nextPos = (posRows[0]?.max_pos ?? -1) + 1;

    const result = await db.execute(
      `INSERT INTO saved_views (project_id, name, filters_json, position)
       VALUES ($1, $2, $3, $4)`,
      [projectId, name, filtersJson, nextPos]
    );

    return result.lastInsertId ?? 0;
  } catch (error) {
    console.error('[saved-views] Error inserting view:', error);
    throw error;
  }
}

/**
 * Delete a saved view by ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param viewId - The view ID to delete
 */
export async function deleteSavedView(
  projectPath: string,
  viewId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM saved_views WHERE id = $1',
      [viewId]
    );
  } catch (error) {
    console.error('[saved-views] Error deleting view:', error);
    throw error;
  }
}

/**
 * Update the position of a saved view.
 *
 * @param projectPath - Absolute path to the project directory
 * @param viewId - The view ID to update
 * @param position - The new position
 */
export async function updateSavedViewPosition(
  projectPath: string,
  viewId: number,
  position: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'UPDATE saved_views SET position = $1 WHERE id = $2',
      [position, viewId]
    );
  } catch (error) {
    console.error('[saved-views] Error updating view position:', error);
    throw error;
  }
}
