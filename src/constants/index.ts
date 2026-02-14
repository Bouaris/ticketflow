/**
 * Constants Module - Barrel Export
 *
 * Centralise toutes les constantes de l'application.
 */

// Labels
export {
  SEVERITY_LABELS,
  SEVERITY_FULL_LABELS,
  PRIORITY_LABELS,
  EFFORT_LABELS,
  EFFORT_SHORT_LABELS,
  TYPE_LABELS,
  getTypeLabel,
} from './labels';

// Storage keys
export {
  STORAGE_KEYS,
  INDEXED_DB,
  getTypeConfigKey,
  type StorageKey,
} from './storage';

// Configuration
export {
  APP_CONFIG,
  AI_CONFIG,
  UI_CONFIG,
} from './config';

// Parser patterns
export {
  PARSER_PATTERNS,
  RAW_SECTION_NAMES,
  isRawSectionTitle,
} from './patterns';
