/**
 * useRelations - Manages relation state for a selected backlog item.
 *
 * Loads relations from SQLite, processes them for bidirectional display
 * (inverting type when current item is the target), and provides
 * add/remove actions with automatic refresh.
 *
 * @module hooks/useRelations
 */

import { useState, useEffect, useCallback } from 'react';
import type { ItemRelation, RelationType } from '../types/relations';
import { invertRelationType } from '../types/relations';
import {
  getRelationsForItem,
  addRelation as dbAddRelation,
  removeRelation as dbRemoveRelation,
} from '../db/queries/relations';
import { useTranslation } from '../i18n';

// ============================================================
// TYPES
// ============================================================

export interface UseRelationsReturn {
  /** Relations for the current item, with types inverted when item is target */
  relations: ItemRelation[];
  isLoading: boolean;
  error: string | null;
  addRelation: (targetId: string, type: RelationType, reason?: string) => Promise<void>;
  removeRelation: (relationId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

export function useRelations(
  projectPath: string,
  projectId: number | null,
  itemId: string | null
): UseRelationsReturn {
  const [relations, setRelations] = useState<ItemRelation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  /**
   * Load relations for the current item and invert types
   * for relations where the item is the target.
   */
  const loadRelations = useCallback(async () => {
    if (!projectPath || !itemId) {
      setRelations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const raw = await getRelationsForItem(projectPath, itemId);

      // Process for bidirectional display:
      // If the current item is the target, invert the relation type
      const processed = raw.map(rel => {
        if (rel.targetId === itemId && rel.sourceId !== itemId) {
          return {
            ...rel,
            relationType: invertRelationType(rel.relationType),
            // Swap source/target so the "other" item is always targetId from the UI perspective
            sourceId: rel.targetId,
            targetId: rel.sourceId,
          };
        }
        return rel;
      });

      setRelations(processed);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.error.relationLoadError;
      setError(message);
      console.error('[useRelations] Error loading relations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, itemId, t]);

  // Load on item change
  useEffect(() => {
    loadRelations();
  }, [loadRelations]);

  /**
   * Add a new relation from the current item to a target.
   */
  const addRelation = useCallback(async (
    targetId: string,
    type: RelationType,
    reason?: string
  ) => {
    if (!projectPath || !itemId || projectId === null) return;

    try {
      await dbAddRelation(projectPath, projectId, itemId, targetId, type, undefined, reason);
      await loadRelations();
    } catch (err) {
      console.error('[useRelations] Error adding relation:', err);
      setError(err instanceof Error ? err.message : t.error.relationAddError);
    }
  }, [projectPath, projectId, itemId, loadRelations, t]);

  /**
   * Remove a relation by its ID.
   */
  const removeRelation = useCallback(async (relationId: number) => {
    if (!projectPath) return;

    try {
      await dbRemoveRelation(projectPath, relationId);
      await loadRelations();
    } catch (err) {
      console.error('[useRelations] Error removing relation:', err);
      setError(err instanceof Error ? err.message : t.error.relationDeleteError);
    }
  }, [projectPath, loadRelations, t]);

  return {
    relations,
    isLoading,
    error,
    addRelation,
    removeRelation,
    refresh: loadRelations,
  };
}
