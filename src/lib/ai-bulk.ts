/**
 * AI Bulk Extraction - Multi-ticket generation from raw text/images
 *
 * Provides bulk import service layer for Phase 14.
 * Phase 15's wizard UI calls generateBulkItems() to extract tickets.
 *
 * @module lib/ai-bulk
 */

import type { AIProvider, ImageData, AIOptions } from './ai';
import { getEffectiveAIConfig, buildTypeClassificationSection, buildTypeEnum, generateCompletionWithRetry, resolveModelForProvider } from './ai';
import { BulkGenerateResponseSchema } from '../types/ai';
import { buildPromptWithContext } from './ai-context';
import { gatherDynamicContext, buildEnhancedPrompt } from './ai-context-dynamic';
import { recordTelemetry } from './ai-telemetry';
import { getCriteriaInstructions } from './ai-criteria';
import { getCurrentLocale, getTranslations } from '../i18n';
import { AI_CONFIG } from '../constants/config';

// ============================================================
// CONSTANTS
// ============================================================

/** Model token limits for bulk extraction validation */
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // Groq - Production
  'llama-3.3-70b-versatile': 32000,
  'llama-3.1-8b-instant': 8000,
  'openai/gpt-oss-120b': 131072,
  'openai/gpt-oss-20b': 131072,
  // Groq - Preview
  'meta-llama/llama-4-maverick-17b-128e-instruct': 131072,
  'meta-llama/llama-4-scout-17b-16e-instruct': 131072,
  'qwen/qwen3-32b': 131072,
  'moonshotai/kimi-k2-instruct-0905': 262144,
  // Gemini - Stable
  'gemini-2.5-flash': 1000000,
  'gemini-2.5-flash-lite': 1000000,
  'gemini-2.5-pro': 1000000,
  // Gemini - Preview
  'gemini-3-flash-preview': 1000000,
  'gemini-3-pro-preview': 1000000,
  // OpenAI - GPT-5
  'gpt-5': 400000,
  'gpt-5-mini': 400000,
  'gpt-5-nano': 400000,
  // OpenAI - GPT-4.1
  'gpt-4.1': 1047576,
  'gpt-4.1-mini': 1047576,
  'gpt-4.1-nano': 1047576,
  // OpenAI - GPT-4o
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  // OpenAI - Reasoning
  'o4-mini': 200000,
  'o3': 200000,
  'o3-mini': 200000,
};

const DEFAULT_TOKEN_LIMIT = 32000; // Conservative fallback

/** Maximum tickets per batch to prevent output token limit issues (4096 tokens fits ~15, leave margin) */
const MAX_TICKETS_PER_BATCH = 12;

/** Delay between chunk API calls to avoid rate limits (ms) */
const INTER_CHUNK_DELAY_MS = 3000;

/** Maximum retries for rate-limited chunk requests */
const CHUNK_MAX_RETRIES = 4;

/** Base delay for exponential backoff on rate limit retries (ms) */
const CHUNK_RETRY_BASE_DELAY_MS = 5000;

// ============================================================
// EXPORTED TYPES
// ============================================================

/**
 * A single ticket proposal from bulk extraction.
 * Uses temporary IDs (TEMP-001, TEMP-002) until user confirms.
 */
export interface BulkProposal {
  tempId: string;
  title: string;
  description?: string;
  userStory?: string;
  specs: string[];
  criteria: Array<{ text: string; checked: boolean }>;
  suggestedType: string;
  suggestedPriority?: string | null;
  suggestedSeverity?: string | null;
  suggestedEffort?: string | null;
  suggestedModule?: string | null;
  emoji?: string | null;
  dependencies: string[];
  constraints: string[];
}

/**
 * Result from bulk AI extraction.
 */
export interface BulkGenerationResult {
  success: boolean;
  proposals?: BulkProposal[];
  error?: string;
  metadata?: {
    totalExtracted: number;
    processingTimeMs: number;
    provider: AIProvider;
    modelId: string;
  };
}

