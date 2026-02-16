/**
 * AI Retry Module - Structured output support and retry logic with error feedback
 *
 * Provides:
 * - Provider/model capability mapping for structured outputs
 * - Retry wrapper that includes validation errors in retry prompts
 * - Minimal Zod-to-JSON-Schema converter for provider compatibility
 */

import { z } from 'zod';
import { getTranslations } from '../i18n';
import { getProviderById } from './ai-provider-registry';

// ============================================================
// TYPES
// ============================================================

export type StructuredOutputMode = 'strict' | 'bestEffort' | 'schema' | 'none';

export interface StructuredOutputSupport {
  groq: {
    strict: string[];
    bestEffort: string[];
  };
  openai: {
    strict: string[];
  };
  gemini: {
    schema: string[];
  };
}

export type RetryResult<T> =
  | { success: true; data: T; retryCount: number }
  | { success: false; error: string; retryCount: number };

// ============================================================
// STRUCTURED OUTPUT SUPPORT MAP
// ============================================================

/**
 * Maps provider/model combinations to their structured output capabilities.
 * Updated based on research (2026-02-05).
 *
 * - strict: Guaranteed schema adherence
 * - bestEffort: JSON mode without strict validation
 * - schema: Gemini's responseSchema feature
 */
export const STRUCTURED_OUTPUT_SUPPORT: StructuredOutputSupport = {
  groq: {
    // Models that support strict JSON schema mode
    strict: [
      'llama-3.3-70b-specdec',
      'llama-3.1-8b-instant',
      'llama3-8b-8192',
      'llama3-70b-8192',
    ],
    // Models that support JSON mode but not strict schema
    bestEffort: [
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
  },
  openai: {
    // OpenAI models with strict structured outputs (Aug 2024+)
    strict: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20',
      'gpt-4o-mini-2024-07-18',
    ],
  },
  gemini: {
    // Gemini models that support responseSchema
    schema: [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
    ],
  },
};

// ============================================================
// CAPABILITY DETECTION
// ============================================================

/**
 * Check if a specific provider/model combination supports structured outputs
 * and return the supported mode.
 *
 * Accepts arbitrary provider IDs (including custom providers). Resolves the
 * provider type via the registry to determine structured output capabilities.
 *
 * @param provider - AI provider ID (e.g. 'groq', 'gemini', 'openai', 'custom-ollama')
 * @param modelId - Model identifier
 * @returns The supported structured output mode
 */
export function getStructuredOutputMode(
  provider: string,
  modelId: string
): StructuredOutputMode {
  // Resolve provider type from registry
  const providerConfig = getProviderById(provider);
  const providerType = providerConfig?.type ?? provider;

  // Normalize model ID (remove version suffixes for matching)
  const normalizedModel = modelId.toLowerCase();

  if (providerType === 'groq') {
    // Check strict support first
    if (STRUCTURED_OUTPUT_SUPPORT.groq.strict.some(m =>
      normalizedModel.includes(m.toLowerCase())
    )) {
      return 'strict';
    }
    // Check best effort
    if (STRUCTURED_OUTPUT_SUPPORT.groq.bestEffort.some(m =>
      normalizedModel.includes(m.toLowerCase())
    )) {
      return 'bestEffort';
    }
    return 'none';
  }

  if (providerType === 'openai-compatible') {
    // For custom openai-compatible providers, use conservative 'none'
    // unless the model is known to support structured output
    if (providerConfig?.isCustom) {
      return 'none'; // Conservative: custom providers may not support structured output
    }
    // Built-in OpenAI check
    if (STRUCTURED_OUTPUT_SUPPORT.openai.strict.some(m =>
      normalizedModel.includes(m.toLowerCase()) ||
      m.toLowerCase().includes(normalizedModel)
    )) {
      return 'strict';
    }
    return 'none';
  }

  if (providerType === 'gemini') {
    if (STRUCTURED_OUTPUT_SUPPORT.gemini.schema.some(m =>
      normalizedModel.includes(m.toLowerCase())
    )) {
      return 'schema';
    }
    return 'none';
  }

  return 'none';
}

/**
 * Simplified check: does this provider/model support ANY structured output mode?
 */
export function supportsStructuredOutput(
  provider: string,
  modelId: string
): boolean {
  return getStructuredOutputMode(provider, modelId) !== 'none';
}

// ============================================================
// ZOD TO JSON SCHEMA CONVERTER
// ============================================================

type JsonSchemaType = {
  type?: string;
  properties?: Record<string, JsonSchemaType>;
  items?: JsonSchemaType;
  required?: string[];
  enum?: (string | number | boolean)[];
  additionalProperties?: boolean;
  nullable?: boolean;
  default?: unknown;
};

