/**
 * AI Integration - Multi-provider support
 *
 * Supports: Groq (default, free), Gemini, OpenAI
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { BacklogItem } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';
import { STORAGE_KEYS } from '../constants/storage';
import { getCustomProviderApiKeyKey, getModelStorageKey } from '../constants/storage';
import { AI_CONFIG } from '../constants/config';
import { setSecureItem, getSecureItem, removeSecureItem, migrateToSecureStorage } from './secure-storage';
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
import { getProviderById } from './ai-provider-registry';
import type { ProviderConfig } from '../types/aiProvider';
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
import type { ZodType, ZodSchema } from 'zod';
import { isAbortError } from './abort';
import { track } from './telemetry';

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

// ============================================================
// TYPES
// ============================================================

export type AIProvider = 'groq' | 'gemini' | 'openai';

/** Extended provider ID that includes custom provider IDs */
export type ProviderId = string;

/** Base64-encoded image data for multimodal AI requests */
export interface ImageData {
  /** Base64-encoded image content (no data: prefix) */
  base64: string;
  /** MIME type (e.g. 'image/png', 'image/jpeg') */
  mimeType: string;
}

interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
}

// ============================================================
// CONFIG MANAGEMENT
// ============================================================

export function getProvider(): AIProvider {
  return (localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as AIProvider) || 'groq';
}

export function setProvider(provider: AIProvider): void {
  localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
}

function getApiKeyStorageKey(provider: string): string {
  switch (provider) {
    case 'groq': return STORAGE_KEYS.GROQ_API_KEY;
    case 'gemini': return STORAGE_KEYS.GEMINI_API_KEY;
    case 'openai': return STORAGE_KEYS.OPENAI_API_KEY;
    default: return getCustomProviderApiKeyKey(provider);
  }
}

export function getApiKey(provider?: string): string | null {
  const p = provider || getProvider();
  return getSecureItem(getApiKeyStorageKey(p));
}

export function setApiKey(key: string, provider?: string): void {
  const p = provider || getProvider();
  setSecureItem(getApiKeyStorageKey(p), key);
}

export function clearApiKey(provider?: string): void {
  const p = provider || getProvider();
  removeSecureItem(getApiKeyStorageKey(p));
}

/**
 * Initialize secure storage - migrate legacy plaintext keys
 * Call this once on app startup
 */
export function initSecureStorage(): void {
  migrateToSecureStorage([
    STORAGE_KEYS.GROQ_API_KEY,
    STORAGE_KEYS.GEMINI_API_KEY,
    STORAGE_KEYS.OPENAI_API_KEY,
  ]);
}

export function hasApiKey(provider?: string): boolean {
  return !!getApiKey(provider);
}

export function getClientConfig(overrideProvider?: string): AIClientConfig | null {
  const provider = overrideProvider || getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) return null;
  return { provider: provider as AIProvider, apiKey };
}

// ============================================================
// AI CLIENTS (singletons with API key change detection)
// ============================================================

// Groq and Gemini keep simple singleton (one instance each, keyed by apiKey)
let groqClient: Groq | null = null;
let groqClientKey: string | null = null;
let geminiClient: GoogleGenerativeAI | null = null;
let geminiClientKey: string | null = null;

// OpenAI-compatible clients: Map-based cache keyed by "apiKey::baseURL"
const openaiClientCache = new Map<string, OpenAI>();

function getOpenAICacheKey(apiKey: string, baseURL?: string): string {
  return baseURL ? `${apiKey}::${baseURL}` : apiKey;
}

function getGroqClient(apiKey: string): Groq {
  if (!groqClient || groqClientKey !== apiKey) {
    groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    groqClientKey = apiKey;
  }
  return groqClient;
}

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!geminiClient || geminiClientKey !== apiKey) {
    geminiClient = new GoogleGenerativeAI(apiKey);
    geminiClientKey = apiKey;
  }
  return geminiClient;
}

function getOpenAIClient(apiKey: string, baseURL?: string): OpenAI {
  const cacheKey = getOpenAICacheKey(apiKey, baseURL);
  if (!openaiClientCache.has(cacheKey)) {
    openaiClientCache.set(cacheKey, new OpenAI({
      apiKey,
      ...(baseURL && { baseURL }),
      dangerouslyAllowBrowser: true,
    }));
  }
  return openaiClientCache.get(cacheKey)!;
}

