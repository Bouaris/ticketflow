/**
 * AI Analysis Module - Backlog analysis with priority scoring, groupings, and insights
 *
 * IMPORTANT: This module must NOT import from './ai' at runtime to avoid circular
 * dependency: ai.ts -> ai-analysis.ts -> ai.ts. Use './ai-client' directly.
 *
 * Provides:
 * - analyzeBacklog - batch analysis of backlog items with priority scoring + groupings
 * - AnalyzeBacklogResult - result type
 * - AnalyzeBacklogOptions - options including batchSize, onProgress, signal
 * - ANALYZE_BACKLOG_PROMPT_FR / ANALYZE_BACKLOG_PROMPT_EN - bilingual prompts
 */

import type { BacklogItem } from '../types/backlog';
import {
  BacklogAnalysisResponseSchema,
  safeParseAIResponse,
  type BacklogAnalysisResponse,
  type ItemPriorityScore,
  type ItemGroup,
  type BlockingBug,
} from '../types/ai';
import { buildPromptWithContext } from './ai-context';
import type { AIOptions as BaseAIOptions } from './ai-context';
import {
  recordTelemetry,
  type TelemetryErrorType,
} from './ai-telemetry';
import { getCurrentLocale, getTranslations } from '../i18n';
import { track } from './telemetry';
import { generateCompletion } from './ai-client';
import { getEffectiveAIConfig, resolveModelForProvider } from './ai-config';

// Re-use AIOptions from ai-context (not from ./ai to avoid circular dep)
type AIOptions = BaseAIOptions & {
  projectId?: number;
  signal?: AbortSignal;
};

// ============================================================
// TYPES
// ============================================================

export interface AnalyzeBacklogResult {
  success: boolean;
  analysis?: BacklogAnalysisResponse;
  error?: string;
  processingTime?: number;
}

export interface AnalyzeBacklogOptions extends AIOptions {
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
  signal?: AbortSignal;
}

// Re-export types for consumers
export type {
  BacklogAnalysisResponse,
  ItemPriorityScore,
  ItemGroup,
  BlockingBug,
};

// ============================================================
// ANALYSIS PROMPTS
// ============================================================

export const ANALYZE_BACKLOG_PROMPT_FR = `Tu es un Product Owner senior expert en priorisation Agile et gestion de dette technique.

## MISSION
Analyse ce backlog et fournis:
1. Un score de priorité (0-100) pour chaque item
2. Des regroupements logiques d'items similaires
3. L'identification des bugs bloquants

## ITEMS DU BACKLOG
{items_json}

## CRITÈRES DE SCORING
Le score combine 3 facteurs (moyenne pondérée):
- **Gravité** (0-100): Impact technique/fonctionnel du problème
  - Bugs P0/P1 = 80-100, P2 = 50-70, P3/P4 = 20-50
  - Features critiques = 70-90, améliorations = 30-60
- **Urgence** (0-100): Délai acceptable avant résolution
  - Bloquant production = 100, Sprint courant = 70-90
  - Prochain sprint = 40-60, Backlog = 10-40
- **Impact Business** (0-100): Valeur pour les utilisateurs/business
  - Fonctionnalité clé = 80-100, amélioration UX = 50-70
  - Dette technique = 30-50, cosmétique = 10-30

Score final = (Gravité + Urgence + Impact Business) / 3

## RÈGLES DE GROUPAGE
- Grouper par thématique fonctionnelle OU technique
- Minimum 2 items par groupe
- Un item peut appartenir à un seul groupe
- Justifier chaque groupe
- Les items non-groupables restent seuls

## DÉTECTION BUGS BLOQUANTS
Un bug est bloquant s'il:
- Est P0 ou P1 (sévérité critique)
- Empêche d'autres items d'être développés
- Affecte une fonctionnalité critique

## FORMAT DE RÉPONSE (JSON strict)
{
  "priorities": [
    {
      "itemId": "BUG-001",
      "score": 85,
      "factors": { "severity": 90, "urgency": 85, "businessImpact": 80 },
      "rationale": "Bug bloquant affectant la connexion",
      "isBlocking": true,
      "blockedBy": []
    }
  ],
  "groups": [
    {
      "groupId": "group-1",
      "name": "Amélioration Authentification",
      "items": ["CT-001", "CT-002", "BUG-003"],
      "rationale": "Items liés au système d'authentification",
      "suggestedOrder": ["BUG-003", "CT-001", "CT-002"]
    }
  ],
  "blockingBugs": [
    {
      "itemId": "BUG-001",
      "severity": "P0",
      "blocksCount": 3,
      "recommendation": "Résoudre en priorité, bloque 3 autres items"
    }
  ],
  "insights": [
    "40% du backlog concerne la performance",
    "Cluster de 5 bugs dans le module paiement"
  ],
  "analyzedAt": 0
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

export const ANALYZE_BACKLOG_PROMPT_EN = `You are a senior Product Owner expert in Agile prioritization and technical debt management.

