/**
 * Spinner - Loading indicator component
 *
 * Consistent loading spinner for the entire app.
 */

// ============================================================
// TYPES
// ============================================================

interface SpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  color?: 'primary' | 'white' | 'gray';
  /** Additional class */
  className?: string;
  /** Label for accessibility */
  label?: string;
}

// ============================================================
// SIZE & COLOR CLASSES
// ============================================================

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

const colorClasses = {
  primary: 'border-blue-200 border-t-blue-600',
  white: 'border-white/30 border-t-white',
  gray: 'border-gray-200 border-t-gray-600',
};

// ============================================================
// COMPONENT
// ============================================================

export function Spinner({
  size = 'md',
  color = 'primary',
  className = '',
  label = 'Chargement...',
}: SpinnerProps) {
  return (
    <div
      className={`
        rounded-full animate-spin
        ${sizeClasses[size]}
        ${colorClasses[color]}
        ${className}
      `}
      role="status"
      aria-label={label}
    />
  );
}

// ============================================================
// FULL PAGE SPINNER
// ============================================================

interface FullPageSpinnerProps {
  /** Text to display below spinner */
  text?: string;
}

export function FullPageSpinner({ text }: FullPageSpinnerProps) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <Spinner size="lg" />
        {text && (
          <p className="mt-4 text-gray-600 text-sm">{text}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// INLINE SPINNER
// ============================================================

interface InlineSpinnerProps {
  /** Text to display next to spinner */
  text?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

export function InlineSpinner({ text, size = 'sm' }: InlineSpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size={size} />
      {text && <span>{text}</span>}
    </span>
  );
}
