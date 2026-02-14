/**
 * AI Chat Engine - Multi-turn conversation with backlog context
 *
 * Assembles backlog context into system prompts, manages conversation history,
 * and parses structured responses. Built on top of generateChatCompletion.
 *
 * @module lib/ai-chat
 */

import type { BacklogItem } from '../types/backlog';
import type { ChatAction, ProactiveSuggestion } from '../types/chat';
import type { RelationType } from '../types/relations';
import { ChatResponseSchema, safeParseAIResponse } from '../types/ai';
import {
  generateChatCompletion,
  getEffectiveAIConfig,
  type ChatCompletionMessage,
} from './ai';
import {
  getChatMessages,
  insertChatMessage,
  trimChatMessages,
} from '../db/queries/chat';
import { recordTelemetry } from './ai-telemetry';

// ============================================================
// BACKLOG SUMMARY BUILDER
// ============================================================

/**
 * Build a compact one-line-per-item summary of the backlog.
 * Used to inject context into the system prompt without exceeding token limits.
 *
 * Format: ID | TYPE | Title | P:priority E:effort | done/total done
 *
 * @param items - Current backlog items
 * @returns Compact text summary (capped at 100 items)
 */
export function buildBacklogSummary(items: BacklogItem[]): string {
  const capped = items.slice(0, 100);
  const lines = capped.map(item => {
    const meta: string[] = [];
    if (item.priority) meta.push(`P:${item.priority}`);
    if (item.effort) meta.push(`E:${item.effort}`);
    if (item.severity) meta.push(`S:${item.severity}`);

    const criteriaCount = item.criteria?.length ?? 0;
    const doneCount = item.criteria?.filter(c => c.checked).length ?? 0;
    const progress = criteriaCount > 0 ? ` | ${doneCount}/${criteriaCount} done` : '';

    return `${item.id} | ${item.type} | ${item.title} | ${meta.join(' ')}${progress}`;
  });

  if (items.length > 100) {
    lines.push(`... and ${items.length - 100} more items`);
  }

  return lines.join('\n');
}

// ============================================================
// SYSTEM PROMPT BUILDER
// ============================================================

const SYSTEM_PROMPT_FR = `Tu es un assistant expert en gestion de Product Backlog pour TicketFlow.
Tu aides l'utilisateur a analyser, organiser et ameliorer son backlog.

REGLES:
1. Reponds TOUJOURS en JSON avec ce format exact: {"text": "ta reponse", "citations": ["ID-001", "ID-002"], "action": null}
2. Cite les IDs specifiques des items quand tu les mentionnes (dans le champ citations)
3. Reponds dans la langue de l'utilisateur
4. Sois concis et actionnable
5. Si tu suggeres une action UI, utilise le champ action avec un des types suivants:
   - {"type": "update_item", "payload": {"itemId": "ID-001", "field": "priority"|"effort"|"severity", "value": "..."}}
   - {"type": "add_relation", "payload": {"sourceId": "ID-001", "targetId": "ID-002", "relationType": "blocks"|"blocked-by"|"related-to", "reason": "..."}}
   - {"type": "open_item", "payload": {"itemId": "ID-001"}}
   - {"type": "filter", "payload": {...}}
   - {"type": "navigate", "payload": {...}}
6. Si aucune action n'est pertinente, mets action a null
7. Pour creer des dependances entre tickets, utilise TOUJOURS le type "add_relation". Pour plusieurs dependances, reponds avec une action a la fois et demande confirmation pour la suivante.

BACKLOG ACTUEL:
{backlog_summary}

Reponds UNIQUEMENT avec le JSON, sans texte avant ni apres.`;

const SYSTEM_PROMPT_EN = `You are an expert Product Backlog management assistant for TicketFlow.
You help the user analyze, organize, and improve their backlog.

RULES:
1. ALWAYS respond in JSON with this exact format: {"text": "your response", "citations": ["ID-001", "ID-002"], "action": null}
2. Cite specific item IDs when you mention them (in the citations field)
3. Respond in the user's language
4. Be concise and actionable
5. If you suggest a UI action, use the action field with one of these types:
   - {"type": "update_item", "payload": {"itemId": "ID-001", "field": "priority"|"effort"|"severity", "value": "..."}}
   - {"type": "add_relation", "payload": {"sourceId": "ID-001", "targetId": "ID-002", "relationType": "blocks"|"blocked-by"|"related-to", "reason": "..."}}
   - {"type": "open_item", "payload": {"itemId": "ID-001"}}
   - {"type": "filter", "payload": {...}}
   - {"type": "navigate", "payload": {...}}
6. If no action is relevant, set action to null
7. To create dependencies between tickets, ALWAYS use the "add_relation" type. For multiple dependencies, respond with one action at a time and ask for confirmation before the next.

CURRENT BACKLOG:
{backlog_summary}

Respond ONLY with JSON, no text before or after.`;

