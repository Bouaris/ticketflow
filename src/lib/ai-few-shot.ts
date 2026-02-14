/**
 * AI Few-Shot Example Selection
 *
 * Provides TF-IDF-based similarity scoring to select the most relevant
 * existing tickets as few-shot examples for AI prompts.
 *
 * @module lib/ai-few-shot
 */

import type { BacklogItem } from '../types/backlog';

// ============================================================
// TYPES
// ============================================================

export interface FewShotOptions {
  /** User's description/request to find similar tickets for */
  query: string;
  /** All items in project to select from */
  candidates: BacklogItem[];
  /** Number of examples to return (default: 3) */
  count?: number;
  /** Prefer same type (e.g., "BUG") - 20% score boost */
  preferType?: string;
  /** Prefer same module - 30% score boost */
  preferModule?: string;
}

interface ScoredItem {
  item: BacklogItem;
  score: number;
}

// ============================================================
// STOPWORDS
// ============================================================

/**
 * French/English stopwords for better term extraction and similarity scoring.
 * These common words are filtered out as they don't carry semantic meaning.
 */
const STOPWORDS = new Set([
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'que', 'qui',
  'dans', 'pour', 'sur', 'avec', 'par', 'ce', 'cette', 'ces', 'son', 'sa', 'ses',
  'est', 'sont', 'être', 'avoir', 'fait', 'faire', 'peut', 'doit', 'quand', 'si',
  'ne', 'pas', 'plus', 'tout', 'tous', 'comme', 'aussi', 'très', 'bien', 'mais',
  'au', 'aux', 'en', 'il', 'elle', 'ils', 'elles', 'nous', 'vous', 'je', 'tu',
  'mon', 'ton', 'notre', 'votre', 'leur', 'leurs', 'dont', 'où', 'donc', 'car',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'this', 'that', 'these', 'those', 'it', 'its', 'not', 'can', 'when', 'if',
  'so', 'up', 'out', 'about', 'into', 'over', 'after', 'no', 'just', 'also',
  // Common technical (not meaningful alone)
  'fix', 'add', 'update', 'bug', 'feature', 'item', 'new', 'create', 'delete',
  'get', 'set', 'use', 'make', 'need', 'want', 'like', 'see', 'try', 'put',
]);

// ============================================================
// TOKENIZATION
// ============================================================

/**
 * Tokenize text into meaningful words.
 *
 * - Lowercases text
 * - Splits on non-word characters
 * - Filters tokens with length <= 2
 * - Filters stopwords
 * - Returns unique tokens
 *
 * @param text - Input text to tokenize
 * @returns Array of unique meaningful tokens
 */
