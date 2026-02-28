/**
 * Shared badge components for item types, priorities, efforts, etc.
 *
 * Supports dynamic colors from TypeConfig.
 */

import type { ItemType, Severity, Priority, Effort } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';
import { SEVERITY_LABELS, PRIORITY_LABELS, EFFORT_SHORT_LABELS } from '../../constants/labels';
import { TYPE_COLORS } from '../../constants/colors';
import { hexToRgba } from '../../lib/utils';

// ============================================================
// TYPE BADGE
// ============================================================

interface ItemBadgeProps {
  /** Item type ID */
  type: ItemType;
  /** Type definition (for dynamic color) */
  typeConfig?: TypeDefinition;
  /** Size variant */
  size?: 'sm' | 'md';
}

export function ItemBadge({ type, typeConfig, size = 'md' }: ItemBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  // Use dynamic color from typeConfig, fallback to TYPE_COLORS constant
  const color = typeConfig?.color || TYPE_COLORS[type as keyof typeof TYPE_COLORS] || '#6b7280';
  const label = typeConfig?.label || type;

  // Calculate rgba background from hex
  const bgColor = hexToRgba(color, 0.15);

  return (
    <span
      className={`font-medium rounded border ${sizeClasses}`}
      style={{
        backgroundColor: bgColor,
        color: color,
        borderColor: hexToRgba(color, 0.3),
      }}
    >
      {label}
    </span>
  );
}

// ============================================================
// SEVERITY BADGE
// ============================================================

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  P0: 'bg-danger text-white',
  P1: 'bg-orange-500 text-white',
  P2: 'bg-warning-soft0 text-white',
  P3: 'bg-lime-500 text-white',
  P4: 'bg-gray-400 text-white',
};

export function SeverityBadge({ severity, size = 'md', showLabel = false }: SeverityBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  const label = showLabel
    ? `${severity} - ${SEVERITY_LABELS[severity]}`
    : severity;

  return (
    <span className={`font-bold rounded ${SEVERITY_COLORS[severity]} ${sizeClasses}`}>
      {label}
    </span>
  );
}

// ============================================================
// PRIORITY BADGE
// ============================================================

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

const PRIORITY_COLORS: Record<Priority, string> = {
  Haute: 'bg-danger-soft text-danger-text',
  Moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Faible: 'bg-surface-alt text-on-surface-secondary',
};

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span className={`font-medium rounded ${PRIORITY_COLORS[priority]} ${sizeClasses}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

// ============================================================
// EFFORT BADGE
// ============================================================

interface EffortBadgeProps {
  effort: Effort;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const EFFORT_COLORS: Record<Effort, string> = {
  XS: 'bg-success-soft text-success-text',
  S: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  M: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  L: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  XL: 'bg-danger-soft text-danger-text',
};

export function EffortBadge({ effort, size = 'md', showLabel = false }: EffortBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  const label = showLabel ? EFFORT_SHORT_LABELS[effort] : effort;

  return (
    <span className={`font-bold rounded ${EFFORT_COLORS[effort]} ${sizeClasses}`}>
      {label}
    </span>
  );
}
