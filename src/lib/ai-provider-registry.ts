/**
 * AI Provider Registry
 *
 * Single source of truth for all AI provider configurations.
 * Manages built-in providers (Groq, Gemini, OpenAI) and custom
 * user-defined OpenAI-compatible providers (Ollama, LM Studio, etc.).
 *
 * Custom providers are persisted to localStorage with Zod validation.
 */

import { z } from 'zod';
import type { ProviderConfig, CustomProviderInput, BuiltInProviderId } from '../types/aiProvider';
import { ProviderConfigSchema, CustomProviderInputSchema } from '../types/aiProvider';

// ============================================================
// STORAGE
// ============================================================

const CUSTOM_PROVIDERS_KEY = 'custom-ai-providers';

// ============================================================
// BUILT-IN PROVIDERS
// ============================================================

/**
 * Built-in provider definitions (immutable).
 * Models match existing AVAILABLE_MODELS in projectAIConfig.ts.
 */
export const BUILT_IN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'groq',
    name: 'Groq',
    type: 'groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      // Production
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B' },
      // Preview
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
      { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
      { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2' },
    ],
    capabilities: { structuredOutput: true, multimodal: false },
    isCustom: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [
      // Stable
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      // Preview
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    ],
    capabilities: { structuredOutput: true, multimodal: true },
    isCustom: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    models: [
      // GPT-5 family
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
      // GPT-4.1 family
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      // GPT-4o family
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      // Reasoning (o-series)
      { id: 'o4-mini', name: 'o4 Mini' },
      { id: 'o3', name: 'o3' },
      { id: 'o3-mini', name: 'o3 Mini' },
    ],
    capabilities: { structuredOutput: true, multimodal: true },
    isCustom: false,
  },
];

// ============================================================
// CUSTOM PROVIDER PERSISTENCE
// ============================================================

/**
 * Load custom providers from localStorage.
 * Returns [] on parse failure or missing data.
 */
export function loadCustomProviders(): ProviderConfig[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return z.array(ProviderConfigSchema).parse(parsed);
  } catch {
    return [];
  }
}

/**
 * Save custom providers to localStorage.
 */
export function saveCustomProviders(providers: ProviderConfig[]): void {
  localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(providers));
}

// ============================================================
// PROVIDER QUERIES
// ============================================================

/**
 * Get all providers (built-in + custom).
 */
export function getAllProviders(): ProviderConfig[] {
  return [...BUILT_IN_PROVIDERS, ...loadCustomProviders()];
}

/**
 * Get a provider by its unique ID.
 * Returns null if not found.
 */
export function getProviderById(id: string): ProviderConfig | null {
  return getAllProviders().find((p) => p.id === id) ?? null;
}

/**
 * Get a built-in provider by its ID.
 * Throws if not found (programming error — built-ins are guaranteed).
 */
export function getBuiltInProvider(id: BuiltInProviderId): ProviderConfig {
  const provider = BUILT_IN_PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`[AI Registry] Built-in provider not found: ${id}`);
  }
  return provider;
}

/**
 * Check if a provider ID belongs to a built-in provider.
 * Type predicate: narrows `id` to `BuiltInProviderId` after the guard check.
 */
export function isBuiltInProvider(id: string): id is BuiltInProviderId {
  return BUILT_IN_PROVIDERS.some((p) => p.id === id);
}

/**
 * Get the default model ID for a provider.
 * Returns null if provider not found.
 */
export function getDefaultModelForProvider(providerId: string): string | null {
  const provider = getProviderById(providerId);
  return provider?.defaultModel ?? null;
}

// ============================================================
// CUSTOM PROVIDER CRUD
// ============================================================

/**
 * Validate custom provider input.
 * Returns structured result with parsed data or error message.
 */
export function validateCustomProvider(
  input: unknown
): { success: true; data: CustomProviderInput } | { success: false; error: string } {
  const result = CustomProviderInputSchema.safeParse(input);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { success: false, error: firstIssue?.message ?? 'Invalid provider configuration' };
  }
  return { success: true, data: result.data };
}

/**
 * Add a custom provider.
 * Validates input, generates unique ID, checks for duplicates,
 * and persists to localStorage.
 */
export function addCustomProvider(
  input: CustomProviderInput
): { success: true; provider: ProviderConfig } | { success: false; error: string } {
  // Validate input
  const validation = validateCustomProvider(input);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  // Generate unique ID from name
  const id = `custom-${input.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`;

  // Check for duplicate ID
  if (getProviderById(id)) {
    return { success: false, error: `Provider "${input.name}" already exists` };
  }

  // Build full provider config
  const provider: ProviderConfig = {
    id,
    name: input.name,
    type: 'openai-compatible',
    baseURL: input.baseURL,
    defaultModel: input.defaultModel,
    models: input.models ?? [{ id: input.defaultModel, name: input.defaultModel }],
    capabilities: { structuredOutput: false, multimodal: false }, // Conservative defaults
    isCustom: true,
  };

  // Append and save
  const customProviders = loadCustomProviders();
  customProviders.push(provider);
  saveCustomProviders(customProviders);

  return { success: true, provider };
}

/**
 * Remove a custom provider by ID.
 * Returns false if not found or if trying to remove a built-in provider.
 */
export function removeCustomProvider(id: string): boolean {
  // Prevent removal of built-in providers
  if (isBuiltInProvider(id)) {
    return false;
  }

  const customProviders = loadCustomProviders();
  const index = customProviders.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  customProviders.splice(index, 1);
  saveCustomProviders(customProviders);
  return true;
}
