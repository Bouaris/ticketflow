/**
 * useAnalytics - React hook for loading dashboard analytics metrics.
 *
 * Loads all analytics metrics from SQLite when the hook is mounted
 * (i.e., when the dashboard view is active). Exposes a refresh function
 * for manual re-fetching after data changes.
 *
 * @module hooks/useAnalytics
 */

import { useState, useCallback, useEffect } from 'react';
import { getAnalyticsMetrics } from '../db/queries/analytics';
import type { AnalyticsMetrics, UseAnalyticsReturn } from '../types/analytics';

/**
 * Hook to load and manage analytics metrics for a project.
 *
 * Only fetches data when mounted (lazy loading - dashboard view only).
 * Re-fetches automatically when projectPath or projectId changes.
 *
 * @param projectPath - Absolute path to the project directory (null if no project)
 * @param projectId - The project ID (null if no project)
 * @returns Object with metrics data, loading state, and refresh function
 *
 * @example
 * ```typescript
 * const { metrics, isLoading, refresh } = useAnalytics(projectPath, projectId);
 * if (isLoading) return <Spinner />;
 * if (metrics) {
 *   console.log(`Total items: ${metrics.totalItems}`);
 * }
 * ```
 */
export function useAnalytics(
  projectPath: string | null,
  projectId: number | null
): UseAnalyticsReturn {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectPath || projectId === null) return;
    setIsLoading(true);
    try {
      const data = await getAnalyticsMetrics(projectPath, projectId);
      setMetrics(data);
    } catch (error) {
      console.error('[useAnalytics] Failed to load metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, projectId]);

  // Auto-load on mount and when project changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { metrics, isLoading, refresh };
}
