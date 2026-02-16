/**
 * Types Module - Barrel Export
 *
 * Centralise tous les types de l'application.
 */

// Backlog types
export type {
  Backlog,
  BacklogItem,
  Section,
  TableGroup,
  RawSection,
  TableRow,
  Criterion,
  Screenshot,
  ItemType,
  Severity,
  Priority,
  Effort,
} from './backlog';

export {
  BacklogSchema,
  BacklogItemSchema,
  SectionSchema,
  TableGroupSchema,
  RawSectionSchema,
  TableRowSchema,
  CriterionSchema,
  ScreenshotSchema,
  ItemTypeSchema,
  SeveritySchema,
  PrioritySchema,
  EffortSchema,
  getTypeFromId,
  getTypeColor,
  getSeverityColor,
  getEffortColor,
} from './backlog';

// Project types
export type { Project } from './project';
export { NEW_BACKLOG_TEMPLATE } from './project';

// TypeConfig
export type { TypeDefinition, TypeConfig } from './typeConfig';
export {
  DEFAULT_TYPES,
  DEFAULT_TYPE_CONFIG,
  LEGACY_TYPE_MAP,
  detectTypesFromMarkdown,
  createTypeConfigFromDetected,
  mergeTypesWithDetected,
  getTypeById,
  getSortedTypes,
  addType,
  reorderTypes,
  removeType,
  updateType,
} from './typeConfig';

// Type guards
export {
  isBacklogItem,
  isTableGroup,
  isRawSection,
  isValidItemType,
  hasProperty,
} from './guards';

// Project AI Configuration
export type { AIModel, ProjectAIConfig, ProjectAIProvider } from './projectAIConfig';
export {
  AIModelSchema,
  ProjectAIConfigSchema,
  DEFAULT_PROJECT_AI_CONFIG,
  AVAILABLE_MODELS,
  DEFAULT_MODELS,
} from './projectAIConfig';

// AI Provider Registry Types
export type { ProviderConfig, BuiltInProviderId, CustomProviderInput } from './aiProvider';
