/**
 * AI Integration - Multi-provider support
 *
 * Supports: Groq (default, free), Gemini, OpenAI
 *
 * This module is the public composition layer. It re-exports from sub-modules
 * and contains business logic for item generation and refinement.
 */

import type { BacklogItem } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';
import {
  RefineResponseSchema,
  GenerateItemResponseSchema,
} from '../types/ai';
import { buildPromptWithContext, type AIOptions as BaseAIOptions } from './ai-context';
import {
  generateWithRetry,
  getStructuredOutputMode,
  zodToSimpleJsonSchema,
  type RetryResult,
} from './ai-retry';
import {
  gatherDynamicContext,
  buildEnhancedPrompt,
} from './ai-context-dynamic';
import {
  recordTelemetry,
  type TelemetryErrorType,
} from './ai-telemetry';
import { getCriteriaInstructions } from './ai-criteria';
import { getCurrentLocale, getTranslations } from '../i18n';
import { track } from './telemetry';
import { getRefinePrompt, getGenerateItemPrompt } from './ai-prompts';

// Sub-module imports
import {
  generateCompletionWithRetry,
  generateChatCompletion,
  testProviderConnection,
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getClientConfig,
  resetClient,
  initSecureStorage,
} from './ai-client';
import {
  getProvider,
  setProvider,
  getEffectiveAIConfig,
  resolveModelForProvider,
  getProviderDisplayName,
  getSelectedModel,
  setSelectedModel,
} from './ai-config';
import type { ImageData, CompletionOptions, ChatCompletionMessage } from './ai-client';
import type { AIProvider, ProviderId } from './ai-config';

// Extended AI options with Phase 3 additions
export interface AIOptions extends BaseAIOptions {
  /** Project ID for telemetry recording */
  projectId?: number;
  /** Existing items for few-shot examples and context */
  items?: BacklogItem[];
  /** Type configurations for context metadata */
  typeConfigs?: TypeDefinition[];
  /** Base64-encoded images for multimodal AI requests (Gemini/OpenAI) */
  images?: ImageData[];
  /** AbortSignal for cancelling AI operations (Phase 24) */
  signal?: AbortSignal;
}

// Re-export for consumers
export { generateWithRetry, getStructuredOutputMode, zodToSimpleJsonSchema };
export { recordTelemetry, getErrorRate, getTelemetryStats } from './ai-telemetry';

// Re-export from sub-modules to maintain existing import paths
export type { AIProvider, ProviderId };
export type { ImageData, CompletionOptions, ChatCompletionMessage };
export type { RetryResult };

export {
  getProvider,
  setProvider,
  getEffectiveAIConfig,
  resolveModelForProvider,
  getProviderDisplayName,
  getSelectedModel,
  setSelectedModel,
};

export {
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getClientConfig,
  resetClient,
  initSecureStorage,
};

export {
  generateCompletionWithRetry,
  generateChatCompletion,
  testProviderConnection,
};

// Re-export from maintenance module (preserves all existing import paths)
export {
  suggestImprovements,
  analyzeBacklogFormat,
  correctBacklogFormat,
  type BacklogMaintenanceResult,
} from './ai-maintenance';
import type { RefinementResult } from './ai-maintenance';
export type { RefinementResult };

// Re-export from analysis module (preserves all existing import paths)
export {
  analyzeBacklog,
  type AnalyzeBacklogResult,
  type AnalyzeBacklogOptions,
  type BacklogAnalysisResponse,
  type ItemPriorityScore,
  type ItemGroup,
  type BlockingBug,
} from './ai-analysis';

// ============================================================
// ITEM REFINEMENT
// ============================================================

export interface RefineOptions extends AIOptions {
  additionalPrompt?: string;
}

