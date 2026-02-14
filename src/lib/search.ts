/**
 * @deprecated Use FTS5 search via src/db/queries/search.ts instead.
 * This MiniSearch-based engine is kept for backward compatibility
 * with useBacklog.ts (legacy hook) and tests. Will be removed
 * in a future phase.
 *
 * Search Engine using MiniSearch
 *
 * Provides fast, indexed full-text search for backlog items.
 * Supports fuzzy matching, prefix search, and field boosting.
 */

import MiniSearch, { type SearchResult } from 'minisearch';
import type { BacklogItem } from '../types/backlog';

// ============================================================
// SEARCH INDEX CONFIGURATION
// ============================================================

const SEARCH_OPTIONS = {
  fields: ['id', 'title', 'description', 'userStory', 'component', 'module'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 3, id: 2, description: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
};

// ============================================================
// SEARCH ENGINE CLASS
// ============================================================

export class BacklogSearchEngine {
  private index: MiniSearch<BacklogItem>;
  private itemsById: Map<string, BacklogItem> = new Map();

  constructor() {
    this.index = new MiniSearch<BacklogItem>({
      ...SEARCH_OPTIONS,
      idField: 'id',
    });
  }

  /**
   * Index all items (replaces existing index)
   */
  indexAll(items: BacklogItem[]): void {
    // Clear existing index
    this.index.removeAll();
    this.itemsById.clear();

    // Index new items
    items.forEach(item => {
      this.itemsById.set(item.id, item);
    });

    this.index.addAll(items);
  }

  /**
   * Add a single item to the index
   */
  addItem(item: BacklogItem): void {
    if (this.itemsById.has(item.id)) {
      this.removeItem(item.id);
    }
    this.itemsById.set(item.id, item);
    this.index.add(item);
  }

  /**
   * Remove an item from the index
   */
  removeItem(id: string): void {
    const item = this.itemsById.get(id);
    if (item) {
      this.index.remove(item);
      this.itemsById.delete(id);
    }
  }

  /**
   * Update an item in the index
   */
  updateItem(item: BacklogItem): void {
    this.removeItem(item.id);
    this.addItem(item);
  }

  /**
   * Search for items matching the query
   * Returns item IDs sorted by relevance
   */
  search(query: string): string[] {
    if (!query.trim()) {
      return [];
    }

    const results: SearchResult[] = this.index.search(query, {
      ...SEARCH_OPTIONS.searchOptions,
      combineWith: 'OR',
    });

    return results.map(r => r.id as string);
  }

  /**
   * Get suggestions for autocomplete
   */
  suggest(query: string, limit = 5): string[] {
    if (!query.trim()) {
      return [];
    }

    const results = this.index.autoSuggest(query, {
      prefix: true,
      fuzzy: 0.2,
    });

    return results.slice(0, limit).map(r => r.suggestion);
  }

  /**
   * Check if index has items
   */
  get isEmpty(): boolean {
    return this.itemsById.size === 0;
  }

  /**
   * Get total indexed items count
   */
  get count(): number {
    return this.itemsById.size;
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let searchEngineInstance: BacklogSearchEngine | null = null;

export function getSearchEngine(): BacklogSearchEngine {
  if (!searchEngineInstance) {
    searchEngineInstance = new BacklogSearchEngine();
  }
  return searchEngineInstance;
}

export function resetSearchEngine(): void {
  searchEngineInstance = null;
}
