/**
 * MetricCard - Stat card for a single numeric metric.
 *
 * Renders a rounded card with icon, large value, label, and optional subtitle.
 * Color maps to Tailwind bg/border classes for visual distinction.
 *
 * @module components/analytics/MetricCard
 */

import type { ReactNode } from 'react';

// ============================================================
// TYPES
// ============================================================

interface MetricCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'gray';
  subtitle?: string;
}

// ============================================================
// COLOR MAP
// ============================================================

const colorMap: Record<NonNullable<MetricCardProps['color']>, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'bg-accent-soft',   border: 'border-accent/30',   text: 'text-accent-text' },
  green:  { bg: 'bg-success-soft',  border: 'border-green-200 dark:border-green-500/30',  text: 'text-success-text' },
  red:    { bg: 'bg-danger-soft',    border: 'border-danger',    text: 'text-danger-text' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-500/30', text: 'text-purple-700 dark:text-purple-300' },
  amber:  { bg: 'bg-warning-soft',  border: 'border-warning-text/30',  text: 'text-amber-700 dark:text-amber-300' },
  gray:   { bg: 'bg-surface-alt',   border: 'border-outline',   text: 'text-on-surface-secondary' },
};

// ============================================================
// COMPONENT
// ============================================================

export function MetricCard({ label, value, icon, color = 'blue', subtitle }: MetricCardProps) {
  const colors = colorMap[color];

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface-muted">{label}</span>
        {icon && <span className={colors.text}>{icon}</span>}
      </div>
      <span className={`text-3xl font-bold ${colors.text}`}>{value}</span>
      {subtitle && (
        <span className="text-xs text-on-surface-faint">{subtitle}</span>
      )}
    </div>
  );
}
