/**
 * Configuration centralisée de l'application
 *
 * Single source of truth pour les paramètres de l'app et de l'IA.
 */

// ============================================================
// APP CONFIGURATION
// ============================================================

export const APP_CONFIG = {
  // Projects
  MAX_RECENT_PROJECTS: 10,
  VISIBLE_PROJECTS_COUNT: 5,

  // File system
  BACKLOG_FILE_NAME: 'TICKETFLOW_Backlog.md',
  ASSETS_FOLDER: '.backlog-assets',
  SCREENSHOTS_FOLDER: 'screenshots',
} as const;

// ============================================================
// AI CONFIGURATION
// ============================================================

export const AI_CONFIG = {
  // Models
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  GEMINI_MODEL: 'gemini-2.0-flash',
  OPENAI_MODEL: 'gpt-4o-mini',

  // Parameters
  MAX_TOKENS: 2048,
  BULK_MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
} as const;

// ============================================================
// UI CONFIGURATION
// ============================================================

export const UI_CONFIG = {
  // Modal backdrop opacity
  MODAL_BACKDROP_OPACITY: 0.6,

  // Toast durations (ms)
  TOAST_DURATION_SUCCESS: 3000,
  TOAST_DURATION_ERROR: 5000,

  // Debounce delays (ms)
  SEARCH_DEBOUNCE: 300,
} as const;