## MISSION
Analyze this backlog and provide:
1. A priority score (0-100) for each item
2. Logical groupings of similar items
3. Identification of blocking bugs

## BACKLOG ITEMS
{items_json}

## SCORING CRITERIA
The score combines 3 factors (weighted average):
- **Severity** (0-100): Technical/functional impact of the problem
  - Bugs P0/P1 = 80-100, P2 = 50-70, P3/P4 = 20-50
  - Critical features = 70-90, improvements = 30-60
- **Urgency** (0-100): Acceptable delay before resolution
  - Production blocker = 100, Current sprint = 70-90
  - Next sprint = 40-60, Backlog = 10-40
- **Business Impact** (0-100): Value for users/business
  - Key feature = 80-100, UX improvement = 50-70
  - Technical debt = 30-50, cosmetic = 10-30

Final score = (Severity + Urgency + Business Impact) / 3

## GROUPING RULES
- Group by functional OR technical theme
- Minimum 2 items per group
- An item can belong to only one group
- Justify each group
- Non-groupable items remain alone

## BLOCKING BUG DETECTION
A bug is blocking if it:
- Is P0 or P1 (critical severity)
- Prevents other items from being developed
- Affects a critical feature

## RESPONSE FORMAT (strict JSON)
{
  "priorities": [
    {
      "itemId": "BUG-001",
      "score": 85,
      "factors": { "severity": 90, "urgency": 85, "businessImpact": 80 },
      "rationale": "Blocking bug affecting login",
      "isBlocking": true,
      "blockedBy": []
    }
  ],
  "groups": [
    {
      "groupId": "group-1",
      "name": "Authentication Improvement",
      "items": ["CT-001", "CT-002", "BUG-003"],
      "rationale": "Items related to the authentication system",
      "suggestedOrder": ["BUG-003", "CT-001", "CT-002"]
    }
  ],
  "blockingBugs": [
    {
      "itemId": "BUG-001",
      "severity": "P0",
      "blocksCount": 3,
      "recommendation": "Resolve first, blocks 3 other items"
    }
  ],
  "insights": [
    "40% of the backlog relates to performance",
    "Cluster of 5 bugs in the payment module"
  ],
  "analyzedAt": 0
}