// ============================================================
// PROVIDER CAPABILITY VALIDATION
// ============================================================

/**
 * Check if a provider supports image (vision) input.
 *
 * CRITICAL: Groq silently ignores images rather than erroring.
 * This check must happen BEFORE the API call.
 *
 * @param provider - AI provider to check
 * @returns true if provider supports images, false otherwise
 */
export function supportsVision(provider: AIProvider): boolean {
  return provider === 'gemini' || provider === 'openai';
}

// ============================================================
// TOKEN ESTIMATION
// ============================================================

/**
 * Estimate token count for bulk extraction request.
 *
 * Conservative estimation to prevent silent failures from exceeding
 * model context limits.
 *
 * @param text - Raw text input
 * @param images - Image data array
 * @returns Estimated token count
 */
export function estimateTokens(text: string, images: ImageData[]): number {
  // Text tokens: chars/4 heuristic (standard GPT tokenization approximation)
  const textTokens = Math.ceil(text.length / 4);

  // Image tokens: ~1700 tokens per image (GPT-4V standard resolution)
  const imageTokens = images.length * 1700;

  // Prompt overhead: system instructions, schema, examples (~500 tokens)
  const overhead = 500;

  return textTokens + imageTokens + overhead;
}

// ============================================================
// BULK EXTRACTION PROMPTS
// ============================================================

const BULK_EXTRACT_PROMPT_FR = `Tu es un Product Owner expert. Analyse le texte brut suivant et extrais TOUS les tickets distincts que tu identifies.

TEXTE BRUT:
{user_input}

{type_classification}

INSTRUCTIONS:
- Extrais chaque idee, feature, bug ou tache distincte comme un ticket separe
- Un ticket par preoccupation/fonctionnalite
- Si le texte decrit une seule chose, retourne un seul ticket
- Utilise les types disponibles: {type_enum}
{criteria_instructions}

REPONDS UNIQUEMENT avec ce JSON (aucun texte avant/apres):
{
  "tickets": [
    {
      "title": "...",
      "description": "...",
      "userStory": null ou "En tant que [X], je veux [Y] afin de [Z]",
      "specs": ["Spec 1", "Spec 2"],
      "criteria": [
        {"text": "Critere d'acceptation 1", "checked": false},
        {"text": "Critere d'acceptation 2", "checked": false}
      ],
      "suggestedType": "{type_enum}",
      "suggestedPriority": "Haute|Moyenne|Faible" ou null,
      "suggestedSeverity": "P0|P1|P2|P3|P4" ou null,
      "suggestedEffort": "XS|S|M|L|XL",
      "suggestedModule": "Module ou composant" ou null,
      "emoji": "emoji pertinent",
      "dependencies": ["Dependance 1"] ou [],
      "constraints": ["Contrainte 1"] ou []
    }
  ]
}`;

const BULK_EXTRACT_PROMPT_EN = `You are an expert Product Owner. Analyze the following raw text and extract ALL distinct tickets you identify.

RAW TEXT:
{user_input}

{type_classification}

INSTRUCTIONS:
- Extract each distinct idea, feature, bug or task as a separate ticket
- One ticket per concern/functionality
- If the text describes a single thing, return it as one ticket
- Use available types: {type_enum}
{criteria_instructions}

RESPOND ONLY with this JSON (no text before/after):
{
  "tickets": [
    {
      "title": "...",
      "description": "...",
      "userStory": null or "As a [X], I want [Y] so that [Z]",
      "specs": ["Spec 1", "Spec 2"],
      "criteria": [
        {"text": "Acceptance criterion 1", "checked": false},
        {"text": "Acceptance criterion 2", "checked": false}
      ],
      "suggestedType": "{type_enum}",
      "suggestedPriority": "Haute|Moyenne|Faible" or null,
      "suggestedSeverity": "P0|P1|P2|P3|P4" or null,
      "suggestedEffort": "XS|S|M|L|XL",
      "suggestedModule": "Module or component" or null,
      "emoji": "relevant emoji",
      "dependencies": ["Dependency 1"] or [],
      "constraints": ["Constraint 1"] or []
    }
  ]
}`;

