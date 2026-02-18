/**
 * Query module for backlog_items table operations.
 *
 * Provides CRUD operations for backlog items.
 * Uses transform functions to convert between DB rows and domain types.
 *
 * @module db/queries/items
 */

import { getDatabase } from '../database';
import type { DbBacklogItem } from '../schema';
import type { BacklogItem } from '../../types/backlog';
import { dbItemToBacklogItem, backlogItemToDbValues, backlogItemToUpdateParts } from '../transforms';
import { removeRelationsForItem } from './relations';
import { allocateIdRange } from './counters';
import { getAllSections, insertSection } from './sections';
import { TYPE_TO_SECTION_LABELS } from '../../lib/itemPlacement';

/**
 * Get all items for a project, ordered by section and position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Array of BacklogItems ordered by section and position
 */
export async function getAllItems(
  projectPath: string,
  projectId: number
): Promise<BacklogItem[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbBacklogItem[]>(
      `SELECT * FROM backlog_items
       WHERE project_id = $1
       ORDER BY section_id ASC, position ASC`,
      [projectId]
    );
    return rows.map(dbItemToBacklogItem);
  } catch (error) {
    console.error('[items] Error getting all items:', error);
    throw error;
  }
}

/**
 * Get all items grouped by their section_id.
 *
 * Uses the DB's section_id foreign key for correct grouping,
 * unlike sectionIndex which is the item's position within a section.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Map of section_id to BacklogItem arrays
 */
export async function getItemsGroupedBySection(
  projectPath: string,
  projectId: number
): Promise<Map<number, BacklogItem[]>> {
  const db = await getDatabase(projectPath);
  const rows = await db.select<DbBacklogItem[]>(
    `SELECT * FROM backlog_items
     WHERE project_id = $1
     ORDER BY section_id ASC, position ASC`,
    [projectId]
  );

  const grouped = new Map<number, BacklogItem[]>();
  for (const row of rows) {
    const items = grouped.get(row.section_id) || [];
    items.push(dbItemToBacklogItem(row));
    grouped.set(row.section_id, items);
  }
  return grouped;
}

/**
 * Get a single item by its ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID (e.g., "BUG-001")
 * @returns The BacklogItem or null if not found
 */
export async function getItemById(
  projectPath: string,
  itemId: string
): Promise<BacklogItem | null> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbBacklogItem[]>(
      'SELECT * FROM backlog_items WHERE id = $1 LIMIT 1',
      [itemId]
    );
    return rows.length > 0 ? dbItemToBacklogItem(rows[0]) : null;
  } catch (error) {
    console.error('[items] Error getting item by id:', error);
    throw error;
  }
}

/**
 * Get all items in a specific section.
 *
 * @param projectPath - Absolute path to the project directory
 * @param sectionId - The section ID
 * @returns Array of BacklogItems in the section
 */
export async function getItemsBySection(
  projectPath: string,
  sectionId: number
): Promise<BacklogItem[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbBacklogItem[]>(
      'SELECT * FROM backlog_items WHERE section_id = $1 ORDER BY position ASC',
      [sectionId]
    );
    return rows.map(dbItemToBacklogItem);
  } catch (error) {
    console.error('[items] Error getting items by section:', error);
    throw error;
  }
}

/**
 * Insert a new item.
 *
 * @param projectPath - Absolute path to the project directory
 * @param item - The BacklogItem to insert
 * @param projectId - The project ID
 * @param sectionId - The section ID
 */
export async function insertItem(
  projectPath: string,
  item: BacklogItem,
  projectId: number,
  sectionId: number
): Promise<void> {
  const db = await getDatabase(projectPath);
  const values = backlogItemToDbValues(item, projectId, sectionId);

  await db.execute(
    `INSERT INTO backlog_items (
      id, project_id, section_id, type, title, emoji, component, module,
      severity, priority, effort, description, user_story, specs, reproduction,
      criteria, dependencies, constraints, screens, screenshots, position, raw_markdown,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, datetime('now'), datetime('now')
    )`,
    values
  );
}

/**
 * Update an existing item.
 *
 * Only updates fields that are present in the updates object.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID to update
 * @param updates - Partial BacklogItem with fields to update
 */
export async function updateItem(
  projectPath: string,
  itemId: string,
  updates: Partial<BacklogItem>
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    const { setClauses, values } = backlogItemToUpdateParts(updates);

    if (setClauses.length === 0) {
      return; // Nothing to update
    }

    values.push(itemId);
    const sql = `UPDATE backlog_items SET ${setClauses.join(', ')} WHERE id = $${values.length}`;

    await db.execute(sql, values);
  } catch (error) {
    console.error('[items] Error updating item:', error);
    throw error;
  }
}

/**
 * Delete an item by ID.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID to delete
 */
