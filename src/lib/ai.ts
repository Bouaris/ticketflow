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
  SuggestionsResponseSchema,
  MaintenanceResponseSchema,
  BacklogAnalysisResponseSchema,
  safeParseAIResponse,
  type MaintenanceIssue,
  type BacklogAnalysisResponse,
  type ItemPriorityScore,
  type ItemGroup,
  type BlockingBug,
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
  generateCompletion,
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

// ============================================================
// ITEM REFINEMENT
// ============================================================

export interface RefinementResult {
  success: boolean;
  refinedItem?: Partial<BacklogItem>;
  suggestions?: string[];
  error?: string;
}

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

// ============================================================
// BULK SUGGESTIONS
// ============================================================

const BULK_SUGGEST_PROMPT_FR = `Tu es un Product Owner expert. Analyse ces items de backlog et suggère des améliorations globales.

ITEMS:
{items_list}

INSTRUCTIONS:
Propose 3-5 suggestions stratégiques pour améliorer ce backlog:
- Priorisation
- Regroupements possibles
- Dépendances identifiées
- Risques à anticiper

Réponds en JSON:
{
  "suggestions": [
    "Suggestion 1 avec justification",
    "Suggestion 2 avec justification"
  ]
}`;

const BULK_SUGGEST_PROMPT_EN = `You are an expert Product Owner. Analyze these backlog items and suggest global improvements.

ITEMS:
{items_list}

INSTRUCTIONS:
Propose 3-5 strategic suggestions to improve this backlog:
- Prioritization
- Possible groupings
- Identified dependencies
- Risks to anticipate

Respond in JSON:
{
  "suggestions": [
    "Suggestion 1 with justification",
    "Suggestion 2 with justification"
  ]
}`;

function getBulkSuggestPrompt(): string {
  return getCurrentLocale() === 'en' ? BULK_SUGGEST_PROMPT_EN : BULK_SUGGEST_PROMPT_FR;
}

export async function suggestImprovements(items: BacklogItem[], options?: AIOptions): Promise<RefinementResult> {
  const startTime = Date.now();
  const { provider } = getEffectiveAIConfig();
  const effectiveProvider = options?.provider || provider;
  const modelId = resolveModelForProvider(effectiveProvider);

  try {
    const itemsList = items
      .slice(0, 20)
      .map(item => `- ${item.id}: ${item.title} (${item.type}, ${item.priority || 'N/A'})`)
      .join('\n');

    const basePrompt = getBulkSuggestPrompt().replace('{items_list}', itemsList);
    const prompt = await buildPromptWithContext(basePrompt, options);

    // Use retry wrapper
    const result = await generateCompletionWithRetry(
      prompt,
      SuggestionsResponseSchema,
      { provider: effectiveProvider, modelId, signal: options?.signal }
    );

    // Record telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'suggest',
        provider: effectiveProvider,
        model: modelId,
        success: result.success,
        errorType: result.success ? undefined : 'validation',
        retryCount: result.retryCount,
        latencyMs: Date.now() - startTime,
      });
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
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
        operation: 'suggest',
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
    };
  }
}

// ============================================================
// BACKLOG MAINTENANCE
// ============================================================

export interface BacklogMaintenanceResult {
  success: boolean;
  issues: MaintenanceIssue[];
  correctedMarkdown?: string;
  summary?: string;
  error?: string;
}

const MAINTENANCE_PROMPT_FR = `Tu es un validateur de fichiers Markdown de backlog. Analyse et retourne UNIQUEMENT un JSON valide.

## PROBLÈMES À DÉTECTER:

1. **duplicate_id**: Le MÊME ID exact apparaît 2+ fois (ex: "### BUG-001" deux fois)
   - NE PAS signaler les groupes "### BUG-005 à BUG-007"

2. **fused_items**: Items/sections collés sans saut de ligne
   - Ex: "**Effort:** M### CT-002" (### collé)
   - Ex: "- [ ] Critère## 3." (## collé)

3. **malformed_section**: Section "## X." dupliquée avec même numéro

## NE PAS SIGNALER:
- Sections vides, groupes d'items, emojis
- "### Légende", "### Conventions" (sections doc sans ID = normal)

## FICHIER:
{backlog_content}

## RÉPONSE JSON (RIEN D'AUTRE):
{"issues":[{"type":"duplicate_id|fused_items|malformed_section","description":"description courte","location":"ligne ou section","suggestion":"correction à faire"}],"correctedMarkdown":"OK","summary":"N problème(s)"}

Si aucun problème: {"issues":[],"correctedMarkdown":"OK","summary":"Aucun problème"}`;

