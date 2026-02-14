/**
 * Query module for type_configs table operations.
 *
 * Provides CRUD operations for dynamic type configurations.
 * Type configs define Kanban columns and their visual properties.
 *
 * @module db/queries/type-configs
 */

import { getDatabase } from '../database';
import type { DbTypeConfig } from '../schema';
import { dbTypeConfigToTypeConfig, typeConfigToDbValues, type TypeConfig } from '../transforms';

/**
 * Get all type configs for a project, ordered by position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of TypeConfig objects
 */
export async function getTypeConfigs(
  projectPath: string,
  projectId: number
): Promise<TypeConfig[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbTypeConfig[]>(
      'SELECT * FROM type_configs WHERE project_id = $1 ORDER BY position ASC',
      [projectId]
    );
    return rows.map(dbTypeConfigToTypeConfig);
  } catch (error) {
    console.error('[type-configs] Error getting type configs:', error);
    throw error;
  }
}

/**
 * Get visible type configs only.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of visible TypeConfig objects
 */
export async function getVisibleTypeConfigs(
  projectPath: string,
  projectId: number
): Promise<TypeConfig[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbTypeConfig[]>(
      'SELECT * FROM type_configs WHERE project_id = $1 AND visible = 1 ORDER BY position ASC',
      [projectId]
    );
    return rows.map(dbTypeConfigToTypeConfig);
  } catch (error) {
    console.error('[type-configs] Error getting visible type configs:', error);
    throw error;
  }
}

/**
 * Get a specific type config.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typeId - The type ID (e.g., "BUG")
 * @returns The TypeConfig or null if not found
 */
export async function getTypeConfig(
  projectPath: string,
  projectId: number,
  typeId: string
): Promise<TypeConfig | null> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbTypeConfig[]>(
      'SELECT * FROM type_configs WHERE project_id = $1 AND id = $2 LIMIT 1',
      [projectId, typeId]
    );
    return rows.length > 0 ? dbTypeConfigToTypeConfig(rows[0]) : null;
  } catch (error) {
    console.error('[type-configs] Error getting type config:', error);
    throw error;
  }
}

/**
 * Insert or update a type config (upsert).
 *
 * Uses INSERT OR REPLACE since type configs have a composite primary key.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param config - The TypeConfig to upsert
 */
export async function upsertTypeConfig(
  projectPath: string,
  projectId: number,
  config: TypeConfig
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    const values = typeConfigToDbValues(config, projectId);

    await db.execute(
      `INSERT OR REPLACE INTO type_configs (id, project_id, label, color, position, visible)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      values
    );
  } catch (error) {
    console.error('[type-configs] Error upserting type config:', error);
    throw error;
  }
}

/**
 * Delete a type config.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typeId - The type ID to delete
 */
export async function deleteTypeConfig(
  projectPath: string,
  projectId: number,
  typeId: string
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM type_configs WHERE project_id = $1 AND id = $2',
      [projectId, typeId]
    );
  } catch (error) {
    console.error('[type-configs] Error deleting type config:', error);
    throw error;
  }
}

/**
 * Bulk upsert type configs.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param configs - Array of TypeConfigs to upsert
 */
export async function bulkUpsertTypeConfigs(
  projectPath: string,
  projectId: number,
  configs: TypeConfig[]
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    for (const config of configs) {
      const values = typeConfigToDbValues(config, projectId);
      await db.execute(
        `INSERT OR REPLACE INTO type_configs (id, project_id, label, color, position, visible)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        values
      );
    }
  } catch (error) {
    console.error('[type-configs] Error bulk upserting type configs:', error);
    throw error;
  }
}

/**
 * Reorder type configs by updating their positions.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param orderedIds - Array of type IDs in the desired order
 */
export async function reorderTypeConfigs(
  projectPath: string,
  projectId: number,
  orderedIds: string[]
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute(
        'UPDATE type_configs SET position = $1 WHERE project_id = $2 AND id = $3',
        [i, projectId, orderedIds[i]]
      );
    }
  } catch (error) {
    console.error('[type-configs] Error reordering type configs:', error);
    throw error;
  }
}

/**
 * Toggle visibility of a type config.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typeId - The type ID to toggle
 */
export async function toggleTypeConfigVisibility(
  projectPath: string,
  projectId: number,
  typeId: string
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      `UPDATE type_configs SET visible = CASE WHEN visible = 1 THEN 0 ELSE 1 END
       WHERE project_id = $1 AND id = $2`,
      [projectId, typeId]
    );
  } catch (error) {
    console.error('[type-configs] Error toggling type config visibility:', error);
    throw error;
  }
}

/**
 * Get default type configs for a new project.
 *
 * @returns Array of default TypeConfig objects
 */
export function getDefaultTypeConfigs(): TypeConfig[] {
  return [
    { id: 'BUG', label: 'Bugs', color: '#ef4444', order: 0, visible: true },
    { id: 'CT', label: 'Court Terme', color: '#3b82f6', order: 1, visible: true },
    { id: 'LT', label: 'Long Terme', color: '#8b5cf6', order: 2, visible: true },
    { id: 'AUTRE', label: 'Autres', color: '#6b7280', order: 3, visible: true },
  ];
}