/**
 * Convert a Zod schema to a simplified JSON Schema compatible with all providers.
 *
 * Uses Zod v4's native toJSONSchema() when available, with fallback for complex cases.
 *
 * Only uses well-supported features:
 * - type, properties, items, required, enum, additionalProperties
 *
 * Avoids features that some providers ignore:
 * - regex patterns, minLength, maxLength, minimum, maximum
 *
 * @param schema - Zod schema to convert
 * @returns JSON Schema object
 */
export function zodToSimpleJsonSchema(schema: z.ZodType): JsonSchemaType {
  // Zod v4 has native toJSONSchema() support
  // Use z.toJSONSchema() if available (Zod v4+)
  if (typeof z.toJSONSchema === 'function') {
    try {
      const jsonSchema = z.toJSONSchema(schema) as JsonSchemaType;
      // Simplify the schema by removing unsupported constraints
      return simplifyJsonSchema(jsonSchema);
    } catch {
      // Fallback to basic conversion
      return { type: 'object', additionalProperties: false };
    }
  }
  // Fallback for edge cases
  return { type: 'object', additionalProperties: false };
}

/**
 * Simplify a JSON Schema by removing constraints that some providers don't support.
 * Keeps only: type, properties, items, required, enum, additionalProperties
 */
function simplifyJsonSchema(schema: JsonSchemaType): JsonSchemaType {
  const simplified: JsonSchemaType = {};

  if (schema.type) simplified.type = schema.type;

  if (schema.properties) {
    simplified.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      simplified.properties[key] = simplifyJsonSchema(value);
    }
  }

  if (schema.items) {
    simplified.items = simplifyJsonSchema(schema.items);
  }

  if (schema.required && schema.required.length > 0) {
    simplified.required = schema.required;
  }

  if (schema.enum) {
    simplified.enum = schema.enum;
  }

  // Always set additionalProperties: false for objects
  if (schema.type === 'object') {
    simplified.additionalProperties = false;
  }

  if (schema.nullable) {
    simplified.nullable = schema.nullable;
  }

  if (schema.default !== undefined) {
    simplified.default = schema.default;
  }

  return simplified;
}

// ============================================================
// RETRY WITH ERROR FEEDBACK
// ============================================================

/**
 * Generate AI response with retry and error feedback.
 *
 * On validation failure, retries with the error message included in the prompt.
 * This gives the LLM context to fix its mistakes.
 *
 * @param prompt - Original prompt
 * @param schema - Zod schema for validation
 * @param generate - Function that calls the AI provider
 * @param maxRetries - Maximum retry attempts (default: 1)
 * @returns Result with data or error
 */
export async function generateWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  generate: (p: string) => Promise<string>,
  maxRetries: number = 1
): Promise<RetryResult<T>> {
  let lastError: string | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Build prompt with error feedback on retries
    const fullPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n[CORRECTION REQUIRED]\nYour previous response failed validation:\n${lastError}\nPlease fix the JSON and try again. Respond with ONLY valid JSON.`;

    try {
      const response = await generate(fullPrompt);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = 'No JSON object found in response. Response must contain a valid JSON object.';
        retryCount = attempt;
        continue;
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        lastError = `Invalid JSON syntax: ${parseError instanceof Error ? parseError.message : 'Parse error'}`;
        retryCount = attempt;
        continue;
      }

      // Validate against schema
      const result = schema.safeParse(parsed);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          retryCount: attempt,
        };
      }

      // Build detailed error message from Zod errors
      // Zod v4 uses issues instead of errors
      const issues = result.error.issues ?? (result.error as { errors?: z.ZodIssue[] }).errors ?? [];
      lastError = issues
        .map((e: z.ZodIssue) => {
          const path = e.path.length > 0 ? e.path.join('.') : 'root';
          return `${path}: ${e.message}`;
        })
        .join('; ');
      retryCount = attempt;

    } catch (error) {
      // Don't retry on rate-limit or auth errors — break immediately
      const msg = error instanceof Error ? error.message : String(error);
      const isRateLimit = /\b429\b/.test(msg) || /resource.?exhausted/i.test(msg) || /too.?many.?requests/i.test(msg);
      const isAuth = /\b(401|403)\b/.test(msg) || /unauthorized|forbidden|invalid.*api.?key/i.test(msg);
      if (isRateLimit || isAuth) {
        const t = getTranslations();
        return {
          success: false as const,
          error: isRateLimit
            ? t.aiErrors.rateLimitReached
            : t.aiErrors.invalidApiKey,
          retryCount: attempt,
        };
      }
      lastError = error instanceof Error ? error.message : 'Unknown error during generation';
      retryCount = attempt;
    }
  }

  return {
    success: false,
    error: lastError || 'Max retries exceeded',
    retryCount,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export type { JsonSchemaType };
