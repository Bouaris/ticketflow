/**
 * DependencySuggestions - Non-blocking suggestion pills for dependency detection
 *
 * Displays detected relationships as color-coded interactive pills.
 * Users can accept (add to dependencies) or dismiss each suggestion.
 * Prominent warning for potential duplicates with high confidence.
 */

import type { DependencySuggestion } from '../../types/ai';
import { SparklesIcon, CloseIcon, CheckIcon, WarningIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

// ============================================================
// TYPES
// ============================================================

interface DependencySuggestionsProps {
  suggestions: DependencySuggestion[];
  isLoading: boolean;
  onAccept: (suggestion: DependencySuggestion) => void;
  onDismiss: (targetId: string) => void;
}

// ============================================================
// RELATIONSHIP STYLING
// ============================================================

const RELATIONSHIP_STYLES: Record<string, {
  bg: string;
  text: string;
  border: string;
  borderHighConfidence: string;
  label: string;
}> = {
  'blocks': {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    borderHighConfidence: 'border-red-500/50',
    label: 'Bloque',
  },
  'blocked-by': {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    borderHighConfidence: 'border-red-500/50',
    label: 'Bloque par',
  },
  'related-to': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    borderHighConfidence: 'border-blue-500/50',
    label: 'Lie a',
  },
  'potential-duplicate': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    borderHighConfidence: 'border-amber-500/50',
    label: 'Doublon potentiel',
  },
};

// ============================================================
// COMPONENT
// ============================================================

export function DependencySuggestions({
  suggestions,
  isLoading,
  onAccept,
  onDismiss,
}: DependencySuggestionsProps) {
  // Don't render if nothing to show
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  // Check for high-confidence duplicate warnings
  const duplicateWarnings = suggestions.filter(
    s => s.relationship === 'potential-duplicate' && s.confidence >= 0.7
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SparklesIcon className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-on-surface-secondary">
          Relations detectees
        </span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-on-surface-muted">
          <Spinner size="sm" />
          <span>Analyse des relations...</span>
        </div>
      )}

      {/* Potential duplicate warning bar */}
      {duplicateWarnings.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-warning-soft border border-warning-text/30 rounded-lg">
          <WarningIcon className="w-5 h-5 text-warning-text flex-shrink-0" />
          <div className="text-sm text-warning-text">
            {duplicateWarnings.length === 1 ? (
              <span>
                Ticket potentiellement en double avec{' '}
                <strong>{duplicateWarnings[0].targetId}</strong>
              </span>
            ) : (
              <span>
                Doublons potentiels detectes:{' '}
                <strong>{duplicateWarnings.map(d => d.targetId).join(', ')}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Suggestion pills */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(suggestion => {
            const style = RELATIONSHIP_STYLES[suggestion.relationship] || RELATIONSHIP_STYLES['related-to'];
            const isHighConfidence = suggestion.confidence >= 0.7;

            return (
              <div
                key={`${suggestion.targetId}-${suggestion.relationship}`}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5
                  rounded-full border text-sm
                  ${style.bg} ${style.text}
                  ${isHighConfidence ? style.borderHighConfidence : style.border}
                `}
                title={suggestion.reason}
              >
                {/* Relationship label + target ID */}
                <span className="font-medium">
                  {style.label}
                </span>
                <span className="opacity-75">{suggestion.targetId}</span>

                {/* Accept button */}
                <button
                  onClick={() => onAccept(suggestion)}
                  className="ml-1 p-0.5 rounded-full hover:bg-surface/20 transition-colors"
                  title="Accepter cette relation"
                  aria-label={`Accepter la relation ${style.label} avec ${suggestion.targetId}`}
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                </button>

                {/* Dismiss button */}
                <button
                  onClick={() => onDismiss(suggestion.targetId)}
                  className="p-0.5 rounded-full hover:bg-surface/20 transition-colors"
                  title="Ignorer cette suggestion"
                  aria-label={`Ignorer la suggestion ${suggestion.targetId}`}
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Reasons (collapsed detail) */}
      {suggestions.length > 0 && (
        <div className="text-xs text-on-surface-faint space-y-0.5">
          {suggestions.map(s => (
            <div key={`reason-${s.targetId}`}>
              {s.targetId}: {s.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
