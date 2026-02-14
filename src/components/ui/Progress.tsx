/**
 * Progress - Progress bar component
 *
 * Used for showing completion progress (e.g., criteria completion).
 */

// ============================================================
// TYPES
// ============================================================

interface ProgressProps {
  /** Current value (0-100) */
  value: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  color?: 'primary' | 'success' | 'warning' | 'danger';
  /** Show percentage label */
  showLabel?: boolean;
  /** Additional class */
  className?: string;
  /** Label format function */
  formatLabel?: (value: number, max: number) => string;
}

// ============================================================
// SIZE & COLOR CLASSES
// ============================================================

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const colorClasses = {
  primary: 'bg-accent',
  success: 'bg-green-600',
  warning: 'bg-amber-500',
  danger: 'bg-danger',
};

const trackClasses = {
  primary: 'bg-accent-soft',
  success: 'bg-success-soft',
  warning: 'bg-amber-100',
  danger: 'bg-danger-soft',
};

// ============================================================
// COMPONENT
// ============================================================

export function Progress({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  className = '',
  formatLabel,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const label = formatLabel
    ? formatLabel(value, max)
    : `${Math.round(percentage)}%`;

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          w-full rounded-full overflow-hidden
          ${trackClasses[color]}
          ${sizeClasses[size]}
        `}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-300
            ${colorClasses[color]}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-on-surface-muted mt-1 block text-right">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================================
// LABELED PROGRESS
// ============================================================

interface LabeledProgressProps extends ProgressProps {
  /** Label text */
  label: string;
}

export function LabeledProgress({
  label,
  value,
  max = 100,
  ...props
}: LabeledProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-on-surface-secondary">{label}</span>
        <span className="text-sm text-on-surface-muted">{Math.round(percentage)}%</span>
      </div>
      <Progress value={value} max={max} {...props} />
    </div>
  );
}

// ============================================================
// CRITERIA PROGRESS (specific to criteria completion)
// ============================================================

interface CriteriaProgressProps {
  /** Completed count */
  completed: number;
  /** Total count */
  total: number;
  /** Display variant */
  variant?: 'bar' | 'text' | 'both';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class */
  className?: string;
}

export function CriteriaProgress({
  completed,
  total,
  variant = 'both',
  size = 'sm',
  className = '',
}: CriteriaProgressProps) {
  if (total === 0) return null;

  const percentage = (completed / total) * 100;
  const color = percentage === 100 ? 'success' : percentage > 50 ? 'primary' : 'warning';

  if (variant === 'text') {
    return (
      <span className={`text-xs text-on-surface-muted ${className}`}>
        {completed}/{total}
      </span>
    );
  }

  if (variant === 'bar') {
    return (
      <Progress
        value={completed}
        max={total}
        size={size}
        color={color}
        className={className}
      />
    );
  }

  // Both (default)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Progress
        value={completed}
        max={total}
        size={size}
        color={color}
        className="flex-1"
      />
      <span className="text-xs text-on-surface-muted whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}