export function tokenize(text: string): string[] {
  return [...new Set(
    text.toLowerCase()
      .split(/\W+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  )];
}

// ============================================================
// SIMILARITY SCORING
// ============================================================

/**
 * Score similarity between a query and a candidate BacklogItem.
 *
 * Uses TF-IDF-like scoring:
 * - Counts matching tokens between query and candidate
 * - Applies IDF-like normalization based on candidate length
 * - Boosts score 1.5x if module/component matches a query token
 *
 * @param query - User's search query or request
 * @param candidate - BacklogItem to score
 * @returns Similarity score (0 = no similarity, higher = more similar)
 */
export function scoreSimilarity(query: string, candidate: BacklogItem): number {
  // Tokenize query
  const queryTokens = new Set(tokenize(query));

  if (queryTokens.size === 0) {
    return 0;
  }

  // Build candidate text from all relevant fields
  const candidateText = [
    candidate.title,
    candidate.description || '',
    candidate.module || '',
    candidate.component || '',
    candidate.userStory || '',
    ...(candidate.specs || []),
    ...(candidate.reproduction || []),
    ...(candidate.criteria || []).map(c => c.text),
  ].join(' ');

  const candidateTokens = tokenize(candidateText);

  if (candidateTokens.length === 0) {
    return 0;
  }

  // Count matching tokens (TF)
  const matches = candidateTokens.filter(t => queryTokens.has(t)).length;

  if (matches === 0) {
    return 0;
  }

  // Apply IDF-like normalization: score decreases with document length
  let score = matches / Math.log(candidateTokens.length + 1);

  // Boost score if module/component matches a query token
  const moduleComponent = [
    (candidate.module || '').toLowerCase(),
    (candidate.component || '').toLowerCase(),
  ].filter(Boolean);

  const moduleMatches = moduleComponent.some(m =>
    [...queryTokens].some(qt => m.includes(qt) || qt.includes(m))
  );

  if (moduleMatches) {
    score *= 1.5;
  }

  return score;
}

// ============================================================
// FEW-SHOT SELECTION
// ============================================================

/**
 * Select the best few-shot examples from candidates based on query similarity.
 *
 * @param options - Selection options
 * @returns Array of BacklogItems sorted by relevance (best first)
 */
export function selectFewShotExamples(options: FewShotOptions): BacklogItem[] {
  const { query, candidates, count = 3, preferType, preferModule } = options;

  if (!query || candidates.length === 0) {
    return [];
  }

  // Score all candidates
  const scored: ScoredItem[] = candidates.map(item => {
    let score = scoreSimilarity(query, item);

    // Apply type boost: +20% score if type matches preferType
    if (preferType && item.type === preferType) {
      score *= 1.2;
    }

    // Apply module boost: +30% score if module matches preferModule
    if (preferModule) {
      const itemModule = (item.module || item.component || '').toLowerCase();
      const targetModule = preferModule.toLowerCase();
      if (itemModule && (itemModule.includes(targetModule) || targetModule.includes(itemModule))) {
        score *= 1.3;
      }
    }

    return { item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out items with score < 0.1 (too dissimilar)
  const MIN_SCORE_THRESHOLD = 0.1;
  const filtered = scored.filter(s => s.score >= MIN_SCORE_THRESHOLD);

  // Return top N by count
  return filtered.slice(0, count).map(s => s.item);
}

// ============================================================
// FEEDBACK-BIASED SELECTION
// ============================================================

/**
 * Select few-shot examples with feedback bias.
 * Highly-rated items get boosted, poorly-rated get penalized.
 * Only applies bias if feedbackScores map is provided and non-empty.
 *
 * @param options - Selection options extended with feedback scores
 * @returns Array of BacklogItems sorted by feedback-biased relevance
 */
export function selectFewShotExamplesWithFeedback(
  options: FewShotOptions & { feedbackScores: Map<string, number> }
): BacklogItem[] {
  const { feedbackScores, ...baseOptions } = options;

  if (feedbackScores.size === 0) {
    return selectFewShotExamples(baseOptions);
  }

  const { query, candidates, count = 3, preferType, preferModule } = baseOptions;

  if (!query || candidates.length === 0) {
    return [];
  }

  // Score all candidates with feedback bias
  const scored: ScoredItem[] = candidates.map(item => {
    let score = scoreSimilarity(query, item);

    // Apply type boost: +20% if type matches
    if (preferType && item.type === preferType) {
      score *= 1.2;
    }

    // Apply module boost: +30% if module matches
    if (preferModule) {
      const itemModule = (item.module || item.component || '').toLowerCase();
      const targetModule = preferModule.toLowerCase();
      if (itemModule && (itemModule.includes(targetModule) || targetModule.includes(itemModule))) {
        score *= 1.3;
      }
    }

    // Apply feedback boost AFTER type/module filtering
    const rating = feedbackScores.get(item.id);
    if (rating !== undefined) {
      if (rating >= 5) score *= 1.5;
      else if (rating >= 4) score *= 1.2;
      else if (rating <= 2) score *= 0.5;
      // 3-star: no change (1.0x)
    }

    return { item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out items with score < 0.1 (too dissimilar)
  const MIN_SCORE_THRESHOLD = 0.1;
  const filtered = scored.filter(s => s.score >= MIN_SCORE_THRESHOLD);

  return filtered.slice(0, count).map(s => s.item);
}

// ============================================================
// PROMPT FORMATTING
// ============================================================

/**
 * Format a BacklogItem as a structured example for the AI prompt.
 *
 * @param item - BacklogItem to format
 * @returns Formatted string block suitable for prompt injection
 */
export function formatExampleForPrompt(item: BacklogItem): string {
  const parts: string[] = [
    `ID: ${item.id}`,
    `Type: ${item.type}`,
    `Title: ${item.title}`,
  ];

  // Description (truncated to 150 chars)
  if (item.description) {
    const truncatedDesc = item.description.length > 150
      ? item.description.substring(0, 147) + '...'
      : item.description;
    parts.push(`Description: ${truncatedDesc}`);
  }

  // Module/Component
  if (item.module) {
    parts.push(`Module: ${item.module}`);
  } else if (item.component) {
    parts.push(`Component: ${item.component}`);
  }

  // Severity (for bugs)
  if (item.severity) {
    parts.push(`Severity: ${item.severity}`);
  }

  // Effort
  if (item.effort) {
    parts.push(`Effort: ${item.effort}`);
  }

  // Max 2 criteria as examples
  if (item.criteria && item.criteria.length > 0) {
    const criteriaExamples = item.criteria.slice(0, 2).map(c => `  - ${c.text}`);
    parts.push(`Criteria:\n${criteriaExamples.join('\n')}`);
  }

  return parts.join('\n');
}

// ============================================================
// TERMINOLOGY EXTRACTION
// ============================================================

/**
 * Extract the most common meaningful terms from a collection of items.
 *
 * Useful for injecting project-specific terminology into AI prompts.
 *
 * @param items - BacklogItems to extract terms from
 * @param maxTerms - Maximum number of terms to return (default: 10)
 * @returns Array of most frequent terms
 */
export function extractTerminology(items: BacklogItem[], maxTerms: number = 10): string[] {
  // Build term frequency map from all titles
  const termFrequency = new Map<string, number>();

  for (const item of items) {
    const tokens = tokenize(item.title);
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }
  }

  // Sort by frequency descending
  const sorted = [...termFrequency.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Return top N terms
  return sorted.slice(0, maxTerms).map(([term]) => term);
}