function getBulkExtractPrompt(): string {
  return getCurrentLocale() === 'en' ? BULK_EXTRACT_PROMPT_EN : BULK_EXTRACT_PROMPT_FR;
}

// ============================================================
// TEXT CHUNKING FOR LARGE INPUTS
// ============================================================

/**
 * Detect if a line is a category header.
 *
 * Matches patterns:
 * - `bugs :` or `bugs:` (word followed by colon)
 * - `## Section Name` (markdown headers)
 * - `**Section Name**` or `**Section Name:**` (bold text as headers)
 * - `BUGS:`, `Court Terme:` (ALL CAPS or Title Case followed by colon)
 *
 * @param line - Trimmed line to check
 * @returns The header text if it's a category header, null otherwise
 */
function detectCategoryHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown headers: ## Section Name
  const mdHeaderMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
  if (mdHeaderMatch) return mdHeaderMatch[1].trim();

  // Bold headers: **Section Name** or **Section Name:**
  const boldMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
  if (boldMatch) return boldMatch[1].trim();

  // Word(s) followed by colon: "bugs :" or "bugs:" or "Court Terme:" or "BUGS:"
  // Must be short (< 60 chars) and not look like a ticket line (no bullet/number prefix)
  if (/^[\s]*[-*•]\s/.test(trimmed) || /^[\s]*\d+[\.)]\s/.test(trimmed)) return null;
  const colonMatch = trimmed.match(/^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s]{0,58})\s*:\s*$/);
  if (colonMatch) return colonMatch[1].trim();

  return null;
}

/**
 * Split raw text input into logical chunks for batched processing.
 *
 * Strategy:
 * 1. Detect category headers and group items under them
 * 2. Keep items under the same header together in the same chunk
 * 3. Prefix each chunk with its header text so AI knows the category context
 * 4. Fall back to line-based splitting if no categories detected
 *
 * @param text - Raw user input
 * @param maxChunks - Maximum number of chunks to create
 * @returns Array of text chunks (each may have a category prefix)
 */
function splitTextIntoChunks(text: string, maxChunks: number = 5): string[] {
  const lines = text.split('\n').filter(line => line.trim());

  // If text is short enough, don't chunk
  if (lines.length <= MAX_TICKETS_PER_BATCH) {
    return [text];
  }

  // --- Phase 1: Detect category groups ---
  interface CategoryGroup {
    header: string | null;
    items: string[];
  }

  const groups: CategoryGroup[] = [];
  let currentGroup: CategoryGroup = { header: null, items: [] };

  for (const line of lines) {
    const header = detectCategoryHeader(line);
    if (header) {
      // Save previous group if it has items
      if (currentGroup.items.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = { header, items: [] };
    } else {
      currentGroup.items.push(line);
    }
  }
  // Push final group
  if (currentGroup.items.length > 0) {
    groups.push(currentGroup);
  }

  // --- Phase 2: Build chunks from groups ---
  // If categories were detected (>1 group or single group with header), use category-aware chunking
  const hasCategoryHeaders = groups.some(g => g.header !== null);

  if (hasCategoryHeaders) {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentChunkItemCount = 0;

    for (const group of groups) {
      // If adding this group would exceed batch size AND current chunk is non-empty, flush
      if (currentChunkItemCount > 0 && currentChunkItemCount + group.items.length > MAX_TICKETS_PER_BATCH) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentChunkItemCount = 0;
      }

      // Add category header as context prefix
      if (group.header) {
        currentChunk.push(`[Category: ${group.header}]`);
      }
      currentChunk.push(...group.items);
      currentChunkItemCount += group.items.length;

      // If this group alone exceeds batch size, flush immediately
      if (currentChunkItemCount >= MAX_TICKETS_PER_BATCH) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentChunkItemCount = 0;
      }
    }

    // Flush remaining
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks.slice(0, maxChunks);
  }

  // --- Fallback: delimiter-based or line-based splitting ---
  const bulletPattern = /^[\s]*[-*•]\s/;
  const numberPattern = /^[\s]*\d+[\.)]\s/;
  const headerPattern = /^#+\s/;

  const delimitedLines = lines.filter(line =>
    bulletPattern.test(line) || numberPattern.test(line) || headerPattern.test(line)
  );

  // If we found natural delimiters, use them for chunking
  if (delimitedLines.length > MAX_TICKETS_PER_BATCH) {
    const chunks: string[] = [];
    const chunkSize = Math.ceil(delimitedLines.length / maxChunks);

    for (let i = 0; i < delimitedLines.length; i += chunkSize) {
      const chunkLines = delimitedLines.slice(i, i + chunkSize);
      chunks.push(chunkLines.join('\n'));
    }

    return chunks.slice(0, maxChunks);
  }

  // Fallback: split by line count
  const chunks: string[] = [];
  const chunkSize = Math.ceil(lines.length / maxChunks);

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunkLines = lines.slice(i, i + chunkSize);
    chunks.push(chunkLines.join('\n'));
  }

  return chunks.slice(0, maxChunks);
}

