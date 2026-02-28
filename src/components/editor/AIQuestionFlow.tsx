/**
 * AIQuestionFlow - Chat-style UI for the AI questioning flow
 *
 * Displays the conversation between user and AI, with:
 * - Message history with styled bubbles (AI left, user right)
 * - Current questions or recap display
 * - Answer input with submit and skip buttons
 * - Confidence indicator
 * - Processing spinner
 *
 * This component is purely presentational. All logic lives in useAIQuestioning.
 */

import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage, QuestioningState } from '../../lib/ai-questioning';
import { SparklesIcon, CheckCircleIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface AIQuestionFlowProps {
  /** Conversation messages to display (filtered: no system messages) */
  messages: ConversationMessage[];
  /** Current phase of questioning */
  phase: QuestioningState['phase'];
  /** Latest questions from AI */
  questions: string[];
  /** Latest recap from AI */
  recap: string | null;
  /** AI confidence level (0-1) */
  confidence: number;
  /** Whether AI is thinking */
  isProcessing: boolean;
  /** Callback when user submits answer */
  onAnswer: (text: string) => void;
  /** Callback to skip questioning */
  onSkip: () => void;
  /** Callback to confirm recap and proceed to generation */
  onConfirmRecap: () => void;
  /** Error message */
  error: string | null;
}

// ============================================================
// COMPONENT
// ============================================================

export function AIQuestionFlow({
  messages,
  phase,
  questions,
  recap,
  confidence,
  isProcessing,
  onAnswer,
  onSkip,
  onConfirmRecap,
  error,
}: AIQuestionFlowProps) {
  const { t } = useTranslation();
  const [answerText, setAnswerText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, questions, recap, isProcessing]);

  // Auto-focus textarea when questions appear
  useEffect(() => {
    if (phase === 'questioning' && !isProcessing) {
      textareaRef.current?.focus();
    }
  }, [phase, isProcessing]);

  const handleSubmit = () => {
    if (!answerText.trim() || isProcessing) return;
    onAnswer(answerText.trim());
    setAnswerText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-4 border border-outline rounded-xl overflow-hidden bg-surface">
      {/* Header */}
      <div className="px-4 py-2.5 bg-surface-alt border-b border-outline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-accent-text" />
          <span className="text-sm font-medium text-on-surface">
            {phase === 'questioning' && t.ai.questioningTitle}
            {phase === 'recap' && t.ai.recapTitle}
            {phase === 'ready' && t.ai.readyToGenerate}
            {phase === 'initial' && t.ai.analyzing}
          </span>
        </div>
        {/* Confidence indicator */}
        {confidence > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-accent-text">{t.ai.confidence}</span>
            <div className="w-16 h-1.5 bg-outline rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-on-surface-secondary">{Math.round(confidence * 100)}%</span>
          </div>
        )}
      </div>

      {/* Message history */}
      <div className="max-h-64 overflow-y-auto p-4 space-y-3">
        {/* Past messages (user answers only, since AI messages are parsed into questions/recap) */}
        {messages.map((msg, index) => {
          if (msg.role === 'user' && index > 0) {
            // User answers (skip the first user message which is the original description)
            return (
              <div key={index} className="flex justify-end">
                <div className="max-w-[80%] bg-accent text-white rounded-lg rounded-br-sm px-3 py-2 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.role === 'assistant') {
            // Parse AI response to show questions nicely
            try {
              const parsed = JSON.parse(msg.content) as { status: string; questions?: string[]; recap?: string | null };
              // Only show past assistant messages (not the current one)
              const isLast = index === messages.length - 1;
              if (isLast) return null; // Current message is shown in the active section below

              return (
                <div key={index} className="flex justify-start">
                  <div className="max-w-[85%] bg-accent-soft text-on-surface rounded-lg rounded-bl-sm px-3 py-2 text-sm">
                    {parsed.questions && parsed.questions.length > 0 && (
                      <ul className="space-y-1">
                        {parsed.questions.map((q, qi) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ul>
                    )}
                    {parsed.recap && <p>{parsed.recap}</p>}
                  </div>
                </div>
              );
            } catch {
              return null;
            }
          }
          return null;
        })}

        {/* Current questions */}
        {phase === 'questioning' && questions.length > 0 && !isProcessing && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-accent-soft text-on-surface rounded-lg rounded-bl-sm px-3 py-2.5 text-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <SparklesIcon className="w-3.5 h-3.5 text-accent-text" />
                <span className="text-xs font-medium text-accent-text">IA</span>
              </div>
              <ol className="space-y-2 list-decimal list-inside">
                {questions.map((q, i) => (
                  <li key={i} className="leading-relaxed">{q}</li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Current recap */}
        {phase === 'recap' && recap && !isProcessing && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-success-soft border border-green-200 dark:border-green-500/30 text-green-900 dark:text-green-200 rounded-lg rounded-bl-sm px-3 py-2.5 text-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircleIcon className="w-3.5 h-3.5 text-success-text" />
                <span className="text-xs font-medium text-success-text">Resume</span>
              </div>
              <p className="leading-relaxed">{recap}</p>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-accent-soft text-accent-text rounded-lg rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2">
              <Spinner size="sm" color="primary" />
              <span>{t.ai.analyzing}</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-danger-soft border border-danger text-danger-text rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-outline bg-surface">
        {/* Answer input (visible during questioning) */}
        {phase === 'questioning' && (
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.ai.answerPlaceholder}
              disabled={isProcessing}
              rows={2}
              className="flex-1 px-3 py-2 border border-outline-strong rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent resize-none disabled:opacity-50 disabled:bg-surface-alt"
            />
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !answerText.trim()}
                className="px-3 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t.ai.send}
              </button>
              <button
                onClick={onSkip}
                disabled={isProcessing}
                className="px-3 py-1.5 text-on-surface-muted hover:text-on-surface-secondary text-xs font-medium rounded-lg hover:bg-surface-alt transition-colors"
              >
                {t.ai.skip}
              </button>
            </div>
          </div>
        )}

        {/* Recap confirmation (visible during recap) */}
        {phase === 'recap' && !isProcessing && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-secondary">{t.ai.recapQuestion}</span>
            <div className="flex gap-2">
              <button
                onClick={onSkip}
                className="px-3 py-2 text-on-surface-secondary hover:text-on-surface text-sm font-medium rounded-lg hover:bg-surface-alt transition-colors"
              >
                {t.editor.generateDirectly}
              </button>
              <button
                onClick={onConfirmRecap}
                className="px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {t.ai.correct}
              </button>
            </div>
          </div>
        )}

        {/* Ready state */}
        {phase === 'ready' && !isProcessing && (
          <div className="flex items-center justify-center">
            <button
              onClick={onConfirmRecap}
              className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <SparklesIcon className="w-4 h-4" />
              {t.editor.generateTicket}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