/**
 * Build the system prompt with backlog context injected.
 *
 * @param items - Current backlog items for context
 * @param locale - Language for prompt instructions
 * @returns Complete system prompt string
 */
export function buildChatSystemPrompt(
  items: BacklogItem[],
  locale: 'fr' | 'en'
): string {
  const summary = buildBacklogSummary(items);
  const template = locale === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
  return template.replace('{backlog_summary}', summary);
}

// ============================================================
// SEND CHAT MESSAGE
// ============================================================

interface SendChatMessageParams {
  projectPath: string;
  projectId: number;
  userMessage: string;
  items: BacklogItem[];
  locale: 'fr' | 'en';
  signal?: AbortSignal;
}

interface SendChatMessageResult {
  text: string;
  citations: string[];
  action: ChatAction | null;
}

/**
 * Send a user message and get an AI response with backlog context.
 *
 * 1. Loads recent chat history from SQLite
 * 2. Builds system prompt with backlog context
 * 3. Assembles multi-turn messages array
 * 4. Persists user message to SQLite
 * 5. Calls generateChatCompletion
 * 6. Parses structured response via ChatResponseSchema
 * 7. Persists assistant response to SQLite
 * 8. Auto-trims old messages
 * 9. Records telemetry
 *
 * @param params - Chat message parameters
 * @returns Parsed response with text, citations, and optional action
 */
export async function sendChatMessage(
  params: SendChatMessageParams
): Promise<SendChatMessageResult> {
  const { projectPath, projectId, userMessage, items, locale, signal } = params;
  const startTime = Date.now();

  // Check if already aborted
  if (signal?.aborted) {
    throw new Error('Chat request aborted');
  }

  // 1. Load recent chat history (last 20 messages for context window)
  const history = await getChatMessages(projectPath, projectId, 20);

  // 2. Build system prompt with backlog context
  const systemPrompt = buildChatSystemPrompt(items, locale);

  // 3. Assemble messages array: system + history + new user message
  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  // 4. Persist user message to SQLite
  await insertChatMessage(projectPath, projectId, 'user', userMessage);

  // 5. Get effective AI config
  const { provider, modelId } = getEffectiveAIConfig(projectPath);

  // Check abort before AI call
  if (signal?.aborted) {
    throw new Error('Chat request aborted');
  }

  let rawResponse: string;
  try {
    // 6. Call multi-turn chat completion
    rawResponse = await generateChatCompletion(messages, { provider, modelId });
  } catch (error) {
    // Record failure telemetry
    await recordTelemetry({
      projectId,
      operation: 'chat',
      provider,
      model: modelId,
      success: false,
      errorType: error instanceof Error && error.message.includes('network')
        ? 'network'
        : 'unknown',
      retryCount: 0,
      latencyMs: Date.now() - startTime,
    });
    throw error;
  }

  // Check abort after AI call
  if (signal?.aborted) {
    throw new Error('Chat request aborted');
  }

  // 7. Parse structured response
  let text: string;
  let citations: string[] = [];
  let action: ChatAction | null = null;

  // Try to extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : rawResponse;

  const parsed = safeParseAIResponse(jsonString, ChatResponseSchema);
  if (parsed) {
    text = parsed.text;
    citations = parsed.citations ?? [];
    action = parsed.action ?? null;
  } else {
    // Fallback: treat raw text as response with no citations/action
    text = rawResponse.trim();
    citations = [];
    action = null;
  }

  // 8. Persist assistant response to SQLite
  await insertChatMessage(
    projectPath,
    projectId,
    'assistant',
    text,
    citations.length > 0 ? citations : undefined,
    action ?? undefined
  );

  // 9. Auto-trim old messages (keep max 200)
  await trimChatMessages(projectPath, projectId, 200);

  // 10. Record telemetry
  await recordTelemetry({
    projectId,
    operation: 'chat',
    provider,
    model: modelId,
    success: true,
    retryCount: 0,
    latencyMs: Date.now() - startTime,
  });

  return { text, citations, action };
}