export async function refineItem(item: BacklogItem, options?: RefineOptions): Promise<RefinementResult> {
  const startTime = Date.now();
  const { provider } = getEffectiveAIConfig();
  const effectiveProvider = options?.provider || provider;
  const modelId = resolveModelForProvider(effectiveProvider);

  try {
    const locale = getCurrentLocale();
    let basePrompt = getRefinePrompt()
      .replace('{id}', item.id)
      .replace('{type}', item.type)
      .replace('{title}', item.title);

    const descSection = item.description ? `Description: ${item.description}` : '';
    const userStorySection = item.userStory ? `User Story: ${item.userStory}` : '';
    const specsSection = item.specs?.length
      ? `${locale === 'en' ? 'Specifications' : 'Specifications'}:\n${item.specs.map(s => `- ${s}`).join('\n')}`
      : '';
    const criteriaSection = item.criteria?.length
      ? `${locale === 'en' ? 'Acceptance Criteria' : 'Criteres d\'acceptation'}:\n${item.criteria.map(c => `- [${c.checked ? 'x' : ' '}] ${c.text}`).join('\n')}`
      : '';
    const dependenciesSection = item.dependencies?.length
      ? `${locale === 'en' ? 'Dependencies' : 'Dependances'}:\n${item.dependencies.map(d => `- ${d}`).join('\n')}`
      : '';
    const constraintsSection = item.constraints?.length
      ? `${locale === 'en' ? 'Constraints' : 'Contraintes'}:\n${item.constraints.map(c => `- ${c}`).join('\n')}`
      : '';
    const additionalPromptSection = options?.additionalPrompt
      ? `\n${locale === 'en' ? 'ADDITIONAL USER INSTRUCTIONS' : 'INSTRUCTIONS SUPPLEMENTAIRES DE L\'UTILISATEUR'}:\n${options.additionalPrompt}`
      : '';

    basePrompt = basePrompt
      .replace('{description_section}', descSection)
      .replace('{user_story_section}', userStorySection)
      .replace('{specs_section}', specsSection)
      .replace('{criteria_section}', criteriaSection)
      .replace('{dependencies_section}', dependenciesSection)
      .replace('{constraints_section}', constraintsSection)
      .replace('{additional_prompt_section}', additionalPromptSection);

    // Load feedback scores for biased few-shot selection (if sufficient data)
    let feedbackScores: Map<string, number> | undefined;
    if (options?.projectId) {
      try {
        const { getFeedbackScores, hasSufficientFeedback } = await import('./ai-feedback');
        if (await hasSufficientFeedback(options.projectId)) {
          feedbackScores = await getFeedbackScores(options.projectId);
        }
      } catch {
        // Feedback loading failure shouldn't break refinement
      }
    }

    // Enhance with dynamic context if items available
    let enhancedPrompt = basePrompt;
    if (options?.items && options.items.length > 0) {
      const context = await gatherDynamicContext({
        query: item.title,
        items: options.items,
        typeConfigs: options.typeConfigs || options.availableTypes || [],
        targetType: item.type,
        targetModule: item.module || item.component,
        fewShotCount: 2,
        moduleContextCount: 3,
        feedbackScores,
      });
      enhancedPrompt = buildEnhancedPrompt(basePrompt, context);
    }

    // Add static context
    const prompt = await buildPromptWithContext(enhancedPrompt, options);

    // Use retry wrapper with structured output validation
    const result = await generateCompletionWithRetry(
      prompt,
      RefineResponseSchema,
      { provider: effectiveProvider, modelId, signal: options?.signal }
    );

    // Record telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'refine',
        provider: effectiveProvider,
        model: modelId,
        success: result.success,
        errorType: result.success ? undefined : 'validation',
        retryCount: result.retryCount,
        latencyMs: Date.now() - startTime,
      });
    }

    if (!result.success) {
      track('ai_generation_failed', { provider: effectiveProvider, type: 'refinement', error_type: 'validation' });
      return { success: false, error: result.error };
    }

    track('ai_generation_completed', { provider: effectiveProvider, type: 'refinement' });
    return {
      success: true,
      refinedItem: {
        title: result.data.title,
        userStory: result.data.userStory || undefined,
        specs: result.data.specs,
        criteria: result.data.criteria,
        dependencies: result.data.dependencies,
        constraints: result.data.constraints,
      },
      suggestions: result.data.suggestions,
    };
  } catch (error) {
    // Record failure telemetry
    if (options?.projectId) {
      const errorType: TelemetryErrorType = error instanceof Error && error.message.includes('network')
        ? 'network'
        : 'unknown';
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'refine',
        provider: effectiveProvider,
        model: modelId,
        success: false,
        errorType,
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      });
    }
    const refineErrorType = error instanceof Error && /\b(401|403)\b|unauthorized|invalid.*api/i.test(error.message)
      ? 'auth'
      : error instanceof Error && /\b429\b|rate.?limit/i.test(error.message)
      ? 'rate_limit'
      : 'unknown';
    track('ai_generation_failed', { provider: effectiveProvider, type: 'refinement', error_type: refineErrorType });
    return {
      success: false,
      error: error instanceof Error ? error.message : getTranslations().aiErrors.unknownError,
    };
  }
}