/**
 * Reset AI client singletons and their tracked keys.
 * Forces recreation on next usage.
 *
 * @param providerId - Optional: clear only a specific provider's cache.
 *   If omitted, clears all caches.
 */
export function resetClient(providerId?: string): void {
  if (!providerId) {
    // Clear all caches
    groqClient = null;
    geminiClient = null;
    openaiClientCache.clear();
    groqClientKey = null;
    geminiClientKey = null;
    return;
  }

  if (providerId === 'groq') {
    groqClient = null;
    groqClientKey = null;
  } else if (providerId === 'gemini') {
    geminiClient = null;
    geminiClientKey = null;
  } else {
    // Clear specific openai-compatible provider entries
    const providerConfig = getProviderById(providerId);
    if (providerConfig) {
      for (const [key] of openaiClientCache) {
        if (providerConfig.baseURL && key.endsWith(`::${providerConfig.baseURL}`)) {
          openaiClientCache.delete(key);
        } else if (!providerConfig.baseURL && !key.includes('::')) {
          openaiClientCache.delete(key);
        }
      }
    } else {
      // Unknown provider -- clear all openai cache as safety measure
      openaiClientCache.clear();
    }
  }
}

// ============================================================
// AI CONFIGURATION
// ============================================================

/**
 * Get user's selected model for a provider from localStorage.
 * Returns null if no selection persisted (use provider default).
 */
export function getSelectedModel(providerId: string): string | null {
  return localStorage.getItem(getModelStorageKey(providerId));
}

/**
 * Persist user's selected model for a provider.
 */
export function setSelectedModel(providerId: string, modelId: string): void {
  localStorage.setItem(getModelStorageKey(providerId), modelId);
}

/**
 * Get effective AI configuration.
 * Uses global settings only (project-level config removed in v2.1).
 */
export function getEffectiveAIConfig(): {
  provider: AIProvider;
  modelId: string;
} {
  const globalProvider = getProvider();
  const providerConfig = getProviderById(globalProvider);

  // Read persisted model selection, falling back to provider default
  const selectedModel = getSelectedModel(globalProvider);
  const defaultModel = providerConfig?.defaultModel
    ?? (globalProvider === 'groq' ? AI_CONFIG.GROQ_MODEL
      : globalProvider === 'gemini' ? AI_CONFIG.GEMINI_MODEL
      : AI_CONFIG.OPENAI_MODEL);

  return {
    provider: globalProvider,
    modelId: selectedModel || defaultModel,
  };
}

/**
 * Resolve the correct model ID for a given provider.
 * Uses: persisted user selection > provider's defaultModel > hardcoded fallback.
 * This is the authoritative model resolution -- use when provider may be overridden.
 */
export function resolveModelForProvider(providerId: string): string {
  const selected = getSelectedModel(providerId);
  if (selected) return selected;

  const providerConfig = getProviderById(providerId);
  if (providerConfig?.defaultModel) return providerConfig.defaultModel;

  // Ultimate fallback for unknown/deleted providers
  if (providerId === 'groq') return AI_CONFIG.GROQ_MODEL;
  if (providerId === 'gemini') return AI_CONFIG.GEMINI_MODEL;
  return AI_CONFIG.OPENAI_MODEL;
}

/**
 * Get display name for a provider.
 * Uses the registry for known providers, falls back to capitalizing the ID.
 */
export function getProviderDisplayName(provider: string): string {
  const config = getProviderById(provider);
  if (config) return config.name;
  // Fallback for unknown providers
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

// ============================================================
// UNIFIED COMPLETION API
// ============================================================

interface CompletionOptions {
  provider?: string;
  modelId?: string;
  /** Optional Zod schema for structured output (provider-native when supported) */
  schema?: ZodType;
  /** Base64-encoded images for multimodal requests (Gemini/OpenAI only) */
  images?: ImageData[];
  /** Override max_tokens for this request (defaults to AI_CONFIG.MAX_TOKENS) */
  maxTokens?: number;
  /** Enable cancellation of in-flight requests */
  signal?: AbortSignal;
}

/**
 * Helper: race a promise against an abort signal.
 * Used for Gemini SDK which doesn't natively support AbortSignal.
 */
async function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }),
  ]);
}

