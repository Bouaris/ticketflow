/**
 * useHistoryDB - Persistent undo/redo history via SQLite.
 *
 * Uses delta-based storage for incremental changes (~90% size reduction)
 * with full-snapshot fallback for backward compatibility.
 *
 * @module hooks/useHistoryDB
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  saveDelta,
  saveFullSnapshot,
  applyUndo,
  applyRedo,
  getSnapshotAtIndex,
  deleteHistoryAfterIndex,
  getHistoryCount,
  getHistoryStack,
} from '../db/queries/history';
import type { DbHistory } from '../db/schema';

/** Maximum number of history entries to maintain */
const MAX_HISTORY = 50;

/**
 * Return type for useHistoryDB hook.
 */
export interface UseHistoryDBReturn {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo and return the previous snapshot JSON */
  undo: () => Promise<string | null>;
  /** Redo and return the next snapshot JSON */
  redo: () => Promise<string | null>;
  /** Push current state to history before a mutation */
  pushToHistory: (backlogJson: string, description: string) => Promise<void>;
  /** Current position in history stack (0-indexed from oldest) */
  currentIndex: number;
  /** Total number of history entries */
  historyLength: number;
  /** Whether history is still loading */
  isLoading: boolean;
  /** Clear redo stack (call when making new change after undo) */
  clearRedoStack: () => Promise<void>;
}

/**
 * Reconstruct state at a given index by replaying deltas from the
 * nearest full snapshot forward (or backward).
 *
 * The history stack is ordered oldest-first. We find the nearest full
 * snapshot at or before the target index, then apply deltas forward.
 */
function reconstructStateAtIndex(
  stack: DbHistory[],
  targetIndex: number
): unknown | null {
  // Find nearest full snapshot at or before targetIndex
  let baseIndex = -1;
  for (let i = targetIndex; i >= 0; i--) {
    const entry = stack[i];
    // Entries with delta_type null or 'full' are full snapshots
    // (null = legacy entries from before delta support)
    if (!entry.delta_type || entry.delta_type === 'full') {
      baseIndex = i;
      break;
    }
  }

  if (baseIndex === -1) {
    // No full snapshot found - cannot reconstruct
    return null;
  }

  // Parse the base snapshot
  let state: unknown;
  try {
    state = JSON.parse(stack[baseIndex].backlog_snapshot);
  } catch {
    return null;
  }

  // Apply deltas forward from baseIndex+1 to targetIndex
  for (let i = baseIndex + 1; i <= targetIndex; i++) {
    const entry = stack[i];
    if (entry.delta_type === 'delta') {
      try {
        state = applyRedo(state, entry.backlog_snapshot);
      } catch {
        // Delta application failed - return what we have
        return state;
      }
    } else {
      // Another full snapshot - use it directly
      try {
        state = JSON.parse(entry.backlog_snapshot);
      } catch {
        return state;
      }
    }
  }

  return state;
}

/**
 * Hook for managing persistent undo/redo history via SQLite.
 *
 * @param projectPath - Absolute path to the project directory (null if no project)
 * @param projectId - The project ID (null if no project)
 * @returns History management interface
 */
