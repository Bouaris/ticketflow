/**
 * Feature Tooltip Component
 *
 * Animated tooltip that appears near a feature when first used.
 * Auto-dismisses after 6 seconds or on manual dismiss.
 *
 * @module components/onboarding/FeatureTooltip
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_PRESETS, useIsReducedMotion, INSTANT_TRANSITION } from '../../lib/animation-presets';
import { CloseIcon } from '../ui/Icons';

interface FeatureTooltipProps {
  /** Whether to show the tooltip */
  visible: boolean;
  /** Tooltip message text */
  message: string;
  /** Position relative to the anchor */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Called when tooltip is dismissed (click or auto) */
  onDismiss: () => void;
}

/**
 * Position classes for tooltip positioning
 */
const POSITION_CLASSES = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

/**
 * Slide direction for animations based on position
 */
const SLIDE_OFFSET = {
  top: { y: 10 },
  bottom: { y: -10 },
  left: { x: 10 },
  right: { x: -10 },
};

/**
 * Contextual feature tooltip with auto-dismiss.
 * Shows near features on first usage to guide progressive discovery.
 */
export function FeatureTooltip({
  visible,
  message,
  position = 'bottom',
  onDismiss,
}: FeatureTooltipProps) {
  const isReducedMotion = useIsReducedMotion();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (visible) {
      timeoutRef.current = setTimeout(() => {
        onDismiss();
      }, 6000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [visible, onDismiss]);

  const slideOffset = SLIDE_OFFSET[position];
  const transition = isReducedMotion ? INSTANT_TRANSITION : SPRING_PRESETS.gentle;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, ...slideOffset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...slideOffset }}
          transition={transition}
          className={`
            absolute z-50 max-w-xs px-3 py-2 text-sm
            bg-accent text-white rounded-lg shadow-lg
            ${POSITION_CLASSES[position]}
          `}
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">{message}</span>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
              aria-label="Dismiss tooltip"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
