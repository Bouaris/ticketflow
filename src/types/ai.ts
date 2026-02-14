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
  dependencies: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
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
  suggestedType: z.string()
    .regex(/^[A-Z]+$/, 'Type must be uppercase letters only')
    .optional()
    .default('CT'),
  suggestedPriority: z.enum(['Haute', 'Moyenne', 'Faible']).nullable().optional(),
  suggestedSeverity: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']).nullable().optional(),
  suggestedEffort: z.enum(['XS', 'S', 'M', 'L', 'XL']).nullable().optional(),
  suggestedModule: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  dependencies: z.array(z.string()).optional().default([]),
  constraints: z.array(z.string()).optional().default([]),
});

/**
 * Schema for suggestImprovements response
 */
export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string()),
});

/**
 * Schema for backlog maintenance response
 */
export const MaintenanceIssueSchema = z.object({
  type: z.enum(['duplicate_id', 'missing_separator', 'malformed_section', 'fused_items', 'invalid_format']),
  description: z.string(),
  location: z.string().optional(),
  suggestion: z.string(),
});

export const MaintenanceResponseSchema = z.object({
  issues: z.array(MaintenanceIssueSchema),
  correctedMarkdown: z.string(),
  summary: z.string(),
});

// ============================================================
// BACKLOG ANALYSIS SCHEMAS (LT-002)
// ============================================================

/**
 * Priority score factors breakdown
 */
export const PriorityFactorsSchema = z.object({
  severity: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
  businessImpact: z.number().min(0).max(100),
});

/**
 * Individual item priority score from AI analysis
 */
export const ItemPriorityScoreSchema = z.object({
  itemId: z.string(),
  score: z.number().min(0).max(100),
  factors: PriorityFactorsSchema,
  rationale: z.string(),
  isBlocking: z.boolean().default(false),
  blockedBy: z.array(z.string()).optional(),
});

/**
 * Suggested item grouping from AI analysis
 */
export const ItemGroupSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  items: z.array(z.string()),
  rationale: z.string(),
  suggestedOrder: z.array(z.string()),
});

/**
 * Blocking bug identified by AI
 */
export const BlockingBugSchema = z.object({
  itemId: z.string(),
  severity: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  blocksCount: z.number(),
  recommendation: z.string(),
});

/**
 * Complete backlog analysis response from AI
 */
export const BacklogAnalysisResponseSchema = z.object({
  priorities: z.array(ItemPriorityScoreSchema),
  groups: z.array(ItemGroupSchema),
  blockingBugs: z.array(BlockingBugSchema),
  insights: z.array(z.string()),
  analyzedAt: z.number(),
});

/**
 * User decision on an AI suggestion
 */
export const SuggestionDecisionSchema = z.object({
  suggestionId: z.string(),
  decision: z.enum(['accepted', 'rejected', 'modified']),
  modifiedValue: z.unknown().optional(),
  decidedAt: z.number(),
});

// ============================================================
// QUESTIONING FLOW SCHEMAS (AI-06)
// ============================================================

/**
 * Schema for AI questioning flow response
 *
 * The AI returns its assessment of the user's description:
 * - "questioning": needs more info, includes clarifying questions
 * - "recap": confident enough to recap understanding before generation
 * - "ready": fully ready to generate (after user confirms recap)
 */
export const QuestioningResponseSchema = z.object({
  status: z.enum(['questioning', 'recap', 'ready']),
  questions: z.array(z.string()).optional().default([]),
  recap: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

// ============================================================
// CHAT RESPONSE SCHEMA (Phase 12)
// ============================================================

/**
 * Schema for AI chat response validation.
 *
 * The AI returns structured JSON with text, optional citations,
 * and an optional action for the UI to execute.
 */
export const ChatResponseSchema = z.object({
  text: z.string(),
  citations: z.array(z.string()).optional().default([]),
  action: z.object({
    type: z.enum(['update_item', 'filter', 'open_item', 'navigate', 'add_relation']),
    payload: z.record(z.string(), z.unknown()),
  }).nullable().optional(),
});

// ============================================================
// DEPENDENCY SUGGESTION SCHEMAS (AI-08)
// ============================================================

/**
 * Schema for a single dependency suggestion
 *
 * Represents a detected relationship between a new ticket
 * and an existing one in the backlog.
 */
export const DependencySuggestionSchema = z.object({
  targetId: z.string(),
  relationship: z.enum(['blocks', 'blocked-by', 'related-to', 'potential-duplicate']),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

/**
 * Schema for dependency detection AI response
 */
export const DependencySuggestionsResponseSchema = z.object({
  suggestions: z.array(DependencySuggestionSchema),
});

// ============================================================
// TYPES (inferred from schemas)
// ============================================================

export type Criterion = z.infer<typeof CriterionSchema>;
export type RefineResponse = z.infer<typeof RefineResponseSchema>;
export type GenerateItemResponse = z.infer<typeof GenerateItemResponseSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;
export type MaintenanceIssue = z.infer<typeof MaintenanceIssueSchema>;
export type MaintenanceResponse = z.infer<typeof MaintenanceResponseSchema>;

// Backlog Analysis Types (LT-002)
export type PriorityFactors = z.infer<typeof PriorityFactorsSchema>;
export type ItemPriorityScore = z.infer<typeof ItemPriorityScoreSchema>;
export type ItemGroup = z.infer<typeof ItemGroupSchema>;
export type BlockingBug = z.infer<typeof BlockingBugSchema>;
export type BacklogAnalysisResponse = z.infer<typeof BacklogAnalysisResponseSchema>;
export type SuggestionDecision = z.infer<typeof SuggestionDecisionSchema>;

// Chat Response Types (Phase 12)
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Questioning Flow Types (AI-06)
export type QuestioningResponse = z.infer<typeof QuestioningResponseSchema>;

// Dependency Suggestion Types (AI-08)
export type DependencySuggestion = z.infer<typeof DependencySuggestionSchema>;
export type DependencySuggestionsResponse = z.infer<typeof DependencySuggestionsResponseSchema>;

// ============================================================
// BULK IMPORT SCHEMAS (Phase 14)
// ============================================================

/**
 * Schema for bulk AI extraction response.
 * Wraps existing GenerateItemResponseSchema in an array for multi-ticket extraction.
 */
export const BulkGenerateResponseSchema = z.object({
  tickets: z.array(GenerateItemResponseSchema).min(1).max(100),
});

export type BulkGenerateResponse = z.infer<typeof BulkGenerateResponseSchema>;

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
