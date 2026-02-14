/**
 * SuggestedPrompts - Empty state with clickable prompt suggestions
 *
 * Shows proactive backlog insights (if any) above 5 static suggested prompts.
 * Proactive insights are computed locally from backlog data.
 * Each card sends the prompt text directly to the AI.
 *
 * @module components/chat/SuggestedPrompts
 */

import type { ProactiveSuggestion } from '../../types/chat';
import { SparklesIcon, WarningIcon, InfoIcon } from '../ui/Icons';

// ============================================================
// TYPES
// ============================================================

interface SuggestedPromptsProps {
  onSendPrompt: (text: string) => void;
  translations: {
    bugsOverview: string;
    priorities: string;
    effortSummary: string;
    blockers: string;
    noCriteria: string;
  };
  emptyStateText: string;
  suggestions?: ProactiveSuggestion[];
  onSendSuggestion?: (suggestion: ProactiveSuggestion) => void;
  insightsLabel?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export function SuggestedPrompts({
  onSendPrompt,
  translations,
  emptyStateText,
  suggestions = [],
  onSendSuggestion,
  insightsLabel = 'Insights',
}: SuggestedPromptsProps) {
  const prompts = [
    translations.bugsOverview,
    translations.priorities,
    translations.effortSummary,
    translations.blockers,
    translations.noCriteria,
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-8">
      <SparklesIcon className="w-10 h-10 text-on-surface-secondary/30 mb-4" />
      <p className="text-sm text-on-surface-secondary mb-6">{emptyStateText}</p>

      <div className="w-full space-y-4">
        {/* Proactive Insights */}
        {suggestions.length > 0 && onSendSuggestion && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-on-surface-secondary uppercase tracking-wide mb-2 text-center">
              {insightsLabel}
            </p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => onSendSuggestion(suggestion)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                  suggestion.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    : 'bg-accent/5 border-accent/20 hover:bg-accent/10 text-on-surface-secondary hover:text-on-surface'
                }`}
              >
                <div className="flex items-start gap-2">
                  {suggestion.severity === 'warning' ? (
                    <WarningIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span>{suggestion.message}</span>
                    {suggestion.relatedItems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {suggestion.relatedItems.map((id) => (
                          <span
                            key={id}
                            className="inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-alt text-on-surface-secondary"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Static Suggestions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-secondary uppercase tracking-wide mb-2 text-center">
            Suggestions
          </p>
          {prompts.map((prompt, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSendPrompt(prompt)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-surface-alt hover:bg-surface text-on-surface-secondary hover:text-on-surface text-sm transition-colors border border-transparent hover:border-outline"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
