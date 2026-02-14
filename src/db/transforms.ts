/**
 * Transform functions between database rows and domain types.
 *
 * These functions handle the conversion between SQLite's snake_case
 * rows and the application's camelCase domain types, including
 * safe JSON parsing for array fields.
 *
 * @module db/transforms
 */

import type { BacklogItem, Section, Criterion, Screenshot, Severity, Priority, Effort } from '../types/backlog';
import type { DbBacklogItem, DbSection, DbTypeConfig, DbArchivedItem } from './schema';
import { isValidSeverity, isValidPriority, isValidEffort } from './schema';

/**
 * Safely parse a JSON string into an array.
 * Returns the default value if parsing fails or input is null/undefined.
 *
 * @param json - The JSON string to parse
 * @param defaultValue - Value to return on failure (defaults to empty array)
 * @returns Parsed array or default value
 */
export function parseJsonArray<T>(json: string | null | undefined, defaultValue: T[] = []): T[] {
  if (!json) return defaultValue;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Convert a database row to a BacklogItem domain type.
 *
 * Handles all field transformations including:
 * - snake_case to camelCase conversion
 * - Null to undefined for optional fields
 * - JSON string parsing for array fields
 *
 * @param row - The database row to transform
 * @returns The transformed BacklogItem
 */
export function dbItemToBacklogItem(row: DbBacklogItem): BacklogItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    emoji: row.emoji ?? undefined,
    component: row.component ?? undefined,
    module: row.module ?? undefined,
    severity: isValidSeverity(row.severity) ? (row.severity as Severity | undefined) : undefined,
    priority: isValidPriority(row.priority) ? (row.priority as Priority | undefined) : undefined,
    effort: isValidEffort(row.effort) ? (row.effort as Effort | undefined) : undefined,
    description: row.description ?? undefined,
    userStory: row.user_story ?? undefined,
    specs: parseJsonArray<string>(row.specs),
    reproduction: parseJsonArray<string>(row.reproduction),
    criteria: parseJsonArray<Criterion>(row.criteria),
    dependencies: parseJsonArray<string>(row.dependencies),
    constraints: parseJsonArray<string>(row.constraints),
    screens: parseJsonArray<string>(row.screens),
    screenshots: parseJsonArray<Screenshot>(row.screenshots),
    rawMarkdown: row.raw_markdown,
    sectionIndex: row.position,
  };
}

/**
 * Convert a BacklogItem to database column values for INSERT/UPDATE.
 *
 * Returns an array of values in the correct order for the INSERT statement:
 * (id, project_id, section_id, type, title, emoji, component, module,
 *  severity, priority, effort, description, user_story, specs, reproduction,
 *  criteria, dependencies, constraints, screens, screenshots, position, raw_markdown)
 *
 * @param item - The BacklogItem to convert
 * @param projectId - The project ID for the foreign key
 * @param sectionId - The section ID for the foreign key
 * @returns Array of values ready for SQL parameters
 */
export function backlogItemToDbValues(
  item: BacklogItem,
  projectId: number,
  sectionId: number
): unknown[] {
  return [
    item.id,
    projectId,
    sectionId,
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
    item.sectionIndex ?? 0,
    item.rawMarkdown,
  ];
}

/**
 * Build partial UPDATE values from a BacklogItem update.
 *
 * Only includes fields that are present in the updates object.
 * Returns both the SET clause parts and the values array.
 *
 * @param updates - Partial BacklogItem with fields to update
 * @returns Object containing setClauses array and values array
 */
export function backlogItemToUpdateParts(
  updates: Partial<BacklogItem>
): { setClauses: string[]; values: unknown[] } {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const fieldMappings: Array<{
    domainKey: keyof BacklogItem;
    dbColumn: string;
    transform?: (v: unknown) => unknown;
  }> = [
    { domainKey: 'type', dbColumn: 'type' },
    { domainKey: 'title', dbColumn: 'title' },
    { domainKey: 'emoji', dbColumn: 'emoji' },
    { domainKey: 'component', dbColumn: 'component' },
    { domainKey: 'module', dbColumn: 'module' },
    { domainKey: 'severity', dbColumn: 'severity' },
    { domainKey: 'priority', dbColumn: 'priority' },
    { domainKey: 'effort', dbColumn: 'effort' },
    { domainKey: 'description', dbColumn: 'description' },
    { domainKey: 'userStory', dbColumn: 'user_story' },
    { domainKey: 'specs', dbColumn: 'specs', transform: (v) => v && (v as string[]).length ? JSON.stringify(v) : null },
    { domainKey: 'reproduction', dbColumn: 'reproduction', transform: (v) => v && (v as string[]).length ? JSON.stringify(v) : null },
    { domainKey: 'criteria', dbColumn: 'criteria', transform: (v) => v && (v as Criterion[]).length ? JSON.stringify(v) : null },
    { domainKey: 'dependencies', dbColumn: 'dependencies', transform: (v) => v && (v as string[]).length ? JSON.stringify(v) : null },
    { domainKey: 'constraints', dbColumn: 'constraints', transform: (v) => v && (v as string[]).length ? JSON.stringify(v) : null },
    { domainKey: 'screens', dbColumn: 'screens', transform: (v) => v && (v as string[]).length ? JSON.stringify(v) : null },
    { domainKey: 'screenshots', dbColumn: 'screenshots', transform: (v) => v && (v as Screenshot[]).length ? JSON.stringify(v) : null },
    { domainKey: 'sectionIndex', dbColumn: 'position' },
    { domainKey: 'rawMarkdown', dbColumn: 'raw_markdown' },
  ];

  for (const mapping of fieldMappings) {
    if (mapping.domainKey in updates) {
      const value = updates[mapping.domainKey];
      const transformedValue = mapping.transform ? mapping.transform(value) : (value ?? null);
      setClauses.push(`${mapping.dbColumn} = $${paramIndex}`);
      values.push(transformedValue);
      paramIndex++;
    }
  }

  // Always update updated_at
  setClauses.push(`updated_at = datetime('now')`);

  return { setClauses, values };
}