async function generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
  const providerId = options?.provider || getProvider();
  const config = getClientConfig(providerId);
  if (!config) {
    const t = getTranslations();
    throw new Error(`${getProviderDisplayName(providerId)} ${t.aiErrors.apiKeyNotConfigured}`);
  }

  // Resolve provider type from registry
  const providerDef: ProviderConfig | null = getProviderById(providerId);
  const providerType = providerDef?.type ?? providerId; // fallback to ID as type for built-ins

  const modelId = options?.modelId || (
    providerDef?.defaultModel
    ?? (providerId === 'groq' ? AI_CONFIG.GROQ_MODEL
      : providerId === 'gemini' ? AI_CONFIG.GEMINI_MODEL
      : AI_CONFIG.OPENAI_MODEL)
  );

  // Check structured output support when schema is provided
  const structuredMode = options?.schema
    ? getStructuredOutputMode(providerId, modelId)
    : 'none';
  const jsonSchema = options?.schema && structuredMode !== 'none'
    ? zodToSimpleJsonSchema(options.schema)
    : null;

  if (providerType === 'groq') {
    const client = getGroqClient(config.apiKey);

    // Build base request - stream: false ensures we get ChatCompletion not Stream
    const baseRequest = {
      model: modelId,
      messages: [{ role: 'user' as const, content: prompt }],
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: options?.maxTokens ?? AI_CONFIG.MAX_TOKENS,
      stream: false as const,
    };

    // Add structured output if supported
    const request = jsonSchema && (structuredMode === 'strict' || structuredMode === 'bestEffort')
      ? {
          ...baseRequest,
          response_format: {
            type: 'json_schema' as const,
            json_schema: {
              name: 'ai_response',
              strict: structuredMode === 'strict',
              schema: jsonSchema as Record<string, unknown>,
            },
          },
        }
      : baseRequest;

    const response = await client.chat.completions.create(
      request,
      options?.signal ? { signal: options.signal } : undefined
    );
    return response.choices[0]?.message?.content || '';

  } else if (providerType === 'gemini') {
    const client = getGeminiClient(config.apiKey);

    // Gemini uses a different schema format (SchemaType enum) - we use JSON mode only
    // Full responseSchema support would require converting to Gemini's Schema type
    const generationConfig = jsonSchema && structuredMode === 'schema'
      ? { responseMimeType: 'application/json' as const }
      : undefined;

    const model = client.getGenerativeModel({
      model: modelId,
      ...(generationConfig && { generationConfig }),
    });

    // Multimodal: send images as inlineData parts alongside text
    if (options?.images && options.images.length > 0) {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
        ...options.images.map(img => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        })),
      ];
      const result = await withAbortSignal(
        model.generateContent({ contents: [{ role: 'user', parts }] }),
        options?.signal
      );
      return result.response.text();
    }

    const result = await withAbortSignal(
      model.generateContent(prompt),
      options?.signal
    );
    return result.response.text();

  } else {
    // OpenAI-compatible (built-in OpenAI + all custom providers)
    const client = getOpenAIClient(config.apiKey, providerDef?.baseURL);

    // Build message content: multimodal with image_url parts or plain text
    const messageContent = options?.images && options.images.length > 0
      ? [
          { type: 'text' as const, text: prompt },
          ...options.images.map(img => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
          })),
        ]
      : prompt;

    // Build base request - stream: false ensures we get ChatCompletion not Stream
    const baseRequest = {
      model: modelId,
      messages: [{ role: 'user' as const, content: messageContent }],
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: options?.maxTokens ?? AI_CONFIG.MAX_TOKENS,
      stream: false as const,
    };

    // Add structured output if supported (OpenAI strict mode)
    const request = jsonSchema && structuredMode === 'strict'
      ? {
          ...baseRequest,
          response_format: {
            type: 'json_schema' as const,
            json_schema: {
              name: 'ai_response',
              strict: true,
              schema: jsonSchema as Record<string, unknown>,
            },
          },
        }
      : baseRequest;

    const response = await client.chat.completions.create(
      request,
      options?.signal ? { signal: options.signal } : undefined
    );
    return response.choices[0]?.message?.content || '';
  }
}

// ============================================================
// MULTI-TURN CHAT COMPLETION API
// ============================================================

/**
 * A message in a multi-turn conversation.
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  provider?: string;
  modelId?: string;
  /** Override max_tokens for this request (defaults to AI_CONFIG.MAX_TOKENS) */
  maxTokens?: number;
  /** Enable cancellation of in-flight requests */
  signal?: AbortSignal;
}

