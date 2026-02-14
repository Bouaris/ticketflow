/**
 * TypeScript interfaces matching the SQLite database schema.
 *
 * These types represent raw database rows with snake_case naming.
 * Transform functions to convert to/from domain types (camelCase)
 * will be added in a subsequent plan.
 *
 * @module db/schema
 */

/**
 * Database row for projects table.
 * Stores metadata about each project/backlog file.
 */
export interface DbProject {
  id: number;
  name: string;
  /** Absolute path to the project directory (unique) */
  path: string;
  /** ISO datetime string */
  created_at: string;
  /** ISO datetime string */
  updated_at: string;
}

/**
 * Database row for sections table.
 * Represents the ## headers in markdown backlog.
 */
export interface DbSection {
  id: number;
  project_id: number;
  title: string;
  /** Order within the project (0-indexed) */
  position: number;
  /** Original markdown header (e.g., "## 1. BUGS (Hotfix)") */
  raw_header: string;
}

/**
 * Database row for type_configs table.
 * Dynamic type definitions (BUG, CT, LT, etc.).
 * Composite primary key: (id, project_id)
 */
export interface DbTypeConfig {
  /** Type identifier (e.g., "BUG", "CT", "LT") */
  id: string;
  project_id: number;
  /** Display label (e.g., "Bugs", "Court Terme") */
  label: string;
  /** Hex color code (e.g., "#ef4444") */
  color: string;
  /** Order in Kanban columns */
  position: number;
  /** Whether visible in UI (1 = visible, 0 = hidden) */
  visible: number;
}

/**
 * Database row for backlog_items table.
 * Main storage for all backlog items.
 *
 * JSON fields are stored as stringified JSON and need parsing:
 * - specs, reproduction, dependencies, constraints, screens: string[] arrays
 * - criteria: Array of {text: string, checked: boolean}
 * - screenshots: Array of {filename: string, alt?: string, addedAt: number}
 */
export interface DbBacklogItem {
  /** Item ID (e.g., "BUG-001", "CT-042") */
  id: string;
  project_id: number;
  section_id: number;
  /** Type prefix (e.g., "BUG", "CT", "LT") */
  type: string;
  title: string;
  /** Optional emoji indicator */
  emoji: string | null;
  /** Component or module affected */
  component: string | null;
  /** Functional domain */
  module: string | null;
  /** Bug severity: P0-P4 */
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null;
  /** Business priority */
  priority: 'Haute' | 'Moyenne' | 'Faible' | null;
  /** Effort estimate */
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL' | null;
  /** Main description text */
  description: string | null;
  /** User story blockquote */
  user_story: string | null;
  /** JSON: string[] - Technical specifications */
  specs: string | null;
  /** JSON: string[] - Bug reproduction steps */
  reproduction: string | null;
  /** JSON: {text: string, checked: boolean}[] - Acceptance criteria */
  criteria: string | null;
  /** JSON: string[] - Dependencies on other items */
  dependencies: string | null;
  /** JSON: string[] - Technical constraints */
  constraints: string | null;
  /** JSON: string[] - Affected screens (for ADM type) */
  screens: string | null;
  /** JSON: {filename: string, alt?: string, addedAt: number}[] */
  screenshots: string | null;
  /** Order within section (0-indexed) */
  position: number;
  /** Original markdown for round-trip fidelity */
  raw_markdown: string;
  /** ISO datetime string */
  created_at: string;
  /** ISO datetime string */
  updated_at: string;
}

/**
 * Database row for history table.
 * Stores serialized backlog snapshots or deltas for undo/redo.
 *
 * delta_type determines how backlog_snapshot should be interpreted:
 * - 'full': backlog_snapshot contains the complete backlog JSON
 * - 'delta': backlog_snapshot contains a jsondiffpatch delta
 */
export interface DbHistory {
  id: number;
  project_id: number;
  /** Full JSON serialization of the backlog state, or a jsondiffpatch delta */
  backlog_snapshot: string;
  /** Human-readable description of the change */
  description: string | null;
  /** 'full' for complete snapshots, 'delta' for jsondiffpatch deltas */
  delta_type: string | null;
  /** ISO datetime string */
  created_at: string;
}

/**
 * Database row for item_relations table.
 * Stores directional relations between backlog items.
 */
export interface DbItemRelation {
  id: number;
  project_id: number;
  source_id: string;
  target_id: string;
  /** 'blocks' | 'blocked-by' | 'related-to' */
  relation_type: string;
  /** null for manual, 0.0-1.0 for AI-suggested */
  confidence: number | null;
  reason: string | null;
  /** ISO datetime string */
  created_at: string;
}

/**
 * Database row for item_templates table.
 * Stores predefined ticket templates.
 */
export interface DbItemTemplate {
  id: number;
  /** null = global/built-in template, number = project-specific */
  project_id: number | null;
  name: string;
  description: string;
  /** Type prefix: "BUG", "CT", "LT", etc. */
  type: string;
  /** JSON blob of partial ItemFormData fields */
  template_data: string;
  /** Icon identifier for display */
  icon: string;
  /** Display order */
  position: number;
  /** 1 = built-in (cannot be deleted by user), 0 = user-created */
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

/**
 * Type guard to check if a severity value is valid.
 */
export function isValidSeverity(
  value: string | null
): value is 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null {
  return value === null || ['P0', 'P1', 'P2', 'P3', 'P4'].includes(value);
}

/**
 * Type guard to check if a priority value is valid.
 */
export function isValidPriority(
  value: string | null
): value is 'Haute' | 'Moyenne' | 'Faible' | null {
  return value === null || ['Haute', 'Moyenne', 'Faible'].includes(value);
}

/**
 * Type guard to check if an effort value is valid.
 */
export function isValidEffort(
  value: string | null
): value is 'XS' | 'S' | 'M' | 'L' | 'XL' | null {
  return value === null || ['XS', 'S', 'M', 'L', 'XL'].includes(value);
}

/**
 * Database row for archived_items table.
 * Stores items that have been archived from the backlog.
 */
export interface DbArchivedItem {
  /** Item ID (e.g., "BUG-001", "CT-042") */
  id: string;
  project_id: number;
  /** Type prefix (e.g., "BUG", "CT", "LT") */
  type: string;
  title: string;
  /** Optional emoji indicator */
  emoji: string | null;
  /** Component or module affected */
  component: string | null;
  /** Functional domain */
  module: string | null;
  /** Bug severity: P0-P4 */
  severity: string | null;
  /** Business priority */
  priority: string | null;
  /** Effort estimate */
  effort: string | null;
  /** Main description text */
  description: string | null;
  /** User story blockquote */
  user_story: string | null;
  /** JSON: string[] - Technical specifications */
  specs: string | null;
  /** JSON: string[] - Bug reproduction steps */
  reproduction: string | null;
  /** JSON: {text: string, checked: boolean}[] - Acceptance criteria */
  criteria: string | null;
  /** JSON: string[] - Dependencies on other items */
  dependencies: string | null;
  /** JSON: string[] - Technical constraints */
  constraints: string | null;
  /** JSON: string[] - Affected screens (for ADM type) */
  screens: string | null;
  /** JSON: {filename: string, alt?: string, addedAt: number}[] */
  screenshots: string | null;
  /** Original markdown for round-trip fidelity */
  raw_markdown: string;
  /** ISO datetime string - when archived */
  archived_at: string;
  /** ISO datetime string - original creation date from backlog_items */
  original_created_at: string | null;
}
