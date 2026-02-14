/**
 * InsightsPanel - Display AI-generated insights about the backlog
 */

import { SparklesIcon, InfoIcon } from '../../ui/Icons';

interface InsightsPanelProps {
  insights: string[];
  className?: string;
}

export function InsightsPanel({ insights, className = '' }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-muted uppercase tracking-wide">
        <SparklesIcon className="w-3.5 h-3.5 text-accent-text" />
        Insights IA
      </h4>

      <div className="space-y-1.5">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex items-start gap-2 p-2.5 bg-accent-soft border border-accent/20 rounded-lg"
          >
            <InfoIcon className="w-4 h-4 text-accent-text flex-shrink-0 mt-0.5" />
            <p className="text-sm text-on-surface leading-relaxed">
              {insight}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact variant for sidebar
 */
export function InsightsCompact({
  insights,
  maxItems = 3,
  className = '',
}: {
  insights: string[];
  maxItems?: number;
  className?: string;
}) {
  if (insights.length === 0) return null;

  const displayInsights = insights.slice(0, maxItems);
  const remaining = insights.length - maxItems;

  return (
    <div className={`space-y-1 ${className}`}>
      {displayInsights.map((insight, index) => (
        <p
          key={index}
          className="text-xs text-on-surface-secondary leading-relaxed line-clamp-2"
        >
          <span className="text-accent-text mr-1">•</span>
          {insight}
        </p>
      ))}
      {remaining > 0 && (
        <p className="text-xs text-on-surface-faint">
          +{remaining} autre{remaining > 1 ? 's' : ''} insight{remaining > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
