/**
 * Query module for analytics dashboard metrics.
 *
 * Provides SQL aggregate queries for computing dashboard statistics.
 * All metrics are computed server-side via GROUP BY queries to avoid
 * client-side aggregation of large datasets.
 *
 * All queries use $1, $2 placeholders per tauri-plugin-sql requirements.
 *
 * @module db/queries/analytics
 */

import { getDatabase } from '../database';
import { parseJsonArray } from '../transforms';
import type {
  AnalyticsMetrics,
  CategoryCount,
  CompletionStats,
  BlockedChainStats,
  StaleStats,
} from '../../types/analytics';

// ============================================================
// HELPERS
// ============================================================

/** Priority label to color mapping */
const PRIORITY_COLORS: Record<string, string> = {
  'Haute': '#ef4444',
  'Moyenne': '#f59e0b',
  'Faible': '#22c55e',
  'Non defini': '#9ca3af',
};

/** Effort label to color mapping */
const EFFORT_COLORS: Record<string, string> = {
  'XS': '#22c55e',
  'S': '#84cc16',
  'M': '#f59e0b',
  'L': '#f97316',
  'XL': '#ef4444',
  'Non defini': '#9ca3af',
};

/** Rotating palette for section bars (distinct, accessible colors) */
const SECTION_COLORS = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#10b981', // emerald
  '#f97316', // orange
  '#06b6d4', // cyan
];

// ============================================================
// MAIN QUERY FUNCTION
// ============================================================

/**
 * Fetch all analytics metrics for a project dashboard.
 *
 * Runs batched SQL aggregate queries and returns a complete
 * AnalyticsMetrics object. All computations happen in SQLite
 * except criteria completion which requires JSON parsing client-side.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @returns Complete analytics metrics for the dashboard
 */
export async function getAnalyticsMetrics(
  projectPath: string,
  projectId: number
): Promise<AnalyticsMetrics> {
  try {
    const db = await getDatabase(projectPath);

    // a) Total items
    const totalRows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM backlog_items WHERE project_id = $1',
      [projectId]
    );
    const totalItems = totalRows[0]?.count ?? 0;

    // b) By type with color (joined with type_configs)
    const byTypeRows = await db.select<{ label: string; value: number; color: string }[]>(
      `SELECT bi.type as label, COUNT(*) as value, COALESCE(tc.color, '#6b7280') as color
       FROM backlog_items bi
       LEFT JOIN type_configs tc ON tc.id = bi.type AND tc.project_id = bi.project_id
       WHERE bi.project_id = $1
       GROUP BY bi.type
       ORDER BY tc.position`,
      [projectId]
    );
    const byType: CategoryCount[] = byTypeRows.map(row => ({
      label: row.label,
      value: row.value,
      color: row.color,
    }));

    // c) By section (joined with sections table, excluding Legende/special sections)
    const bySectionRows = await db.select<{ label: string; value: number }[]>(
      `SELECT s.title as label, COUNT(bi.id) as value
       FROM sections s
       LEFT JOIN backlog_items bi ON bi.section_id = s.id
       WHERE s.project_id = $1
         AND UPPER(s.title) NOT LIKE '%LEGENDE%'
         AND UPPER(s.title) NOT LIKE '%LÉGENDE%'
         AND UPPER(s.title) NOT LIKE '%CONVENTION%'
         AND UPPER(s.title) NOT LIKE '%ROADMAP%'
       GROUP BY s.id
       ORDER BY s.position`,
      [projectId]
    );
    const bySection: CategoryCount[] = bySectionRows.map((row, i) => ({
      label: row.label,
      value: row.value,
      color: SECTION_COLORS[i % SECTION_COLORS.length],
    }));

    // d) By priority
    const byPriorityRows = await db.select<{ label: string; value: number }[]>(
      `SELECT COALESCE(priority, 'Non defini') as label, COUNT(*) as value
       FROM backlog_items WHERE project_id = $1
       GROUP BY priority`,
      [projectId]
    );
    const byPriority: CategoryCount[] = byPriorityRows.map(row => ({
      label: row.label,
      value: row.value,
      color: PRIORITY_COLORS[row.label] ?? '#9ca3af',
    }));

    // e) By effort
    const byEffortRows = await db.select<{ label: string; value: number }[]>(
      `SELECT COALESCE(effort, 'Non defini') as label, COUNT(*) as value
       FROM backlog_items WHERE project_id = $1
       GROUP BY effort`,
      [projectId]
    );
    const byEffort: CategoryCount[] = byEffortRows.map(row => ({
      label: row.label,
      value: row.value,
      color: EFFORT_COLORS[row.label] ?? '#9ca3af',
    }));

    // f) Completion stats (criteria JSON parsed client-side)
    const completion = await computeCompletionStats(db, projectId);

    // g) Blocked chain stats
    const blocked = await computeBlockedChainStats(db, projectId);

    // h) Stale items
    const stale = await computeStaleStats(db, projectId);

    return {
      totalItems,
      byType,
      bySection,
      byPriority,
      byEffort,
      completion,
      blocked,
      stale,
    };
  } catch (error) {
    console.error('[analytics] Error fetching metrics:', error);
    throw error;
  }
}

