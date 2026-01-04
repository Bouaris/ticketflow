/**
 * useHistory Hook Tests
 *
 * 12 tests covering:
 * - Initial state (2 tests)
 * - Push functionality (3 tests)
 * - Undo functionality (3 tests)
 * - Redo functionality (2 tests)
 * - Clear functionality (2 tests)
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../hooks/useHistory';

// ============================================================
// INITIAL STATE TESTS (1-2)
// ============================================================

describe('useHistory - Initial State', () => {
  test('1. initial state has null current', () => {
    const { result } = renderHook(() => useHistory<string>());
    const [state] = result.current;

    expect(state.current).toBeNull();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.historySize).toBe(0);
  });

  test('2. actions are defined', () => {
    const { result } = renderHook(() => useHistory<number>());
    const [, actions] = result.current;

    expect(typeof actions.push).toBe('function');
    expect(typeof actions.undo).toBe('function');
    expect(typeof actions.redo).toBe('function');
    expect(typeof actions.clear).toBe('function');
  });
});

// ============================================================
// PUSH TESTS (3-5)
// ============================================================

describe('useHistory - Push', () => {
  test('3. push sets current state', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });

    expect(result.current[0].current).toBe('first');
  });

  test('4. multiple pushes enable undo', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });

    expect(result.current[0].current).toBe('second');
    expect(result.current[0].canUndo).toBe(true);
    expect(result.current[0].historySize).toBe(1);
  });

  test('5. push clears future (redo stack)', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });
    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].canRedo).toBe(true);

    act(() => {
      result.current[1].push('third');
    });

    expect(result.current[0].canRedo).toBe(false);
  });
});

// ============================================================
// UNDO TESTS (6-8)
// ============================================================

describe('useHistory - Undo', () => {
  test('6. undo returns null when no history', () => {
    const { result } = renderHook(() => useHistory<string>());

    let undoResult: string | null = 'initial';
    act(() => {
      undoResult = result.current[1].undo();
    });

    expect(undoResult).toBeNull();
  });

  test('7. undo restores previous state', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });
    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].current).toBe('first');
  });

  test('8. undo enables redo', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });

    expect(result.current[0].canRedo).toBe(false);

    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].canRedo).toBe(true);
  });
});

// ============================================================
// REDO TESTS (9-10)
// ============================================================

describe('useHistory - Redo', () => {
  test('9. redo returns null when no future', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });

    let redoResult: string | null = 'initial';
    act(() => {
      redoResult = result.current[1].redo();
    });

    expect(redoResult).toBeNull();
  });

  test('10. redo restores undone state', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });
    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].current).toBe('first');

    act(() => {
      result.current[1].redo();
    });

    expect(result.current[0].current).toBe('second');
  });
});

// ============================================================
// CLEAR TESTS (11-12)
// ============================================================

describe('useHistory - Clear', () => {
  test('11. clear resets all state', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });
    act(() => {
      result.current[1].clear();
    });

    expect(result.current[0].current).toBeNull();
    expect(result.current[0].canUndo).toBe(false);
    expect(result.current[0].canRedo).toBe(false);
    expect(result.current[0].historySize).toBe(0);
  });

  test('12. clear works after undo', () => {
    const { result } = renderHook(() => useHistory<string>());

    act(() => {
      result.current[1].push('first');
    });
    act(() => {
      result.current[1].push('second');
    });
    act(() => {
      result.current[1].undo();
    });
    act(() => {
      result.current[1].clear();
    });

    expect(result.current[0].current).toBeNull();
    expect(result.current[0].historySize).toBe(0);
  });
});
