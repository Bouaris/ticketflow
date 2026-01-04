/**
 * useBacklogHistory - Undo/Redo history management
 *
 * Provides undo/redo functionality for backlog state changes.
 * Uses a stack-based approach with configurable history limit.
 */

import { useState, useCallback, useRef } from 'react';
import type { Backlog } from '../types/backlog';

const MAX_HISTORY = 50;

export interface UseBacklogHistoryReturn {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo the last change */
  undo: (currentBacklog: Backlog | null, setBacklog: (b: Backlog) => void) => void;
  /** Redo the last undone change */
  redo: (currentBacklog: Backlog | null, setBacklog: (b: Backlog) => void) => void;
  /** Push current state to history before a mutation */
  pushToHistory: (backlog: Backlog | null) => void;
  /** Clear all history (on reset) */
  clearHistory: () => void;
}

/**
 * Hook for managing undo/redo history.
 */
export function useBacklogHistory(): UseBacklogHistoryReturn {
  const [past, setPast] = useState<Backlog[]>([]);
  const [future, setFuture] = useState<Backlog[]>([]);
  const isUndoRedoRef = useRef(false);

  const pushToHistory = useCallback((backlog: Backlog | null) => {
    if (backlog && !isUndoRedoRef.current) {
      setPast(prev => {
        const newPast = [...prev, backlog];
        return newPast.length > MAX_HISTORY ? newPast.slice(-MAX_HISTORY) : newPast;
      });
      setFuture([]);
    }
  }, []);

  const undo = useCallback((
    currentBacklog: Backlog | null,
    setBacklog: (b: Backlog) => void
  ) => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    isUndoRedoRef.current = true;
    setPast(newPast);
    if (currentBacklog) {
      setFuture(prev => [currentBacklog, ...prev]);
    }
    setBacklog(previous);
    isUndoRedoRef.current = false;
  }, [past]);

  const redo = useCallback((
    currentBacklog: Backlog | null,
    setBacklog: (b: Backlog) => void
  ) => {
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    isUndoRedoRef.current = true;
    setFuture(newFuture);
    if (currentBacklog) {
      setPast(prev => [...prev, currentBacklog]);
    }
    setBacklog(next);
    isUndoRedoRef.current = false;
  }, [future]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    pushToHistory,
    clearHistory,
  };
}
