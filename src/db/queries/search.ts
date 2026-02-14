/**
 * FTS5 full-text search query module.
 *
 * Provides ranked search across backlog items using SQLite FTS5
 * with BM25 ranking, highlighting, and snippet generation.
 *
 * @module db/queries/search
 */

import { getDatabase } from '../database';
import type { DbBacklogItem } from '../schema';

// ============================================================
// TYPES
// ============================================================

export interface SearchResult {
  item: DbBacklogItem;
  titleHighlight: string;
  descriptionSnippet: string;
  rank: number;
}

// ============================================================
// QUERY SANITIZATION
// ============================================================

/**
 * Sanitize user input for FTS5 MATCH query.
 *
 * Removes FTS5 operators and reserved words, then wraps each
 * remaining term in double quotes with prefix matching.
 *
 * @example
 * sanitizeFtsQuery('auth login')    // '"auth"* "login"*'
 * sanitizeFtsQuery('BUG-001')       // '"BUG"* "001"*'
 * sanitizeFtsQuery('NOT OR *')      // ''
 */
export function sanitizeFtsQuery(input: string): string {
  // Remove FTS5 operators: *, ^, ", (, ), {, }
  let cleaned = input.replace(/[*^"(){}]/g, '');

  // Remove reserved words (case-insensitive, whole words only)
  cleaned = cleaned.replace(/\b(AND|OR|NOT|NEAR)\b/gi, '');

  cleaned = cleaned.trim();
  if (!cleaned) return '';

  const terms = cleaned.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return '';

  // Wrap each term in double quotes and add * for prefix matching
  return terms.map(t => `"${t}"*`).join(' ');
}

// ============================================================
// SEARCH QUERIES
// ============================================================

/**
 * Search items with full FTS5 ranking, highlighting, and snippets.
 *
 * Returns full DbBacklogItem rows with highlighted title and
 * description snippet, ordered by BM25 relevance rank.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID to filter by
 * @param query - Raw user search input (will be sanitized)
 * @param limit - Maximum results to return (default 20)
 * @returns Array of SearchResult ordered by relevance
 */
export async function searchItems(
  projectPath: string,
  projectId: number,
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return [];

  try {
    const db = await getDatabase(projectPath);

    const rows = await db.select<(DbBacklogItem & {
      title_highlight: string;
      description_snippet: string;
      rank: number;
    })[]>(
      `SELECT
        bi.*,
        highlight(backlog_items_fts, 1, '<mark>', '</mark>') as title_highlight,
        snippet(backlog_items_fts, 2, '<mark>', '</mark>', '...', 32) as description_snippet,
        rank
      FROM backlog_items_fts
      JOIN backlog_items bi ON bi.rowid = backlog_items_fts.rowid
      WHERE backlog_items_fts MATCH $1
        AND bi.project_id = $2
      ORDER BY rank
      LIMIT $3`,
      [ftsQuery, projectId, limit]
    );

    return rows.map(row => ({
      item: row,
      titleHighlight: row.title_highlight,
      descriptionSnippet: row.description_snippet,
      rank: row.rank,
    }));
  } catch (error) {
    console.error('[search] FTS5 search error:', error);
    return [];
  }
}

/**
 * Lightweight search returning only matching item IDs.
 *
 * Optimized for filter bar integration where only the set of
 * matching IDs is needed (no highlights or snippets).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID to filter by
 * @param query - Raw user search input (will be sanitized)
 * @returns Array of matching item ID strings
 */
export async function searchItemIds(
  projectPath: string,
  projectId: number,
  query: string
): Promise<string[]> {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return [];

  try {
    const db = await getDatabase(projectPath);

    const rows = await db.select<{ id: string }[]>(
      `SELECT bi.id
      FROM backlog_items_fts
      JOIN backlog_items bi ON bi.rowid = backlog_items_fts.rowid
      WHERE backlog_items_fts MATCH $1
        AND bi.project_id = $2
      ORDER BY rank`,
      [ftsQuery, projectId]
    );

    return rows.map(row => row.id);
  } catch (error) {
    console.error('[search] FTS5 searchItemIds error:', error);
    return [];
  }
}
