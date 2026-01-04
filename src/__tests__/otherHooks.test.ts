/**
 * Other Hooks Tests
 *
 * Tests for smaller utility hooks:
 * - useKeyboardShortcuts (3 tests)
 * - useKanbanColumnWidths (7 tests)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useKanbanColumnWidths, KANBAN_BASE_WIDTH } from '../hooks/useKanbanColumnWidths';

// ============================================================
// useKeyboardShortcuts TESTS (1-3)
// ============================================================

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. calls onUndo when Ctrl+Z is pressed', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }));

    // Simulate Ctrl+Z
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', {
      value: document.createElement('div'),
    });
    window.dispatchEvent(event);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).not.toHaveBeenCalled();
  });

  test('2. calls onRedo when Ctrl+Y is pressed', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }));

    // Simulate Ctrl+Y
    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', {
      value: document.createElement('div'),
    });
    window.dispatchEvent(event);

    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  test('3. does not call callbacks when focus is in input field', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onUndo, onRedo }));

    // Simulate Ctrl+Z with input target
    const inputElement = document.createElement('input');
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', {
      value: inputElement,
    });
    window.dispatchEvent(event);

    expect(onUndo).not.toHaveBeenCalled();
  });
});

// ============================================================
// useKanbanColumnWidths TESTS (4-10)
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
