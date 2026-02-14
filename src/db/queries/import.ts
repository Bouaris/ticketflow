/**
 * Query module for batch import operations.
 *
 * Provides efficient batch operations for importing backlog data
 * from Markdown files into the SQLite database.
 *
 * @module db/queries/import
 */

import { getDatabase } from '../database';

/**
 * Clear all project data (for fresh import).
 *
 * Deletes data in the correct order to respect foreign key constraints:
 * history -> backlog_items -> type_configs -> sections
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID to clear
 */
export async function clearProjectData(
  projectPath: string,
  projectId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Delete in order due to foreign keys
    await db.execute('DELETE FROM history WHERE project_id = $1', [projectId]);
    await db.execute('DELETE FROM backlog_items WHERE project_id = $1', [projectId]);
    await db.execute('DELETE FROM type_configs WHERE project_id = $1', [projectId]);
    await db.execute('DELETE FROM sections WHERE project_id = $1', [projectId]);
  } catch (error) {
    console.error('[import] Error clearing project data:', error);
    throw error;
  }
}

/**
 * Batch insert sections.
 *
 * Inserts multiple sections and returns a map of position to section_id
 * for linking items to their sections.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param sections - Array of sections to insert
 * @returns Map from section position to section ID
 */
export async function batchInsertSections(
  projectPath: string,
  projectId: number,
  sections: Array<{ title: string; position: number; rawHeader: string }>
): Promise<Map<number, number>> {
  try {
    const db = await getDatabase(projectPath);
    const positionToId = new Map<number, number>();

    for (const section of sections) {
      const result = await db.execute(
        `INSERT INTO sections (project_id, title, position, raw_header)
         VALUES ($1, $2, $3, $4)`,
        [projectId, section.title, section.position, section.rawHeader]
      );
      positionToId.set(section.position, result.lastInsertId ?? 0);
    }

    return positionToId;
  } catch (error) {
    console.error('[import] Error batch inserting sections:', error);
    throw error;
  }
}

/**
 * Batch insert items.
 *
 * Inserts multiple backlog items using prepared values arrays.
 * Each item's values array must match the INSERT column order.
 *
 * @param projectPath - Absolute path to the project directory
 * @param items - Array of items with their SQL parameter values
 */
export async function batchInsertItems(
  projectPath: string,
  items: Array<{ values: unknown[] }>
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    for (const item of items) {
      await db.execute(
        `INSERT INTO backlog_items (
          id, project_id, section_id, type, title, emoji, component, module,
          severity, priority, effort, description, user_story,
          specs, reproduction, criteria, dependencies, constraints, screens, screenshots,
          position, raw_markdown, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, datetime('now'), datetime('now')
        )`,
        item.values
      );
    }
  } catch (error) {
    console.error('[import] Error batch inserting items:', error);
    throw error;
  }
}
