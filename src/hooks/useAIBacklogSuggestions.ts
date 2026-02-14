/**
 * useAIBacklogSuggestions - Hook for AI-powered backlog analysis
 *
 * Provides:
 * - Backlog analysis with prioritization scores
 * - Item grouping suggestions
 * - Blocking bug detection
 * - User decision tracking (accept/reject)
 * - Session caching for performance
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { BacklogItem } from '../types/backlog';
import type {
  BacklogAnalysisResponse,
  ItemPriorityScore,
  ItemGroup,
  BlockingBug,
  SuggestionDecision,
} from '../types/ai';
import { analyzeBacklog, type AnalyzeBacklogOptions } from '../lib/ai';
import { isAbortError } from '../lib/abort';
import {
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,
  hasValidCache,
} from '../lib/ai-cache';
import {
  loadDecisionsAsMap,
  saveDecision,
  removeDecision,
  clearDecisions,
} from '../lib/ai-decisions';
import { useTranslation } from '../i18n';

// ============================================================
// TYPES
// ============================================================

export interface AnalysisProgress {
  current: number;
  total: number;
}

export interface UseAIBacklogSuggestionsReturn {
  // State
  analysis: BacklogAnalysisResponse | null;
  isAnalyzing: boolean;
  error: string | null;
  progress: AnalysisProgress | null;
  hasCache: boolean;

  // Actions
  analyze: (options?: Partial<AnalyzeBacklogOptions>) => Promise<void>;
  refreshAnalysis: () => Promise<void>;
  clearAnalysis: () => void;

  // Decision tracking
  decisions: Map<string, SuggestionDecision>;
  acceptSuggestion: (suggestionId: string, type: 'priority' | 'group') => void;
  rejectSuggestion: (suggestionId: string) => void;
  clearDecision: (suggestionId: string) => void;
  clearAllDecisions: () => void;

  // Getters
  getItemScore: (itemId: string) => ItemPriorityScore | null;
  getItemGroup: (itemId: string) => ItemGroup | null;
  isItemBlocking: (itemId: string) => boolean;
  getBlockingInfo: (itemId: string) => BlockingBug | null;

  // Derived data
  sortedByAIPriority: BacklogItem[];
  highPriorityItems: BacklogItem[];
  blockingBugs: BlockingBug[];
  insights: string[];
  groups: ItemGroup[];
}

// ============================================================
// HOOK
// ============================================================

export function useAIBacklogSuggestions(
  items: BacklogItem[],
  projectPath: string | null
): UseAIBacklogSuggestionsReturn {
  const { t } = useTranslation();

  // State
  const [analysis, setAnalysis] = useState<BacklogAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [decisions, setDecisions] = useState<Map<string, SuggestionDecision>>(new Map());

  // Stable hash of items for dependency array (based on IDs sorted)
  const itemsHash = useMemo(() => {
    return items.map(i => i.id).sort().join(',');
  }, [items]);

  // Track previous project to detect project changes
  const prevProjectPathRef = useRef<string | null>(null);

  // AbortController for cancelling in-progress analysis
  const abortControllerRef = useRef<AbortController | null>(null);

  // CRITICAL: Reset and reload analysis when project changes
  useEffect(() => {
    const projectChanged = prevProjectPathRef.current !== projectPath;
    prevProjectPathRef.current = projectPath;

    // If project changed, reset ALL state to prevent cross-project data leakage
    if (projectChanged) {
      setAnalysis(null);
      setError(null);
      setProgress(null);
      setDecisions(new Map());
    }

    if (!projectPath) return;

    // Load cached analysis if valid for this specific project
    const cached = getCachedAnalysis(projectPath, items);
    if (cached) {
      setAnalysis(cached);
    } else if (projectChanged) {
      // Ensure analysis is null if no cache on project change
      setAnalysis(null);
    }

    // Load decisions for this specific project (only on project change)
    if (projectChanged) {
      const loadedDecisions = loadDecisionsAsMap(projectPath);
      setDecisions(loadedDecisions);
    }
  }, [projectPath, itemsHash, items]);

  // Abort any in-progress analysis when project changes or unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [projectPath]);

  // Check if valid cache exists
  const hasCache = useMemo(() => {
    if (!projectPath) return false;
    return hasValidCache(projectPath, items);
  }, [projectPath, items]);

  // Build lookup maps for efficient access
  const priorityMap = useMemo(() => {
    if (!analysis) return new Map<string, ItemPriorityScore>();
    return new Map(analysis.priorities.map(p => [p.itemId, p]));
  }, [analysis]);

  const blockingMap = useMemo(() => {
    if (!analysis) return new Map<string, BlockingBug>();
    return new Map(analysis.blockingBugs.map(b => [b.itemId, b]));
  }, [analysis]);

  // Analyze backlog
  const analyze = useCallback(async (options?: Partial<AnalyzeBacklogOptions>) => {
    if (!projectPath || items.length === 0) return;

    // Cancel any existing analysis
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setError(null);
    setProgress({ current: 0, total: 1 });

    try {
      const result = await analyzeBacklog(items, {
        projectPath,
        signal: controller.signal,
        onProgress: (current, total) => {
          // Only update if not aborted
          if (!controller.signal.aborted) {
            setProgress({ current, total });
          }
        },
        ...options,
      });

      // Only update state if not aborted
      if (!controller.signal.aborted) {
        if (result.success && result.analysis) {
          setAnalysis(result.analysis);
          setCachedAnalysis(projectPath, items, result.analysis);
        } else {
          setError(result.error || t.error.analysisError);
        }
      }
    } catch (err) {
      // Silently ignore abort errors
      if (!isAbortError(err) && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : t.error.unknown);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
        setProgress(null);
      }
    }
  }, [items, projectPath, t]);

  // Force refresh (clear cache and re-analyze)
  const refreshAnalysis = useCallback(async () => {
    if (projectPath) {
      clearAnalysisCache(projectPath);
    }
    await analyze();
  }, [analyze, projectPath]);

  // Clear analysis
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
    if (projectPath) {
      clearAnalysisCache(projectPath);
    }
  }, [projectPath]);

  // Decision management
  const acceptSuggestion = useCallback((suggestionId: string, _type: 'priority' | 'group') => {
    if (!projectPath) return;

    const decision: SuggestionDecision = {
      suggestionId,
      decision: 'accepted',
      decidedAt: Date.now(),
    };

    saveDecision(projectPath, decision);
    setDecisions(prev => new Map(prev).set(suggestionId, decision));
  }, [projectPath]);

  const rejectSuggestion = useCallback((suggestionId: string) => {
    if (!projectPath) return;

    const decision: SuggestionDecision = {
      suggestionId,
      decision: 'rejected',
      decidedAt: Date.now(),
    };

    saveDecision(projectPath, decision);
    setDecisions(prev => new Map(prev).set(suggestionId, decision));
  }, [projectPath]);

  const clearDecision = useCallback((suggestionId: string) => {
    if (!projectPath) return;

    removeDecision(projectPath, suggestionId);
    setDecisions(prev => {
      const next = new Map(prev);
      next.delete(suggestionId);
      return next;
    });
  }, [projectPath]);

  const clearAllDecisions = useCallback(() => {
    if (!projectPath) return;

    clearDecisions(projectPath);
    setDecisions(new Map());
  }, [projectPath]);

  // Getters
  const getItemScore = useCallback((itemId: string): ItemPriorityScore | null => {
    return priorityMap.get(itemId) || null;
  }, [priorityMap]);

  const getItemGroup = useCallback((itemId: string): ItemGroup | null => {
    if (!analysis) return null;
    return analysis.groups.find(g => g.items.includes(itemId)) || null;
  }, [analysis]);

  const isItemBlocking = useCallback((itemId: string): boolean => {
    return blockingMap.has(itemId);
  }, [blockingMap]);

  const getBlockingInfo = useCallback((itemId: string): BlockingBug | null => {
    return blockingMap.get(itemId) || null;
  }, [blockingMap]);

  // Derived data
  const sortedByAIPriority = useMemo(() => {
    if (!analysis) return items;

    return [...items].sort((a, b) => {
      const scoreA = priorityMap.get(a.id)?.score ?? 0;
      const scoreB = priorityMap.get(b.id)?.score ?? 0;
      return scoreB - scoreA; // Descending (highest first)
    });
  }, [items, analysis, priorityMap]);

  const highPriorityItems = useMemo(() => {
    return sortedByAIPriority.filter(item => {
      const score = priorityMap.get(item.id)?.score ?? 0;
      return score >= 70;
    });
  }, [sortedByAIPriority, priorityMap]);

  const blockingBugs = useMemo(() => {
    return analysis?.blockingBugs || [];
  }, [analysis]);

  const insights = useMemo(() => {
    return analysis?.insights || [];
  }, [analysis]);

  const groups = useMemo(() => {
    return analysis?.groups || [];
  }, [analysis]);

  return {
    // State
    analysis,
    isAnalyzing,
    error,
    progress,
    hasCache,

    // Actions
    analyze,
    refreshAnalysis,
    clearAnalysis,

    // Decision tracking
    decisions,
    acceptSuggestion,
    rejectSuggestion,
    clearDecision,
    clearAllDecisions,

    // Getters
    getItemScore,
    getItemGroup,
    isItemBlocking,
    getBlockingInfo,

    // Derived data
    sortedByAIPriority,
    highPriorityItems,
    blockingBugs,
    insights,
    groups,
  };
}