Respond ONLY with JSON, no markdown or explanation.`;

function getAnalyzeBacklogPrompt(): string {
  return getCurrentLocale() === 'en' ? ANALYZE_BACKLOG_PROMPT_EN : ANALYZE_BACKLOG_PROMPT_FR;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Helper: chunk an array into batches
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper: merge multiple partial analysis results with deduplication
 */
function mergeAnalysisResults(
  results: Partial<BacklogAnalysisResponse>[]
): BacklogAnalysisResponse {
  const prioritiesMap = new Map<string, ItemPriorityScore>();
  const groupsMap = new Map<string, ItemGroup>();
  const blockingBugsMap = new Map<string, BlockingBug>();
  const insightsSet = new Set<string>();

  for (const result of results) {
    // Deduplicate priorities by itemId (keep latest)
    if (result.priorities) {
      for (const priority of result.priorities) {
        prioritiesMap.set(priority.itemId, priority);
      }
    }
    // Deduplicate groups by groupId (keep latest)
    if (result.groups) {
      for (const group of result.groups) {
        groupsMap.set(group.groupId, group);
      }
    }
    // Deduplicate blocking bugs by itemId (keep latest)
    if (result.blockingBugs) {
      for (const bug of result.blockingBugs) {
        blockingBugsMap.set(bug.itemId, bug);
      }
    }
    // Deduplicate insights
    if (result.insights) {
      for (const insight of result.insights) {
        insightsSet.add(insight);
      }
    }
  }

  return {
    priorities: Array.from(prioritiesMap.values()),
    groups: Array.from(groupsMap.values()),
    blockingBugs: Array.from(blockingBugsMap.values()),
    insights: Array.from(insightsSet),
    analyzedAt: Date.now(),
  };
}

// ============================================================
// ANALYZE BACKLOG
// ============================================================

/**
 * Analyze backlog items and generate prioritization scores, groupings, and insights
 *
 * @param items BacklogItem array to analyze
 * @param options AI options including batch size and progress callback
 * @returns Analysis result with scores, groups, blocking bugs, and insights
 */
export async function analyzeBacklog(
  items: BacklogItem[],
  options?: AnalyzeBacklogOptions
): Promise<AnalyzeBacklogResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize || 25;

  try {
    // Check if already aborted before starting
    if (options?.signal?.aborted) {
      return {
        success: false,
        error: 'Operation cancelled',
        processingTime: Date.now() - startTime,
      };
    }

    if (items.length === 0) {
      return {
        success: true,
        analysis: {
          priorities: [],
          groups: [],
          blockingBugs: [],
          insights: [getTranslations().aiErrors.noItemsToAnalyze],
          analyzedAt: Date.now(),
        },
        processingTime: Date.now() - startTime,
      };
    }

    // Get effective AI config for this project
    const { provider } = getEffectiveAIConfig();
    const effectiveProvider = options?.provider || provider;
    const modelId = resolveModelForProvider(effectiveProvider);

    // Chunk items for processing
    const batches = chunkArray(items, batchSize);
    const results: Partial<BacklogAnalysisResponse>[] = [];

    for (let i = 0; i < batches.length; i++) {
      // Check if aborted before starting batch
      if (options?.signal?.aborted) {
        return {
          success: false,
          error: 'Operation cancelled',
          processingTime: Date.now() - startTime,
        };
      }

      const batch = batches[i];

      // Notify progress (1-indexed for UI: 1/3, 2/3, 3/3)
      options?.onProgress?.(i + 1, batches.length);

      // Build items JSON for this batch
      const itemsJson = JSON.stringify(
        batch.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description?.slice(0, 200),
          severity: item.severity,
          priority: item.priority,
          effort: item.effort,
          module: item.module || item.component,
          criteriaCount: item.criteria?.length || 0,
          completedCriteria: item.criteria?.filter(c => c.checked).length || 0,
        })),
        null,
        2
      );

      const batchStartTime = Date.now();
      const basePrompt = getAnalyzeBacklogPrompt().replace('{items_json}', itemsJson);
      const prompt = await buildPromptWithContext(basePrompt, options);
      const text = await generateCompletion(prompt, { provider: effectiveProvider, modelId });

      // Check if aborted after AI call completed
      if (options?.signal?.aborted) {
        return {
          success: false,
          error: 'Operation cancelled',
          processingTime: Date.now() - startTime,
        };
      }

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (import.meta.env.DEV) {
          console.warn(`[AI Analysis] Batch ${i + 1}/${batches.length}: Invalid response`);
        }
        // Record telemetry for failed batch
        if (options?.projectId) {
          await recordTelemetry({
            projectId: options.projectId,
            operation: 'analyze',
            provider: effectiveProvider,
            model: modelId,
            success: false,
            errorType: 'json_parse',
            retryCount: 0,
            latencyMs: Date.now() - batchStartTime,
          });
        }
        continue;
      }

      const parsed = safeParseAIResponse(jsonMatch[0], BacklogAnalysisResponseSchema);
      if (parsed) {
        results.push(parsed);
        // Record telemetry for successful batch
        if (options?.projectId) {
          await recordTelemetry({
            projectId: options.projectId,
            operation: 'analyze',
            provider: effectiveProvider,
            model: modelId,
            success: true,
            retryCount: 0,
            latencyMs: Date.now() - batchStartTime,
          });
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn(`[AI Analysis] Batch ${i + 1}/${batches.length}: Validation failed`);
        }
        // Record telemetry for validation failure
        if (options?.projectId) {
          await recordTelemetry({
            projectId: options.projectId,
            operation: 'analyze',
            provider: effectiveProvider,
            model: modelId,
            success: false,
            errorType: 'validation',
            retryCount: 0,
            latencyMs: Date.now() - batchStartTime,
          });
        }
      }
    }

    // Final progress notification
    options?.onProgress?.(batches.length, batches.length);

    if (results.length === 0) {
      return {
        success: false,
        error: getTranslations().aiErrors.noValidResult,
        processingTime: Date.now() - startTime,
      };
    }

    // Merge all results
    const merged = mergeAnalysisResults(results);

    track('ai_generation_completed', { provider: effectiveProvider, type: 'analysis' });
    return {
      success: true,
      analysis: merged,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    // Record telemetry for exception
    const { provider } = getEffectiveAIConfig();
    const effectiveProvider = options?.provider || provider;
    const modelId = resolveModelForProvider(effectiveProvider);
    if (options?.projectId) {
      const errorType: TelemetryErrorType = error instanceof Error && error.message.includes('network')
        ? 'network'
        : 'unknown';
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'analyze',
        provider: effectiveProvider,
        model: modelId,
        success: false,
        errorType,
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : getTranslations().aiErrors.unknownError,
      processingTime: Date.now() - startTime,
    };
  }
}