export async function deleteItem(
  projectPath: string,
  itemId: string
): Promise<void> {
  // Remove all relations involving this item first (cascade cleanup)
  await removeRelationsForItem(projectPath, itemId);

  const db = await getDatabase(projectPath);
  await db.execute(
    'DELETE FROM backlog_items WHERE id = $1',
    [itemId]
  );
}

/**
 * Move an item to a different section and/or position.
 *
 * @param projectPath - Absolute path to the project directory
 * @param itemId - The item ID to move
 * @param newSectionId - The target section ID
 * @param newPosition - The target position within the section
 */
export async function moveItem(
  projectPath: string,
  itemId: string,
  newSectionId: number,
  newPosition: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      `UPDATE backlog_items
       SET section_id = $1, position = $2, updated_at = datetime('now')
       WHERE id = $3`,
      [newSectionId, newPosition, itemId]
    );
  } catch (error) {
    console.error('[items] Error moving item:', error);
    throw error;
  }
}

/**
 * Get items by type across all sections.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param type - The item type (e.g., "BUG", "CT")
 * @returns Array of BacklogItems of the specified type
 */
export async function getItemsByType(
  projectPath: string,
  projectId: number,
  type: string
): Promise<BacklogItem[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbBacklogItem[]>(
      `SELECT * FROM backlog_items
       WHERE project_id = $1 AND type = $2
       ORDER BY section_id ASC, position ASC`,
      [projectId, type]
    );
    return rows.map(dbItemToBacklogItem);
  } catch (error) {
    console.error('[items] Error getting items by type:', error);
    throw error;
  }
}

/**
 * Count items by type for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Record mapping type to count
 */
export async function countItemsByType(
  projectPath: string,
  projectId: number
): Promise<Record<string, number>> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ type: string; count: number }[]>(
      `SELECT type, COUNT(*) as count FROM backlog_items
       WHERE project_id = $1
       GROUP BY type`,
      [projectId]
    );

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.type] = row.count;
    }
    return counts;
  } catch (error) {
    console.error('[items] Error counting items by type:', error);
    throw error;
  }
}

/**
 * Get the highest item number for a type (for ID generation).
 *
 * @deprecated Use getNextItemNumber from counters.ts instead.
 * This only scans active items and misses archived/deleted ones,
 * which can cause ID reuse.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param typePrefix - The type prefix (e.g., "BUG")
 * @returns The highest number found, or 0 if no items exist
 */
export async function getMaxItemNumber(
  projectPath: string,
  projectId: number,
  typePrefix: string
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<{ id: string }[]>(
      `SELECT id FROM backlog_items
       WHERE project_id = $1 AND type = $2`,
      [projectId, typePrefix]
    );

    let maxNum = 0;
    for (const row of rows) {
      const parts = row.id.split('-');
      if (parts.length >= 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    return maxNum;
  } catch (error) {
    console.error('[items] Error getting max item number:', error);
    throw error;
  }
}

/**
 * Bulk insert items (for import operations).
 *
 * @param projectPath - Absolute path to the project directory
 * @param items - Array of items to insert
 * @param projectId - The project ID
 * @param sectionIdMap - Map from section index to section ID
 */
export async function bulkInsertItems(
  projectPath: string,
  items: BacklogItem[],
  projectId: number,
  sectionIdMap: Map<number, number>
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);

    for (const item of items) {
      const sectionId = sectionIdMap.get(item.sectionIndex) ?? 1;
      const values = backlogItemToDbValues(item, projectId, sectionId);

      await db.execute(
        `INSERT OR REPLACE INTO backlog_items (
          id, project_id, section_id, type, title, emoji, component, module,
          severity, priority, effort, description, user_story, specs, reproduction,
          criteria, dependencies, constraints, screens, screenshots, position, raw_markdown,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, datetime('now'), datetime('now')
        )`,
        values
      );
    }
  } catch (error) {
    console.error('[items] Error bulk inserting items:', error);
    throw error;
  }
}

/**
 * Minimal interface for bulk item proposals.
 * Kept local to avoid circular dependency with ai-bulk.ts.
 * Matches the fields needed to construct a BacklogItem.
 */
interface BulkItemProposal {
  title: string;
  description?: string;
  userStory?: string;
  specs?: string[];
  criteria?: Array<{ text: string; checked: boolean }>;
  suggestedType: string;
  suggestedPriority?: string | null;
  suggestedSeverity?: string | null;
  suggestedEffort?: string | null;
  suggestedModule?: string | null;
  emoji?: string | null;
  dependencies?: string[];
  constraints?: string[];
}