const MAINTENANCE_PROMPT_EN = `You are a backlog Markdown file validator. Analyze and return ONLY valid JSON.

## PROBLEMS TO DETECT:

1. **duplicate_id**: The SAME exact ID appears 2+ times (e.g. "### BUG-001" twice)
   - Do NOT flag groups like "### BUG-005 to BUG-007"

2. **fused_items**: Items/sections stuck together without line break
   - E.g. "**Effort:** M### CT-002" (### stuck)
   - E.g. "- [ ] Criterion## 3." (## stuck)

3. **malformed_section**: Section "## X." duplicated with same number

## DO NOT FLAG:
- Empty sections, item groups, emojis
- "### Legend", "### Conventions" (doc sections without ID = normal)

## FILE:
{backlog_content}

## JSON RESPONSE (NOTHING ELSE):
{"issues":[{"type":"duplicate_id|fused_items|malformed_section","description":"short description","location":"line or section","suggestion":"correction to apply"}],"correctedMarkdown":"OK","summary":"N problem(s)"}

If no problems: {"issues":[],"correctedMarkdown":"OK","summary":"No problems"}`;

function getMaintenancePrompt(): string {
  return getCurrentLocale() === 'en' ? MAINTENANCE_PROMPT_EN : MAINTENANCE_PROMPT_FR;
}

const CORRECTION_PROMPT_FR = `Tu es un correcteur de fichiers Markdown de backlog Ticketflow.

## FORMAT OFFICIEL TICKETFLOW:
\`\`\`markdown
# NomProjet - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : YYYY-MM-DD

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)
...

---

## 1. BUGS

### BUG-001 | Titre du bug
**Composant:** ...
**Sévérité:** P0-P4 - Description
**Effort:** XS/S/M/L/XL (description)
**Description:** ...

**Critères d'acceptation:**
- [ ] Critère 1

---

## 2. COURT TERME

### CT-001 | Titre feature
**Module:** ...
**Priorité:** Haute/Moyenne/Faible
**Effort:** ...
**Description:** ...

**User Story:**
> En tant que..., je veux...

**Critères d'acceptation:**
- [ ] Critère 1

---

## X. Légende

### Effort
| Code | Signification | Estimation |
...

### Sévérité (Bugs)
...

### Priorité (Features)
...
\`\`\`

## PROBLÈMES DÉTECTÉS:
{issues_list}

## FICHIER À CORRIGER:
{backlog_content}

## INSTRUCTIONS:
1. Corrige TOUS les problèmes listés
2. duplicate_id: renomme le second ID (ex: CT-002 -> CT-003, trouve le prochain ID libre)
3. fused_items: ajoute une ligne vide ET "---" entre les items/sections
4. malformed_section: renumérote la section dupliquée
5. GARDE le contenu des tickets INTACT, corrige seulement la structure
6. Respecte le format officiel ci-dessus

## RÉPONSE:
Retourne UNIQUEMENT le fichier Markdown corrigé.
Commence par # et termine par ---.
Pas de texte avant ni après.`;

const CORRECTION_PROMPT_EN = `You are a Ticketflow backlog Markdown file corrector.

## OFFICIAL TICKETFLOW FORMAT:
\`\`\`markdown
# ProjectName - Product Backlog

> Development reference document
> Last updated: YYYY-MM-DD

---

## Table of Contents
1. [Bugs](#1-bugs)
2. [Short Term](#2-short-term)
...

---

## 1. BUGS

### BUG-001 | Bug title
**Component:** ...
**Severity:** P0-P4 - Description
**Effort:** XS/S/M/L/XL (description)
**Description:** ...

**Acceptance Criteria:**
- [ ] Criterion 1

---

## 2. SHORT TERM

### CT-001 | Feature title
**Module:** ...
**Priority:** Haute/Moyenne/Faible
**Effort:** ...
**Description:** ...

**User Story:**
> As a..., I want...

**Acceptance Criteria:**
- [ ] Criterion 1

---

## X. Legend

### Effort
| Code | Meaning | Estimate |
...

### Severity (Bugs)
...

### Priority (Features)
...
\`\`\`

## DETECTED PROBLEMS:
{issues_list}

## FILE TO CORRECT:
{backlog_content}

## INSTRUCTIONS:
1. Fix ALL listed problems
2. duplicate_id: rename the second ID (e.g. CT-002 -> CT-003, find the next free ID)
3. fused_items: add an empty line AND "---" between items/sections
4. malformed_section: renumber the duplicated section
5. KEEP ticket content INTACT, only fix the structure
6. Respect the official format above

## RESPONSE:
Return ONLY the corrected Markdown file.
Start with # and end with ---.
No text before or after.`;