/**
 * Estimate how many tickets the text might contain.
 * Used to decide whether to chunk the input.
 *
 * @param text - Raw user input
 * @returns Estimated ticket count
 */
function estimateTicketCount(text: string): number {
  const lines = text.split('\n').filter(line => line.trim());

  // Count lines that look like ticket headers
  const bulletPattern = /^[\s]*[-*•]\s/;
  const numberPattern = /^[\s]*\d+[\.)]\s/;
  const headerPattern = /^#+\s/;

  const headerLines = lines.filter(line =>
    bulletPattern.test(line) || numberPattern.test(line) || headerPattern.test(line)
  );

  // If no clear headers, assume 1 ticket per 3-5 lines
  return headerLines.length > 0 ? headerLines.length : Math.ceil(lines.length / 4);
}

// ============================================================
// RATE LIMIT DETECTION FOR CHUNK RETRIES
// ============================================================

/**
 * Check if an error (thrown) is a rate-limit error (429 or similar).
 */
function isChunkRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return isRateLimitMessage(msg) || (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 429);
}

/**
 * Check if a result error message indicates a rate-limit error.
 * Used to detect rate limits returned as { success: false, error: "..." }
 * instead of thrown exceptions.
 */
function isRateLimitMessage(msg: string): boolean {
  if (/\b429\b/i.test(msg)) return true;
  if (/rate.?limit/i.test(msg)) return true;
  if (/resource.?exhausted/i.test(msg)) return true;
  if (/too.?many.?requests/i.test(msg)) return true;
  if (/limit.*atteinte/i.test(msg)) return true;
  if (/attendez/i.test(msg)) return true;
  return false;
}

// ============================================================
// BULK GENERATION
// ============================================================

/**
 * Generate multiple ticket proposals from raw text/image input.
 *
 * Main entry point for bulk AI extraction. Called by Phase 15 wizard UI.
 *
 * @param description - Raw user input (text description)
 * @param options - AI options including projectPath, provider, images, items, typeConfigs
 * @param onProgress - Optional progress callback (current chunk, total chunks)
 * @returns BulkGenerationResult with proposals or error
 */