// ============================================================
// GENERATE ITEM FROM DESCRIPTION
// ============================================================

export interface GenerateItemResult {
  success: boolean;
  item?: {
    title: string;
    description?: string;
    userStory?: string;
    specs: string[];
    criteria: { text: string; checked: boolean }[];
    suggestedType: string;
    suggestedPriority?: 'Haute' | 'Moyenne' | 'Faible';
    suggestedSeverity?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
    suggestedEffort?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    suggestedModule?: string;
    emoji?: string;
    dependencies?: string[];
    constraints?: string[];
  };
  error?: string;
}

// ============================================================
// DYNAMIC TYPE CLASSIFICATION HELPERS
// ============================================================

/**
 * Default descriptions for legacy types (used when custom types don't have descriptions)
 */
const DEFAULT_TYPE_DESCRIPTIONS_FR: Record<string, string> = {
  BUG: 'Anomalie technique. Sévérité P0-P4. PAS de user story (le bug EST le problème).',
  CT: 'Court Terme - Livrable dans le sprint. Impact immédiat mesurable.',
  LT: 'Long Terme - Vision stratégique. Investissement architectural.',
  AUTRE: 'Innovation, exploration, amélioration continue.',
};

const DEFAULT_TYPE_DESCRIPTIONS_EN: Record<string, string> = {
  BUG: 'Technical anomaly. Severity P0-P4. NO user story (the bug IS the problem).',
  CT: 'Short Term - Sprint deliverable. Immediate measurable impact.',
  LT: 'Long Term - Strategic vision. Architectural investment.',
  AUTRE: 'Innovation, exploration, continuous improvement.',
};

function getDefaultTypeDescriptions(): Record<string, string> {
  return getCurrentLocale() === 'en' ? DEFAULT_TYPE_DESCRIPTIONS_EN : DEFAULT_TYPE_DESCRIPTIONS_FR;
}

/**
 * Build the type classification section for the AI prompt
 * Supports both default and custom types
 */
export function buildTypeClassificationSection(types?: TypeDefinition[]): string {
  const typeDescs = getDefaultTypeDescriptions();
  const t = getTranslations();

  if (!types || types.length === 0) {
    // Fallback to default types
    return Object.entries(typeDescs)
      .map(([id, desc]) => `- ${id}: ${desc}`)
      .join('\n');
  }

  return types.map(tp => {
    const defaultDesc = typeDescs[tp.id];
    // Use default description if known type, otherwise use label as description
    const description = defaultDesc || `${tp.label} - ${t.aiErrors.customTypeDesc}.`;
    return `- ${tp.id}: ${description}`;
  }).join('\n');
}

/**
 * Build the valid type enum string for the JSON schema in the prompt
 */
export function buildTypeEnum(types?: TypeDefinition[]): string {
  if (!types || types.length === 0) {
    return 'BUG|CT|LT|AUTRE';
  }
  return types.map(t => t.id).join('|');
}

