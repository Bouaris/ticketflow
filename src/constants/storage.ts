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

  // Tauri-specific
  TAURI_LAST_FILE: 'ticketflow-last-file',

  // Version tracking
  LAST_SEEN_VERSION: 'ticketflow-last-seen-version',
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
