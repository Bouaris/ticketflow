/**
 * useAIFeedback - React hook for AI feedback submission and stats
 *
 * Wraps the ai-feedback module with React state management,
 * providing a clean interface for the AIFeedbackWidget component.
 *
 * @module hooks/useAIFeedback
 */

import { useState, useEffect, useCallback } from 'react';
import {
  recordFeedback,
  getFeedbackStats,
  type FeedbackStats,
  type FeedbackOperation,
} from '../lib/ai-feedback';
import { getEffectiveAIConfig } from '../lib/ai';

// ============================================================
// TYPES
// ============================================================

export interface UseAIFeedbackReturn {
  /** Submit a star rating for an AI-generated item */
  submitRating: (itemId: string, rating: number, text?: string) => Promise<void>;
  /** Feedback statistics (null until loaded) */
  stats: FeedbackStats | null;
  /** Whether stats are currently loading */
  isLoadingStats: boolean;
  /** Re-fetch stats from database */
  refreshStats: () => Promise<void>;
  /** Whether a rating has been submitted in this session */
  hasSubmitted: boolean;
}

// ============================================================
// HOOK
// ============================================================

/**
 * React hook for AI feedback submission and stats display.
 *
 * @param projectId - Current project ID (null if no project)
 * @param projectPath - Current project path for AI config resolution
 * @returns Object with submission function, stats, and loading state
 */
export function useAIFeedback(
  projectId: number | null,
  projectPath?: string
): UseAIFeedbackReturn {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  /**
   * Load feedback stats from the database.
   */
  const refreshStats = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingStats(true);
    try {
      const result = await getFeedbackStats(projectId);
      setStats(result);
    } catch {
      // Stats loading failure is not critical
      console.warn('[useAIFeedback] Failed to load stats');
    } finally {
      setIsLoadingStats(false);
    }
  }, [projectId]);

  // Load stats on mount when projectId is available
  useEffect(() => {
    if (projectId) {
      refreshStats();
    }
  }, [projectId, refreshStats]);

  /**
   * Submit a star rating for an AI-generated item.
   *
   * @param itemId - The backlog item ID that was rated
   * @param rating - Star rating (1-5)
   * @param text - Optional feedback text (for low ratings)
   */
  const submitRating = useCallback(async (
    itemId: string,
    rating: number,
    text?: string
  ) => {
    if (!projectId) return;

    const { provider, modelId } = getEffectiveAIConfig();

    const operation: FeedbackOperation = 'generate';

    await recordFeedback({
      projectId,
      itemId,
      operation,
      rating,
      feedbackText: text,
      provider,
      model: modelId,
    });

    setHasSubmitted(true);
  }, [projectId, projectPath]);

  return {
    submitRating,
    stats,
    isLoadingStats,
    refreshStats,
    hasSubmitted,
  };
}
