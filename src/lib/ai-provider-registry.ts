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
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Versatile)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
    capabilities: { structuredOutput: true, multimodal: false },
    isCustom: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    capabilities: { structuredOutput: true, multimodal: true },
    isCustom: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
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
 */
export function isBuiltInProvider(id: string): boolean {
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