/**
 * Generate a chat completion from a multi-turn conversation.
 *
 * Unlike generateCompletion (single prompt), this accepts a full messages array
 * with system, user, and assistant roles for multi-turn context.
 *
 * @param messages - Array of conversation messages
 * @param options - Provider and model configuration
 * @returns The assistant's response text
 */
export async function generateChatCompletion(
  messages: ChatCompletionMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  const providerId = options?.provider || getProvider();
  const config = getClientConfig(providerId);
  if (!config) {
    const t = getTranslations();
    throw new Error(`${getProviderDisplayName(providerId)} ${t.aiErrors.apiKeyNotConfigured}`);
  }

  // Resolve provider type from registry
  const providerDef: ProviderConfig | null = getProviderById(providerId);
  const providerType = providerDef?.type ?? providerId;

  const modelId = options?.modelId || (
    providerDef?.defaultModel
    ?? (providerId === 'groq' ? AI_CONFIG.GROQ_MODEL
      : providerId === 'gemini' ? AI_CONFIG.GEMINI_MODEL
      : AI_CONFIG.OPENAI_MODEL)
  );

  if (providerType === 'groq') {
    const client = getGroqClient(config.apiKey);
    const response = await client.chat.completions.create({
      model: modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: options?.maxTokens ?? AI_CONFIG.MAX_TOKENS,
      stream: false as const,
    }, options?.signal ? { signal: options.signal } : undefined);
    return response.choices[0]?.message?.content || '';

  } else if (providerType === 'gemini') {
    const client = getGeminiClient(config.apiKey);

    // Extract system instruction from messages
    const systemMessage = messages.find(m => m.role === 'system');
    const systemInstruction = systemMessage?.content || undefined;

    // Convert remaining messages to Gemini format
    // Gemini uses 'model' instead of 'assistant' for the AI role
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const model = client.getGenerativeModel({
      model: modelId,
      ...(systemInstruction && { systemInstruction }),
    });

    if (nonSystemMessages.length <= 1) {
      // Single message: use generateContent directly
      const lastContent = nonSystemMessages[nonSystemMessages.length - 1]?.content || '';
      const result = await withAbortSignal(
        model.generateContent(lastContent),
        options?.signal
      );
      return result.response.text();
    }

    // Multi-turn: use startChat with history
    const history = nonSystemMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    const result = await withAbortSignal(
      chat.sendMessage(lastMessage.content),
      options?.signal
    );
    return result.response.text();

  } else {
    // OpenAI-compatible (built-in OpenAI + all custom providers)
    const client = getOpenAIClient(config.apiKey, providerDef?.baseURL);
    const response = await client.chat.completions.create({
      model: modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: options?.maxTokens ?? AI_CONFIG.MAX_TOKENS,
      stream: false as const,
    }, options?.signal ? { signal: options.signal } : undefined);
    return response.choices[0]?.message?.content || '';
  }
}

/**
 * Check if an error is a rate-limit (429) that can be retried after a delay.
 */
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b429\b/.test(msg) || /resource.?exhausted/i.test(msg) || /too.?many.?requests/i.test(msg)) {
    return true;
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    if ((err as { status: number }).status === 429) return true;
  }
  return false;
}

/**
 * Check if an error is an auth (401/403) error that should not be retried.
 */
function isNonRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(401|403)\b/.test(msg) || /unauthorized|forbidden|invalid.*api.?key/i.test(msg)) {
    return true;
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 401 || status === 403) return true;
  }
  return false;
}

/**
 * Silently retry a function on 429 rate-limit errors with exponential backoff.
 * Keeps the loading spinner going — user sees no error until all retries exhausted.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 3000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry abort errors - propagate immediately
      if (isAbortError(err)) throw err;
      if (!isRateLimitError(err) || attempt === maxRetries) throw err;
      // Exponential backoff: 3s, 6s, 12s
      const backoffMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  throw lastError;
}

/**
 * Format an API error into a user-friendly message.
 */
function formatAPIError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const t = getTranslations();
  if (/\b429\b/.test(msg) || /resource.?exhausted/i.test(msg) || /too.?many.?requests/i.test(msg)) {
    return t.aiErrors.rateLimitReached;
  }
  if (/\b401\b/.test(msg) || /unauthorized/i.test(msg) || /invalid.*api.?key/i.test(msg)) {
    return t.aiErrors.invalidApiKey;
  }
  if (/\b403\b/.test(msg) || /forbidden/i.test(msg)) {
    return t.aiErrors.accessDenied;
  }
  return msg;
}

