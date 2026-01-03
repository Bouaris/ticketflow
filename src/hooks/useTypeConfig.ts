/**
 * useTypeConfig - Hook for managing dynamic item types
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { TypeConfig, TypeDefinition } from '../types/typeConfig';
import {
  DEFAULT_TYPE_CONFIG,
  loadTypeConfig,
  saveTypeConfig,
  detectTypesFromMarkdown,
  mergeTypesWithDetected,
  getSortedTypes,
  addType,
  removeType,
  updateType,
  reorderTypes,
} from '../types/typeConfig';

export interface UseTypeConfigReturn {
  /** Current type configuration */
  config: TypeConfig;
  /** Sorted list of types */
  sortedTypes: TypeDefinition[];
  /** Initialize config for a project */
  initializeForProject: (projectPath: string, markdownContent?: string) => void;
  /** Initialize config with specific types (for new projects) */
  initializeWithTypes: (projectPath: string, types: TypeDefinition[]) => void;
  /** Set types directly */
  setTypes: (types: TypeDefinition[]) => void;
  /** Add a new type */
  addNewType: (type: Omit<TypeDefinition, 'order'>) => void;
  /** Remove a type */
  removeTypeById: (typeId: string) => void;
  /** Update a type */
  updateTypeById: (typeId: string, updates: Partial<TypeDefinition>) => void;
  /** Reorder types (for drag & drop) */
  reorderTypesAtIndex: (fromIndex: number, toIndex: number) => void;
  /** Get type by ID */
  getType: (typeId: string) => TypeDefinition | undefined;
  /** Check if type exists */
  hasType: (typeId: string) => boolean;
  /** Current project path */
  projectPath: string | null;
}

export function useTypeConfig(): UseTypeConfigReturn {
  const [config, setConfig] = useState<TypeConfig>(DEFAULT_TYPE_CONFIG);
  const [projectPath, setProjectPath] = useState<string | null>(null);

  // Compute sorted types - MEMOIZED to prevent unnecessary re-renders
  const sortedTypes = useMemo(() => getSortedTypes(config), [config]);

  // Save config when it changes
  useEffect(() => {
    if (projectPath && config.types.length > 0) {
      saveTypeConfig(projectPath, config);
    }
  }, [config, projectPath]);

  /**
   * Initialize config for a project
   * - ALWAYS detect types from markdown if provided (sync with file)
   * - Merge with existing config to preserve user customizations (labels, colors)
   * - Fallback to localStorage or defaults if no markdown
   */
  const initializeForProject = useCallback((path: string, markdownContent?: string) => {
    setProjectPath(path);

    // TOUJOURS détecter les types du markdown si fourni
    if (markdownContent) {
      const detectedTypes = detectTypesFromMarkdown(markdownContent);

      if (detectedTypes.length > 0) {
        // Charger config existante pour préserver labels/couleurs personnalisés
        const existingConfig = loadTypeConfig(path);
        // Fusionner : types du fichier + personnalisations existantes
        const newConfig = mergeTypesWithDetected(existingConfig, detectedTypes);
        setConfig(newConfig);
        return;
      }
    }

    // Fallback : charger localStorage ou utiliser défauts
    const existingConfig = loadTypeConfig(path);
    if (existingConfig) {
      setConfig(existingConfig);
      return;
    }

    setConfig(DEFAULT_TYPE_CONFIG);
  }, []);

  /**
   * Initialize config with specific types (for new projects)
   * This clears any existing localStorage config and uses the provided types
   */
  const initializeWithTypes = useCallback((path: string, types: TypeDefinition[]) => {
    const newConfig: TypeConfig = {
      types: types.map((t, i) => ({ ...t, order: i })),
      version: 1,
    };

    setProjectPath(path);
    setConfig(newConfig);

    // Immediately save to localStorage to avoid race conditions
    saveTypeConfig(path, newConfig);
  }, []);

  /**
   * Set types directly (for modal editing)
   * IMPORTANT: Sauvegarde immédiatement pour éviter race condition si modal ferme
   */
  const setTypes = useCallback((types: TypeDefinition[]) => {
    const newConfig: TypeConfig = {
      ...config,
      types: types.map((t, i) => ({ ...t, order: i })),
    };
    setConfig(newConfig);

    // CRITICAL: Sauvegarder IMMÉDIATEMENT, pas dans useEffect
    if (projectPath) {
      saveTypeConfig(projectPath, newConfig);
    }
  }, [config, projectPath]);

  /**
   * Add a new type
   */
  const addNewType = useCallback((type: Omit<TypeDefinition, 'order'>) => {
    setConfig(prev => addType(prev, type));
  }, []);

  /**
   * Remove a type
   */
  const removeTypeById = useCallback((typeId: string) => {
    setConfig(prev => removeType(prev, typeId));
  }, []);

  /**
   * Update a type
   */
  const updateTypeById = useCallback((typeId: string, updates: Partial<TypeDefinition>) => {
    setConfig(prev => updateType(prev, typeId, updates));
  }, []);

  /**
   * Reorder types (for drag & drop)
   */
  const reorderTypesAtIndex = useCallback((fromIndex: number, toIndex: number) => {
    setConfig(prev => reorderTypes(prev, fromIndex, toIndex));
  }, []);

  /**
   * Get type by ID
   */
  const getType = useCallback((typeId: string): TypeDefinition | undefined => {
    return config.types.find(t => t.id === typeId);
  }, [config.types]);

  /**
   * Check if type exists
   */
  const hasType = useCallback((typeId: string): boolean => {
    return config.types.some(t => t.id === typeId);
  }, [config.types]);

  return {
    config,
    sortedTypes,
    initializeForProject,
    initializeWithTypes,
    setTypes,
    addNewType,
    removeTypeById,
    updateTypeById,
    reorderTypesAtIndex,
    getType,
    hasType,
    projectPath,
  };
}