export async function generateBulkItems(
  description: string,
  options?: AIOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<BulkGenerationResult> {
  const startTime = Date.now();
  const t = getTranslations();

  // Get effective AI config (project-specific or global)
  const { provider } = getEffectiveAIConfig(options?.projectPath);
  const effectiveProvider = options?.provider || provider;
  const modelId = resolveModelForProvider(effectiveProvider);

  try {
    // VALIDATE: Provider vision capability (if images provided)
    if (options?.images && options.images.length > 0 && !supportsVision(effectiveProvider)) {
      return {
        success: false,
        error: t.aiErrors.providerNoVision.replace('{provider}', effectiveProvider),
      };
    }

    // VALIDATE: Token limits
    const estimated = estimateTokens(description, options?.images || []);
    const limit = MODEL_TOKEN_LIMITS[modelId] || DEFAULT_TOKEN_LIMIT;

    // 80% threshold for safety margin (allow room for response tokens)
    if (estimated > limit * 0.8) {
      return {
        success: false,
        error: t.aiErrors.tokenLimitExceeded
          .replace('{estimated}', String(estimated))
          .replace('{limit}', String(limit)),
      };
    }

    // CHUNKING STRATEGY: If estimated ticket count is high, split into batches
    const estimatedTickets = estimateTicketCount(description);
    const needsChunking = estimatedTickets > MAX_TICKETS_PER_BATCH;

    if (needsChunking && !options?.images) {
      // Split text into chunks (images not supported with chunking)
      const chunks = splitTextIntoChunks(description, Math.ceil(estimatedTickets / MAX_TICKETS_PER_BATCH));
      const allProposals: BulkProposal[] = [];

      // Process each chunk sequentially with inter-chunk delay and retry logic
      for (let i = 0; i < chunks.length; i++) {
        // Report progress
        onProgress?.(i + 1, chunks.length);

        // Inter-chunk delay (skip before first chunk)
        if (i > 0) {
          await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
        }

        // Retry with exponential backoff on rate limit errors.
        // Handles BOTH thrown errors AND returned { success: false } results
        // (generateCompletionWithRetry catches 429s and returns them as results).
        let chunkResult: BulkGenerationResult | null = null;
        for (let retry = 0; retry <= CHUNK_MAX_RETRIES; retry++) {
          try {
            chunkResult = await generateBulkItemsSingleRequest(chunks[i], {
              ...options,
              images: undefined, // No images in chunked requests
            });

            // Check if the result is a rate-limit error returned as { success: false }
            if (!chunkResult.success && chunkResult.error && isRateLimitMessage(chunkResult.error)) {
              if (retry < CHUNK_MAX_RETRIES) {
                const backoffMs = CHUNK_RETRY_BASE_DELAY_MS * Math.pow(2, retry);
                await new Promise(r => setTimeout(r, backoffMs));
                continue; // Retry this chunk
              }
              // All retries exhausted — fall through to error handling below
            } else {
              break; // Not a rate-limit issue, exit retry loop
            }
          } catch (err) {
            if (isChunkRateLimitError(err) && retry < CHUNK_MAX_RETRIES) {
              const backoffMs = CHUNK_RETRY_BASE_DELAY_MS * Math.pow(2, retry);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            }
            throw err; // Non-rate-limit error or retries exhausted
          }
        }

        if (!chunkResult || !chunkResult.success) {
          // If any chunk fails after retries, return the error
          return chunkResult || { success: false, error: t.aiErrors.bulkExtractionFailed.replace('{error}', 'chunk processing failed') };
        }

        if (chunkResult.proposals) {
          // Renumber temp IDs to be sequential across chunks
          const renumbered = chunkResult.proposals.map((p, idx) => ({
            ...p,
            tempId: `TEMP-${String(allProposals.length + idx + 1).padStart(3, '0')}`,
          }));
          allProposals.push(...renumbered);
        }
      }

      return {
        success: true,
        proposals: allProposals,
        metadata: {
          totalExtracted: allProposals.length,
          processingTimeMs: Date.now() - startTime,
          provider: effectiveProvider,
          modelId,
        },
      };
    }

    // Single request (no chunking needed or images provided)
    return generateBulkItemsSingleRequest(description, options);
  } catch (error) {
    // Record failure telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'bulk_generate',
        provider: effectiveProvider,
        model: modelId,
        success: false,
        errorType: 'unknown',
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      });
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: t.aiErrors.bulkExtractionFailed.replace('{error}', errorMsg),
    };
  }
}

