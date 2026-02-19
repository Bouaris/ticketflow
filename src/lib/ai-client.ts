/**
 * AI Client Module - SDK singletons, API key management, and completion core
 *
 * This is a leaf module: it imports only from external packages and sibling modules
 * that themselves have no back-dependency on ai.ts. This deliberately avoids circular
 * dependency: ai.ts -> ai-maintenance.ts/ai-analysis.ts -> (this module) -> ai.ts.
 *
 * Provides:
 * - SDK singleton factories: getGroqClient, getGeminiClient, getOpenAIClient
 * - API key CRUD: getApiKey, setApiKey, clearApiKey, hasApiKey, initSecureStorage
 * - Client config: getClientConfig, resetClient
 * - Completion core: generateCompletion (internal), generateChatCompletion, generateCompletionWithRetry
 * - Health check: testProviderConnection
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { STORAGE_KEYS } from '../constants/storage';
import { getCustomProviderApiKeyKey } from '../constants/storage';
import { AI_CONFIG } from '../constants/config';
import { setSecureItem, getSecureItem, removeSecureItem, migrateToSecureStorage } from './secure-storage';
import { getProviderById } from './ai-provider-registry';
import type { ProviderConfig } from '../types/aiProvider';
import {
  generateWithRetry,
  getStructuredOutputMode,
  zodToSimpleJsonSchema,
  type RetryResult,
} from './ai-retry';
import type { TelemetryErrorType } from './ai-telemetry';
import { getProvider, getProviderDisplayName } from './ai-config';
import { getTranslations } from '../i18n';
import { isAbortError } from './abort';
import type { ZodType, ZodSchema } from 'zod';

// ============================================================
// TYPES
// ============================================================

interface AIClientConfig {
  provider: string;
  apiKey: string;
}

/** Base64-encoded image data for multimodal AI requests */
export interface ImageData {
  /** Base64-encoded image content (no data: prefix) */
  base64: string;
  /** MIME type (e.g. 'image/png', 'image/jpeg') */
  mimeType: string;
}

export interface CompletionOptions {
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

// ============================================================
// API KEY MANAGEMENT
// ============================================================

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
  return { provider, apiKey };
}

// ============================================================
// SDK SINGLETONS
// ============================================================

let groqClient: Groq | null = null;
let groqClientKey: string | null = null;
let geminiClient: GoogleGenerativeAI | null = null;
let geminiClientKey: string | null = null;

// OpenAI-compatible clients: Map-based cache keyed by "apiKey::baseURL"
const openaiClientCache = new Map<string, OpenAI>();

function getOpenAICacheKey(apiKey: string, baseURL?: string): string {
  return baseURL ? `${apiKey}::${baseURL}` : apiKey;
}

export function getGroqClient(apiKey: string): Groq {
  if (!groqClient || groqClientKey !== apiKey) {
    groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    groqClientKey = apiKey;
  }
  return groqClient;
}

export function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!geminiClient || geminiClientKey !== apiKey) {
    geminiClient = new GoogleGenerativeAI(apiKey);
    geminiClientKey = apiKey;
  }
  return geminiClient;
}

export function getOpenAIClient(apiKey: string, baseURL?: string): OpenAI {
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
// UNIFIED COMPLETION API
// ============================================================

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

/**
 * Core single-turn completion. Internal function used by generateCompletionWithRetry
 * and testProviderConnection. Also exported for use by ai-maintenance.ts and
 * ai-analysis.ts which call it directly (no retry needed for those flows).
 */
export async function generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
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

// ============================================================
// RETRY WRAPPER
// ============================================================

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

// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Test provider connectivity with minimal token usage.
 * Used by health check — no retry, no telemetry, no context.
 */
export async function testProviderConnection(providerId?: string): Promise<string> {
  return generateCompletion('Test', { provider: providerId, maxTokens: 5 });
}

// Re-export types needed by consumers
export type { RetryResult, TelemetryErrorType };
