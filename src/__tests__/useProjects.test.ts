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
import { renderHookWithProviders as renderHook, act } from '../test-utils/test-wrapper';
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

// ============================================================
// TAURI SCANFORBACKLOG TESTS (11-13)
// ============================================================

import {
  openFolderDialog,
  fileExists,
  writeTextFileContents,
  readTextFileContents,
  joinPath,
} from '../lib/tauri-bridge';

describe('useProjects - scanForBacklog Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('11. scanForBacklog returns found when backlog exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);

    const { result } = renderHook(() => useProjects());

    let scanResult;
    await act(async () => {
      scanResult = await result.current.scanForBacklog('/project/path');
    });

    expect(scanResult).toEqual({
      found: true,
      file: BACKLOG_FILE_NAME,
      allFiles: [BACKLOG_FILE_NAME],
    });
    expect(joinPath).toHaveBeenCalledWith('/project/path', BACKLOG_FILE_NAME);
  });

  test('12. scanForBacklog returns not found when backlog does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);

    const { result } = renderHook(() => useProjects());

    let scanResult;
    await act(async () => {
      scanResult = await result.current.scanForBacklog('/project/path');
    });

    expect(scanResult).toEqual({ found: false, file: null, allFiles: [] });
  });

  test('13. scanForBacklog handles errors gracefully', async () => {
    vi.mocked(fileExists).mockRejectedValue(new Error('Access denied'));

    const { result } = renderHook(() => useProjects());

    let scanResult;
    await act(async () => {
      scanResult = await result.current.scanForBacklog('/project/path');
    });

    expect(scanResult).toEqual({ found: false, file: null, allFiles: [] });
  });
});

// ============================================================
// TAURI OPENPROJECTDIRECTORY TESTS (14-17)
// ============================================================

describe('useProjects - openProjectDirectory Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('14. openProjectDirectory returns path and scan result on success', async () => {
    vi.mocked(openFolderDialog).mockResolvedValue('/selected/folder');
    vi.mocked(fileExists).mockResolvedValue(true);

    const { result } = renderHook(() => useProjects());

    let openResult;
    await act(async () => {
      openResult = await result.current.openProjectDirectory();
    });

    expect(openResult).toEqual({
      path: '/selected/folder',
      scanResult: {
        found: true,
        file: BACKLOG_FILE_NAME,
        allFiles: [BACKLOG_FILE_NAME],
      },
    });
    expect(result.current.isLoading).toBe(false);
  });

  test('15. openProjectDirectory returns null when cancelled', async () => {
    vi.mocked(openFolderDialog).mockResolvedValue(null);

    const { result } = renderHook(() => useProjects());

    let openResult;
    await act(async () => {
      openResult = await result.current.openProjectDirectory();
    });

    expect(openResult).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('16. openProjectDirectory sets error on failure', async () => {
    vi.mocked(openFolderDialog).mockRejectedValue(new Error('Dialog error'));

    const { result } = renderHook(() => useProjects());

    let openResult;
    await act(async () => {
      openResult = await result.current.openProjectDirectory();
    });

    expect(openResult).toBeNull();
    expect(result.current.error).toBe("Erreur lors de l'ouverture du dossier.");
    expect(result.current.isLoading).toBe(false);
  });

  test('17. openProjectDirectory sets error in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useProjects());

    let openResult;
    await act(async () => {
      openResult = await result.current.openProjectDirectory();
    });

    expect(openResult).toBeNull();
    expect(result.current.error).toBe('Cette fonctionnalite necessite la version desktop.');
  });
});

// ============================================================
// TAURI CREATENEWBACKLOG TESTS (18-20)
// ============================================================

describe('useProjects - createNewBacklog Tauri Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('18. createNewBacklog creates file with template', async () => {
    vi.mocked(writeTextFileContents).mockResolvedValue(undefined);

    const { result } = renderHook(() => useProjects());

    let fileName;
    await act(async () => {
      fileName = await result.current.createNewBacklog('/project/path');
    });

    expect(fileName).toBe(BACKLOG_FILE_NAME);
    expect(writeTextFileContents).toHaveBeenCalledWith(
      expect.stringContaining(BACKLOG_FILE_NAME),
      expect.stringContaining('# ')
    );
    // Verify template contains expected sections
    const calledContent = vi.mocked(writeTextFileContents).mock.calls[0][1];
    expect(calledContent).toContain('Table des matières');
    expect(calledContent).toContain('Légende');
  });

  test('19. createNewBacklog throws in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useProjects());

    await expect(
      act(async () => {
        await result.current.createNewBacklog('/project/path');
      })
    ).rejects.toThrow('Cette fonctionnalite necessite la version desktop.');
  });

  test('20. createNewBacklog uses custom types when provided', async () => {
    vi.mocked(writeTextFileContents).mockResolvedValue(undefined);

    const customTypes = [
      { id: 'FEAT', label: 'Features', color: '#00ff00', order: 1, visible: true },
      { id: 'BUG', label: 'Bugs', color: '#ff0000', order: 2, visible: true },
    ];

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await result.current.createNewBacklog('/project/path', customTypes);
    });

    const calledContent = vi.mocked(writeTextFileContents).mock.calls[0][1];
    expect(calledContent).toContain('FEATURES');
    expect(calledContent).toContain('BUGS');
  });
});