/**
 * Generate AI completion with structured output validation and retry.
 *
 * Attempts structured output first (if supported), then validates with Zod.
 * On validation failure, retries with error feedback.
 *
 * @param prompt - The prompt to send to the AI
 * @param schema - Zod schema for validation
 * @param options - Completion options (provider, model)
 * @returns Result with validated data or error
 */
export async function generateCompletionWithRetry<T>(
  prompt: string,
  schema: ZodSchema<T>,
  options?: Omit<CompletionOptions, 'schema'> & { images?: ImageData[] }
): Promise<RetryResult<T>> {
  // Check if already aborted
  if (options?.signal?.aborted) {
    return { success: false, error: 'Operation cancelled', retryCount: 0 };
  }

  // First try with structured output if available
  // 429 errors are silently retried (up to 2 retries, 3s apart) to avoid user-facing rate-limit errors
  try {
    const text = await withRateLimitRetry(
      () => generateCompletion(prompt, { ...options, schema, images: options?.images })
    );

    // Extract and validate JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return { success: true, data: result.data, retryCount: 0 };
      }
    }
  } catch (err) {
    // Don't retry on auth (401/403) errors - propagate immediately
    if (isNonRetryableError(err)) {
      return { success: false, error: formatAPIError(err), retryCount: 0 };
    }
    // Rate-limit exhausted all silent retries - propagate as error
    if (isRateLimitError(err)) {
      return { success: false, error: formatAPIError(err), retryCount: 0 };
    }
    // Other errors: fall through to retry
  }

  // Structured output failed or not available - use retry with error feedback
  // Note: images only sent on first attempt; retries use text-only prompt
  return generateWithRetry(
    prompt,
    schema,
    (p) => withRateLimitRetry(() => generateCompletion(p, options)),
    1 // maxRetries
  );
}

/**
 * Test provider connectivity with minimal token usage.
 * Used by health check — no retry, no telemetry, no context.
 */
export async function testProviderConnection(providerId?: string): Promise<string> {
  return generateCompletion('Test', { provider: providerId, maxTokens: 5 });
}

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

const REFINE_PROMPT_FR = `Tu es un Product Owner expert en méthodologie Agile. Analyse cet item de backlog et propose des améliorations.

ITEM ACTUEL:
ID: {id}
Type: {type}
Titre: {title}
{description_section}
{user_story_section}
{specs_section}
{criteria_section}
{dependencies_section}
{constraints_section}
{additional_prompt_section}

INSTRUCTIONS:
1. Reformule le titre pour qu'il soit plus clair et actionnable
2. Améliore la user story si présente (format "En tant que... je veux... afin de...")
3. Affine les spécifications pour qu'elles soient plus précises
4. Propose des critères d'acceptation SMART (Spécifiques, Mesurables, Atteignables, Réalistes, Temporels)
5. Identifie les dépendances ou risques potentiels
6. Affine ou suggère des dépendances pertinentes (autres tickets, APIs, services, composants)
7. Identifie les contraintes techniques ou business (compatibilité, performance, sécurité, budget)

RÉPONDS EN JSON avec ce format exact:
{
  "title": "Nouveau titre affiné",
  "userStory": "User story reformulée ou null si non applicable",
  "specs": ["Spec 1 affinée", "Spec 2 affinée"],
  "criteria": [
    {"text": "Critère 1 SMART", "checked": false},
    {"text": "Critère 2 SMART", "checked": false}
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "dependencies": ["Dépendance affinée 1", "Dépendance affinée 2"],
  "constraints": ["Contrainte affinée 1", "Contrainte affinée 2"]
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

const REFINE_PROMPT_EN = `You are an expert Product Owner in Agile methodology. Analyze this backlog item and propose improvements.

CURRENT ITEM:
ID: {id}
Type: {type}
Title: {title}
{description_section}
{user_story_section}
{specs_section}
{criteria_section}
{dependencies_section}
{constraints_section}
{additional_prompt_section}