/**
 * Bulk create items from AI proposals, auto-routing each to its matching section.
 *
 * Groups proposals by type, allocates ID ranges per type group,
 * then sequentially inserts items into the section matching their type.
 *
 * Does NOT use withTransaction because tauri-plugin-sql's connection pool
 * does not guarantee the same connection across sequential execute() calls,
 * causing "cannot start a transaction within a transaction" errors.
 * Sequential awaited inserts on a single-user desktop app are safe enough.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param proposals - Validated AI proposals with suggestedType
 * @returns Array of created BacklogItems with definitive IDs
 *
 * @example
 * ```typescript
 * const created = await bulkCreateItems(projectPath, projectId, [
 *   { title: 'Fix login', suggestedType: 'BUG', ... },
 *   { title: 'Add search', suggestedType: 'CT', ... },
 * ]);
 * // BUG→Bugs section, CT→Court Terme section (auto-routed)
 * ```
 */
export async function bulkCreateItems(
  projectPath: string,
  projectId: number,
  proposals: BulkItemProposal[]
): Promise<BacklogItem[]> {
  if (proposals.length === 0) return [];

  const db = await getDatabase(projectPath);

  // Load all sections (mutable — we may add new sections during routing)
  const allSections = await getAllSections(projectPath, projectId);

  // Cache of type→sectionId resolved during this bulk operation
  const resolvedSections = new Map<string, number>();

  /**
   * Find or create the DB section for a given type prefix.
   *
   * Uses TYPE_TO_SECTION_LABELS for matching (same source of truth as
   * findTargetSectionIndex in itemPlacement.ts). If no section matches,
   * creates one automatically so items always have a valid FK.
   */
  async function ensureSectionForType(typePrefix: string): Promise<number> {
    // Return cached result if already resolved
    const cached = resolvedSections.get(typePrefix);
    if (cached !== undefined) return cached;

    // Get match labels: known types use TYPE_TO_SECTION_LABELS, custom types use prefix variants
    const matchLabels = TYPE_TO_SECTION_LABELS[typePrefix] || [typePrefix, typePrefix + 'S'];

    // Search existing sections using case-insensitive label matching
    for (const section of allSections) {
      const titleUpper = section.title.toUpperCase();
      const matched = matchLabels.some(label => {
        const labelUpper = label.toUpperCase();
        return titleUpper === labelUpper || titleUpper.includes(labelUpper);
      });
      if (matched) {
        resolvedSections.set(typePrefix, section.id);
        return section.id;
      }
    }

    // No matching section found — create one
    const sectionTitle = matchLabels[0]; // e.g., "BUGS", "COURT TERME", "LONG TERME"
    const position = allSections.length;
    const newId = await insertSection(projectPath, projectId, sectionTitle, position, `## ${sectionTitle}`);

    // Add to local cache so subsequent types see it
    allSections.push({ id: newId, project_id: projectId, title: sectionTitle, position, raw_header: `## ${sectionTitle}` });
    resolvedSections.set(typePrefix, newId);
    return newId;
  }

  // Group proposals by type
  const typeGroups = new Map<string, BulkItemProposal[]>();
  for (const proposal of proposals) {
    const type = proposal.suggestedType || 'CT';
    const group = typeGroups.get(type) || [];
    group.push(proposal);
    typeGroups.set(type, group);
  }

  const created: BacklogItem[] = [];

  for (const [typePrefix, typeProposals] of typeGroups) {
    const sectionId = await ensureSectionForType(typePrefix);

    // Get current max position in this section
    const positionRows = await db.select<{ max_pos: number | null }[]>(
      `SELECT MAX(position) as max_pos FROM backlog_items WHERE section_id = $1`,
      [sectionId]
    );
    let nextPosition = (positionRows[0]?.max_pos ?? -1) + 1;

    // Allocate ID range for this type group
    const { startNumber } = await allocateIdRange(
      projectPath,
      projectId,
      typePrefix,
      typeProposals.length
    );

    // Sequential inserts with pre-allocated IDs
    for (let i = 0; i < typeProposals.length; i++) {
      const proposal = typeProposals[i];
      const idNumber = startNumber + i;
      const definitiveId = `${typePrefix}-${String(idNumber).padStart(3, '0')}`;

      const item: BacklogItem = {
        id: definitiveId,
        type: typePrefix,
        title: proposal.title,
        emoji: proposal.emoji ?? undefined,
        component: undefined,
        module: proposal.suggestedModule ?? undefined,
        severity: (proposal.suggestedSeverity as BacklogItem['severity']) ?? undefined,
        priority: (proposal.suggestedPriority as BacklogItem['priority']) ?? undefined,
        effort: (proposal.suggestedEffort as BacklogItem['effort']) ?? undefined,
        description: proposal.description,
        userStory: proposal.userStory,
        specs: proposal.specs || [],
        reproduction: undefined,
        criteria: proposal.criteria || [],
        dependencies: proposal.dependencies || [],
        constraints: proposal.constraints || [],
        screens: undefined,
        screenshots: [],
        rawMarkdown: '',
        sectionIndex: nextPosition,
      };

      await insertItem(projectPath, item, projectId, sectionId);
      created.push(item);
      nextPosition++;
    }
  }

  return created;
}
