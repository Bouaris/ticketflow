/**
 * Animation Presets - Centralized motion configuration
 *
 * Provides consistent spring-based animations across the app.
 * All UI motion should import presets from here to ensure visual coherence.
 *
 * @module lib/animation-presets
 */

import { useReducedMotion } from 'motion/react';
import type { Transition, Variants } from 'motion/react';

// ============================================================
// SPRING PRESETS
// ============================================================

/** Named spring transition presets for consistent feel */
export const SPRING_PRESETS = {
  /** Fast, responsive - for hover/press feedback */
  snappy: { type: 'spring', stiffness: 500, damping: 30 } as const satisfies Transition,
  /** Smooth, natural - for modals and panels */
  gentle: { type: 'spring', stiffness: 300, damping: 25 } as const satisfies Transition,
  /** Playful, overshoot - for emphasis */
  bouncy: { type: 'spring', stiffness: 400, damping: 20 } as const satisfies Transition,
  /** Snappy with minimal overshoot - for list items */
  quick: { type: 'spring', stiffness: 600, damping: 35 } as const satisfies Transition,
} as const;

// ============================================================
// CARD ANIMATIONS
// ============================================================

/** Hover scale for kanban cards (applied via nested motion.div to avoid dnd-kit conflicts) */
export const CARD_HOVER = {
  scale: 1.02,
  transition: SPRING_PRESETS.snappy,
} as const;

// ============================================================
// ITEM ENTER / EXIT
// ============================================================

/** Fade + slide-up for items entering a list */
export const ITEM_ENTER = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
} as const;

/** Fade + slide-right for items leaving a list */
export const ITEM_EXIT = {
  exit: { opacity: 0, x: 50 },
} as const;

// ============================================================
// MODAL VARIANTS (AnimatePresence)
// ============================================================

/** Scale + opacity for centered modals */
export const MODAL_VARIANTS: Variants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
};

/** Slide from right for panel overlays */
export const PANEL_VARIANTS: Variants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

/** Opacity for backdrop */
export const BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================
// REDUCED MOTION HOOK
// ============================================================

/** Re-export useReducedMotion for convenience */
export const useIsReducedMotion = useReducedMotion;

/** Instant transition for reduced-motion users */
export const INSTANT_TRANSITION: Transition = { duration: 0 };
