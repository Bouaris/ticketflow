/**
 * Project AI Configuration Types
 *
 * Types and constants for per-project AI provider and model configuration.
 */

import { z } from 'zod';

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
// AVAILABLE MODELS PER PROVIDER
// ============================================================

export const AVAILABLE_MODELS: Record<'groq' | 'gemini' | 'openai', AIModel[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)', provider: 'groq' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Versatile)', provider: 'groq' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)', provider: 'groq' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
  ],
};

// ============================================================
// DEFAULT MODELS PER PROVIDER
// ============================================================

export const DEFAULT_MODELS: Record<'groq' | 'gemini' | 'openai', string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
};