// ============================================================
// PROACTIVE SUGGESTIONS ENGINE
// ============================================================

/**
 * Analyze the backlog locally (no AI call) and return actionable insights.
 *
 * Checks 5 rules against the items array and returns the most relevant
 * suggestions, capped at 3, sorted by severity (warnings first).
 *
 * @param items - Current backlog items
 * @param locale - Language for suggestion messages
 * @returns Array of up to 3 ProactiveSuggestion
 */
export function analyzeBacklogForSuggestions(
  items: BacklogItem[],
  locale: 'fr' | 'en'
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];

  // 1. Bugs without effort estimate
  const bugsNoEffort = items.filter(i => i.type === 'BUG' && !i.effort);
  if (bugsNoEffort.length > 0) {
    const count = bugsNoEffort.length;
    suggestions.push({
      id: 'bugs-no-effort',
      message: locale === 'fr'
        ? `${count} bug(s) n'ont pas d'estimation d'effort`
        : `${count} bug(s) have no effort estimate`,
      severity: 'warning',
      relatedItems: bugsNoEffort.slice(0, 5).map(i => i.id),
    });
  }

  // 2. Items without acceptance criteria
  const noCriteria = items.filter(i => !i.criteria || i.criteria.length === 0);
  if (noCriteria.length >= 3) {
    const count = noCriteria.length;
    suggestions.push({
      id: 'missing-criteria',
      message: locale === 'fr'
        ? `${count} items n'ont aucun critere d'acceptation`
        : `${count} items have no acceptance criteria`,
      severity: 'info',
      relatedItems: noCriteria.slice(0, 5).map(i => i.id),
    });
  }

  // 3. Critical bugs (P0 or P1)
  const criticalBugs = items.filter(
    i => i.type === 'BUG' && (i.severity === 'P0' || i.severity === 'P1')
  );
  if (criticalBugs.length > 0) {
    const count = criticalBugs.length;
    suggestions.push({
      id: 'critical-bugs',
      message: locale === 'fr'
        ? `${count} bug(s) critique(s) (P0/P1) en attente`
        : `${count} critical bug(s) (P0/P1) pending`,
      severity: 'warning',
      relatedItems: criticalBugs.map(i => i.id),
    });
  }

  // 4. High-priority items without effort
  const highNoEffort = items.filter(i => i.priority === 'Haute' && !i.effort);
  if (highNoEffort.length > 0) {
    const count = highNoEffort.length;
    suggestions.push({
      id: 'high-priority-no-effort',
      message: locale === 'fr'
        ? `${count} item(s) haute priorite sans estimation`
        : `${count} high-priority item(s) without estimate`,
      severity: 'info',
      relatedItems: highNoEffort.slice(0, 5).map(i => i.id),
    });
  }

  // 5. Backlog size alert
  if (items.length > 50) {
    suggestions.push({
      id: 'backlog-large',
      message: locale === 'fr'
        ? `Backlog volumineux (${items.length} items) - envisagez un tri`
        : `Large backlog (${items.length} items) - consider grooming`,
      severity: 'info',
      relatedItems: [],
    });
  }

  // Sort: warnings first, then infos
  suggestions.sort((a, b) => {
    if (a.severity === 'warning' && b.severity === 'info') return -1;
    if (a.severity === 'info' && b.severity === 'warning') return 1;
    return 0;
  });

  // Cap at 3 suggestions
  return suggestions.slice(0, 3);
}

// ============================================================
// ACTION EXECUTION
// ============================================================

/** Allowed fields and their valid values for chat-based updates */
const ALLOWED_FIELDS: Record<string, string[]> = {
  priority: ['Haute', 'Moyenne', 'Faible'],
  effort: ['XS', 'S', 'M', 'L', 'XL'],
  severity: ['P0', 'P1', 'P2', 'P3', 'P4'],
};

export interface ActionExecutionResult {
  success: boolean;
  message: string;
}

export interface ActionExecutionContext {
  updateItem: (itemId: string, updates: Partial<BacklogItem>) => Promise<void>;
  openItem: (itemId: string) => void;
  addRelation?: (sourceId: string, targetId: string, relationType: RelationType, reason?: string) => Promise<void>;
  items: BacklogItem[];
}

