/**
 * useBacklogHistory Tests
 *
 * 10 tests covering:
 * - Initial state
 * - Push to history
 * - Undo functionality
 * - Redo functionality
 * - History limit
 * - Clear history
 */

import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBacklogHistory } from '../hooks/useBacklogHistory';
import type { Backlog } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const createMockBacklog = (id: string): Backlog => ({
  header: `# Backlog ${id}`,
  tableOfContents: '',
  sections: [],
});

// ============================================================
// INITIAL STATE TESTS (1-2)
// ============================================================

describe('useBacklogHistory - Initial State', () => {
  test('1. canUndo is false initially', () => {
    const { result } = renderHook(() => useBacklogHistory());
    expect(result.current.canUndo).toBe(false);
  });

  test('2. canRedo is false initially', () => {
    const { result } = renderHook(() => useBacklogHistory());
    expect(result.current.canRedo).toBe(false);
  });
});

// ============================================================
// PUSH TO HISTORY TESTS (3-4)
// ============================================================

describe('useBacklogHistory - Push to History', () => {
  test('3. pushToHistory enables undo', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog = createMockBacklog('1');

    act(() => {
      result.current.pushToHistory(backlog);
    });

    expect(result.current.canUndo).toBe(true);
  });

  test('4. pushToHistory clears future stack', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const backlog3 = createMockBacklog('3');
    const setBacklog = vi.fn();

    // Push initial state
    act(() => {
      result.current.pushToHistory(backlog1);
    });

    // Simulate undo (creates future)
    act(() => {
      result.current.undo(backlog2, setBacklog);
    });

    expect(result.current.canRedo).toBe(true);

    // Push new state should clear future
    act(() => {
      result.current.pushToHistory(backlog3);
    });

    expect(result.current.canRedo).toBe(false);
  });
});

// ============================================================
// UNDO TESTS (5-6)
// ============================================================

describe('useBacklogHistory - Undo', () => {
  test('5. undo restores previous state', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const setBacklog = vi.fn();

    // Push state 1
    act(() => {
      result.current.pushToHistory(backlog1);
    });

    // Undo with current state 2
    act(() => {
      result.current.undo(backlog2, setBacklog);
    });

    expect(setBacklog).toHaveBeenCalledWith(backlog1);
  });

  test('6. undo moves current to future stack', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const setBacklog = vi.fn();

    act(() => {
      result.current.pushToHistory(backlog1);
    });

    act(() => {
      result.current.undo(backlog2, setBacklog);
    });

    // After undo, redo should be available
    expect(result.current.canRedo).toBe(true);
  });
});

// ============================================================
// REDO TESTS (7-8)
// ============================================================

describe('useBacklogHistory - Redo', () => {
  test('7. redo restores next state from future', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const setBacklog = vi.fn();

    // Setup: push and undo
    act(() => {
      result.current.pushToHistory(backlog1);
    });
    act(() => {
      result.current.undo(backlog2, setBacklog);
    });

    // Now redo
    act(() => {
      result.current.redo(backlog1, setBacklog);
    });

    // Should restore backlog2 (which was put in future during undo)
    expect(setBacklog).toHaveBeenLastCalledWith(backlog2);
  });

  test('8. redo moves current to past stack', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const setBacklog = vi.fn();

    act(() => {
      result.current.pushToHistory(backlog1);
    });
    act(() => {
      result.current.undo(backlog2, setBacklog);
    });

    // After undo, canUndo should be false (empty past)
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.redo(backlog1, setBacklog);
    });

    // After redo, canUndo should be true again
    expect(result.current.canUndo).toBe(true);
  });
});

// ============================================================
// HISTORY LIMIT & CLEAR TESTS (9-10)
// ============================================================

describe('useBacklogHistory - Limits & Clear', () => {
  test('9. history respects MAX_HISTORY limit (50)', () => {
    const { result } = renderHook(() => useBacklogHistory());

    // Push 60 items
    for (let i = 0; i < 60; i++) {
      act(() => {
        result.current.pushToHistory(createMockBacklog(`${i}`));
      });
    }

    // Should still have canUndo (limited to 50)
    expect(result.current.canUndo).toBe(true);

    // Undo 50 times should work
    const setBacklog = vi.fn();
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.undo(createMockBacklog('current'), setBacklog);
      });
    }

    // After 50 undos, canUndo should be false
    expect(result.current.canUndo).toBe(false);
  });

  test('10. clearHistory resets both stacks', () => {
    const { result } = renderHook(() => useBacklogHistory());
    const backlog1 = createMockBacklog('1');
    const backlog2 = createMockBacklog('2');
    const setBacklog = vi.fn();

    // Setup some history
    act(() => {
      result.current.pushToHistory(backlog1);
      result.current.pushToHistory(backlog2);
    });
    act(() => {
      result.current.undo(createMockBacklog('current'), setBacklog);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Clear
    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
