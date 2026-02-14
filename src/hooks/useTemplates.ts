/**
 * Hook for loading and managing ticket templates.
 *
 * Seeds built-in templates on first access (idempotent) and loads
 * all available templates for the current project.
 *
 * @module hooks/useTemplates
 */

import { useState, useEffect, useCallback } from 'react';
import { getTemplatesForProject, seedBuiltinTemplates, type TicketTemplate } from '../db/queries/templates';

// ============================================================
// TYPES
// ============================================================

export interface UseTemplatesReturn {
  templates: TicketTemplate[];
  isLoading: boolean;
  reload: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Load and manage ticket templates for a project.
 *
 * On mount, seeds built-in templates (idempotent) then loads
 * all templates (global + project-specific).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID (null if not yet loaded)
 * @returns Templates array, loading state, and reload function
 */
export function useTemplates(
  projectPath: string,
  projectId: number | null
): UseTemplatesReturn {
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!projectId) {
      setTemplates([]);
      return;
    }

    setIsLoading(true);
    try {
      await seedBuiltinTemplates(projectPath);
      const loaded = await getTemplatesForProject(projectPath, projectId);
      setTemplates(loaded);
    } catch (error) {
      console.error('[useTemplates] Error loading templates:', error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, projectId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return { templates, isLoading, reload: loadTemplates };
}
