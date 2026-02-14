/**
 * useChatPanel - Encapsulates all chat panel state and operations
 *
 * Manages message history, send/clear operations, optimistic updates,
 * and abort control for in-flight requests. Keeps ProjectWorkspace minimal.
 *
 * @module hooks/useChatPanel
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { BacklogItem } from '../types/backlog';
import type { ChatMessage, ChatPanelState, ProactiveSuggestion } from '../types/chat';
import { getChatMessages, clearChatMessages, insertChatMessage } from '../db/queries/chat';
import {
  sendChatMessage,
  analyzeBacklogForSuggestions,
  executeChatAction,
  type ActionExecutionContext,
} from '../lib/ai-chat';
import { useTranslation } from '../i18n';

// ============================================================
// TYPES
// ============================================================

interface UseChatPanelParams {
  projectPath: string;
  projectId: number | null;
  items: BacklogItem[];
  locale: 'fr' | 'en';
  onUpdateItem?: (itemId: string, updates: Partial<BacklogItem>) => Promise<void>;
  onOpenItem?: (itemId: string) => void;
  onAddRelation?: (sourceId: string, targetId: string, relationType: string, reason?: string) => Promise<void>;
}

interface UseChatPanelReturn {
  messages: ChatMessage[];
  state: ChatPanelState;
  error: string | null;
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
  loadHistory: () => Promise<void>;
  suggestions: ProactiveSuggestion[];
  sendSuggestion: (suggestion: ProactiveSuggestion) => void;
}

// ============================================================
// HOOK
// ============================================================

export function useChatPanel({
  projectPath,
  projectId,
  items,
  locale,
  onUpdateItem,
  onOpenItem,
  onAddRelation,
}: UseChatPanelParams): UseChatPanelReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatPanelState>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { t } = useTranslation();

  // Proactive suggestions (computed locally, no AI call)
  const suggestions = useMemo(
    () => analyzeBacklogForSuggestions(items, locale),
    [items, locale]
  );

  // Load chat history from SQLite
  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      const history = await getChatMessages(projectPath, projectId, 50);
      setMessages(history);
    } catch (err) {
      console.error('[useChatPanel] Failed to load history:', err);
    }
  }, [projectPath, projectId]);

  // Send a user message and get AI response
  const send = useCallback(async (text: string) => {
    if (!projectId || !text.trim()) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Optimistically add user message
    const tempId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      projectId,
      role: 'user',
      content: text.trim(),
      citations: null,
      action: null,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setState('loading');
    setError(null);

    try {
      const result = await sendChatMessage({
        projectPath,
        projectId,
        userMessage: text.trim(),
        items,
        locale,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      // Replace optimistic user message and add assistant response
      // Reload from DB to get correct IDs
      let updatedHistory = await getChatMessages(projectPath, projectId, 50);
      setMessages(updatedHistory);
      setState('idle');

      // Execute action if AI response contains one
      // Skip filter/navigate actions — the AI's text response already describes the results
      const skipActionTypes = ['filter', 'navigate'];
      if (result.action && onUpdateItem && onOpenItem && !skipActionTypes.includes(result.action.type)) {
        const actionContext: ActionExecutionContext = {
          updateItem: onUpdateItem,
          openItem: onOpenItem,
          addRelation: onAddRelation,
          items,
        };
        const actionResult = await executeChatAction(result.action, actionContext);

        // Persist action confirmation as assistant message
        const confirmMessage = actionResult.success
          ? `Done: ${actionResult.message}`
          : `Failed: ${actionResult.message}`;
        await insertChatMessage(projectPath, projectId, 'assistant', confirmMessage);

        // Reload to show the confirmation message
        updatedHistory = await getChatMessages(projectPath, projectId, 50);
        setMessages(updatedHistory);
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setState('error');

      if (err instanceof Error) {
        if (err.message.includes('API key') || err.message.includes('api_key') || err.message.includes('authentication')) {
          setError(t.chat.errorNoKey);
        } else {
          setError(t.chat.errorGeneric);
        }
      } else {
        setError(t.chat.errorGeneric);
      }
    }
  }, [projectPath, projectId, items, locale]);

  // Clear all chat messages
  const clear = useCallback(async () => {
    if (!projectId) return;
    try {
      await clearChatMessages(projectPath, projectId);
      setMessages([]);
      setError(null);
      setState('idle');
    } catch (err) {
      console.error('[useChatPanel] Failed to clear messages:', err);
    }
  }, [projectPath, projectId]);

  // Load history when projectId changes
  useEffect(() => {
    if (projectId) {
      loadHistory();
    } else {
      setMessages([]);
    }
  }, [projectId, loadHistory]);

  // Send a proactive suggestion as a user question
  const sendSuggestion = useCallback((suggestion: ProactiveSuggestion) => {
    const relatedIds = suggestion.relatedItems.length > 0
      ? ` (${suggestion.relatedItems.join(', ')})`
      : '';
    const question = `${suggestion.message}${relatedIds}`;
    send(question);
  }, [send]);

  // Cleanup: abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    state,
    error,
    send,
    clear,
    loadHistory,
    suggestions,
    sendSuggestion,
  };
}
