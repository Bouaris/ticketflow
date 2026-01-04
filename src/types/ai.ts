/**
 * AI Types - Zod schemas for AI response validation
 *
 * Provides runtime validation for AI-generated JSON responses
 * to prevent crashes from malformed AI output.
 */

import { z } from 'zod';
import { CriterionSchema } from './backlog';

// Re-export for backwards compatibility
export { CriterionSchema };

// ============================================================
// SCHEMAS
// ============================================================

/**
 * Schema for refineItem response
 */
export const RefineResponseSchema = z.object({
  title: z.string(),
  userStory: z.string().nullable().optional(),
  specs: z.array(z.string()).optional(),
  criteria: z.array(CriterionSchema).optional(),
  suggestions: z.array(z.string()).optional(),
});

/**
 * Schema for generateItemFromDescription response
 */
export const GenerateItemResponseSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  userStory: z.string().nullable().optional(),
  specs: z.array(z.string()).optional().default([]),
  criteria: z.array(CriterionSchema).optional().default([]),
  suggestedType: z.enum(['BUG', 'CT', 'LT', 'AUTRE']).optional().default('CT'),
  suggestedPriority: z.enum(['Haute', 'Moyenne', 'Faible']).nullable().optional(),
  suggestedSeverity: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']).nullable().optional(),
  suggestedEffort: z.enum(['XS', 'S', 'M', 'L', 'XL']).nullable().optional(),
  suggestedModule: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
});

/**
 * Schema for suggestImprovements response
 */
export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string()),
});

// ============================================================
// TYPES (inferred from schemas)
// ============================================================

export type Criterion = z.infer<typeof CriterionSchema>;
export type RefineResponse = z.infer<typeof RefineResponseSchema>;
export type GenerateItemResponse = z.infer<typeof GenerateItemResponseSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Safely parse JSON and validate against a schema
 * @param json JSON string to parse
 * @param schema Zod schema to validate against
 * @returns Validated data or null if invalid
 */
export function safeParseAIResponse<T>(
  json: string,
  schema: z.ZodType<T>
): T | null {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.error('[AI] Validation error:', result.error.format());
    return null;
  } catch (error) {
    console.error('[AI] JSON parse error:', error);
    return null;
  }
}