/**
 * Convert a database section row to a Section domain type.
 *
 * @param row - The database row to transform
 * @param items - The BacklogItems belonging to this section
 * @returns The transformed Section
 */
export function dbSectionToSection(row: DbSection, items: BacklogItem[]): Section {
  return {
    id: String(row.id),
    title: row.title,
    rawHeader: row.raw_header,
    items: items,
  };
}

/**
 * Convert a Section to database column values for INSERT.
 *
 * @param projectId - The project ID for the foreign key
 * @param title - The section title
 * @param position - The position/order in the project
 * @param rawHeader - The original markdown header
 * @returns Array of values ready for SQL parameters
 */
export function sectionToDbValues(
  projectId: number,
  title: string,
  position: number,
  rawHeader: string
): unknown[] {
  return [projectId, title, position, rawHeader];
}

/**
 * Type configuration domain type (for use in hooks).
 */
export interface TypeConfig {
  id: string;
  label: string;
  color: string;
  order: number;
  visible: boolean;
}

/**
 * Convert a database type config row to domain TypeConfig.
 *
 * @param row - The database row to transform
 * @returns The transformed TypeConfig
 */
export function dbTypeConfigToTypeConfig(row: DbTypeConfig): TypeConfig {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    order: row.position,
    visible: row.visible === 1,
  };
}

/**
 * Convert a TypeConfig to database column values for INSERT/UPDATE.
 *
 * @param config - The TypeConfig to convert
 * @param projectId - The project ID for the foreign key
 * @returns Array of values ready for SQL parameters
 */
export function typeConfigToDbValues(config: TypeConfig, projectId: number): unknown[] {
  return [
    config.id,
    projectId,
    config.label,
    config.color,
    config.order,
    config.visible ? 1 : 0,
  ];
}

/**
 * Archived item domain type.
 * Represents items that have been removed from the active backlog.
 */
export interface ArchivedItem {
  id: string;
  projectId: number;
  type: string;
  title: string;
  emoji?: string;
  component?: string;
  module?: string;
  severity?: Severity;
  priority?: Priority;
  effort?: Effort;
  description?: string;
  userStory?: string;
  specs?: string[];
  reproduction?: string[];
  criteria?: Criterion[];
  dependencies?: string[];
  constraints?: string[];
  screens?: string[];
  screenshots?: Screenshot[];
  rawMarkdown: string;
  archivedAt: string;
  originalCreatedAt?: string;
}

/**
 * Convert a database archived item row to ArchivedItem domain type.
 *
 * @param row - The database row to transform
 * @returns The transformed ArchivedItem
 */
export function dbArchivedItemToArchivedItem(row: DbArchivedItem): ArchivedItem {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    emoji: row.emoji ?? undefined,
    component: row.component ?? undefined,
    module: row.module ?? undefined,
    severity: isValidSeverity(row.severity) ? (row.severity as Severity | undefined) : undefined,
    priority: isValidPriority(row.priority) ? (row.priority as Priority | undefined) : undefined,
    effort: isValidEffort(row.effort) ? (row.effort as Effort | undefined) : undefined,
    description: row.description ?? undefined,
    userStory: row.user_story ?? undefined,
    specs: parseJsonArray<string>(row.specs),
    reproduction: parseJsonArray<string>(row.reproduction),
    criteria: parseJsonArray<Criterion>(row.criteria),
    dependencies: parseJsonArray<string>(row.dependencies),
    constraints: parseJsonArray<string>(row.constraints),
    screens: parseJsonArray<string>(row.screens),
    screenshots: parseJsonArray<Screenshot>(row.screenshots),
    rawMarkdown: row.raw_markdown,
    archivedAt: row.archived_at,
    originalCreatedAt: row.original_created_at ?? undefined,
  };
}
