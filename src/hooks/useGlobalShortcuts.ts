/**
 * useGlobalShortcuts - Centralized keyboard shortcut hook
 *
 * Replaces the minimal useKeyboardShortcuts hook with a comprehensive,
 * context-aware shortcut system. Uses ref-based listener pattern to
 * avoid re-registering the keydown listener when actions change.
 *
 * Features:
 * - Context-aware: respects modal state, input focus, and selection
 * - Single keydown listener on window (never re-registered)
 * - Supports modifier combos (ctrl, shift, alt) and plain keys
 * - Special handling for Ctrl+Shift+Z as redo alternative
 *
 * @module hooks/useGlobalShortcuts
 */

import { useEffect, useRef } from 'react';
import type { ShortcutDefinition } from '../constants/shortcuts';

// ============================================================
// TYPES
// ============================================================

export interface ShortcutAction extends ShortcutDefinition {
  /** Handler called when the shortcut matches */
  handler: () => void;
}

export interface ShortcutContext {
  /** Whether any modal is currently open */
  hasOpenModal: boolean;
  /** Whether an item is currently selected */
  hasSelection: boolean;
}

// ============================================================
// KEY MATCHING
// ============================================================

interface ParsedCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+');
  const result: ParsedCombo = {
    ctrl: false,
    shift: false,
    alt: false,
    key: '',
  };

  for (const part of parts) {
    if (part === 'ctrl' || part === 'meta') {
      result.ctrl = true;
    } else if (part === 'shift') {
      result.shift = true;
    } else if (part === 'alt') {
      result.alt = true;
    } else {
      result.key = part;
    }
  }

  return result;
}

function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo);

  // Check modifiers
  const hasCtrl = e.ctrlKey || e.metaKey;
  if (parsed.ctrl !== hasCtrl) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;

  // Check key
  const eventKey = e.key.toLowerCase();

  // Special case: '?' is produced by Shift+/ on many keyboards
  // e.key already resolves to '?' so we match directly
  if (parsed.key === '?') {
    return eventKey === '?';
  }

  // Match against e.key (primary) or e.code (fallback for special keys)
  if (eventKey === parsed.key) return true;

  // Arrow keys: e.key is "ArrowUp" etc., match against parsed "arrowup"
  if (eventKey === parsed.key) return true;

  return false;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Register global keyboard shortcuts with context-aware dispatch.
 *
 * @param actions - Array of shortcut actions to register
 * @param context - Current UI context (modal state, selection state)
 */
export function useGlobalShortcuts(
  actions: ShortcutAction[],
  context: ShortcutContext,
): void {
  // Store actions and context in refs to avoid re-registering the listener
  const actionsRef = useRef(actions);
  const contextRef = useRef(context);

  // Keep refs in sync
  actionsRef.current = actions;
  contextRef.current = context;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const ctx = contextRef.current;
      const currentActions = actionsRef.current;

      for (const action of currentActions) {
        // Check main combo
        let matched = matchCombo(e, action.keys);

        // Special case: Ctrl+Shift+Z as alternative redo
        if (!matched && action.keys === 'ctrl+y') {
          matched = matchCombo(e, 'ctrl+shift+z');
        }

        if (!matched) continue;

        // Context checks
        if (!action.allowInInput && isInInput) continue;
        if (action.requiresNoModal && ctx.hasOpenModal) continue;
        if (action.requiresSelection && !ctx.hasSelection) continue;

        // Match found - prevent default and dispatch
        e.preventDefault();
        action.handler();
        return; // Only first matching shortcut fires
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps: listener registered once, reads from refs
}
