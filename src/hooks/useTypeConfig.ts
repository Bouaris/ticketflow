/**
 * useTypeConfig - Hook for managing dynamic item types
 */

import { useState, useCallback, useMemo } from 'react';
import type { TypeConfig, TypeDefinition } from '../types/typeConfig';
import {
  DEFAULT_TYPE_CONFIG,
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
  /** Toggle type visibility in Kanban */
  toggleTypeVisibility: (typeId: string) => void;
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

  /**
   * Initialize config for a project
   * - Detect types from markdown if provided (sync with file)
   * - Merge with DEFAULT_TYPE_CONFIG to preserve known type colors
   * - SQLite is the sole source of truth (loaded via ProjectWorkspace)
   */
  const initializeForProject = useCallback((path: string, markdownContent?: string) => {
    setProjectPath(path);

    // Detect types from markdown if provided
    if (markdownContent) {
      const detectedTypes = detectTypesFromMarkdown(markdownContent);

      if (detectedTypes.length > 0) {
        // Merge detected types with defaults to get known colors/labels
        const newConfig = mergeTypesWithDetected(DEFAULT_TYPE_CONFIG, detectedTypes);
        setConfig(newConfig);
        return;
      }
    }

    // Fallback to defaults (SQLite data is loaded via initializeWithTypes)
    setConfig(DEFAULT_TYPE_CONFIG);
  }, []);

  /**
   * Initialize config with specific types (from SQLite via ProjectWorkspace)
   */
  const initializeWithTypes = useCallback((path: string, types: TypeDefinition[]) => {
    const newConfig: TypeConfig = {
      types: types.map((t, i) => ({ ...t, order: i })),
      version: 1,
    };

    setProjectPath(path);
    setConfig(newConfig);
  }, []);

  /**
   * Set types directly (for modal editing)
   * SQLite persistence is handled by ProjectWorkspace via bulkUpsertTypeConfigs
   */
  const setTypes = useCallback((types: TypeDefinition[]) => {
    const newConfig: TypeConfig = {
      ...config,
      types: types.map((t, i) => ({ ...t, order: i })),
    };
    setConfig(newConfig);
  }, [config]);

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
   * Toggle type visibility in Kanban
   */
  const toggleTypeVisibility = useCallback((typeId: string) => {
    setConfig(prev => ({
      ...prev,
      types: prev.types.map(t =>
        t.id === typeId ? { ...t, visible: !t.visible } : t
      ),
    }));
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
    toggleTypeVisibility,
    getType,
    hasType,
    projectPath,
  };
}
