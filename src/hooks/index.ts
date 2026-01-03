/**
 * Hooks Module - Barrel Export
 *
 * Centralise tous les hooks de l'application.
 */

// Backlog management
export type { UseBacklogReturn, BacklogFilters, ViewMode } from './useBacklog';
export { useBacklog } from './useBacklog';

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
