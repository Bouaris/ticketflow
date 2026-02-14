/**
 * Query module for projects table operations.
 *
 * Provides CRUD operations for project metadata.
 * Each project corresponds to a backlog file/directory.
 *
 * @module db/queries/projects
 */

import { getDatabase } from '../database';
import type { DbProject } from '../schema';

/**
 * Get a project by its filesystem path.
 *
 * @param projectPath - Absolute path to the project directory
 * @returns The project record or null if not found
 */
export async function getProjectByPath(projectPath: string): Promise<DbProject | null> {
  try {
    const db = await getDatabase(projectPath);
    const results = await db.select<DbProject[]>(
      'SELECT * FROM projects WHERE path = $1 LIMIT 1',
      [projectPath]
    );
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[projects] Error getting project by path:', error);
    throw error;
  }
}

/**
 * Get or create a project record.
 *
 * If the project exists, returns its ID.
 * If not, creates a new record and returns the new ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param name - Display name for the project
 * @returns The project ID
 */
export async function getOrCreateProject(projectPath: string, name: string): Promise<number> {
  try {
    const db = await getDatabase(projectPath);

    // Check if project exists
    const existing = await db.select<DbProject[]>(
      'SELECT id FROM projects WHERE path = $1 LIMIT 1',
      [projectPath]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Create new project
    const result = await db.execute(
      `INSERT INTO projects (name, path, created_at, updated_at)
       VALUES ($1, $2, datetime('now'), datetime('now'))`,
      [name, projectPath]
    );

    if (result.lastInsertId === undefined) {
      throw new Error('Failed to get lastInsertId after project insert');
    }
    return result.lastInsertId;
  } catch (error) {
    console.error('[projects] Error getting or creating project:', error);
    throw error;
  }
}

/**
 * Update a project's metadata.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID to update
 * @param updates - Partial project data to update
 */
export async function updateProject(
  projectPath: string,
  projectId: number,
  updates: Partial<Pick<DbProject, 'name'>>
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return; // Nothing to update
    }

    // Always update updated_at
    setClauses.push(`updated_at = datetime('now')`);

    values.push(projectId);
    const sql = `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;

    await db.execute(sql, values);
  } catch (error) {
    console.error('[projects] Error updating project:', error);
    throw error;
  }
}

/**
 * Get all projects (for multi-project support).
 *
 * @param projectPath - Path to any project (to get DB connection)
 * @returns Array of all project records
 */
export async function getAllProjects(projectPath: string): Promise<DbProject[]> {
  try {
    const db = await getDatabase(projectPath);
    return await db.select<DbProject[]>(
      'SELECT * FROM projects ORDER BY updated_at DESC'
    );
  } catch (error) {
    console.error('[projects] Error getting all projects:', error);
    throw error;
  }
}
