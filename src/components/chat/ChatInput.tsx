/**
 * ChatInput - Text input with send button for chat panel
 *
 * Supports multi-line input (textarea), auto-resize up to 4 rows,
 * Enter to send, Shift+Enter for new line.
 *
 * @module components/chat/ChatInput
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { SendIcon, SpinnerIcon } from '../ui/Icons';

// ============================================================
// TYPES
// ============================================================

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder: string;
  sendLabel: string;
}

// ============================================================
// COMPONENT
// ============================================================

export function ChatInput({ onSend, isLoading, placeholder, sendLabel }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !isLoading;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    // Max 4 rows (~96px)
    const maxHeight = 96;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, value, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="border-t border-outline p-3 bg-surface">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-input-bg border border-outline rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          title={sendLabel}
          className="flex-shrink-0 p-2 rounded-lg bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <SpinnerIcon className="w-4 h-4" />
          ) : (
            <SendIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
