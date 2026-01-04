/**
 * Keyboard Shortcuts Hook
 *
 * Handles global keyboard shortcuts for undo/redo operations.
 * Automatically ignores shortcuts when focus is in input fields.
 */

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  /** Undo callback (Ctrl+Z) */
  onUndo: () => void;
  /** Redo callback (Ctrl+Y or Ctrl+Shift+Z) */
  onRedo: () => void;
}

/**
 * Hook that registers global keyboard shortcuts for undo/redo.
 * Shortcuts are disabled when focus is in input, textarea, or contenteditable elements.
 */
export function useKeyboardShortcuts({ onUndo, onRedo }: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      }

      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);
}
