/**
 * Feature Tooltips Hook
 *
 * Manages first-use feature tooltip state via localStorage.
 * Tracks which features (command palette, chat panel, inline edit, drag-drop)
 * the user has encountered.
 *
 * Tooltips only show AFTER onboarding completes (not during or before).
 *
 * @module hooks/useFeatureTooltips
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ticketflow-feature-tooltips';
const ONBOARDING_KEY = 'ticketflow-onboarding-complete';

export type FeatureKey = 'commandPalette' | 'chatPanel' | 'inlineEdit' | 'dragDrop';

interface FeatureTooltipState {
  commandPalette?: boolean;
  chatPanel?: boolean;
  inlineEdit?: boolean;
  dragDrop?: boolean;
}

interface UseFeatureTooltipsResult {
  /** Check if a feature tooltip should be shown */
  shouldShow: (key: FeatureKey) => boolean;
  /** Mark a feature as seen (persists to localStorage) */
  markSeen: (key: FeatureKey) => void;
}

/**
 * Check and manage feature tooltip state.
 *
 * Uses localStorage for persistence. Tooltips only show after
 * onboarding is complete.
 */
export function useFeatureTooltips(): UseFeatureTooltipsResult {
  const [state, setState] = useState<FeatureTooltipState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const shouldShow = useCallback(
    (key: FeatureKey): boolean => {
      // Only show tooltips after onboarding completes
      try {
        const isOnboardingComplete = localStorage.getItem(ONBOARDING_KEY) === 'true';
        if (!isOnboardingComplete) {
          return false;
        }
      } catch {
        return false;
      }

      // Show if not yet seen
      return state[key] !== true;
    },
    [state]
  );

  const markSeen = useCallback((key: FeatureKey) => {
    setState((prev) => {
      const updated = { ...prev, [key]: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // localStorage not available - still update state
      }
      return updated;
    });
  }, []);

  return {
    shouldShow,
    markSeen,
  };
}