export function useHistoryDB(
  projectPath: string | null,
  projectId: number | null
): UseHistoryDBReturn {
  const [historyLength, setHistoryLength] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);

  // Use refs to track internal state for operations
  const historyLengthRef = useRef(historyLength);
  const currentIndexRef = useRef(currentIndex);

  // Track the current in-memory state for delta computation
  const currentStateRef = useRef<unknown>(null);

  // Cache the history stack for efficient undo/redo
  const historyStackRef = useRef<DbHistory[]>([]);

  // Keep refs in sync
  useEffect(() => {
    historyLengthRef.current = historyLength;
    currentIndexRef.current = currentIndex;
  }, [historyLength, currentIndex]);

  // Load history on mount/project change
  useEffect(() => {
    const loadHistory = async () => {
      if (!projectPath || projectId === null) {
        setHistoryLength(0);
        setCurrentIndex(-1);
        currentStateRef.current = null;
        historyStackRef.current = [];
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const count = await getHistoryCount(projectPath, projectId);
        setHistoryLength(count);

        if (count > 0) {
          // Load the full history stack for delta reconstruction
          const stack = await getHistoryStack(projectPath, projectId);
          historyStackRef.current = stack;

          // Reconstruct current state from latest entry
          const lastIndex = count - 1;
          const state = reconstructStateAtIndex(stack, lastIndex);
          currentStateRef.current = state;

          setCurrentIndex(lastIndex);
        } else {
          setCurrentIndex(-1);
          currentStateRef.current = null;
          historyStackRef.current = [];
        }
      } catch (error) {
        console.error('[useHistoryDB] Error loading history:', error);
        setHistoryLength(0);
        setCurrentIndex(-1);
        currentStateRef.current = null;
        historyStackRef.current = [];
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [projectPath, projectId]);

  /**
   * Reload the history stack from DB.
   * Called after modifications to keep cache in sync.
   */
  const reloadStack = useCallback(async () => {
    if (!projectPath || projectId === null) return;
    const stack = await getHistoryStack(projectPath, projectId);
    historyStackRef.current = stack;
  }, [projectPath, projectId]);

  /**
   * Push a new snapshot to history.
   * Uses delta storage when previous state is available,
   * falls back to full snapshot otherwise.
   */
  const pushToHistory = useCallback(async (
    backlogJson: string,
    description: string
  ) => {
    if (!projectPath || projectId === null) return;

    try {
      // If we're not at the end of history, clear the redo stack
      if (currentIndexRef.current < historyLengthRef.current - 1) {
        await deleteHistoryAfterIndex(projectPath, projectId, currentIndexRef.current);
        // Reload count after deletion
        const newCount = await getHistoryCount(projectPath, projectId);
        historyLengthRef.current = newCount;
      }

      const currentState = JSON.parse(backlogJson);

      if (currentStateRef.current !== null) {
        // Delta-based save: compute diff between previous and current state
        const entryId = await saveDelta(
          projectPath,
          projectId,
          currentStateRef.current,
          currentState,
          description
        );

        // If states were identical, saveDelta returns null - no new entry
        if (entryId === null) {
          return;
        }
      } else {
        // No previous state - save full snapshot
        await saveFullSnapshot(projectPath, projectId, backlogJson, description);
      }

      // Update in-memory state
      currentStateRef.current = currentState;

      // Update state and reload stack
      const newLength = Math.min(historyLengthRef.current + 1, MAX_HISTORY);
      setHistoryLength(newLength);
      setCurrentIndex(newLength - 1);

      await reloadStack();
    } catch (error) {
      console.error('[useHistoryDB] Error pushing to history:', error);
    }
  }, [projectPath, projectId, reloadStack]);

  /**
   * Undo: go back in history and return the previous state.
   * For delta entries, applies reverse patch. For full entries, parses directly.
   * Returns the backlog JSON string or null if can't undo.
   */
  const undo = useCallback(async (): Promise<string | null> => {
    if (!projectPath || projectId === null) return null;
    if (currentIndexRef.current <= 0) return null;

    try {
      const newIndex = currentIndexRef.current - 1;
      const stack = historyStackRef.current;

      if (stack.length === 0) {
        // Fallback: load from DB if stack not cached
        const entry = await getSnapshotAtIndex(projectPath, projectId, newIndex);
        if (!entry) return null;

        if (!entry.delta_type || entry.delta_type === 'full') {
          setCurrentIndex(newIndex);
          const parsed = JSON.parse(entry.backlog_snapshot);
          currentStateRef.current = parsed;
          return entry.backlog_snapshot;
        }
        // Cannot apply delta without stack context
        return null;
      }

      // Use the current entry (the one we're undoing FROM) to apply reverse delta
      const currentEntry = stack[currentIndexRef.current];

      if (currentEntry && currentEntry.delta_type === 'delta' && currentStateRef.current !== null) {
        // Apply reverse delta to get previous state
        const previousState = applyUndo(currentStateRef.current, currentEntry.backlog_snapshot);
        currentStateRef.current = previousState;
        setCurrentIndex(newIndex);
        return JSON.stringify(previousState);
      } else {
        // Full snapshot or no current state: reconstruct from stack
        const state = reconstructStateAtIndex(stack, newIndex);
        if (state !== null) {
          currentStateRef.current = state;
          setCurrentIndex(newIndex);
          return JSON.stringify(state);
        }
      }
    } catch (error) {
      console.error('[useHistoryDB] Error during undo:', error);
    }

    return null;
  }, [projectPath, projectId]);

  /**
   * Redo: go forward in history and return the next state.
   * For delta entries, applies forward patch. For full entries, parses directly.
   * Returns the backlog JSON string or null if can't redo.
   */
  const redo = useCallback(async (): Promise<string | null> => {
    if (!projectPath || projectId === null) return null;
    if (currentIndexRef.current >= historyLengthRef.current - 1) return null;

    try {
      const newIndex = currentIndexRef.current + 1;
      const stack = historyStackRef.current;

      if (stack.length === 0) {
        // Fallback: load from DB if stack not cached
        const entry = await getSnapshotAtIndex(projectPath, projectId, newIndex);
        if (!entry) return null;

        if (!entry.delta_type || entry.delta_type === 'full') {
          setCurrentIndex(newIndex);
          const parsed = JSON.parse(entry.backlog_snapshot);
          currentStateRef.current = parsed;
          return entry.backlog_snapshot;
        }
        return null;
      }

      // Use the next entry (the one we're redoing TO) to apply forward delta
      const nextEntry = stack[newIndex];

      if (nextEntry && nextEntry.delta_type === 'delta' && currentStateRef.current !== null) {
        // Apply forward delta to get next state
        const nextState = applyRedo(currentStateRef.current, nextEntry.backlog_snapshot);
        currentStateRef.current = nextState;
        setCurrentIndex(newIndex);
        return JSON.stringify(nextState);
      } else if (nextEntry) {
        // Full snapshot: parse directly
        if (!nextEntry.delta_type || nextEntry.delta_type === 'full') {
          const state = JSON.parse(nextEntry.backlog_snapshot);
          currentStateRef.current = state;
          setCurrentIndex(newIndex);
          return nextEntry.backlog_snapshot;
        }
        // Reconstruct from stack
        const state = reconstructStateAtIndex(stack, newIndex);
        if (state !== null) {
          currentStateRef.current = state;
          setCurrentIndex(newIndex);
          return JSON.stringify(state);
        }
      }
    } catch (error) {
      console.error('[useHistoryDB] Error during redo:', error);
    }

    return null;
  }, [projectPath, projectId]);

  /**
   * Clear the redo stack (entries after current position).
   * Call this when making a new change after undoing.
   */
  const clearRedoStack = useCallback(async () => {
    if (!projectPath || projectId === null) return;
    if (currentIndexRef.current >= historyLengthRef.current - 1) return;

    try {
      await deleteHistoryAfterIndex(projectPath, projectId, currentIndexRef.current);
      const newCount = await getHistoryCount(projectPath, projectId);
      setHistoryLength(newCount);
      await reloadStack();
    } catch (error) {
      console.error('[useHistoryDB] Error clearing redo stack:', error);
    }
  }, [projectPath, projectId, reloadStack]);

  return {
    canUndo: currentIndex > 0,
    canRedo: currentIndex < historyLength - 1,
    undo,
    redo,
    pushToHistory,
    currentIndex,
    historyLength,
    isLoading,
    clearRedoStack,
  };
}
