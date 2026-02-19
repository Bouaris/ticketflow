/**
 * useAIQuestioning - React hook for AI questioning flow state management
 *
 * Wraps the questioning conversation engine with React state,
 * loading indicators, error handling, and settings toggle.
 *
 * The hook manages the full lifecycle:
 * - Start questioning from a user description
 * - Submit answers to AI questions
 * - Skip questioning to generate immediately
 * - Reset conversation state
 * - Get enriched prompt after questioning completes
 */

import { useState, useCallback } from 'react';
import {
  type QuestioningState,
  createInitialState,
  startQuestioningFlow,
  continueConversation,
  buildFinalPrompt,
} from '../lib/ai-questioning';
import { useTranslation } from '../i18n';
import { STORAGE_KEYS } from '../constants/storage';

// ============================================================
// TYPES
// ============================================================

export interface UseAIQuestioningReturn {
  /** Current conversation state */
  state: QuestioningState;
  /** Whether the AI is processing */
  isProcessing: boolean;
  /** Error message if any */
  error: string | null;
  /** Start the questioning flow with a user description */
  start: (description: string) => Promise<void>;
  /** Submit an answer to the AI's questions */
  answer: (text: string) => Promise<void>;
  /** Skip questioning and go straight to generation */
  skip: () => void;
  /** Reset the conversation */
  reset: () => void;
  /** Get the enriched prompt for generation (after questioning completes) */
  getEnrichedPrompt: () => string;
  /** Whether questioning is enabled (from settings) */
  isEnabled: boolean;
}

// ============================================================
// HOOK
// ============================================================

/**
 * React hook managing the AI questioning conversation flow.
 *
 * @param projectPath - Optional project path for AI config resolution
 * @returns Object with state, actions, and settings
 */
export function useAIQuestioning(projectPath?: string): UseAIQuestioningReturn {
  const [state, setState] = useState<QuestioningState>(createInitialState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  // Read enabled state from localStorage (defaults to true if not set)
  const isEnabled = (() => {
    const stored = localStorage.getItem(STORAGE_KEYS.QUESTIONING_MODE);
    return stored === null ? true : stored === 'true';
  })();

  /**
   * Start the questioning flow with a user description.
   * If questioning is disabled, immediately sets phase to 'skipped'.
   */
  const start = useCallback(async (description: string) => {
    if (!isEnabled) {
      setState({
        ...createInitialState(),
        phase: 'skipped',
        originalDescription: description,
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const newState = await startQuestioningFlow(description, { projectPath });
      setState(newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.error.questioningStartError;
      setError(message);
      // On error, allow user to proceed with generation
      setState({
        ...createInitialState(),
        phase: 'skipped',
        originalDescription: description,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isEnabled, projectPath, t]);

  /**
   * Submit an answer to the AI's questions.
   * Continues the conversation and updates state.
   */
  const answer = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const newState = await continueConversation(state, text, { projectPath });
      setState(newState);
    } catch (err) {
      const message = err instanceof Error ? err.message : t.error.questioningConversationError;
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [state, projectPath, t]);

  /**
   * Skip questioning and go straight to generation.
   */
  const skip = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'skipped',
    }));
  }, []);

  /**
   * Reset the conversation to initial state.
   */
  const reset = useCallback(() => {
    setState(createInitialState());
    setError(null);
    setIsProcessing(false);
  }, []);

  /**
   * Get the enriched prompt for generation.
   * Uses conversation context if questioning completed,
   * or returns original description if skipped.
   */
  const getEnrichedPrompt = useCallback((): string => {
    return buildFinalPrompt(state);
  }, [state]);

  return {
    state,
    isProcessing,
    error,
    start,
    answer,
    skip,
    reset,
    getEnrichedPrompt,
    isEnabled,
  };
}
