/**
 * Query module for item_templates table operations.
 *
 * Provides CRUD operations for managing ticket templates.
 * Built-in templates are seeded on first access and cannot be deleted.
 * All queries use $1, $2 placeholders per tauri-plugin-sql requirements.
 *
 * @module db/queries/templates
 */

import { getDatabase } from '../database';
import type { DbItemTemplate } from '../schema';

// ============================================================
// DOMAIN TYPES
// ============================================================

/**
 * Domain representation of a ticket template (camelCase).
 */
export interface TicketTemplate {
  id: number;
  projectId: number | null;
  name: string;
  description: string;
  type: string;
  templateData: Record<string, unknown>;
  icon: string;
  position: number;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TRANSFORM
// ============================================================

/** Convert a DB row to a domain TicketTemplate (snake_case -> camelCase) */
function dbRowToTemplate(row: DbItemTemplate): TicketTemplate {
  let parsedData: Record<string, unknown> = {};
  try {
    parsedData = JSON.parse(row.template_data) as Record<string, unknown>;
  } catch {
    console.warn('[templates] Failed to parse template_data for template:', row.id);
  }

  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    type: row.type,
    templateData: parsedData,
    icon: row.icon,
    position: row.position,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// BUILT-IN TEMPLATES
// ============================================================

/**
 * Built-in templates seeded on first use.
 * These are global (project_id = NULL) and available to all projects.
 */
export const BUILTIN_TEMPLATES: Omit<DbItemTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    project_id: null,
    name: 'Bug Report',
    description: 'Rapport de bug avec etapes de reproduction',
    type: 'BUG',
    template_data: JSON.stringify({
      severity: 'P2',
      reproduction: ['Ouvrir...', 'Cliquer sur...', 'Observer...'],
      criteria: [{ text: 'Le bug ne se reproduit plus', checked: false }],
    }),
    icon: 'bug',
    position: 0,
    is_builtin: 1,
  },
  {
    project_id: null,
    name: 'Feature Request',
    description: 'Nouvelle fonctionnalite avec user story',
    type: 'CT',
    template_data: JSON.stringify({
      priority: 'Moyenne',
      effort: 'M',
      userStory: 'En tant que [utilisateur], je veux [action] afin de [benefice]',
      criteria: [{ text: 'La fonctionnalite est accessible', checked: false }],
    }),
    icon: 'sparkles',
    position: 1,
    is_builtin: 1,
  },
  {
    project_id: null,
    name: 'Technical Debt',
    description: 'Refactoring ou dette technique',
    type: 'LT',
    template_data: JSON.stringify({
      priority: 'Faible',
      effort: 'L',
      description: 'Description du probleme technique actuel et de la solution proposee.',
      specs: ['Identifier le code impacte', 'Ecrire les tests manquants', 'Refactorer'],
    }),
    icon: 'settings',
    position: 2,
    is_builtin: 1,
  },
];

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all templates available for a project.
 *
 * Returns merged list of global (built-in) templates and project-specific ones,
 * ordered by position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of TicketTemplate ordered by position
 */
export async function getTemplatesForProject(
  projectPath: string,
  projectId: number
): Promise<TicketTemplate[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbItemTemplate[]>(
      `SELECT * FROM item_templates
       WHERE project_id = $1 OR project_id IS NULL
       ORDER BY position`,
      [projectId]
    );
    return rows.map(dbRowToTemplate);
  } catch (error) {
    console.error('[templates] Error getting templates for project:', error);
    throw error;
  }
}

/**
 * Seed built-in templates into the database (idempotent).
 *
 * Checks if built-in templates already exist before inserting.
 * Uses project_id = NULL for global availability.
 *
 * @param projectPath - Absolute path to the project directory
 */
export async function seedBuiltinTemplates(
  projectPath: string
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    // Check if built-in templates already exist
    const countResult = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM item_templates WHERE is_builtin = 1'
    );
    const count = countResult[0]?.count ?? 0;
    if (count > 0) return; // Already seeded

    // Insert each built-in template
    for (const template of BUILTIN_TEMPLATES) {
      await db.execute(
        `INSERT OR IGNORE INTO item_templates
         (project_id, name, description, type, template_data, icon, position, is_builtin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          template.project_id,
          template.name,
          template.description,
          template.type,
          template.template_data,
          template.icon,
          template.position,
          template.is_builtin,
        ]
      );
    }
  } catch (error) {
    console.error('[templates] Error seeding built-in templates:', error);
    throw error;
  }
}

/**
 * Delete a user-created template.
 *
 * Only allows deleting non-builtin templates (is_builtin = 0).
 *
 * @param projectPath - Absolute path to the project directory
 * @param templateId - The template row ID
 */
export async function deleteTemplate(
  projectPath: string,
  templateId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM item_templates WHERE id = $1 AND is_builtin = 0',
      [templateId]
    );
  } catch (error) {
    console.error('[templates] Error deleting template:', error);
    throw error;
  }
}
