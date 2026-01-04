/**
 * useProjects Hook Tests
 *
 * 10 tests covering:
 * - Initial state
 * - Project CRUD operations
 * - Project ordering
 * - Storage persistence
 * - Mode detection
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PROJECTS_STORAGE_KEY, BACKLOG_FILE_NAME } from '../types/project';

// Mock tauri-bridge before importing the hook
vi.mock('../lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
  openFolderDialog: vi.fn(),
  joinPath: vi.fn((a: string, b: string) => `${a}/${b}`),
  fileExists: vi.fn(),
  writeTextFileContents: vi.fn(),
  readTextFileContents: vi.fn(),
}));

import { useProjects } from '../hooks/useProjects';
import { isTauri } from '../lib/tauri-bridge';

// ============================================================
// INITIAL STATE TESTS (1-3)
// ============================================================

describe('useProjects - Initial State', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('1. projects is empty array initially when localStorage is empty', () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.projects).toEqual([]);
  });

  test('2. isLoading is false and error is null initially', () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('3. isTauriMode reflects isTauri() result', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const { result } = renderHook(() => useProjects());
    expect(result.current.isTauriMode).toBe(false);
  });
});

// ============================================================
// CRUD TESTS (4-7)
// ============================================================

describe('useProjects - CRUD Operations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('4. addProject adds a new project', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject({
        name: 'Test Project',
        path: '/path/to/project',
        backlogFile: BACKLOG_FILE_NAME,
      });
    });

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0].name).toBe('Test Project');
    expect(result.current.projects[0].path).toBe('/path/to/project');
    expect(result.current.projects[0].id).toBeDefined();
    expect(result.current.projects[0].lastOpened).toBeDefined();
  });

  test('5. addProject updates existing project with same path', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject({
        name: 'Original Name',
        path: '/path/to/project',
        backlogFile: BACKLOG_FILE_NAME,
      });
    });

    const originalId = result.current.projects[0].id;
    const originalLastOpened = result.current.projects[0].lastOpened;

    // Wait a bit to ensure different timestamp
    act(() => {
      result.current.addProject({
        name: 'Updated Name',
        path: '/path/to/project',
        backlogFile: BACKLOG_FILE_NAME,
      });
    });

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0].name).toBe('Updated Name');
    expect(result.current.projects[0].id).toBe(originalId);
    expect(result.current.projects[0].lastOpened).toBeGreaterThanOrEqual(originalLastOpened);
  });

  test('6. removeProject removes a project by ID', () => {
    const { result } = renderHook(() => useProjects());

    let projectId: string;
    act(() => {
      const project = result.current.addProject({
        name: 'Test Project',
        path: '/path/to/project',
        backlogFile: BACKLOG_FILE_NAME,
      });
      projectId = project.id;
    });

    expect(result.current.projects.length).toBe(1);

    act(() => {
      result.current.removeProject(projectId);
    });

    expect(result.current.projects.length).toBe(0);
  });

  test('7. touchProject updates lastOpened and moves project to top', () => {
    const { result } = renderHook(() => useProjects());

    let firstProjectId: string;
    act(() => {
      const first = result.current.addProject({
        name: 'First',
        path: '/path/first',
        backlogFile: BACKLOG_FILE_NAME,
      });
      firstProjectId = first.id;
    });

    act(() => {
      result.current.addProject({
        name: 'Second',
        path: '/path/second',
        backlogFile: BACKLOG_FILE_NAME,
      });
    });

    // Second should be first (most recent)
    expect(result.current.projects[0].name).toBe('Second');

    act(() => {
      result.current.touchProject(firstProjectId);
    });

    // After touch, First should be first again
    expect(result.current.projects[0].name).toBe('First');
  });
});

// ============================================================
// STORAGE TESTS (8-9)
// ============================================================

describe('useProjects - Storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('8. projects are persisted to localStorage', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject({
        name: 'Persisted Project',
        path: '/path/to/project',
        backlogFile: BACKLOG_FILE_NAME,
      });
    });

    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Persisted Project');
  });

  test('9. projects are loaded from localStorage on mount', () => {
    // Pre-populate localStorage
    const existingProjects = [
      {
        id: 'existing-1',
        name: 'Existing Project',
        path: '/existing/path',
        backlogFile: BACKLOG_FILE_NAME,
        lastOpened: Date.now(),
      },
    ];
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(existingProjects));

    const { result } = renderHook(() => useProjects());

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0].name).toBe('Existing Project');
  });
});

// ============================================================
// TAURI MODE TESTS (10)
// ============================================================

describe('useProjects - Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('10. scanForBacklog returns empty result in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useProjects());

    let scanResult;
    await act(async () => {
      scanResult = await result.current.scanForBacklog('/some/path');
    });

    expect(scanResult).toEqual({ found: false, file: null, allFiles: [] });
  });
});
