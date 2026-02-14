/**
 * AI Criteria Enhancement Module
 *
 * Provides prompt instructions for generating adaptive, testable
 * acceptance criteria on every AI-generated ticket.
 *
 * Key insight: Criteria are NOT generated in a separate AI call.
 * They are part of the GenerateItemResponseSchema.criteria field.
 * This module enhances the generation prompt to produce BETTER criteria.
 *
 * @module lib/ai-criteria
 */

import type { Criterion } from '../types/ai';
import { getCurrentLocale } from '../i18n';

// ============================================================
// CRITERIA INSTRUCTIONS (PROMPT FRAGMENT)
// ============================================================

/**
 * Prompt fragment injected into GENERATE_ITEM_PROMPT to produce
 * adaptive, testable acceptance criteria in checkbox format.
 *
 * - 2-3 criteria for simple items (bug mineur, config)
 * - 4-6 criteria for complex items (feature, refactoring majeur)
 * - Each criterion must be verifiable (yes/no answer)
 * - At least 1 edge case or error criterion
 * - No generic criteria ("fonctionne correctement", "pas de bugs")
 */
const CRITERIA_INSTRUCTIONS_FR = `
CRITERES D'ACCEPTATION AUTO-GENERES:
Tu DOIS generer des criteres d'acceptation pour chaque ticket.
- Nombre adaptatif: 2-3 pour items simples (bug mineur, config), 4-6 pour items complexes (feature, refactoring majeur)
- Chaque critere DOIT etre verifiable (reponse oui/non claire)
- Inclure au moins 1 critere de cas limite ou d'erreur
- Format: checkbox ("- [ ] critere")
- PAS de criteres generiques ("fonctionne correctement", "pas de bugs")

BONS EXEMPLES:
- [ ] L'utilisateur voit un message d'erreur si le champ email est vide
- [ ] Le temps de reponse de l'API est < 200ms pour 95% des requetes
- [ ] L'export PDF contient toutes les colonnes selectionnees
- [ ] Le composant gere correctement un tableau vide (0 items)

MAUVAIS EXEMPLES (A EVITER):
- [ ] La fonctionnalite fonctionne correctement
- [ ] L'interface est intuitive
- [ ] Pas de bugs
`;

const CRITERIA_INSTRUCTIONS_EN = `
AUTO-GENERATED ACCEPTANCE CRITERIA:
You MUST generate acceptance criteria for each ticket.
- Adaptive count: 2-3 for simple items (minor bug, config), 4-6 for complex items (feature, major refactoring)
- Each criterion MUST be verifiable (clear yes/no answer)
- Include at least 1 edge case or error criterion
- Format: checkbox ("- [ ] criterion")
- NO generic criteria ("works correctly", "no bugs")

GOOD EXAMPLES:
- [ ] User sees an error message if the email field is empty
- [ ] API response time is < 200ms for 95% of requests
- [ ] PDF export contains all selected columns
- [ ] Component handles an empty array gracefully (0 items)

BAD EXAMPLES (AVOID):
- [ ] The feature works correctly
- [ ] The interface is intuitive
- [ ] No bugs
`;

/** Get locale-appropriate criteria instructions */
export function getCriteriaInstructions(): string {
  return getCurrentLocale() === 'en' ? CRITERIA_INSTRUCTIONS_EN : CRITERIA_INSTRUCTIONS_FR;
}

/** @deprecated Use getCriteriaInstructions() instead */
export const CRITERIA_INSTRUCTIONS = CRITERIA_INSTRUCTIONS_FR;

// ============================================================
// CRITERIA ENHANCEMENT
// ============================================================

/**
 * Evaluate existing criteria quality.
 *
 * This is a local helper, NOT an AI call. Used to check if
 * AI-generated criteria meet minimum standards.
 *
 * @param existingCriteria - Current criteria array
 * @param options - Optional context (title, type) for logging
 * @returns The criteria as-is (enhancement happens via prompt injection)
 */
export function enhanceCriteria(
  existingCriteria: Criterion[],
  options?: { title?: string; type?: string }
): Criterion[] {
  if (existingCriteria.length === 0) {
    // No criteria yet - they will come from AI generation via prompt injection
    return [];
  }

  if (existingCriteria.length < 2) {
    console.warn(
      `[AI Criteria] Thin criteria (${existingCriteria.length}) for "${options?.title || 'unknown'}". ` +
      'Consider re-generating with enhanced prompt.'
    );
  }

  return existingCriteria;
}

// ============================================================
// PROMPT BUILDER
// ============================================================

/**
 * Build the criteria prompt section for injection into GENERATE_ITEM_PROMPT.
 *
 * @returns CRITERIA_INSTRUCTIONS string
 */
export function buildCriteriaPromptSection(): string {
  return CRITERIA_INSTRUCTIONS;
}