// ============================================================
// INTERNAL QUERY HELPERS
// ============================================================

/**
 * Compute criteria completion stats by parsing criteria JSON client-side.
 */
async function computeCompletionStats(
  db: Awaited<ReturnType<typeof getDatabase>>,
  projectId: number
): Promise<CompletionStats> {
  const rows = await db.select<{ criteria: string | null }[]>(
    'SELECT criteria FROM backlog_items WHERE project_id = $1',
    [projectId]
  );

  let totalItems = rows.length;
  let totalCriteria = 0;
  let checkedCriteria = 0;
  let openCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;

  for (const row of rows) {
    const criteria = parseJsonArray<{ text: string; checked: boolean }>(row.criteria);

    if (criteria.length === 0) {
      // Items with no criteria count as open
      openCount++;
      continue;
    }

    const checked = criteria.filter(c => c.checked).length;
    totalCriteria += criteria.length;
    checkedCriteria += checked;

    const rate = checked / criteria.length;
    if (rate === 0) {
      openCount++;
    } else if (rate === 1) {
      doneCount++;
    } else {
      inProgressCount++;
    }
  }

  // Guard against division by zero
  const completionRate = totalCriteria > 0
    ? Math.round((checkedCriteria / totalCriteria) * 100)
    : 0;

  return {
    totalItems,
    totalCriteria,
    checkedCriteria,
    completionRate,
    openCount,
    inProgressCount,
    doneCount,
  };
}

/**
 * Compute blocked chain statistics from item_relations.
 */
async function computeBlockedChainStats(
  db: Awaited<ReturnType<typeof getDatabase>>,
  projectId: number
): Promise<BlockedChainStats> {
  // Top blockers (items that block the most other items)
  const topBlockerRows = await db.select<{ item_id: string; blocked_count: number }[]>(
    `SELECT source_id as item_id, COUNT(*) as blocked_count
     FROM item_relations
     WHERE project_id = $1 AND relation_type = 'blocks'
     GROUP BY source_id
     ORDER BY blocked_count DESC
     LIMIT 5`,
    [projectId]
  );

  const topBlockers = topBlockerRows.map(row => ({
    itemId: row.item_id,
    blockedCount: row.blocked_count,
  }));

  // Total distinct blockers
  const totalBlockers = topBlockerRows.length > 0
    ? (await db.select<{ count: number }[]>(
        `SELECT COUNT(DISTINCT source_id) as count
         FROM item_relations
         WHERE project_id = $1 AND relation_type = 'blocks'`,
        [projectId]
      ))[0]?.count ?? 0
    : 0;

  // Total distinct blocked items
  const blockedRows = await db.select<{ count: number }[]>(
    `SELECT COUNT(DISTINCT target_id) as count
     FROM item_relations
     WHERE project_id = $1 AND relation_type = 'blocks'`,
    [projectId]
  );
  const totalBlocked = blockedRows[0]?.count ?? 0;

  return {
    totalBlockers,
    totalBlocked,
    topBlockers,
  };
}

/**
 * Compute stale item statistics.
 * Stale = updated >30 days ago with incomplete criteria.
 */
async function computeStaleStats(
  db: Awaited<ReturnType<typeof getDatabase>>,
  projectId: number
): Promise<StaleStats> {
  // Stale items: updated >30 days ago with incomplete criteria
  const staleRows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count
     FROM backlog_items
     WHERE project_id = $1
     AND updated_at < datetime('now', '-30 days')
     AND (criteria IS NULL OR criteria = '[]' OR criteria LIKE '%"checked":false%')`,
    [projectId]
  );
  const staleCount = staleRows[0]?.count ?? 0;

  // Total active items (all items, since we don't have a "done" status column)
  const activeRows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM backlog_items WHERE project_id = $1',
    [projectId]
  );
  const totalActive = activeRows[0]?.count ?? 0;

  return {
    staleCount,
    totalActive,
  };
}
