/**
 * Project types for multi-project management
 */

export interface Project {
  /** Unique identifier (UUID) */
  id: string;
  /** Project name (folder name) */
  name: string;
  /** Absolute path to project directory */
  path: string;
  /** Name of the backlog file found */
  backlogFile: string;
  /** Timestamp of last access */
  lastOpened: number;
  /** Number of items in backlog (optional, for display) */
  itemCount?: number;
}

/** Storage key for projects list */
export const PROJECTS_STORAGE_KEY = 'ticketflow-projects';

/** Maximum number of recent projects to store */
export const MAX_RECENT_PROJECTS = 10;

/** Number of projects to show before "Show more" */
export const VISIBLE_PROJECTS_COUNT = 5;

/** The only backlog file name supported */
export const BACKLOG_FILE_NAME = 'TICKETFLOW_Backlog.md';

/** Template for new backlog file with default sections */
export const NEW_BACKLOG_TEMPLATE = `# TICKETFLOW Backlog

## Bugs

## Court Terme

## Long Terme

## Autres Idées
`;
