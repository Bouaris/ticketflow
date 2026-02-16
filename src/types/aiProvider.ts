/**
 * AI Provider Registry Types
 *
 * Zod-validated schemas and TypeScript types for the provider registry.
 * Supports built-in providers (Groq, Gemini, OpenAI) and user-defined
 * custom OpenAI-compatible providers (Ollama, LM Studio, etc.).
 */

import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

/** SDK type used under the hood for API calls */
export const ProviderTypeSchema = z.enum(['groq', 'gemini', 'openai-compatible']);

/** Model entry: id + display name */
export const ProviderModelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/** Provider capabilities metadata */
export const ProviderCapabilitiesSchema = z.object({
  structuredOutput: z.boolean(),
  multimodal: z.boolean(),
});

/**
 * Full provider configuration schema.
 * Used for both built-in and custom providers.
 */
export const ProviderConfigSchema = z.object({
  /** Unique identifier (e.g. "groq", "ollama-local") */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Display name */
  name: z.string().min(1).max(50),
  /** Which SDK to use for API calls */
  type: ProviderTypeSchema,
  /** Base URL for openai-compatible providers */
  baseURL: z.string().url().optional(),
  /** Default model ID */
  defaultModel: z.string().min(1),
  /** Available models */
  models: z.array(ProviderModelSchema),
  /** Provider capabilities */
  capabilities: ProviderCapabilitiesSchema,
  /** Whether this is a user-created custom provider */
  isCustom: z.boolean().default(false),
});

/**
 * Custom provider input schema.
 * Used to validate user input when adding a custom provider.
 * Enforces HTTPS or localhost for security.
 */
export const CustomProviderInputSchema = z.object({
  /** Display name */
  name: z.string().min(1).max(50),
  /** Endpoint URL (must be HTTPS or localhost) */
  baseURL: z.string().url().refine(
    (url) =>
      url.startsWith('https://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1'),
    { message: 'Custom endpoints must use HTTPS or localhost' }
  ),
  /** API key (optional for localhost providers like Ollama) */
  apiKey: z.string().optional(),
  /** Default model ID to use */
  defaultModel: z.string().min(1),
  /** Optional list of available models */
  models: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});

// ============================================================
// TYPES
// ============================================================

/** Full provider configuration */
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** SDK type enum */
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

/** User input for adding a custom provider */
export type CustomProviderInput = z.infer<typeof CustomProviderInputSchema>;

/** Built-in provider IDs (backward compatible with existing AIProvider type) */
export type BuiltInProviderId = 'groq' | 'gemini' | 'openai';
