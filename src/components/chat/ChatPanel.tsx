/**
 * ChatPanel - Integrated left-side chat panel
 *
 * Main chat UI that sits as a side panel alongside workspace content.
 * Contains header, scrollable messages area, suggested prompts (empty state),
 * error display, and input area.
 *
 * @module components/chat/ChatPanel
 */

import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType, ChatPanelState, ProactiveSuggestion } from '../../types/chat';
import type { BacklogItem } from '../../types/backlog';
import { useTranslation } from '../../i18n';
import { CloseIcon, TrashIcon } from '../ui/Icons';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';

// ============================================================
// TYPES
// ============================================================

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessageType[];
  state: ChatPanelState;
  error: string | null;
  items: BacklogItem[];
  onSend: (text: string) => void;
  onClear: () => void;
  onOpenItem: (item: BacklogItem) => void;
  suggestions?: ProactiveSuggestion[];
  onSendSuggestion?: (suggestion: ProactiveSuggestion) => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  state,
  error,
  items,
  onSend,
  onClear,
  onOpenItem,
  suggestions = [],
  onSendSuggestion,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputFocusRef = useRef<boolean>(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !inputFocusRef.current) {
      inputFocusRef.current = true;
      // Small delay to allow transition to start
      const timer = setTimeout(() => {
        const textarea = document.querySelector('[data-chat-input]') as HTMLTextAreaElement;
        textarea?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      inputFocusRef.current = false;
    }
  }, [isOpen]);

  const handleClear = () => {
    if (window.confirm(t.chat.clearConfirm)) {
      onClear();
    }
  };

  if (!isOpen) return null;

  const showSuggestions = messages.length === 0 && state === 'idle';

  return (
      <div className="w-[400px] min-w-[400px] h-full bg-surface border-r border-outline shadow-xl flex flex-col shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline">
          <h2 className="text-base font-semibold text-on-surface">
            {t.chat.title}
          </h2>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-md text-on-surface-secondary hover:text-on-surface hover:bg-surface-alt transition-colors"
                title={t.chat.clear}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-on-surface-secondary hover:text-on-surface hover:bg-surface-alt transition-colors"
              title={t.action.close}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {showSuggestions ? (
            <SuggestedPrompts
              onSendPrompt={onSend}
              translations={t.chat.suggestedPrompts}
              emptyStateText={t.chat.emptyState}
              suggestions={suggestions}
              onSendSuggestion={onSendSuggestion}
              insightsLabel={t.chat.insights}
            />
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  items={items}
                  onOpenItem={onOpenItem}
                />
              ))}
              {state === 'loading' && (
                <div className="flex justify-start mb-3">
                  <div className="bg-surface-alt rounded-xl px-3.5 py-2.5 rounded-bl-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-on-surface-secondary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-on-surface-secondary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-on-surface-secondary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={onSend}
          isLoading={state === 'loading'}
          placeholder={t.chat.placeholder}
          sendLabel={t.chat.send}
        />
      </div>
  );
}
