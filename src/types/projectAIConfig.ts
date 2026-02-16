/**
 * Project AI Configuration Types
 *
 * @deprecated This module is deprecated since v2.1. Use ai-provider-registry instead.
 * Kept for backward compatibility — will be removed in v2.2.
 */

import { z } from 'zod';
import { BUILT_IN_PROVIDERS } from '../lib/ai-provider-registry';
import type { BuiltInProviderId } from './aiProvider';

// ============================================================
// SCHEMAS
// ============================================================

export const AIModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['groq', 'gemini', 'openai']),
});

export const ProjectAIConfigSchema = z.object({
  /** Provider: 'global' means inherit from global settings */
  provider: z.enum(['groq', 'gemini', 'openai', 'global']),
  /** Model ID to use (only relevant when provider is not 'global') */
  modelId: z.string().optional(),
  /** Version for future migrations */
  version: z.number().default(1),
});

// ============================================================
// TYPES
// ============================================================

export type AIModel = z.infer<typeof AIModelSchema>;
export type ProjectAIConfig = z.infer<typeof ProjectAIConfigSchema>;
export type ProjectAIProvider = 'groq' | 'gemini' | 'openai' | 'global';

// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_PROJECT_AI_CONFIG: ProjectAIConfig = {
  provider: 'global',
  version: 1,
};

// ============================================================
// AVAILABLE MODELS PER PROVIDER (derived from registry)
// ============================================================

/** @deprecated Use BUILT_IN_PROVIDERS from ai-provider-registry instead */
export const AVAILABLE_MODELS: Record<BuiltInProviderId, AIModel[]> = {
  groq: BUILT_IN_PROVIDERS.find(p => p.id === 'groq')!.models.map(m => ({ ...m, provider: 'groq' as const })),
  gemini: BUILT_IN_PROVIDERS.find(p => p.id === 'gemini')!.models.map(m => ({ ...m, provider: 'gemini' as const })),
  openai: BUILT_IN_PROVIDERS.find(p => p.id === 'openai')!.models.map(m => ({ ...m, provider: 'openai' as const })),
};

// ============================================================
// DEFAULT MODELS PER PROVIDER (derived from registry)
// ============================================================

/** @deprecated Use getProviderById(id).defaultModel from ai-provider-registry instead */
export const DEFAULT_MODELS: Record<BuiltInProviderId, string> = {
  groq: BUILT_IN_PROVIDERS.find(p => p.id === 'groq')!.defaultModel,
  gemini: BUILT_IN_PROVIDERS.find(p => p.id === 'gemini')!.defaultModel,
  openai: BUILT_IN_PROVIDERS.find(p => p.id === 'openai')!.defaultModel,
};
