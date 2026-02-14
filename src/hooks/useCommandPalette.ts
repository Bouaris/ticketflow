/**
 * Command Palette State Hook
 *
 * Manages the open/close state of the command palette overlay.
 * Simple boolean state with toggle support.
 *
 * @module hooks/useCommandPalette
 */

import { useState, useCallback } from 'react';

/**
 * Provides open/close state management for the command palette.
 *
 * @returns Object with isOpen state and open/close/toggle functions
 */
export function useCommandPalette(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}
