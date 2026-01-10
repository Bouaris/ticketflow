/**
 * ScoreBadge - Circular badge displaying AI priority score
 *
 * Color coding:
 * - Red (>= 80): Critical priority
 * - Orange (60-79): High priority
 * - Yellow (40-59): Medium priority
 * - Green (< 40): Low priority
 *
 * Uses Portal to render tooltip at document.body level,
 * escaping stacking context issues with z-index.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PriorityFactors } from '../../../types/ai';
import { ScoreTooltip } from './ScoreTooltip';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  factors?: PriorityFactors;
  rationale?: string;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

function getScoreColor(score: number): {
  bg: string;
  text: string;
  ring: string;
} {
  if (score >= 80) {
    return {
      bg: 'bg-red-500',
      text: 'text-white',
      ring: 'ring-red-300',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-orange-500',
      text: 'text-white',
      ring: 'ring-orange-300',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-amber-400',
      text: 'text-amber-900',
      ring: 'ring-amber-200',
    };
  }
  return {
    bg: 'bg-green-500',
    text: 'text-white',
    ring: 'ring-green-300',
  };
}

export function ScoreBadge({
  score,
  size = 'sm',
  showTooltip = true,
  factors,
  rationale,
  onClick,
  className = '',
}: ScoreBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const colors = getScoreColor(score);

  // Calculate tooltip position when hovering
  const updateTooltipPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, []);

  // Update position on hover and scroll
  useEffect(() => {
    if (!isHovered || !showTooltip || !factors) return;

    updateTooltipPosition();

    // Update position on scroll/resize
    const handleScroll = () => updateTooltipPosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isHovered, showTooltip, factors, updateTooltipPosition]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    updateTooltipPosition();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltipPosition(null);
  };

  return (
    <div
      className={`inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        onClick={onClick}
        type="button"
        aria-label={`Score IA: ${score} sur 100`}
        className={`
          ${sizeClasses[size]}
          ${colors.bg}
          ${colors.text}
          rounded-full flex items-center justify-center
          font-bold shadow-sm
          transition-all duration-150
          hover:ring-2 ${colors.ring}
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
        `}
        title={`Score IA: ${score}`}
      >
        {score}
      </button>

      {/* Render tooltip via Portal to escape stacking context */}
      {showTooltip && isHovered && factors && tooltipPosition && createPortal(
        <ScoreTooltip
          score={score}
          factors={factors}
          rationale={rationale}
          position={tooltipPosition}
        />,
        document.body
      )}
    </div>
  );
}

/**
 * Compact variant for inline display
 */
export function ScoreBadgeInline({
  score,
  className = '',
}: {
  score: number;
  className?: string;
}) {
  const colors = getScoreColor(score);

  return (
    <span
      className={`
        inline-flex items-center justify-center
        px-1.5 py-0.5 rounded text-[10px] font-bold
        ${colors.bg} ${colors.text}
        ${className}
      `}
    >
      {score}
    </span>
  );
}