// ============================================================
// LOADPROJECTCONTENT TESTS (21-23)
// ============================================================

describe('useProjects - loadProjectContent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('21. loadProjectContent returns content and touches project', async () => {
    vi.mocked(readTextFileContents).mockResolvedValue('# Backlog Content');

    const { result } = renderHook(() => useProjects());

    // Add a project first
    let projectId: string;
    act(() => {
      const project = result.current.addProject({
        name: 'Test',
        path: '/test/path',
        backlogFile: BACKLOG_FILE_NAME,
      });
      projectId = project.id;
    });

    let content;
    await act(async () => {
      content = await result.current.loadProjectContent(projectId);
    });

    expect(content).toBe('# Backlog Content');
    expect(readTextFileContents).toHaveBeenCalled();
  });

  test('22. loadProjectContent returns null for unknown project', async () => {
    const { result } = renderHook(() => useProjects());

    let content;
    await act(async () => {
      content = await result.current.loadProjectContent('nonexistent-id');
    });

    expect(content).toBeNull();
  });

  test('23. loadProjectContent returns null in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useProjects());

    // Add a project
    let projectId: string;
    act(() => {
      const project = result.current.addProject({
        name: 'Test',
        path: '/test/path',
        backlogFile: BACKLOG_FILE_NAME,
      });
      projectId = project.id;
    });

    let content;
    await act(async () => {
      content = await result.current.loadProjectContent(projectId);
    });

    expect(content).toBeNull();
  });

  test('24. loadProjectContent handles errors', async () => {
    vi.mocked(readTextFileContents).mockRejectedValue(new Error('Read error'));

    const { result } = renderHook(() => useProjects());

    // Add a project
    let projectId: string;
    act(() => {
      const project = result.current.addProject({
        name: 'Test',
        path: '/test/path',
        backlogFile: BACKLOG_FILE_NAME,
      });
      projectId = project.id;
    });

    let content;
    await act(async () => {
      content = await result.current.loadProjectContent(projectId);
    });

    expect(content).toBeNull();
    expect(result.current.error).toBe('Erreur lors du chargement du projet.');
  });
});

// ============================================================
// VALIDATEPROJECT TESTS (25-27)
// ============================================================

describe('useProjects - validateProject', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
  });

  test('25. validateProject returns true when file exists', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);

    const { result } = renderHook(() => useProjects());

    const project = {
      id: 'test-id',
      name: 'Test',
      path: '/test/path',
      backlogFile: BACKLOG_FILE_NAME,
      lastOpened: Date.now(),
    };

    let isValid;
    await act(async () => {
      isValid = await result.current.validateProject(project);
    });

    expect(isValid).toBe(true);
  });

  test('26. validateProject returns false when file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);

    const { result } = renderHook(() => useProjects());

    const project = {
      id: 'test-id',
      name: 'Test',
      path: '/test/path',
      backlogFile: BACKLOG_FILE_NAME,
      lastOpened: Date.now(),
    };

    let isValid;
    await act(async () => {
      isValid = await result.current.validateProject(project);
    });

    expect(isValid).toBe(false);
  });

  test('27. validateProject returns false in web mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useProjects());

    const project = {
      id: 'test-id',
      name: 'Test',
      path: '/test/path',
      backlogFile: BACKLOG_FILE_NAME,
      lastOpened: Date.now(),
    };

    let isValid;
    await act(async () => {
      isValid = await result.current.validateProject(project);
    });

    expect(isValid).toBe(false);
  });

  test('28. validateProject handles errors', async () => {
    vi.mocked(fileExists).mockRejectedValue(new Error('Check error'));

    const { result } = renderHook(() => useProjects());

    const project = {
      id: 'test-id',
      name: 'Test',
      path: '/test/path',
      backlogFile: BACKLOG_FILE_NAME,
      lastOpened: Date.now(),
    };

    let isValid;
    await act(async () => {
      isValid = await result.current.validateProject(project);
    });

    expect(isValid).toBe(false);
  });
});