INSTRUCTIONS:
1. Rephrase the title to be clearer and more actionable
2. Improve the user story if present (format "As a... I want... so that...")
3. Refine specifications to be more precise
4. Propose SMART acceptance criteria (Specific, Measurable, Achievable, Realistic, Time-bound)
5. Identify dependencies or potential risks
6. Refine or suggest relevant dependencies (other tickets, APIs, services, components)
7. Identify technical or business constraints (compatibility, performance, security, budget)

RESPOND IN JSON with this exact format:
{
  "title": "Refined actionable title",
  "userStory": "Rephrased user story or null if not applicable",
  "specs": ["Refined spec 1", "Refined spec 2"],
  "criteria": [
    {"text": "SMART acceptance criterion 1", "checked": false},
    {"text": "SMART acceptance criterion 2", "checked": false}
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "dependencies": ["Refined dependency 1", "Refined dependency 2"],
  "constraints": ["Refined constraint 1", "Refined constraint 2"]
}

Respond ONLY with JSON, no markdown or explanation.`;

function getRefinePrompt(): string {
  return getCurrentLocale() === 'en' ? REFINE_PROMPT_EN : REFINE_PROMPT_FR;
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

const GENERATE_ITEM_PROMPT_FR = `Tu es un Staff Engineer d'élite, architecte de systèmes distribués et expert en ingénierie produit. Tu combines une vision technologique avant-gardiste avec une rigueur d'exécution absolue. Tu penses en termes de systèmes, d'impacts de second ordre, et de dette technique anticipée.

Ta mission: transformer une idée brute en un item de backlog de qualité production - précis, actionnable, et aligné avec les standards d'excellence des équipes d'ingénierie de classe mondiale.

---

DESCRIPTION DE L'UTILISATEUR:
{user_description}

---

ANALYSE SYSTÉMIQUE:
Avant de générer, pose-toi ces questions:
- Quel est le VRAI problème sous-jacent (pas juste le symptôme)?
- Quels systèmes/modules sont impactés directement ET indirectement?
- Quels sont les risques de régression ou d'effets de bord?
- Cette solution est-elle la plus simple qui fonctionne (KISS)?

CLASSIFICATION DES ITEMS:
{type_classification}

STANDARDS DE QUALITÉ:
1. TITRE: Verbe d'action + contexte + impact. Maximum 60 caractères.
   - Bon: "Corriger le crash au chargement des images > 5MB"
   - Mauvais: "Bug images" (trop vague)

2. DESCRIPTION: Technique, factuelle, sans fluff. Contexte + comportement actuel + comportement attendu.

3. USER STORY: Uniquement si elle apporte de la VALEUR MÉTIER RÉELLE.
   - Bug d'affichage mineur -> null (la correction EST la valeur)
   - Feature UX significative -> "En tant que [persona précis], je veux [action concrète] afin de [bénéfice mesurable et vérifiable]"
   - Évite les user stories génériques type "en tant qu'utilisateur je veux que ça marche"

4. SPECS: 2-4 points techniques précis.
   - Pour un bug: étapes de reproduction exactes
   - Pour une feature: contraintes techniques, intégrations, edge cases

{criteria_instructions}

6. EFFORT: Estimation réaliste basée sur la complexité technique réelle.
   - XS: < 2h (fix trivial, typo, config)
   - S: 2-4h (changement localisé, bien compris)
   - M: 1-2 jours (feature moyenne, tests inclus)
   - L: 3-5 jours (feature complexe, refactoring)
   - XL: 1-2 semaines (système nouveau, investigation requise)

7. DÉPENDANCES (optionnel): Éléments dont ce ticket dépend.
   - Autres tickets (ex: "BUG-003 corrigé")
   - APIs ou services (ex: "API d'authentification fonctionnelle")
   - Composants ou modules (ex: "Module de paiement déployé")

8. CONTRAINTES (optionnel): Limitations techniques ou business.
   - Contraintes techniques (ex: "Compatible IE11", "Temps de réponse < 200ms")
   - Contraintes business (ex: "RGPD compliant", "Budget max 2j")

---

RÉPONDS UNIQUEMENT avec ce JSON (aucun texte avant/après):
{
  "title": "Titre actionnable et précis",
  "description": "Description technique du problème ou de la solution",
  "userStory": null ou "En tant que [X], je veux [Y] afin de [Z mesurable]",
  "specs": ["Spécification technique 1", "Spécification technique 2"],
  "criteria": [
    {"text": "Critère d'acceptation vérifiable 1", "checked": false},
    {"text": "Critère d'acceptation vérifiable 2", "checked": false}
  ],
  "suggestedType": "{type_enum}",
  "suggestedPriority": "Haute|Moyenne|Faible" ou null,
  "suggestedSeverity": "P0|P1|P2|P3|P4" ou null,
  "suggestedEffort": "XS|S|M|L|XL",
  "suggestedModule": "Module ou composant concerné" ou null,
  "emoji": "un emoji pertinent",
  "dependencies": ["Dépendance 1", "Dépendance 2"] ou [],
  "constraints": ["Contrainte 1", "Contrainte 2"] ou []
}`;

const GENERATE_ITEM_PROMPT_EN = `You are an elite Staff Engineer, distributed systems architect and product engineering expert. You combine a cutting-edge technological vision with absolute execution rigor. You think in terms of systems, second-order impacts, and anticipated technical debt.

Your mission: transform a raw idea into a production-quality backlog item - precise, actionable, and aligned with excellence standards of world-class engineering teams.

---

USER DESCRIPTION:
{user_description}

---

SYSTEMIC ANALYSIS:
Before generating, ask yourself:
- What is the REAL underlying problem (not just the symptom)?
- What systems/modules are impacted directly AND indirectly?
- What are the regression risks or side effects?
- Is this solution the simplest one that works (KISS)?

ITEM CLASSIFICATION:
{type_classification}

QUALITY STANDARDS:
1. TITLE: Action verb + context + impact. Maximum 60 characters.
   - Good: "Fix crash when loading images > 5MB"
   - Bad: "Image bug" (too vague)

2. DESCRIPTION: Technical, factual, no fluff. Context + current behavior + expected behavior.

3. USER STORY: Only if it provides REAL BUSINESS VALUE.
   - Minor display bug -> null (the fix IS the value)
   - Significant UX feature -> "As a [specific persona], I want [concrete action] so that [measurable and verifiable benefit]"
   - Avoid generic user stories like "as a user I want it to work"

4. SPECS: 2-4 precise technical points.
   - For a bug: exact reproduction steps
   - For a feature: technical constraints, integrations, edge cases

{criteria_instructions}

6. EFFORT: Realistic estimate based on actual technical complexity.
   - XS: < 2h (trivial fix, typo, config)
   - S: 2-4h (localized, well-understood change)
   - M: 1-2 days (medium feature, tests included)
   - L: 3-5 days (complex feature, refactoring)
   - XL: 1-2 weeks (new system, investigation required)

7. DEPENDENCIES (optional): Items this ticket depends on.
   - Other tickets (e.g. "BUG-003 fixed")
   - APIs or services (e.g. "Authentication API operational")
   - Components or modules (e.g. "Payment module deployed")

8. CONSTRAINTS (optional): Technical or business limitations.
   - Technical constraints (e.g. "IE11 compatible", "Response time < 200ms")
   - Business constraints (e.g. "GDPR compliant", "Budget max 2d")

---

RESPOND ONLY with this JSON (no text before/after):
{
  "title": "Clear, actionable title",
  "description": "Technical description of the problem or solution",
  "userStory": null or "As a [X], I want [Y] so that [Z measurable]",
  "specs": ["Technical specification 1", "Technical specification 2"],
  "criteria": [
    {"text": "Verifiable acceptance criterion 1", "checked": false},
    {"text": "Verifiable acceptance criterion 2", "checked": false}
  ],
  "suggestedType": "{type_enum}",
  "suggestedPriority": "Haute|Moyenne|Faible" or null,
  "suggestedSeverity": "P0|P1|P2|P3|P4" or null,
  "suggestedEffort": "XS|S|M|L|XL",
  "suggestedModule": "Affected module or component" or null,
  "emoji": "a relevant emoji",
  "dependencies": ["Dependency 1", "Dependency 2"] or [],
  "constraints": ["Constraint 1", "Constraint 2"] or []
}`;

function getGenerateItemPrompt(): string {
  return getCurrentLocale() === 'en' ? GENERATE_ITEM_PROMPT_EN : GENERATE_ITEM_PROMPT_FR;
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
        console.warn(`[AI Analysis] Batch ${i + 1}/${batches.length}: Invalid response`);
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
        console.warn(`[AI Analysis] Batch ${i + 1}/${batches.length}: Validation failed`);
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
