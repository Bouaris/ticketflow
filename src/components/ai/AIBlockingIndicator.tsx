/**
 * AIBlockingIndicator - Warning badge for blocking bugs
 *
 * Displays a pulsing red indicator when an item is blocking other items
 */

import { WarningIcon } from '../ui/Icons';

interface AIBlockingIndicatorProps {
  blocksCount: number;
  severity?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  recommendation?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AIBlockingIndicator({
  blocksCount,
  severity: _severity,
  recommendation,
  size = 'sm',
  className = '',
}: AIBlockingIndicatorProps) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const containerClasses = size === 'sm' ? 'p-0.5' : 'p-1';

  return (
    <div
      role="status"
      aria-label={`Bug bloquant - ${blocksCount} item${blocksCount > 1 ? 's' : ''} dépendant${blocksCount > 1 ? 's' : ''}`}
      className={`
        relative inline-flex items-center justify-center
        ${containerClasses}
        ${className}
      `}
      title={recommendation || `Bug bloquant - ${blocksCount} item(s) dépendant(s)`}
    >
      {/* Pulsing background */}
      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50" />

      {/* Icon */}
      <span className="relative flex items-center justify-center rounded-full bg-red-500 p-0.5">
        <WarningIcon className={`${sizeClasses} text-white`} />
      </span>

      {/* Count badge */}
      {blocksCount > 0 && (
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center
                     w-3.5 h-3.5 text-[8px] font-bold text-white bg-red-700 rounded-full"
        >
          {blocksCount > 9 ? '9+' : blocksCount}
        </span>
      )}
    </div>
  );
}

/**
 * Inline variant for list views
 */
export function AIBlockingBadge({
  blocksCount,
  severity,
  className = '',
}: {
  blocksCount: number;
  severity?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  className?: string;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5
        text-[10px] font-medium rounded
        bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-500/30
        ${className}
      `}
      title={`Bug bloquant ${severity || ''} - ${blocksCount} item(s) dépendant(s)`}
    >
      <WarningIcon className="w-3 h-3" />
      <span>Bloquant</span>
      {blocksCount > 0 && (
        <span className="px-1 py-0.5 bg-red-200 dark:bg-red-800/50 rounded text-red-800 dark:text-red-200">
          {blocksCount}
        </span>
      )}
    </span>
  );
}
