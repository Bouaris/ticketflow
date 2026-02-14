/**
 * ScoreTooltip - Detailed breakdown of AI priority score factors
 *
 * Rendered via Portal at document.body level for proper z-index stacking.
 * Position is calculated by parent component using getBoundingClientRect.
 */

import type { PriorityFactors } from '../../../types/ai';

interface ScoreTooltipProps {
  score: number;
  factors: PriorityFactors;
  rationale?: string;
  /** Position calculated by parent (center of trigger element) */
  position?: { top: number; left: number };
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const getBarColor = (v: number) => {
    if (v >= 80) return 'bg-danger-soft0';
    if (v >= 60) return 'bg-orange-500';
    if (v >= 40) return 'bg-amber-400';
    return 'bg-success-soft0';
  };

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-on-surface-secondary">{label}</span>
        <span className="font-medium text-on-surface">{value}</span>
      </div>
      <div className="h-1 bg-outline rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(value)} transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreTooltip({ score, factors, rationale, position }: ScoreTooltipProps) {
  // Calculate style based on position prop (Portal mode) or use relative positioning
  const positionStyle = position
    ? {
        position: 'fixed' as const,
        top: `${position.top - 8}px`, // 8px margin above
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
      }
    : {};

  return (
    <div
      role="tooltip"
      aria-label={`Score IA: ${score} sur 100`}
      className={`
        ${position ? '' : 'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2'}
        w-48 p-3 bg-surface rounded-lg shadow-lg border border-outline
        animate-in fade-in-0 zoom-in-95 duration-150
      `}
      style={positionStyle}
    >
      {/* Score header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-on-surface-muted">Score IA</span>
        <span className="text-lg font-bold text-on-surface">{score}</span>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        <FactorBar label="Gravité" value={factors.severity} />
        <FactorBar label="Urgence" value={factors.urgency} />
        <FactorBar label="Impact Business" value={factors.businessImpact} />
      </div>

      {/* Rationale */}
      {rationale && (
        <div className="mt-3 pt-2 border-t border-outline">
          <p className="text-[10px] text-on-surface-muted leading-relaxed line-clamp-3">
            {rationale}
          </p>
        </div>
      )}

      {/* Arrow */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface border-r border-b border-outline rotate-45" />
    </div>
  );
}
