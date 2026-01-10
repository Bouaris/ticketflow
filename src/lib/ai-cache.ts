/**
 * AI Analysis Cache - Session-based caching for backlog analysis results
 *
 * Uses sessionStorage with TTL and hash-based invalidation
 */

import type { BacklogAnalysisResponse } from '../types/ai';
import { getAIAnalysisCacheKey, hashItems } from '../constants/storage';

// ============================================================
// CONSTANTS
// ============================================================

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================
// TYPES
// ============================================================

interface AnalysisCacheEntry {
  version: number;
  analysis: BacklogAnalysisResponse;
  itemsHash: string;
  cachedAt: number;
}

// ============================================================
// CACHE FUNCTIONS
// ============================================================

/**
 * Get cached analysis if valid
 *
 * Returns null if:
 * - No cache exists
 * - Cache version mismatch
 * - Cache expired (TTL)
 * - Items hash mismatch (backlog changed)
 */
export function getCachedAnalysis(
  projectPath: string,
  items: { id: string; title: string }[]
): BacklogAnalysisResponse | null {
  try {
    const key = getAIAnalysisCacheKey(projectPath);
    const stored = sessionStorage.getItem(key);

    if (!stored) return null;

    const cache: AnalysisCacheEntry = JSON.parse(stored);

    // Check version
    if (cache.version !== CACHE_VERSION) {
      clearAnalysisCache(projectPath);
      return null;
    }

    // Check TTL
    if (Date.now() - cache.cachedAt > CACHE_TTL_MS) {
      clearAnalysisCache(projectPath);
      return null;
    }

    // Check items hash (invalidate if backlog changed)
    const currentHash = hashItems(items);
    if (cache.itemsHash !== currentHash) {
      clearAnalysisCache(projectPath);
      return null;
    }

    return cache.analysis;
  } catch (error) {
    console.warn('[AICache] Error reading cache:', error);
    return null;
  }
}

/**
 * Store analysis in cache
 */
export function setCachedAnalysis(
  projectPath: string,
  items: { id: string; title: string }[],
  analysis: BacklogAnalysisResponse
): void {
  try {
    const cache: AnalysisCacheEntry = {
      version: CACHE_VERSION,
      analysis,
      itemsHash: hashItems(items),
      cachedAt: Date.now(),
    };

    const key = getAIAnalysisCacheKey(projectPath);
    sessionStorage.setItem(key, JSON.stringify(cache));
  } catch (error) {
    console.warn('[AICache] Error writing cache:', error);
  }
}

/**
 * Clear cache for a specific project
 */
export function clearAnalysisCache(projectPath: string): void {
  try {
    const key = getAIAnalysisCacheKey(projectPath);
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('[AICache] Error clearing cache:', error);
  }
}

/**
 * Check if valid cache exists
 */
export function hasValidCache(
  projectPath: string,
  items: { id: string; title: string }[]
): boolean {
  return getCachedAnalysis(projectPath, items) !== null;
}

/**
 * Get cache age in milliseconds
 * Returns -1 if no cache
 */
export function getCacheAge(projectPath: string): number {
  try {
    const key = getAIAnalysisCacheKey(projectPath);
    const stored = sessionStorage.getItem(key);

    if (!stored) return -1;

    const cache: AnalysisCacheEntry = JSON.parse(stored);
    return Date.now() - cache.cachedAt;
  } catch {
    return -1;
  }
}

/**
 * Get remaining TTL in milliseconds
 * Returns 0 if expired or no cache
 */
export function getCacheTTLRemaining(projectPath: string): number {
  const age = getCacheAge(projectPath);
  if (age < 0) return 0;

  const remaining = CACHE_TTL_MS - age;
  return remaining > 0 ? remaining : 0;
}
