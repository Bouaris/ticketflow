/**
 * AI Maintenance Module - Backlog format analysis/correction + bulk suggestions
 *
 * IMPORTANT: This module must NOT import from './ai' at runtime to avoid circular
 * dependency: ai.ts -> ai-maintenance.ts -> ai.ts. Use './ai-client' directly.
 *
 * Provides:
 * - suggestImprovements - bulk strategic suggestions for a set of backlog items
 * - analyzeBacklogFormat - detect structural issues in markdown backlog files
 * - correctBacklogFormat - AI-powered correction of detected structural issues
 * - BacklogMaintenanceResult - result type for maintenance operations
 */

import type { BacklogItem } from '../types/backlog';
import {
  SuggestionsResponseSchema,
  MaintenanceResponseSchema,
  safeParseAIResponse,
  type MaintenanceIssue,
} from '../types/ai';
import { buildPromptWithContext } from './ai-context';
import type { AIOptions as BaseAIOptions } from './ai-context';
import {
  recordTelemetry,
  type TelemetryErrorType,
} from './ai-telemetry';
import { getCurrentLocale, getTranslations } from '../i18n';
import { generateCompletion, generateCompletionWithRetry } from './ai-client';
import { getEffectiveAIConfig, resolveModelForProvider } from './ai-config';

// Re-use AIOptions from ai-context (not from ./ai to avoid circular dep)
type AIOptions = BaseAIOptions & {
  projectId?: number;
  signal?: AbortSignal;
};

// ============================================================
// BACKLOG MAINTENANCE RESULT
// ============================================================

export interface BacklogMaintenanceResult {
  success: boolean;
  issues: MaintenanceIssue[];
  correctedMarkdown?: string;
  summary?: string;
  error?: string;
}

// ============================================================
// BULK SUGGESTIONS
// ============================================================

export interface RefinementResult {
  success: boolean;
  refinedItem?: Partial<BacklogItem>;
  suggestions?: string[];
  error?: string;
}

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