/**
 * Execute a ChatAction safely.
 *
 * Supports:
 * - update_item: Safe field mutations (priority, effort, severity) on a single item
 * - open_item: Open an item in the detail panel
 * - add_relation: Create a dependency/relation between two items
 * - filter/navigate: Not yet supported
 *
 * NEVER allows delete or bulk operations. Validates field names and values
 * against allowlists.
 *
 * @param action - The action to execute
 * @param context - Callbacks and items for execution
 * @returns Result with success flag and human-readable message
 */
export async function executeChatAction(
  action: ChatAction,
  context: ActionExecutionContext
): Promise<ActionExecutionResult> {
  switch (action.type) {
    case 'update_item': {
      const { itemId, field, value } = action.payload as {
        itemId?: string;
        field?: string;
        value?: unknown;
      };

      if (!itemId || typeof itemId !== 'string') {
        return { success: false, message: 'Missing itemId in action payload' };
      }
      if (!field || typeof field !== 'string') {
        return { success: false, message: 'Missing field in action payload' };
      }

      // Validate field is in allowlist
      const allowedValues = ALLOWED_FIELDS[field];
      if (!allowedValues) {
        return {
          success: false,
          message: `Field "${field}" is not allowed. Only priority, effort, severity can be changed from chat.`,
        };
      }

      // Validate value (allow null to clear)
      if (value !== null && (typeof value !== 'string' || !allowedValues.includes(value))) {
        return {
          success: false,
          message: `Invalid value "${String(value)}" for field "${field}". Allowed: ${allowedValues.join(', ')}`,
        };
      }

      // Validate item exists
      const item = context.items.find(i => i.id === itemId);
      if (!item) {
        return { success: false, message: `Item ${itemId} not found` };
      }

      try {
        await context.updateItem(itemId, { [field]: value ?? undefined });
        return {
          success: true,
          message: `Updated ${itemId}: ${field} set to ${value ?? 'none'}`,
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to update ${itemId}: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    }

    case 'open_item': {
      const { itemId } = action.payload as { itemId?: string };

      if (!itemId || typeof itemId !== 'string') {
        return { success: false, message: 'Missing itemId in action payload' };
      }

      const item = context.items.find(i => i.id === itemId);
      if (!item) {
        return { success: false, message: `Item ${itemId} not found` };
      }

      context.openItem(itemId);
      return { success: true, message: `Opened ${itemId}` };
    }

    case 'add_relation': {
      const { sourceId, targetId, relationType, reason } = action.payload as {
        sourceId?: string;
        targetId?: string;
        relationType?: string;
        reason?: string;
      };

      if (!sourceId || typeof sourceId !== 'string') {
        return { success: false, message: 'Missing sourceId in add_relation payload' };
      }
      if (!targetId || typeof targetId !== 'string') {
        return { success: false, message: 'Missing targetId in add_relation payload' };
      }

      // Validate relation type
      const validRelationTypes: RelationType[] = ['blocks', 'blocked-by', 'related-to'];
      if (!relationType || !validRelationTypes.includes(relationType as RelationType)) {
        return {
          success: false,
          message: `Invalid relationType "${String(relationType)}". Allowed: ${validRelationTypes.join(', ')}`,
        };
      }

      // Validate both items exist
      const sourceItem = context.items.find(i => i.id === sourceId);
      if (!sourceItem) {
        return { success: false, message: `Source item ${sourceId} not found` };
      }
      const targetItem = context.items.find(i => i.id === targetId);
      if (!targetItem) {
        return { success: false, message: `Target item ${targetId} not found` };
      }

      // Check addRelation callback is available
      if (!context.addRelation) {
        return { success: false, message: 'Relation creation is not available in this context' };
      }

      try {
        await context.addRelation(sourceId, targetId, relationType as RelationType, reason);
        const relationLabel = relationType === 'blocks' ? 'blocks'
          : relationType === 'blocked-by' ? 'is blocked by'
          : 'is related to';
        return {
          success: true,
          message: `Relation created: ${sourceId} ${relationLabel} ${targetId}`,
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to create relation: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    }

    case 'filter':
      return { success: false, message: 'Filter actions not yet supported' };

    case 'navigate':
      return { success: false, message: 'Navigate actions not yet supported' };

    default:
      return { success: false, message: `Unknown action type: ${(action as ChatAction).type}` };
  }
}
