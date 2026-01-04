/**
 * TypeConfig - Dynamic type configuration system
 *
 * Allows users to create custom item types instead of hardcoded ones.
 */

import { TYPE_COLORS, getAutoColor } from '../constants/colors';

// ============================================================
// TYPE DEFINITION
// ============================================================

export interface TypeDefinition {
  /** Short code (e.g., "BUG", "CT", "LT") - used in IDs */
  id: string;
  /** Readable label (e.g., "Bugs", "Court Terme") */
  label: string;
  /** Color for display (hex or CSS variable) */
  color: string;
  /** Order for Kanban columns (lower = first) */
  order: number;
  /** Whether this type column is visible in Kanban (default: true) */
  visible: boolean;
}

export interface TypeConfig {
  /** List of type definitions */
  types: TypeDefinition[];
  /** List of type IDs that user explicitly deleted (won't be re-created from Markdown) */
  deletedTypes?: string[];
  /** Version for future migrations */
  version: number;
}

// ============================================================
// DEFAULT TYPES FOR NEW PROJECTS
// ============================================================

export const DEFAULT_TYPES: TypeDefinition[] = [
  { id: 'BUG', label: 'Bugs', color: TYPE_COLORS.BUG, order: 0, visible: true },
  { id: 'CT', label: 'Court Terme', color: TYPE_COLORS.CT, order: 1, visible: true },
  { id: 'LT', label: 'Long Terme', color: TYPE_COLORS.LT, order: 2, visible: true },
  { id: 'AUTRE', label: 'Autres Idées', color: TYPE_COLORS.AUTRE, order: 3, visible: true },
];

export const DEFAULT_TYPE_CONFIG: TypeConfig = {
  types: DEFAULT_TYPES,
  version: 1,
};

// ============================================================
// LEGACY TYPE MAPPING (for backward compatibility)
// ============================================================

export const LEGACY_TYPE_MAP: Record<string, TypeDefinition> = {
  BUG: { id: 'BUG', label: 'Bugs', color: TYPE_COLORS.BUG, order: 0, visible: true },
  CT: { id: 'CT', label: 'Court Terme', color: TYPE_COLORS.CT, order: 1, visible: true },
  LT: { id: 'LT', label: 'Long Terme', color: TYPE_COLORS.LT, order: 2, visible: true },
  AUTRE: { id: 'AUTRE', label: 'Autres Idées', color: TYPE_COLORS.AUTRE, order: 3, visible: true },
};

// ============================================================
// STORAGE
// ============================================================

const TYPE_CONFIG_STORAGE_KEY = 'ticketflow-type-config';

/**
 * Load type config from localStorage for a specific project
 * Migrates old configs without `visible` field by defaulting to true
 */
