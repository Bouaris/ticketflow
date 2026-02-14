/**
 * Clés de stockage centralisées
 *
 * Single source of truth pour toutes les clés localStorage et IndexedDB.
 */

// ============================================================
// LOCAL STORAGE KEYS
// ============================================================

export const STORAGE_KEYS = {
  // Projects
  PROJECTS: 'ticketflow-projects',
  TYPE_CONFIG_PREFIX: 'ticketflow-type-config',

  // UI Preferences
  COLUMN_WIDTHS: 'ticketflow-column-widths',
  TEXTAREA_HEIGHTS: 'ticketflow-textarea-heights',

  // AI Configuration
  AI_PROVIDER: 'ai-provider',
  GROQ_API_KEY: 'groq-api-key',
  GEMINI_API_KEY: 'gemini-api-key',
  OPENAI_API_KEY: 'openai-api-key',
  AI_CONTEXT_FILES_PREFIX: 'ticketflow-ai-context-files',
  PROJECT_AI_CONFIG_PREFIX: 'ticketflow-project-ai-config',

  // AI Analysis (LT-002)
  AI_ANALYSIS_CACHE_PREFIX: 'ticketflow-ai-analysis',
  AI_DECISIONS_PREFIX: 'ticketflow-ai-decisions',

  // Tauri-specific
  TAURI_LAST_FILE: 'ticketflow-last-file',

  // Version tracking
  LAST_SEEN_VERSION: 'ticketflow-last-seen-version',

  // GSD Integration
  GSD_CONFIG_PREFIX: 'ticketflow-gsd-config',

  // Onboarding
  ONBOARDING_COMPLETE: 'ticketflow-onboarding-complete',
} as const;

// ============================================================
// INDEXED DB CONFIGURATION
// ============================================================

export const INDEXED_DB = {
  DB_NAME: 'backlog-manager',
  FILE_HANDLES_STORE: 'file-handles',
  LAST_FILE_KEY: 'last-file',
  SCREENSHOTS_FOLDER_KEY: 'screenshots-folder-parent',
  VERSION: 2,
} as const;

// ============================================================
// TYPE HELPERS
// ============================================================

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Build a type config key for a specific project
 */
export function getTypeConfigKey(projectId: string): string {
  return `${STORAGE_KEYS.TYPE_CONFIG_PREFIX}-${projectId}`;
}

/**
 * Build a context files config key for a specific project path
 */
export function getContextFilesKey(projectPath: string): string {
  // Simple hash of the path to avoid special characters in localStorage key
  const hash = hashPath(projectPath);
  return `${STORAGE_KEYS.AI_CONTEXT_FILES_PREFIX}-${hash}`;
}

/**
 * Build a project AI config key for a specific project path
 */
export function getProjectAIConfigKey(projectPath: string): string {
  const hash = hashPath(projectPath);
  return `${STORAGE_KEYS.PROJECT_AI_CONFIG_PREFIX}-${hash}`;
}

/**
 * Build an AI analysis cache key for a specific project path
 */
export function getAIAnalysisCacheKey(projectPath: string): string {
  const hash = hashPath(projectPath);
  return `${STORAGE_KEYS.AI_ANALYSIS_CACHE_PREFIX}-${hash}`;
}

/**
 * Build an AI decisions key for a specific project path
 */
export function getAIDecisionsKey(projectPath: string): string {
  const hash = hashPath(projectPath);
  return `${STORAGE_KEYS.AI_DECISIONS_PREFIX}-${hash}`;
}

/**
 * Build a GSD config key for a specific project path
 */
export function getGsdConfigKey(projectPath: string): string {
  const hash = hashPath(projectPath);
  return `${STORAGE_KEYS.GSD_CONFIG_PREFIX}-${hash}`;
}

/**
 * Simple hash function for path strings
 */
export function hashPath(path: string): string {
  const hash = path.split('').reduce((acc, char) => {
    acc = ((acc << 5) - acc) + char.charCodeAt(0);
    return acc & acc;
  }, 0);
  return Math.abs(hash).toString(36);
}

/**
 * Hash function for backlog items array
 * Used for cache invalidation when items change
 */
export function hashItems(items: { id: string; title: string }[]): string {
  const content = items.map(i => `${i.id}:${i.title}`).join('|');
  return hashPath(content);
}
