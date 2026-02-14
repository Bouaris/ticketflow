/**
 * Query module for sections table operations.
 *
 * Provides CRUD operations for backlog sections (## headers).
 * Sections organize items into logical groups.
 *
 * @module db/queries/sections
 */

import { getDatabase } from '../database';
import { withTransaction } from '../transaction';
import type { DbSection } from '../schema';

/**
 * Get all sections for a project, ordered by position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of section records ordered by position
 */
export async function getAllSections(
  projectPath: string,
  projectId: number
): Promise<DbSection[]> {
  try {
    const db = await getDatabase(projectPath);
    return await db.select<DbSection[]>(
      'SELECT * FROM sections WHERE project_id = $1 ORDER BY position ASC',
      [projectId]
    );
  } catch (error) {
    console.error('[sections] Error getting all sections:', error);
    throw error;
  }
}

/**
 * Get a section by its ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param sectionId - The section ID
 * @returns The section record or null if not found
 */
export async function getSectionById(
  projectPath: string,
  sectionId: number
): Promise<DbSection | null> {
  try {
    const db = await getDatabase(projectPath);
    const results = await db.select<DbSection[]>(
      'SELECT * FROM sections WHERE id = $1 LIMIT 1',
      [sectionId]
    );
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[sections] Error getting section by id:', error);
    throw error;
  }
}

/**
 * Insert a new section.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param title - The section title
 * @param position - The position/order in the project
 * @param rawHeader - The original markdown header
 * @returns The new section ID
 */
export async function insertSection(
  projectPath: string,
  projectId: number,
  title: string,
  position: number,
  rawHeader: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const result = await db.execute(
      `INSERT INTO sections (project_id, title, position, raw_header)
       VALUES ($1, $2, $3, $4)`,
      [projectId, title, position, rawHeader]
    );
    if (result.lastInsertId === undefined) {
      throw new Error('Failed to get lastInsertId after section insert');
    }
    return result.lastInsertId;
  } catch (error) {
    console.error('[sections] Error inserting section:', error);
    throw error;
  }
}

/**
 * Update a section's properties.
 *
 * @param projectPath - Absolute path to the project directory
 * @param sectionId - The section ID to update
 * @param updates - Partial section data to update
 */
export async function updateSection(
  projectPath: string,
  sectionId: number,
  updates: Partial<Pick<DbSection, 'title' | 'position' | 'raw_header'>>
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex}`);
      values.push(updates.position);
      paramIndex++;
    }

    if (updates.raw_header !== undefined) {
      setClauses.push(`raw_header = $${paramIndex}`);
      values.push(updates.raw_header);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return; // Nothing to update
    }

    values.push(sectionId);
    const sql = `UPDATE sections SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;

    await db.execute(sql, values);
  } catch (error) {
    console.error('[sections] Error updating section:', error);
    throw error;
  }
}

/**
 * Delete a section and all its items.
 *
 * @param projectPath - Absolute path to the project directory
 * @param sectionId - The section ID to delete
 */
export async function deleteSection(
  projectPath: string,
  sectionId: number
): Promise<void> {
  try {
    // Wrap in transaction for atomic deletion of items + section
    await withTransaction(projectPath, async () => {
      const db = await getDatabase(projectPath);

      // Delete items first (cascade would handle this but explicit is clearer)
      await db.execute(
        'DELETE FROM backlog_items WHERE section_id = $1',
        [sectionId]
      );

      // Delete the section
      await db.execute(
        'DELETE FROM sections WHERE id = $1',
        [sectionId]
      );
    });
  } catch (error) {
    console.error('[sections] Error deleting section:', error);
    throw error;
  }
}

/**
 * Reorder sections by updating their positions.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param orderedIds - Array of section IDs in the desired order
 */
export async function reorderSections(
  projectPath: string,
  projectId: number,
  orderedIds: number[]
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Update each section's position
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute(
        'UPDATE sections SET position = $1 WHERE id = $2 AND project_id = $3',
        [i, orderedIds[i], projectId]
      );
    }
  } catch (error) {
    console.error('[sections] Error reordering sections:', error);
    throw error;
  }
}

/**
 * Find a section by title pattern.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param titlePattern - Pattern to search for (case-insensitive)
 * @returns The matching section or null
 */
export async function findSectionByTitle(
  projectPath: string,
  projectId: number,
  titlePattern: string
): Promise<DbSection | null> {
  try {
    const db = await getDatabase(projectPath);
    const results = await db.select<DbSection[]>(
      'SELECT * FROM sections WHERE project_id = $1 AND UPPER(title) LIKE UPPER($2) LIMIT 1',
      [projectId, `%${titlePattern}%`]
    );
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[sections] Error finding section by title:', error);
    throw error;
  }
}
