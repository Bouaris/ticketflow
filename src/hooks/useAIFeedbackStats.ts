/**
 * useAIFeedbackStats - Hook for fetching AI feedback statistics
 *
 * Encapsulates the getOrCreateProject + getFeedbackStats database queries
 * so UI components don't need direct database access.
 *
 * Follows the useAIFeedback pattern from the existing codebase.
 *
 * @module hooks/useAIFeedbackStats
 */

import { useState, useEffect } from 'react';
import { getFeedbackStats, type FeedbackStats } from '../lib/ai-feedback';
import { getOrCreateProject } from '../db/queries/projects';

/**
 * Fetches AI feedback stats for a project.
 *
 * @param projectPath - Path to the project file
 * @param isOpen - Whether the consuming component/modal is open (gates the fetch)
 * @returns Object with stats (null until loaded or if unavailable)
 */
export function useAIFeedbackStats(projectPath: string | undefined, isOpen: boolean) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);

  useEffect(() => {
    if (!isOpen || !projectPath) {
      return;
    }
    const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
    getOrCreateProject(projectPath, projectName)
      .then(projectId => getFeedbackStats(projectId))
      .then(setStats)
      .catch(() => setStats(null));
  }, [isOpen, projectPath]);

  return { stats };
}
