/**
 * Shared badge components for item types, priorities, efforts, etc.
 */

import type { ItemType, Severity, Priority, Effort } from '../../types/backlog';
import { TYPE_LABELS } from '../../types/backlog';

// ============================================================
// TYPE BADGE
// ============================================================

interface ItemBadgeProps {
  type: ItemType;
  size?: 'sm' | 'md';
}

export function ItemBadge({ type, size = 'md' }: ItemBadgeProps) {
  const colors: Record<ItemType, string> = {
    BUG: 'bg-red-100 text-red-700 border-red-200',
    EXT: 'bg-blue-100 text-blue-700 border-blue-200',
    ADM: 'bg-purple-100 text-purple-700 border-purple-200',
    COS: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    LT: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span className={`font-medium rounded border ${colors[type]} ${sizeClasses}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ============================================================
// SEVERITY BADGE
// ============================================================

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const colors: Record<Severity, string> = {
    P0: 'bg-red-600 text-white',
    P1: 'bg-orange-500 text-white',
    P2: 'bg-amber-500 text-white',
    P3: 'bg-lime-500 text-white',
    P4: 'bg-gray-400 text-white',
  };

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span className={`font-bold rounded ${colors[severity]} ${sizeClasses}`}>
      {severity}
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

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const colors: Record<Priority, string> = {
    Haute: 'bg-red-100 text-red-700',
    Moyenne: 'bg-amber-100 text-amber-700',
    Faible: 'bg-gray-100 text-gray-600',
  };

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span className={`font-medium rounded ${colors[priority]} ${sizeClasses}`}>
      {priority}
    </span>
  );
}

// ============================================================
// EFFORT BADGE
// ============================================================

interface EffortBadgeProps {
  effort: Effort;
  size?: 'sm' | 'md';
}

export function EffortBadge({ effort, size = 'md' }: EffortBadgeProps) {
  const colors: Record<Effort, string> = {
    XS: 'bg-green-100 text-green-700',
    S: 'bg-lime-100 text-lime-700',
    M: 'bg-amber-100 text-amber-700',
    L: 'bg-orange-100 text-orange-700',
    XL: 'bg-red-100 text-red-700',
  };

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-xs px-2 py-1';

  return (
    <span className={`font-bold rounded ${colors[effort]} ${sizeClasses}`}>
      {effort}
    </span>
  );
}
