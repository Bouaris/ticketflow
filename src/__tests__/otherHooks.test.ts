/**
 * Other Hooks Tests
 *
 * Tests for smaller utility hooks:
 * - useKanbanColumnWidths (7 tests)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKanbanColumnWidths, KANBAN_BASE_WIDTH } from '../hooks/useKanbanColumnWidths';

// ============================================================
// useKanbanColumnWidths TESTS (1-7)
// ============================================================

describe('useKanbanColumnWidths', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('4. returns empty multipliers when no project path', () => {
    const { result } = renderHook(() => useKanbanColumnWidths(undefined));
    expect(result.current.multipliers).toEqual({});
  });

  test('5. getMultiplier returns 1 by default', () => {
    const { result } = renderHook(() => useKanbanColumnWidths('/test/project'));
    expect(result.current.getMultiplier('BUG')).toBe(1);
    expect(result.current.getMultiplier('CT')).toBe(1);
  });

  test('6. getWidth returns base width by default', () => {
    const { result } = renderHook(() => useKanbanColumnWidths('/test/project'));
    expect(result.current.getWidth('BUG')).toBe(KANBAN_BASE_WIDTH);
  });

  test('7. toggleWidth switches between 1x and 2x', () => {
    const { result } = renderHook(() => useKanbanColumnWidths('/test/project'));

    expect(result.current.getMultiplier('BUG')).toBe(1);

    act(() => {
      result.current.toggleWidth('BUG');
    });

    expect(result.current.getMultiplier('BUG')).toBe(2);
    expect(result.current.getWidth('BUG')).toBe(KANBAN_BASE_WIDTH * 2);

    act(() => {
      result.current.toggleWidth('BUG');
    });

    expect(result.current.getMultiplier('BUG')).toBe(1);
  });

  test('8. toggleWidth persists to localStorage', () => {
    const { result } = renderHook(() => useKanbanColumnWidths('/test/project'));

    act(() => {
      result.current.toggleWidth('BUG');
    });

    // Verify value is persisted by checking it survives a "reload"
    // The next render should load from localStorage
    const { result: result2 } = renderHook(() => useKanbanColumnWidths('/test/project'));
    expect(result2.current.getMultiplier('BUG')).toBe(2);
  });

  test('9. resetWidths clears all multipliers', () => {
    const { result } = renderHook(() => useKanbanColumnWidths('/test/project'));

    act(() => {
      result.current.toggleWidth('BUG');
      result.current.toggleWidth('CT');
    });

    expect(result.current.getMultiplier('BUG')).toBe(2);
    expect(result.current.getMultiplier('CT')).toBe(2);

    act(() => {
      result.current.resetWidths();
    });

    expect(result.current.getMultiplier('BUG')).toBe(1);
    expect(result.current.getMultiplier('CT')).toBe(1);
  });

  test('10. loads multipliers when project path changes', () => {
    // Set up storage for project A
    const projectAPath = '/project/a';
    const { result, rerender } = renderHook(
      ({ path }) => useKanbanColumnWidths(path),
      { initialProps: { path: projectAPath } }
    );

    act(() => {
      result.current.toggleWidth('BUG');
    });

    expect(result.current.getMultiplier('BUG')).toBe(2);

    // Switch to project B (should have fresh multipliers)
    rerender({ path: '/project/b' });

    expect(result.current.getMultiplier('BUG')).toBe(1);

    // Switch back to project A (should restore saved multipliers)
    rerender({ path: projectAPath });

    expect(result.current.getMultiplier('BUG')).toBe(2);
  });
});
