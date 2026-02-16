/**
 * useProjectAIConfig - Hook for managing per-project AI configuration
 *
 * @deprecated Since v2.1, project-level AI config has been removed.
 * This hook always returns global settings. Kept for backward compatibility.
 */

import { useCallback } from 'react';
import {
  getProvider,
  type AIProvider,
} from '../lib/ai';
import { getProviderById } from '../lib/ai-provider-registry';
import type {
  ProjectAIConfig,
  ProjectAIProvider,
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

export function useProjectAIConfig(_projectPath: string | null): UseProjectAIConfigReturn {
  // v2.1: Project-level AI config removed — always use global settings
  const globalProvider = getProvider();
  const providerConfig = getProviderById(globalProvider);

  const effectiveModelId = providerConfig?.defaultModel ?? globalProvider;

  // Keep setProvider and setModelId as no-ops with deprecation warnings
  const setProviderFn = useCallback((_provider: ProjectAIProvider) => {
    console.warn('[useProjectAIConfig] Project-level AI config removed in v2.1. Use global settings.');
  }, []);

  const setModelId = useCallback((_modelId: string) => {
    console.warn('[useProjectAIConfig] Project-level AI config removed in v2.1. Use global settings.');
  }, []);

  return {
    config: { provider: 'global', version: 1 },
    setProvider: setProviderFn,
    setModelId,
    isGlobal: true,
    effectiveProvider: globalProvider,
    effectiveModelId,
  };
}
