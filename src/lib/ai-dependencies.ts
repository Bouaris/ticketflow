/**
 * AI Dependency Detection Engine
 *
 * Two-stage dependency detection:
 * 1. TF-IDF pre-filter (fast, local) - finds similar items
 * 2. AI classification (on top candidates only) - determines relationship type
 *
 * Never blocks ticket creation - all errors caught gracefully.
 *
 * @module lib/ai-dependencies
 */

import type { BacklogItem } from '../types/backlog';
import {
  DependencySuggestionsResponseSchema,
  type DependencySuggestion,
} from '../types/ai';
import { scoreSimilarity } from './ai-few-shot';
import {
  generateCompletionWithRetry,
  getEffectiveAIConfig,
  type AIProvider,
} from './ai';
import { recordTelemetry } from './ai-telemetry';

// Re-export for consumers
export type { DependencySuggestion };

// ============================================================
// TYPES
// ============================================================

interface SimilarItem {
  item: BacklogItem;
  score: number;
}

interface DetectDependenciesOptions {
  provider?: AIProvider;
  projectPath?: string;
  projectId?: number;
}

// ============================================================
// TF-IDF PRE-FILTER (STAGE 1)
// ============================================================

/**
 * Find items similar to a new ticket using TF-IDF scoring.
 *
 * Scores all existing items against the new item's title + description,
 * filters by threshold, and returns the top 10 sorted by score.
 *
 * @param newItem - New item being created
 * @param existingItems - All existing backlog items
 * @param threshold - Minimum similarity score (default: 0.3)
 * @returns Top 10 similar items above threshold
 */
export function findSimilarItems(
  newItem: { title: string; description?: string },
  existingItems: BacklogItem[],
  threshold: number = 0.3
): SimilarItem[] {
  const query = `${newItem.title} ${newItem.description || ''}`;

  return existingItems
    .map(item => ({
      item,
      score: scoreSimilarity(query, item),
    }))
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// ============================================================
// DEPENDENCY DETECTION PROMPT
// ============================================================

const DEPENDENCY_DETECTION_PROMPT = `Analyse le nouveau ticket et les tickets existants du backlog.
Identifie les relations entre eux.

NOUVEAU TICKET:
{new_item}

TICKETS EXISTANTS SIMILAIRES (pre-filtres par TF-IDF):
{similar_items}

TYPES DE RELATIONS:
1. "blocks" / "blocked-by": Le nouveau ticket ne peut pas etre implemente avant/apres un existant
2. "related-to": Les tickets partagent un module, une fonctionnalite, ou un contexte technique
3. "potential-duplicate": Les tickets decrivent le meme probleme ou la meme fonctionnalite

REPONSE JSON:
{
  "suggestions": [
    {
      "targetId": "BUG-001",
      "relationship": "blocks" | "blocked-by" | "related-to" | "potential-duplicate",
      "confidence": 0.0-1.0,
      "reason": "Explication courte de la relation"
    }
  ]
}

REGLES:
- Seuil de confiance minimum: 0.5
- Maximum 5 suggestions
- "potential-duplicate" necessite confidence >= 0.7
- Justifie chaque relation en 1 phrase
- Si aucune relation significative, retourne un tableau vide: {"suggestions": []}`;

// ============================================================
// AI CLASSIFICATION (STAGE 2)
// ============================================================

/**
 * Format a new item for the dependency detection prompt.
 */
function formatNewItem(newItem: { title: string; description?: string; type?: string }): string {
  const parts = [`Titre: ${newItem.title}`];
  if (newItem.description) {
    parts.push(`Description: ${newItem.description}`);
  }
  if (newItem.type) {
    parts.push(`Type: ${newItem.type}`);
  }
  return parts.join('\n');
}

/**
 * Format similar items for the dependency detection prompt.
 */
function formatSimilarItems(items: SimilarItem[]): string {
  return items.map(({ item, score }) => {
    const parts = [
      `- ${item.id}: ${item.title}`,
      `  Type: ${item.type}`,
    ];
    if (item.description) {
      const truncated = item.description.length > 150
        ? item.description.substring(0, 147) + '...'
        : item.description;
      parts.push(`  Description: ${truncated}`);
    }
    if (item.module || item.component) {
      parts.push(`  Module: ${item.module || item.component}`);
    }
    parts.push(`  Similarite TF-IDF: ${score.toFixed(2)}`);
    return parts.join('\n');
  }).join('\n\n');
}

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================

/**
 * Detect dependencies between a new item and existing backlog items.
 *
 * Two-stage process:
 * 1. TF-IDF pre-filter to find top 10 candidates (fast, local)
 * 2. AI classification to determine relationship types (on candidates only)
 *
 * NEVER blocks ticket creation. All errors are caught and return empty array.
 *
 * @param newItem - The new ticket being created
 * @param existingItems - All existing backlog items
 * @param options - Provider, project path, project ID for telemetry
 * @returns Array of dependency suggestions (empty on error)
 */
export async function detectDependencies(
  newItem: { title: string; description?: string; type?: string },
  existingItems: BacklogItem[],
  options?: DetectDependenciesOptions
): Promise<DependencySuggestion[]> {
  const startTime = Date.now();

  try {
    // Guard: need items to compare against
    if (!existingItems || existingItems.length === 0) {
      return [];
    }

    // Stage 1: TF-IDF pre-filter
    const candidates = findSimilarItems(newItem, existingItems);

    if (candidates.length === 0) {
      // No similar items found - no dependencies to suggest
      return [];
    }

    // Stage 2: AI classification
    const { provider, modelId } = getEffectiveAIConfig(options?.projectPath);
    const effectiveProvider = options?.provider || provider;

    const prompt = DEPENDENCY_DETECTION_PROMPT
      .replace('{new_item}', formatNewItem(newItem))
      .replace('{similar_items}', formatSimilarItems(candidates));

    const result = await generateCompletionWithRetry(
      prompt,
      DependencySuggestionsResponseSchema,
      { provider: effectiveProvider, modelId }
    );

    // Record telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'dependency_detect',
        provider: effectiveProvider,
        model: modelId,
        success: result.success,
        errorType: result.success ? undefined : 'validation',
        retryCount: result.retryCount,
        latencyMs: Date.now() - startTime,
      });
    }

    if (!result.success) {
      return [];
    }

    // Build set of valid existing IDs for validation
    const existingIds = new Set(existingItems.map(item => item.id));

    // Filter and validate suggestions
    const suggestions = result.data.suggestions
      // Validate targetId exists in existing items
      .filter(s => existingIds.has(s.targetId))
      // Filter by minimum confidence threshold
      .filter(s => s.confidence >= 0.5)
      // Filter potential-duplicate by higher confidence threshold
      .filter(s => s.relationship !== 'potential-duplicate' || s.confidence >= 0.7);

    return suggestions;
  } catch (error) {
    // Never block ticket creation - log and return empty
    console.warn('[AI Dependencies] Detection failed:', error);

    // Record failure telemetry
    if (options?.projectId) {
      const { provider, modelId } = getEffectiveAIConfig(options?.projectPath);
      const effectiveProvider = options?.provider || provider;
      try {
        await recordTelemetry({
          projectId: options.projectId,
          operation: 'dependency_detect',
          provider: effectiveProvider,
          model: modelId,
          success: false,
          errorType: 'unknown',
          retryCount: 0,
          latencyMs: Date.now() - startTime,
        });
      } catch {
        // Telemetry failure should never propagate
      }
    }

    return [];
  }
}
