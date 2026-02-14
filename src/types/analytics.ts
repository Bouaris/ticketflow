/**
 * TypeScript interfaces for analytics dashboard metrics.
 *
 * All analytics data shapes consumed by the dashboard UI.
 * Metrics are computed via SQL aggregate queries in db/queries/analytics.ts.
 *
 * @module types/analytics
 */

/** Count by a category (type, section, priority, effort, severity) */
export interface CategoryCount {
  label: string;
  value: number;
  color: string;
}

/** Criteria completion breakdown */
export interface CompletionStats {
  totalItems: number;
  totalCriteria: number;
  checkedCriteria: number;
  /** Percentage 0-100 */
  completionRate: number;
  /** Items with 0% completion */
  openCount: number;
  /** Items with 1-99% completion */
  inProgressCount: number;
  /** Items with 100% completion */
  doneCount: number;
}

/** Blocked chain statistics from item_relations */
export interface BlockedChainStats {
  /** Number of distinct items that block other items */
  totalBlockers: number;
  /** Number of distinct items that are blocked */
  totalBlocked: number;
  /** Top blockers with their blocked count */
  topBlockers: { itemId: string; blockedCount: number }[];
}

/** Stale items (not updated in >30 days with incomplete criteria) */
export interface StaleStats {
  staleCount: number;
  totalActive: number;
}

/** Complete analytics metrics for the dashboard */
export interface AnalyticsMetrics {
  totalItems: number;
  byType: CategoryCount[];
  bySection: CategoryCount[];
  byPriority: CategoryCount[];
  byEffort: CategoryCount[];
  completion: CompletionStats;
  blocked: BlockedChainStats;
  stale: StaleStats;
}

/** Return type for useAnalytics hook */
export interface UseAnalyticsReturn {
  metrics: AnalyticsMetrics | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}
