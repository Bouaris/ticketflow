/**
 * Onboarding Hook
 *
 * Manages first-run onboarding state via dual persistence:
 * - localStorage: synchronous, fast primary check
 * - SQLite user_preferences: survives browser data clears
 *
 * Global flag (not per-project) - once completed, never shown again.
 *
 * @module hooks/useOnboarding
 */

import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storage';

interface UseOnboardingResult {
  /** True while checking SQLite fallback on startup */
  isLoading: boolean;
  /** Whether onboarding has been completed */
  isComplete: boolean;
  /** Mark onboarding as complete (persists to both localStorage and SQLite) */
  markComplete: () => void;
}

/**
 * Check and manage onboarding completion state.
 *
 * Uses dual persistence strategy:
 * 1. localStorage for fast synchronous checks
 * 2. SQLite user_preferences for browser-clear resilience
 *
 * On mount, checks localStorage first. If empty, attempts SQLite fallback.
 * markComplete() writes to both stores (localStorage sync, SQLite fire-and-forget).
 */
export function useOnboarding(): UseOnboardingResult {
  // ── Initial state from localStorage (synchronous, fast) ────

  const [isComplete, setIsComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
    } catch {
      return false;
    }
  });

  const [isLoading, setIsLoading] = useState(!isComplete);
  // Only loading if localStorage didn't already confirm complete

  // ── SQLite fallback check on mount ──────────────────────────

  useEffect(() => {
    if (isComplete) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function checkSqlite() {
      try {
        const { getDatabase, getCurrentProjectPath } = await import('../db/database');
        const projectPath = getCurrentProjectPath();
        if (!projectPath) {
          setIsLoading(false);
          return;
        }
        const db = await getDatabase(projectPath);
        const rows = await db.select<{ value: string }[]>(
          'SELECT value FROM user_preferences WHERE key = $1',
          ['onboarding_complete']
        );
        if (!cancelled && rows.length > 0 && rows[0].value === 'true') {
          // Restore to localStorage for fast future checks
          try {
            localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
          } catch {
            // localStorage not available
          }
          setIsComplete(true);
        }
      } catch {
        // SQLite not available — rely on localStorage
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkSqlite();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run once on mount only

  // ── Mark complete: dual write ───────────────────────────────

  const markComplete = useCallback(() => {
    // Primary: localStorage (instant, synchronous)
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    } catch {
      // localStorage not available
    }

    // Update React state immediately
    setIsComplete(true);

    // Secondary: SQLite fire-and-forget (survives browser clear)
    (async () => {
      try {
        const { getDatabase, getCurrentProjectPath } = await import('../db/database');
        const projectPath = getCurrentProjectPath();
        if (!projectPath) return;
        const db = await getDatabase(projectPath);
        await db.execute(
          'INSERT INTO user_preferences (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
          ['onboarding_complete', 'true']
        );
      } catch {
        // SQLite write failed — localStorage is still set, acceptable degradation
      }
    })();
  }, []);

  return {
    isLoading,
    isComplete,
    markComplete,
  };
}
