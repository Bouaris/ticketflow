/**
 * Badge - Generic badge component
 *
 * For displaying labels, tags, and status indicators.
 */

import { hexToRgba } from '../../lib/utils';

// ============================================================
// TYPES
// ============================================================

interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Color variant */
  color?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom background color (hex) */
  bgColor?: string;
  /** Custom text color (hex) */
  textColor?: string;
  /** Additional class */
  className?: string;
  /** Whether badge is rounded-full (pill) or rounded */
  pill?: boolean;
  /** Whether to show dot indicator */
  dot?: boolean;
}

// ============================================================
// PRESET COLORS
// ============================================================

const colorClasses = {
  gray: 'bg-gray-100 text-gray-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  pink: 'bg-pink-100 text-pink-700',
};

const dotColorClasses = {
  gray: 'bg-gray-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-2.5 py-1',
};

// ============================================================
// COMPONENT
// ============================================================

export function Badge({
  children,
  color = 'gray',
  size = 'md',
  bgColor,
  textColor,
  className = '',
  pill = true,
  dot = false,
}: BadgeProps) {
  const roundedClass = pill ? 'rounded-full' : 'rounded';

  // Custom color handling
  const style = bgColor || textColor ? {
    backgroundColor: bgColor,
    color: textColor,
  } : undefined;

  const colorClass = style ? '' : colorClasses[color];

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium
        ${sizeClasses[size]}
        ${roundedClass}
        ${colorClass}
        ${className}
      `}
      style={style}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColorClasses[color]}`} />
      )}
      {children}
    </span>
  );
}

// ============================================================
// DYNAMIC BADGE (uses hex colors)
// ============================================================

interface DynamicBadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Background color (hex) */
  color: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class */
  className?: string;
}

/**
 * Badge with dynamic color from hex value.
 * Automatically calculates contrast for text color.
 */
export function DynamicBadge({
  children,
  color,
  size = 'md',
  className = '',
}: DynamicBadgeProps) {
  // Calculate lighter background and contrasting text
  const bgColor = hexToRgba(color, 0.15);
  const textColor = color;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${sizeClasses[size]}
        ${className}
      `}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {children}
    </span>
  );
}