function getCorrectionPrompt(): string {
  return getCurrentLocale() === 'en' ? CORRECTION_PROMPT_EN : CORRECTION_PROMPT_FR;
}

export async function analyzeBacklogFormat(
  markdownContent: string,
  options?: AIOptions
): Promise<BacklogMaintenanceResult> {
  try {
    // Get effective AI config for this project
    const { provider } = getEffectiveAIConfig();
    const effectiveProvider = options?.provider || provider;
    const modelId = resolveModelForProvider(effectiveProvider);

    // Limit content size to avoid token limits
    const t = getTranslations();
    const truncatedContent = markdownContent.length > 50000
      ? markdownContent.slice(0, 50000) + '\n\n' + t.aiErrors.truncatedContent
      : markdownContent;

    const basePrompt = getMaintenancePrompt().replace('{backlog_content}', truncatedContent);
    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, { provider: effectiveProvider, modelId });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(t.aiErrors.invalidResponse);
    }

    const parsed = safeParseAIResponse(jsonMatch[0], MaintenanceResponseSchema);
    if (!parsed) {
      throw new Error(t.aiErrors.invalidResponseFormat);
    }

    return {
      success: true,
      issues: parsed.issues,
      correctedMarkdown: parsed.correctedMarkdown,
      summary: parsed.summary,
    };
  } catch (error) {
    return {
      success: false,
      issues: [],
      error: error instanceof Error ? error.message : getTranslations().aiErrors.unknownError,
    };
  }
}

/**
 * Correct a backlog file based on detected issues (2nd AI call)
 */
export async function correctBacklogFormat(
  markdownContent: string,
  issues: MaintenanceIssue[],
  options?: AIOptions
): Promise<{ success: boolean; correctedMarkdown?: string; error?: string }> {
  try {
    if (issues.length === 0) {
      return { success: true, correctedMarkdown: markdownContent };
    }

    // Get effective AI config for this project
    const { provider } = getEffectiveAIConfig();
    const effectiveProvider = options?.provider || provider;
    const modelId = resolveModelForProvider(effectiveProvider);

    // Build issues list for the prompt
    const issuesList = issues
      .map((issue, i) => `${i + 1}. [${issue.type}] ${issue.description} (${issue.location}) → ${issue.suggestion}`)
      .join('\n');

    const t = getTranslations();
    const truncatedContent = markdownContent.length > 50000
      ? markdownContent.slice(0, 50000) + '\n\n' + t.aiErrors.truncatedContent
      : markdownContent;

    const basePrompt = getCorrectionPrompt()
      .replace('{issues_list}', issuesList)
      .replace('{backlog_content}', truncatedContent);

    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, { provider: effectiveProvider, modelId });

    // The response should be the corrected markdown directly
    // Clean up any potential wrapper text
    let corrected = text.trim();

    // If wrapped in code block, extract it
    const codeBlockMatch = corrected.match(/```(?:markdown)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      corrected = codeBlockMatch[1].trim();
    }

    // Validate it looks like a markdown file
    if (!corrected.startsWith('#')) {
      throw new Error(t.aiErrors.correctedFileInvalid);
    }

    return {
      success: true,
      correctedMarkdown: corrected,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : getTranslations().aiErrors.correctionError,
    };
  }
}

// ============================================================
// BACKLOG ANALYSIS (LT-002)
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

const ANALYZE_BACKLOG_PROMPT_FR = `Tu es un Product Owner senior expert en priorisation Agile et gestion de dette technique.

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

const ANALYZE_BACKLOG_PROMPT_EN = `You are a senior Product Owner expert in Agile prioritization and technical debt management.

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

// Re-export types for consumers
export type {
  BacklogAnalysisResponse,
  ItemPriorityScore,
  ItemGroup,
  BlockingBug,
};