/**
 * Generate bulk items from a single AI request (internal helper).
 * Used by generateBulkItems for both single and chunked requests.
 */
async function generateBulkItemsSingleRequest(
  description: string,
  options?: AIOptions
): Promise<BulkGenerationResult> {
  const startTime = Date.now();
  const t = getTranslations();

  // Get effective AI config
  const { provider } = getEffectiveAIConfig(options?.projectPath);
  const effectiveProvider = options?.provider || provider;
  const modelId = resolveModelForProvider(effectiveProvider);

  try {

    // BUILD: Base prompt with type classification and criteria instructions
    let basePrompt = getBulkExtractPrompt()
      .replace('{user_input}', description)
      .replace('{type_classification}', buildTypeClassificationSection(options?.availableTypes))
      .replace('{type_enum}', buildTypeEnum(options?.availableTypes))
      .replace('{criteria_instructions}', getCriteriaInstructions());

    // ENHANCE: Apply dynamic context (few-shot examples) if items available
    let enhancedPrompt = basePrompt;
    if (options?.items && options.items.length > 0) {
      const context = await gatherDynamicContext({
        query: description,
        items: options.items,
        typeConfigs: options.typeConfigs || options.availableTypes || [],
        fewShotCount: 3,
        moduleContextCount: 5,
      });
      enhancedPrompt = buildEnhancedPrompt(basePrompt, context);
    }

    // ADD: Static context (CLAUDE.md, AGENTS.md, GSD planning)
    const prompt = await buildPromptWithContext(enhancedPrompt, options);

    // CALL: AI with retry and validation (use higher token limit for bulk)
    const result = await generateCompletionWithRetry(
      prompt,
      BulkGenerateResponseSchema,
      { provider: effectiveProvider, modelId, images: options?.images, maxTokens: AI_CONFIG.BULK_MAX_TOKENS }
    );

    // RECORD: Telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'bulk_generate',
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

    // TRANSFORM: AI response to BulkProposal[]
    const proposals: BulkProposal[] = result.data.tickets.map((ticket: any, index: number) => ({
      tempId: `TEMP-${String(index + 1).padStart(3, '0')}`,
      title: ticket.title,
      description: ticket.description || undefined,
      userStory: ticket.userStory || undefined,
      specs: ticket.specs || [],
      criteria: ticket.criteria || [],
      suggestedType: ticket.suggestedType || 'CT',
      suggestedPriority: ticket.suggestedPriority,
      suggestedSeverity: ticket.suggestedSeverity,
      suggestedEffort: ticket.suggestedEffort,
      suggestedModule: ticket.suggestedModule,
      emoji: ticket.emoji,
      dependencies: ticket.dependencies || [],
      constraints: ticket.constraints || [],
    }));

    // VALIDATE: Empty extraction
    if (proposals.length === 0) {
      return { success: false, error: t.aiErrors.bulkExtractionEmpty };
    }

    return {
      success: true,
      proposals,
      metadata: {
        totalExtracted: proposals.length,
        processingTimeMs: Date.now() - startTime,
        provider: effectiveProvider,
        modelId,
      },
    };
  } catch (error) {
    // Record failure telemetry
    if (options?.projectId) {
      await recordTelemetry({
        projectId: options.projectId,
        operation: 'bulk_generate',
        provider: effectiveProvider,
        model: modelId,
        success: false,
        errorType: 'unknown',
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      });
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: t.aiErrors.bulkExtractionFailed.replace('{error}', errorMsg),
    };
  }
}
