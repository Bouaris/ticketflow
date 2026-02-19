/**
 * AI Config Module - Provider and model configuration
 *
 * Provides:
 * - getProvider / setProvider - active provider selection
 * - getSelectedModel / setSelectedModel - per-provider model persistence
 * - getEffectiveAIConfig - resolved provider + model for the current session
 * - resolveModelForProvider - 3-tier fallback (persisted > registry > hardcoded)
 * - getProviderDisplayName - human-readable provider name
 */

import { STORAGE_KEYS } from '../constants/storage';
import { getModelStorageKey } from '../constants/storage';
import { AI_CONFIG } from '../constants/config';
import { getProviderById } from './ai-provider-registry';

// ============================================================
// TYPES
// ============================================================

export type AIProvider = 'groq' | 'gemini' | 'openai';

/** Extended provider ID that includes custom provider IDs */
export type ProviderId = string;

// ============================================================
// PROVIDER SELECTION
// ============================================================

export function getProvider(): AIProvider {
  return (localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as AIProvider) || 'groq';
}

export function setProvider(provider: AIProvider): void {
  localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
}

// ============================================================
// MODEL SELECTION
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

// ============================================================
// EFFECTIVE CONFIG
// ============================================================

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
