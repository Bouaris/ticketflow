/**
 * Hooks Module - Barrel Export
 *
 * Centralise tous les hooks de l'application.
 */

// Backlog management (SQLite-backed)
export type { UseBacklogDBReturn, BacklogFilters, ViewMode } from './useBacklogDB';
export { useBacklogDB } from './useBacklogDB';

// File access
export type { UseFileAccessReturn } from './useFileAccess';
export { useFileAccess } from './useFileAccess';

// Projects management
export type { UseProjectsReturn, ScanResult } from './useProjects';
export { useProjects } from './useProjects';

// Screenshot folder
export { useScreenshotFolder } from './useScreenshotFolder';

// Type configuration
export type { UseTypeConfigReturn } from './useTypeConfig';
export { useTypeConfig } from './useTypeConfig';

// AI context files configuration
export type { UseContextFilesReturn } from './useContextFiles';
export { useContextFiles } from './useContextFiles';
