/**
 * Command Search Hook
 *
 * Wraps MiniSearch to provide fuzzy/prefix search over palette commands.
 * Rebuilds the search index whenever the command list changes.
 *
 * @module hooks/useCommandSearch
 */

import { useMemo, useCallback } from 'react';
import MiniSearch, { type SearchResult } from 'minisearch';
import type { PaletteCommand } from '../lib/command-registry';

// ============================================================
// TYPES
// ============================================================

/** Extended search result with typed fields from stored data */
export interface PaletteSearchResult {
  id: string;
  label: string;
  category: string;
  score: number;
  terms: string[];
  queryTerms: string[];
  match: Record<string, string[]>;
}

/** Document shape indexed by MiniSearch */
interface IndexedDocument {
  id: string;
  label: string;
  keywords: string;
  category: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_RESULTS = 30;

// ============================================================
// HOOK
// ============================================================

/**
 * Creates a MiniSearch index from palette commands and provides a search function.
 *
 * The index is rebuilt via `useMemo` whenever the `commands` array reference changes.
 * Search supports prefix matching, fuzzy matching (20% edit distance), and boosts
 * label matches over keyword matches.
 *
 * @param commands - Full list of PaletteCommand to index
 * @returns search function and rebuild trigger
 */
export function useCommandSearch(commands: PaletteCommand[]): {
  search: (query: string) => PaletteSearchResult[];
  resultCount: number;
} {
  // Build MiniSearch index when commands change
  const miniSearch = useMemo(() => {
    const ms = new MiniSearch<IndexedDocument>({
      fields: ['label', 'keywords'],
      storeFields: ['label', 'category'],
      idField: 'id',
      tokenize: (text: string) => {
        return text.split(/[\s\-_/|]+/).filter(Boolean);
      },
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { label: 2 },
        combineWith: 'OR',
        weights: { fuzzy: 0.45, prefix: 0.75 },
      },
    });

    const documents: IndexedDocument[] = commands.map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      keywords: cmd.keywords || '',
      category: cmd.category,
    }));

    ms.addAll(documents);
    return ms;
  }, [commands]);

  // Search function - stable reference thanks to useCallback
  const search = useCallback(
    (query: string): PaletteSearchResult[] => {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const results: SearchResult[] = miniSearch.search(trimmed);

      return results.slice(0, MAX_RESULTS).map(result => ({
        id: result.id as string,
        label: result.label as string,
        category: result.category as string,
        score: result.score,
        terms: result.terms,
        queryTerms: result.queryTerms,
        match: result.match as Record<string, string[]>,
      }));
    },
    [miniSearch],
  );

  return { search, resultCount: commands.length };
}