export async function generateItemFromDescription(description: string, options?: AIOptions): Promise<GenerateItemResult> {
  const startTime = Date.now();
  const { provider } = getEffectiveAIConfig();
  const effectiveProvider = options?.provider || provider;
  const modelId = resolveModelForProvider(effectiveProvider);

  try {
    // Build base prompt with type classification and criteria instructions
    let basePrompt = getGenerateItemPrompt()
      .replace('{user_description}', description)
      .replace('{type_classification}', buildTypeClassificationSection(options?.availableTypes))
      .replace('{type_enum}', buildTypeEnum(options?.availableTypes))
      .replace('{criteria_instructions}', getCriteriaInstructions());

    // Append image analysis hint when screenshots are attached
    if (options?.images && options.images.length > 0) {
      const t = getTranslations();
      basePrompt += `\n\nNote: ${options.images.length} ${t.aiErrors.screenshotsAttached}`;
    }

    // Load feedback scores for biased few-shot selection (if sufficient data)
    let feedbackScores: Map<string, number> | undefined;
    if (options?.projectId) {
      try {
        const { getFeedbackScores, hasSufficientFeedback } = await import('./ai-feedback');
        if (await hasSufficientFeedback(options.projectId)) {
          feedbackScores = await getFeedbackScores(options.projectId);
        }
      } catch {
        // Feedback loading failure shouldn't break generation
      }
    }

    // Enhance with dynamic context (few-shot examples, module context) if items available
    let enhancedPrompt = basePrompt;
    if (options?.items && options.items.length > 0) {
      const context = await gatherDynamicContext({
        query: description,
        items: options.items,
        typeConfigs: options.typeConfigs || options.availableTypes || [],
        fewShotCount: 3,
        moduleContextCount: 5,
        feedbackScores,
      });
      enhancedPrompt = buildEnhancedPrompt(basePrompt, context);
    }

    // Add static context (CLAUDE.md, AGENTS.md)
    const prompt = await buildPromptWithContext(enhancedPrompt, options);

    // Use retry wrapper with structured output validation
    const result = await generateCompletionWithRetry(
      prompt,
      GenerateItemResponseSchema,
      { provider: effectiveProvider, modelId, images: options?.images, signal: options?.signal }
    );

    // Record telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'generate',
        provider: effectiveProvider,
        model: modelId,
        success: result.success,
        errorType: result.success ? undefined : 'validation',
        retryCount: result.retryCount,
        latencyMs: Date.now() - startTime,
      });
    }

    if (!result.success) {
      track('ai_generation_failed', { provider: effectiveProvider, type: 'ticket', error_type: 'validation' });
      return { success: false, error: result.error };
    }

    track('ai_generation_completed', { provider: effectiveProvider, type: 'ticket' });
    return {
      success: true,
      item: {
        title: result.data.title,
        description: result.data.description || undefined,
        userStory: result.data.userStory || undefined,
        specs: result.data.specs || [],
        criteria: result.data.criteria || [],
        suggestedType: result.data.suggestedType || 'CT',
        suggestedPriority: result.data.suggestedPriority || undefined,
        suggestedSeverity: result.data.suggestedSeverity || undefined,
        suggestedEffort: result.data.suggestedEffort || undefined,
        suggestedModule: result.data.suggestedModule || undefined,
        emoji: result.data.emoji || undefined,
        dependencies: result.data.dependencies || [],
        constraints: result.data.constraints || [],
      },
    };
  } catch (error) {
    // Record failure telemetry
    if (options?.projectId) {
      const errorType: TelemetryErrorType = error instanceof Error && error.message.includes('network')
        ? 'network'
        : 'unknown';
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'generate',
        provider: effectiveProvider,
        model: modelId,
        success: false,
        errorType,
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      });
    }
    const generateErrorType = error instanceof Error && /\b(401|403)\b|unauthorized|invalid.*api/i.test(error.message)
      ? 'auth'
      : error instanceof Error && /\b429\b|rate.?limit/i.test(error.message)
      ? 'rate_limit'
      : error instanceof Error && /network|fetch|ECONN/i.test(error.message)
      ? 'network'
      : 'unknown';
    track('ai_generation_failed', { provider: effectiveProvider, type: 'ticket', error_type: generateErrorType });
    return {
      success: false,
      error: error instanceof Error ? error.message : getTranslations().aiErrors.unknownError,
    };
  }
}
