/**
 * useProjectAIConfig - Hook for managing per-project AI configuration
 *
 * Provides access to project-specific AI provider and model settings
 * with automatic fallback to global settings when set to 'global'.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  loadProjectAIConfig,
  saveProjectAIConfig,
  getProvider,
  getEffectiveAIConfig,
  type AIProvider,
} from '../lib/ai';
import {
  type ProjectAIConfig,
  type ProjectAIProvider,
  DEFAULT_PROJECT_AI_CONFIG,
  DEFAULT_MODELS,
} from '../types/projectAIConfig';

// ============================================================
// TYPES
// ============================================================

export interface UseProjectAIConfigReturn {
  /** Current project AI configuration */
  config: ProjectAIConfig;
  /** Set the provider for this project */
  setProvider: (provider: ProjectAIProvider) => void;
  /** Set the model ID for this project */
  setModelId: (modelId: string) => void;
  /** Whether the project is using global settings */
  isGlobal: boolean;
  /** The effective provider after resolving 'global' */
  effectiveProvider: AIProvider;
  /** The effective model ID after resolving defaults */
  effectiveModelId: string;
}

// ============================================================
// HOOK
// ============================================================

export function useProjectAIConfig(projectPath: string | null): UseProjectAIConfigReturn {
  const [config, setConfig] = useState<ProjectAIConfig>(DEFAULT_PROJECT_AI_CONFIG);

  // Load config when project path changes
  useEffect(() => {
    if (projectPath) {
      const loaded = loadProjectAIConfig(projectPath);
      setConfig(loaded);
    } else {
      setConfig(DEFAULT_PROJECT_AI_CONFIG);
    }
  }, [projectPath]);

  // Set provider
  const setProvider = useCallback((provider: ProjectAIProvider) => {
    if (!projectPath) return;

    const newConfig: ProjectAIConfig = {
      ...config,
      provider,
      // Reset modelId when changing provider
      modelId: provider === 'global' ? undefined : DEFAULT_MODELS[provider as AIProvider],
    };

    setConfig(newConfig);
    saveProjectAIConfig(projectPath, newConfig);
  }, [projectPath, config]);

  // Set model ID
  const setModelId = useCallback((modelId: string) => {
    if (!projectPath) return;

    const newConfig: ProjectAIConfig = {
      ...config,
      modelId,
    };

    setConfig(newConfig);
    saveProjectAIConfig(projectPath, newConfig);
  }, [projectPath, config]);

  // Compute derived values
  const isGlobal = config.provider === 'global';

  // Get effective values (resolves 'global' to actual provider)
  const { provider: effectiveProvider, modelId: effectiveModelId } = projectPath
    ? getEffectiveAIConfig(projectPath)
    : { provider: getProvider(), modelId: DEFAULT_MODELS[getProvider()] };

  return {
    config,
    setProvider,
    setModelId,
    isGlobal,
    effectiveProvider,
    effectiveModelId,
  };
}
