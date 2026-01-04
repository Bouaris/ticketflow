/**
 * useHistory - Undo/Redo History Management
 *
 * Provides undo/redo functionality for any state type.
 * Maintains a stack of past and future states.
 */

import { useState, useCallback, useMemo } from 'react';

const MAX_HISTORY_SIZE = 50; // Limit memory usage

export interface HistoryState<T> {
  current: T | null;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
}

export interface HistoryActions<T> {
  push: (state: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  clear: () => void;
}

export function useHistory<T>(): [HistoryState<T>, HistoryActions<T>] {
  const [past, setPast] = useState<T[]>([]);
  const [current, setCurrent] = useState<T | null>(null);
  const [future, setFuture] = useState<T[]>([]);

  /**
   * Push a new state to history
   */
  const push = useCallback((state: T) => {
    setCurrent(prevCurrent => {
      if (prevCurrent !== null) {
        setPast(prevPast => {
          const newPast = [...prevPast, prevCurrent];
          // Limit history size
          if (newPast.length > MAX_HISTORY_SIZE) {
            return newPast.slice(-MAX_HISTORY_SIZE);
          }
          return newPast;
        });
      }
      return state;
    });
    // Clear future on new action (can't redo after new change)
    setFuture([]);
  }, []);

  /**
   * Undo: Go back to previous state
   */
  const undo = useCallback((): T | null => {
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    setPast(newPast);
    setCurrent(prevCurrent => {
      if (prevCurrent !== null) {
        setFuture(prevFuture => [prevCurrent, ...prevFuture]);
      }
      return previous;
    });

    return previous;
  }, [past]);

  /**
   * Redo: Go forward to next state
   */
  const redo = useCallback((): T | null => {
    if (future.length === 0) return null;

    const next = future[0];
    const newFuture = future.slice(1);

    setFuture(newFuture);
    setCurrent(prevCurrent => {
      if (prevCurrent !== null) {
        setPast(prevPast => [...prevPast, prevCurrent]);
      }
      return next;
    });

    return next;
  }, [future]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
    setCurrent(null);
  }, []);

  const state = useMemo((): HistoryState<T> => ({
    current,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    historySize: past.length + future.length,
  }), [current, past.length, future.length]);

  const actions = useMemo((): HistoryActions<T> => ({
    push,
    undo,
    redo,
    clear,
  }), [push, undo, redo, clear]);

  return [state, actions];
}