export function loadTypeConfig(projectPath: string): TypeConfig | null {
  try {
    const key = `${TYPE_CONFIG_STORAGE_KEY}-${hashPath(projectPath)}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const config = JSON.parse(stored) as TypeConfig;
      // Migration: add visible=true to types that don't have it
      config.types = config.types.map(t => ({
        ...t,
        visible: t.visible ?? true,
      }));
      return config;
    }
  } catch (error) {
    console.error('Failed to load type config:', error);
  }
  return null;
}

/**
 * Save type config to localStorage for a specific project
 */
export function saveTypeConfig(projectPath: string, config: TypeConfig): void {
  try {
    const key = `${TYPE_CONFIG_STORAGE_KEY}-${hashPath(projectPath)}`;
    localStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save type config:', error);
  }
}

/**
 * Simple hash for project path to use as storage key
 */
function hashPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Detect types from markdown content by scanning:
 * 1. Item IDs (### BUG-001 | Title)
 * 2. HTML comments (<!-- Type: CT -->)
 * 3. Section headers (## 1. BUGS, ## 2. COURT TERME)
 */
export function detectTypesFromMarkdown(markdown: string): string[] {
  const types = new Set<string>();

  // 1. Detect from item IDs (### BUG-001 | Title)
  const itemPattern = /###\s*([A-Z]+)-\d+/g;
  let match;
  while ((match = itemPattern.exec(markdown)) !== null) {
    types.add(match[1]);
  }

  // 2. Detect from HTML comments (<!-- Type: CT -->)
  // These are embedded in section headers by template generator
  const commentPattern = /<!--\s*Type:\s*([A-Z]+)\s*-->/gi;
  while ((match = commentPattern.exec(markdown)) !== null) {
    types.add(match[1].toUpperCase());
  }

  // 3. Detect from section headers (## 1. BUGS, ## 2. COURT TERME)
  // Map section labels to their type IDs
  const sectionToType: Record<string, string> = {
    'BUGS': 'BUG',
    'BUG': 'BUG',
    'COURT TERME': 'CT',
    'COURT-TERME': 'CT',
    'CT': 'CT',
    'LONG TERME': 'LT',
    'LONG-TERME': 'LT',
    'LT': 'LT',
    'AUTRES IDÉES': 'AUTRE',
    'AUTRES IDEES': 'AUTRE',
    'AUTRES': 'AUTRE',
    'AUTRE': 'AUTRE',
    'TESTS': 'TEST',
    'TEST': 'TEST',
  };

  const sectionPattern = /^##\s*\d+\.\s*(.+)$/gm;
  while ((match = sectionPattern.exec(markdown)) !== null) {
    const sectionLabel = match[1].trim().toUpperCase();

    // Skip legend/légende sections
    if (sectionLabel.includes('LÉGENDE') || sectionLabel.includes('LEGENDE')) {
      continue;
    }

    // Try direct mapping for known types
    if (sectionToType[sectionLabel]) {
      types.add(sectionToType[sectionLabel]);
    } else {
      // Try partial match for labels like "BUGS (Hotfix)"
      let found = false;
      for (const [key, value] of Object.entries(sectionToType)) {
        if (sectionLabel.startsWith(key)) {
          types.add(value);
          found = true;
          break;
        }
      }

      // If no mapping found, treat the section label as a custom type
      // Only if it looks like a valid type ID (uppercase letters, possibly with spaces)
      if (!found && /^[A-ZÀ-ÿ\s]+$/.test(sectionLabel)) {
        // Use the section label as type ID (remove spaces, keep uppercase)
        const customTypeId = sectionLabel.replace(/\s+/g, '_');
        types.add(customTypeId);
      }
    }
  }

  return Array.from(types);
}

/**
 * Create type config from detected types, using legacy mapping when available
 */
export function createTypeConfigFromDetected(detectedTypes: string[]): TypeConfig {
  const types: TypeDefinition[] = detectedTypes.map((typeId, index) => {
    // Use legacy mapping if available
    if (LEGACY_TYPE_MAP[typeId]) {
      return { ...LEGACY_TYPE_MAP[typeId], order: index, visible: true };
    }
    // Create new type with auto-generated color
    return {
      id: typeId,
      label: typeId.charAt(0) + typeId.slice(1).toLowerCase(),
      color: getAutoColor(index),
      order: index,
      visible: true,
    };
  });

  return { types, version: 1 };
}

/**
 * Merge detected types with existing config
 * - Keep existing labels/colors/visible/ORDER for types that exist in both
 * - Add new types from detected (visible: true by default)
 * - Skip types that user explicitly deleted (in deletedTypes list)
 */
export function mergeTypesWithDetected(
  existingConfig: TypeConfig | null,
  detectedTypes: string[]
): TypeConfig {
  const result: TypeDefinition[] = [];
  const deletedTypes = existingConfig?.deletedTypes || [];

  // Find max existing order to assign to new types
  const maxExistingOrder = existingConfig?.types.reduce(
    (max, t) => Math.max(max, t.order),
    -1
  ) ?? -1;
  let nextOrder = maxExistingOrder + 1;

  detectedTypes.forEach((typeId) => {
    // Skip types that user explicitly deleted
    if (deletedTypes.includes(typeId)) {
      return;
    }

    // Check if exists in current config (preserve ALL user customizations including order)
    const existing = existingConfig?.types.find(t => t.id === typeId);
    if (existing) {
      // CRITICAL: Preserve existing order, don't override with detection index
      result.push({ ...existing, visible: existing.visible ?? true });
    } else if (LEGACY_TYPE_MAP[typeId]) {
      // Use legacy mapping for known types, assign next available order
      result.push({ ...LEGACY_TYPE_MAP[typeId], order: nextOrder++, visible: true });
    } else {
      // Create new type with auto-generated label and color
      result.push({
        id: typeId,
        label: typeId.charAt(0) + typeId.slice(1).toLowerCase(),
        color: getAutoColor(nextOrder),
        order: nextOrder++,
        visible: true,
      });
    }
  });

  // Preserve deletedTypes list
  return { types: result, deletedTypes, version: 1 };
}

// getAutoColor is imported from colors.ts

/**
 * Get type definition by ID
 */
export function getTypeById(config: TypeConfig, typeId: string): TypeDefinition | undefined {
  return config.types.find(t => t.id === typeId);
}

/**
 * Get sorted types by order
 */
export function getSortedTypes(config: TypeConfig): TypeDefinition[] {
  return [...config.types].sort((a, b) => a.order - b.order);
}

/**
 * Add a new type to config (removes from deletedTypes if it was there)
 */
export function addType(config: TypeConfig, type: Omit<TypeDefinition, 'order' | 'visible'>): TypeConfig {
  const maxOrder = Math.max(...config.types.map(t => t.order), -1);
  const deletedTypes = (config.deletedTypes || []).filter(id => id !== type.id);
  return {
    ...config,
    types: [...config.types, { ...type, order: maxOrder + 1, visible: true }],
    deletedTypes,
  };
}

/**
 * Update type order after drag & drop
 */
export function reorderTypes(config: TypeConfig, fromIndex: number, toIndex: number): TypeConfig {
  const sorted = getSortedTypes(config);
  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(toIndex, 0, moved);

  // Update orders
  const updatedTypes = sorted.map((type, index) => ({ ...type, order: index }));

  return { ...config, types: updatedTypes };
}

/**
 * Remove a type from config and add to deletedTypes list
 * (prevents re-creation from Markdown detection)
 */
export function removeType(config: TypeConfig, typeId: string): TypeConfig {
  const deletedTypes = config.deletedTypes || [];
  return {
    ...config,
    types: config.types.filter(t => t.id !== typeId),
    deletedTypes: deletedTypes.includes(typeId) ? deletedTypes : [...deletedTypes, typeId],
  };
}

/**
 * Update a type in config
 */
export function updateType(config: TypeConfig, typeId: string, updates: Partial<TypeDefinition>): TypeConfig {
  return {
    ...config,
    types: config.types.map(t => t.id === typeId ? { ...t, ...updates } : t),
  };
}
