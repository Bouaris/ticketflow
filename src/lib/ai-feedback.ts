/**
 * AI Feedback Module - Star rating and learning loop
 *
 * Provides:
 * - Recording user feedback (1-5 star ratings) on AI-generated tickets
 * - Statistics computation (average rating, trend, total count)
 * - Feedback scores map for biasing few-shot selection
 * - Auto-trim to prevent unbounded table growth
 *
 * @module lib/ai-feedback
 */

import { getDatabase, getCurrentProjectPath } from '../db/database';

// ============================================================
// TYPES
// ============================================================

export type FeedbackOperation = 'generate' | 'refine' | 'questioning';

export interface FeedbackEntry {
  projectId: number;
  itemId: string;
  operation: FeedbackOperation;
  rating: number; // 1-5
  feedbackText?: string;
  provider: string;
  model: string;
}

export interface FeedbackStats {
  averageRating: number;
  totalFeedback: number;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  recentAvg: number;
  olderAvg: number;
}

// ============================================================
// FEEDBACK RECORDING
// ============================================================

/**
 * Record a user feedback entry for an AI-generated ticket.
 *
 * Automatically trims old entries to prevent unbounded growth.
 * Fails silently - feedback should never break the app.
 *
 * @param entry - Feedback entry to record
 */
export async function recordFeedback(entry: FeedbackEntry): Promise<void> {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      console.warn('[Feedback] No active project path');
      return;
    }

    const db = await getDatabase(projectPath);

    // Insert feedback entry
    await db.execute(
      `INSERT INTO ai_feedback
       (project_id, item_id, operation, rating, feedback_text, provider, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.projectId,
        entry.itemId,
        entry.operation,
        entry.rating,
        entry.feedbackText || null,
        entry.provider,
        entry.model,
      ]
    );

    // Auto-trim to prevent unbounded growth (keep last 500 entries per project)
    await db.execute(
      `DELETE FROM ai_feedback
       WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM ai_feedback
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT 500
       )`,
      [entry.projectId]
    );
  } catch (error) {
    // Don't fail app operations if feedback fails - just log
    console.warn('[Feedback] Failed to record:', error);
  }
}

// ============================================================
// STATISTICS COMPUTATION
// ============================================================

/**
 * Get feedback statistics for a project.
 *
 * Computes average rating, total count, and improvement trend.
 * Trend compares last 20 ratings vs previous 20.
 *
 * @param projectId - Project ID to query
 * @returns FeedbackStats with average, trend, and counts
 */
export async function getFeedbackStats(projectId: number): Promise<FeedbackStats> {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return { averageRating: 0, totalFeedback: 0, trend: 'insufficient', recentAvg: 0, olderAvg: 0 };
  }

  const db = await getDatabase(projectPath);

  // Overall average and count
  const overallResult = await db.select<Array<{ avg_rating: number | null; total: number }>>(
    `SELECT AVG(CAST(rating AS FLOAT)) as avg_rating, COUNT(*) as total
     FROM ai_feedback WHERE project_id = $1`,
    [projectId]
  );

  const overall = overallResult[0] || { avg_rating: null, total: 0 };
  const totalFeedback = overall.total || 0;
  const averageRating = overall.avg_rating || 0;

  // If insufficient data, return early
  if (totalFeedback < 10) {
    return {
      averageRating,
      totalFeedback,
      trend: 'insufficient',
      recentAvg: 0,
      olderAvg: 0,
    };
  }

  // Recent 20 ratings average
  const recentResult = await db.select<Array<{ avg_rating: number | null }>>(
    `SELECT AVG(CAST(rating AS FLOAT)) as avg_rating
     FROM (SELECT rating FROM ai_feedback WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20)`,
    [projectId]
  );

  // Previous 20 ratings average (skip first 20, take next 20)
  const olderResult = await db.select<Array<{ avg_rating: number | null }>>(
    `SELECT AVG(CAST(rating AS FLOAT)) as avg_rating
     FROM (SELECT rating FROM ai_feedback WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 20)`,
    [projectId]
  );

  const recentAvg = recentResult[0]?.avg_rating || 0;
  const olderAvg = olderResult[0]?.avg_rating || 0;

  // Determine trend
  let trend: FeedbackStats['trend'];
  if (olderAvg === 0) {
    // Not enough older data to compare
    trend = 'stable';
  } else if (recentAvg > olderAvg + 0.2) {
    trend = 'improving';
  } else if (recentAvg < olderAvg - 0.2) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    averageRating,
    totalFeedback,
    trend,
    recentAvg,
    olderAvg,
  };
}

// ============================================================
// FEEDBACK SCORES FOR LEARNING LOOP
// ============================================================

/**
 * Get feedback scores as a map of itemId -> latest rating.
 *
 * Used by the few-shot selection to bias toward highly-rated tickets.
 * Only keeps the most recent rating per item.
 *
 * @param projectId - Project ID to query
 * @returns Map of itemId to latest rating (1-5)
 */
export async function getFeedbackScores(projectId: number): Promise<Map<string, number>> {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return new Map();
  }

  const db = await getDatabase(projectPath);

  const rows = await db.select<Array<{ item_id: string; rating: number }>>(
    `SELECT item_id, rating FROM ai_feedback
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId]
  );

  // Only keep first (most recent) rating per item_id
  const scores = new Map<string, number>();
  for (const row of rows) {
    if (!scores.has(row.item_id)) {
      scores.set(row.item_id, row.rating);
    }
  }

  return scores;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if a project has sufficient feedback data for the learning loop.
 *
 * Returns true if total feedback count >= 10.
 * Used to gate feedback-biased selection (don't bias until 10+ ratings).
 *
 * @param projectId - Project ID to query
 * @returns true if 10+ feedback entries exist
 */
export async function hasSufficientFeedback(projectId: number): Promise<boolean> {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return false;
  }

  const db = await getDatabase(projectPath);

  const result = await db.select<Array<{ total: number }>>(
    `SELECT COUNT(*) as total FROM ai_feedback WHERE project_id = $1`,
    [projectId]
  );

  return (result[0]?.total || 0) >= 10;
}
