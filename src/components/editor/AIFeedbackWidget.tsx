/**
 * AIFeedbackWidget - Star rating UI for AI-generated tickets
 *
 * Compact widget shown after AI generates a ticket.
 * - 1-5 star rating
 * - Optional text field for low ratings (1-2 stars)
 * - Auto-submit for 3+ stars
 * - Thank you confirmation after submission
 */

import { useState, useEffect, useCallback } from 'react';
import { StarIcon, CheckCircleIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface AIFeedbackWidgetProps {
  /** Whether the widget is visible */
  visible: boolean;
  /** Callback when user submits a rating */
  onSubmit: (rating: number, text?: string) => void;
  /** Whether feedback has already been submitted */
  hasSubmitted: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export function AIFeedbackWidget({ visible, onSubmit, hasSubmitted }: AIFeedbackWidgetProps) {
  const { t } = useTranslation();
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);

  // Show thank you message and fade out after submission
  useEffect(() => {
    if (hasSubmitted) {
      setShowThankYou(true);
      const timer = setTimeout(() => {
        setShowThankYou(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasSubmitted]);

  const handleStarClick = useCallback((rating: number) => {
    setSelectedRating(rating);

    // Auto-submit for 3+ stars (no text needed)
    if (rating >= 3) {
      onSubmit(rating);
    }
  }, [onSubmit]);

  const handleTextSubmit = useCallback(() => {
    if (selectedRating > 0) {
      onSubmit(selectedRating, feedbackText.trim() || undefined);
    }
  }, [selectedRating, feedbackText, onSubmit]);

  if (!visible) return null;

  // Thank you state
  if (showThankYou || hasSubmitted) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 dark:border-green-500/30 bg-success-soft p-3 flex items-center gap-2 transition-opacity duration-500">
        <CheckCircleIcon className="w-5 h-5 text-success-text flex-shrink-0" />
        <span className="text-sm text-success-text">{t.aiFeedback.thankYou}</span>
        <div className="flex gap-0.5 ml-auto">
          {[1, 2, 3, 4, 5].map(star => (
            <StarIcon
              key={star}
              className={`w-4 h-4 ${star <= selectedRating ? 'text-amber-400' : 'text-on-surface-faint'}`}
              filled={star <= selectedRating}
            />
          ))}
        </div>
      </div>
    );
  }

  // Rating input state
  return (
    <div className="mt-4 rounded-lg border border-outline bg-surface-alt p-3">
      {/* Star rating row */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-on-surface-secondary flex-shrink-0">
          {t.aiFeedback.rateGeneration}
        </span>
        <div className="flex gap-1 ml-auto">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              aria-label={`${star} ${t.aiFeedback.starLabel}${star > 1 ? 's' : ''}`}
              className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 rounded"
            >
              <StarIcon
                className={`w-6 h-6 transition-colors ${
                  star <= (hoveredStar || selectedRating)
                    ? 'text-amber-400'
                    : 'text-on-surface-faint'
                }`}
                filled={star <= (hoveredStar || selectedRating)}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Text feedback for low ratings (1-2 stars) */}
      {selectedRating > 0 && selectedRating <= 2 && (
        <div className="mt-3 space-y-2">
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            placeholder={t.aiFeedback.improvePlaceholder}
            className="w-full px-3 py-2 text-sm border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent resize-none bg-surface"
            rows={2}
          />
          <button
            type="button"
            onClick={handleTextSubmit}
            className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            {t.aiFeedback.submit}
          </button>
        </div>
      )}
    </div>
  );
}
