/**
 * useProjects - Manage recent projects list
 *
 * Handles project storage, directory scanning, and backlog file detection.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types/project';
import {
  PROJECTS_STORAGE_KEY,
  MAX_RECENT_PROJECTS,
  BACKLOG_FILE_NAME,
} from '../types/project';
import type { TypeDefinition } from '../types/typeConfig';
import { DEFAULT_TYPES } from '../types/typeConfig';
import {
  isTauri,
  openFolderDialog,
  joinPath,
  fileExists,
  writeTextFileContents,
  readTextFileContents,
} from '../lib/tauri-bridge';

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Load projects from localStorage
function loadProjectsFromStorage(): Project[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load projects from storage:', error);
  }
  return [];
}

// Save projects to localStorage
function saveProjectsToStorage(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error('Failed to save projects to storage:', error);
  }
}

export interface ScanResult {
  found: boolean;
  file: string | null;
  allFiles: string[];
}

export interface UseProjectsReturn {
  /** List of recent projects (sorted by lastOpened desc) */
  projects: Project[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether we're in Tauri mode */
  isTauriMode: boolean;
  /** Open folder dialog and scan for backlog */
  openProjectDirectory: () => Promise<{ path: string; scanResult: ScanResult } | null>;
  /** Scan a directory for backlog files */
  scanForBacklog: (dirPath: string) => Promise<ScanResult>;
  /** Create a new backlog file in directory */
  createNewBacklog: (dirPath: string, types?: TypeDefinition[]) => Promise<string>;
  /** Add or update a project in the list */
  addProject: (project: Omit<Project, 'id' | 'lastOpened'>) => Project;
  /** Remove a project from the list */
  removeProject: (id: string) => void;
  /** Update project's lastOpened timestamp */
  touchProject: (id: string) => void;
  /** Load project content by ID */
  loadProjectContent: (id: string) => Promise<string | null>;
  /** Check if a project's path still exists */
  validateProject: (project: Project) => Promise<boolean>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTauriMode = isTauri();

  // Load projects on mount and clean up invalid ones
  useEffect(() => {
    const loaded = loadProjectsFromStorage();

    // Filter out projects that don't use TICKETFLOW_Backlog.md
    const validProjects = loaded.filter(p => p.backlogFile === BACKLOG_FILE_NAME);

    // If we filtered some out, save the cleaned list
    if (validProjects.length !== loaded.length) {
      saveProjectsToStorage(validProjects);
    }

    // Sort by lastOpened descending
    validProjects.sort((a, b) => b.lastOpened - a.lastOpened);
    setProjects(validProjects);
  }, []);

  // Save projects whenever they change
  useEffect(() => {
    if (projects.length > 0) {
      saveProjectsToStorage(projects);
    }
  }, [projects]);

  /**
   * Scan a directory for TICKETFLOW_Backlog.md
   */
  const scanForBacklog = useCallback(async (dirPath: string): Promise<ScanResult> => {
    if (!isTauriMode) {
      return { found: false, file: null, allFiles: [] };
    }

    try {
      // Only check for the specific file TICKETFLOW_Backlog.md
      const filePath = joinPath(dirPath, BACKLOG_FILE_NAME);
      const exists = await fileExists(filePath);

      if (exists) {
        return { found: true, file: BACKLOG_FILE_NAME, allFiles: [BACKLOG_FILE_NAME] };
      }

      return { found: false, file: null, allFiles: [] };
    } catch (err) {
      console.error('Failed to scan directory:', err);
      return { found: false, file: null, allFiles: [] };
    }
  }, [isTauriMode]);

  /**
   * Open folder dialog and scan for backlog
   */
  const openProjectDirectory = useCallback(async (): Promise<{ path: string; scanResult: ScanResult } | null> => {
    if (!isTauriMode) {
      setError('Cette fonctionnalité nécessite la version desktop.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const path = await openFolderDialog();

      if (!path) {
        setIsLoading(false);
        return null; // User cancelled
      }

      const scanResult = await scanForBacklog(path);
      setIsLoading(false);

      return { path, scanResult };
    } catch {
      setError('Erreur lors de l\'ouverture du dossier.');
      setIsLoading(false);
      return null;
    }
  }, [isTauriMode, scanForBacklog]);

  /**
   * Create a new TICKETFLOW_Backlog.md file in directory
   * Generates a complete template with ToC, Legend, and Conventions
   */
  const createNewBacklog = useCallback(async (dirPath: string, types?: TypeDefinition[]): Promise<string> => {
    if (!isTauriMode) {
      throw new Error('Cette fonctionnalité nécessite la version desktop.');
    }

    const typesToUse = types || DEFAULT_TYPES;
    const sortedTypes = [...typesToUse].sort((a, b) => a.order - b.order);
    const projectName = dirPath.split(/[/\\]/).pop() || 'Project';
    const today = new Date().toISOString().split('T')[0];

    // Generate Table of Contents
    const tocEntries = sortedTypes.map((t, i) =>
      `${i + 1}. [${t.label}](#${i + 1}-${t.label.toLowerCase().replace(/\s+/g, '-')})`
    ).join('\n');

    // Generate Section Headers
    const sections = sortedTypes.map((t, i) =>
      `## ${i + 1}. ${t.label.toUpperCase()}\n\n`
    ).join('\n---\n\n');

    const template = `# ${projectName} - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : ${today}

---

## Table des matières
${tocEntries}
${sortedTypes.length + 1}. [Légende](#${sortedTypes.length + 1}-legende)

---

${sections}---

## ${sortedTypes.length + 1}. Légende

### Légende Effort

| Code | Signification | Estimation |
|------|---------------|------------|
| XS | Extra Small | < 2h |
| S | Small | 2-4h |
| M | Medium | 1-2 jours |
| L | Large | 3-5 jours |
| XL | Extra Large | 1-2 semaines |

---

### Conventions

${sortedTypes.map(t => `- **${t.id}-XXX** : ${t.label}`).join('\n')}

---

### Sévérité (Bugs)

| Code | Signification |
|------|---------------|
| P0 | Bloquant - Production down |
| P1 | Critique - Impact majeur |
| P2 | Moyenne - Contournable |
| P3 | Faible - Mineur |
| P4 | Cosmétique |

---

### Priorité (Features)

| Niveau | Signification |
|--------|---------------|
| Haute | Sprint actuel |
| Moyenne | Prochain sprint |
| Faible | Backlog |
`;

    const filePath = joinPath(dirPath, BACKLOG_FILE_NAME);
    await writeTextFileContents(filePath, template);
    return BACKLOG_FILE_NAME;
  }, [isTauriMode]);

  /**
   * Add or update a project
   */
  const addProject = useCallback((projectData: Omit<Project, 'id' | 'lastOpened'>): Project => {
    const now = Date.now();

    // Check if project with same path exists
    const existingIndex = projects.findIndex(p => p.path === projectData.path);

    if (existingIndex >= 0) {
      // Update existing project
      const updated = {
        ...projects[existingIndex],
        ...projectData,
        lastOpened: now,
      };

      setProjects(prev => {
        const newProjects = [...prev];
        newProjects[existingIndex] = updated;
        // Re-sort by lastOpened
        newProjects.sort((a, b) => b.lastOpened - a.lastOpened);
        return newProjects.slice(0, MAX_RECENT_PROJECTS);
      });

      return updated;
    }

    // Create new project
    const newProject: Project = {
      id: generateId(),
      ...projectData,
      lastOpened: now,
    };

    setProjects(prev => {
      const newProjects = [newProject, ...prev];
      return newProjects.slice(0, MAX_RECENT_PROJECTS);
    });

    return newProject;
  }, [projects]);

  /**
   * Remove a project from the list
   */
  const removeProject = useCallback((id: string): void => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  /**
   * Update project's lastOpened timestamp
   */
  const touchProject = useCallback((id: string): void => {
    setProjects(prev => {
      const project = prev.find(p => p.id === id);
      if (!project) return prev;

      const updated = { ...project, lastOpened: Date.now() };
      const others = prev.filter(p => p.id !== id);
      return [updated, ...others];
    });
  }, []);

  /**
   * Load project content by ID
   */
  const loadProjectContent = useCallback(async (id: string): Promise<string | null> => {
    const project = projects.find(p => p.id === id);
    if (!project || !isTauriMode) return null;

    try {
      const filePath = joinPath(project.path, project.backlogFile);
      const content = await readTextFileContents(filePath);
      touchProject(id);
      return content;
    } catch (err) {
      console.error('Failed to load project content:', err);
      setError('Erreur lors du chargement du projet.');
      return null;
    }
  }, [projects, isTauriMode, touchProject]);

  /**
   * Check if a project's path still exists
   */
  const validateProject = useCallback(async (project: Project): Promise<boolean> => {
    if (!isTauriMode) return false;

    try {
      const filePath = joinPath(project.path, project.backlogFile);
      return await fileExists(filePath);
    } catch {
      return false;
    }
  }, [isTauriMode]);

  return {
    projects,
    isLoading,
    error,
    isTauriMode,
    openProjectDirectory,
    scanForBacklog,
    createNewBacklog,
    addProject,
    removeProject,
    touchProject,
    loadProjectContent,
    validateProject,
  };
}
