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
  // Map section labels to their type IDs (EXACT MATCH only)
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

    // Skip legend/légende sections and table of contents
    if (sectionLabel.includes('LÉGENDE') || sectionLabel.includes('LEGENDE') ||
        sectionLabel.includes('TABLE DES MATIÈRES') || sectionLabel.includes('TABLE DES MATIERES')) {
      continue;
    }

    // Try EXACT mapping for known types
    if (sectionToType[sectionLabel]) {
      types.add(sectionToType[sectionLabel]);
    } else {
      // CRITICAL FIX: Check if label is a CUSTOM type (contains spaces or special chars)
      // DO NOT use startsWith() as it causes false positives like "BUG V5" → "BUG"
      // Instead, only use exact word boundary matching for known prefixes
      let found = false;

      // Only match if the section label is EXACTLY a known prefix followed by parenthesis
      // e.g., "BUGS (Hotfix)" → "BUG", but NOT "BUG V5" → custom type
      for (const [key, value] of Object.entries(sectionToType)) {
        // Match: "BUGS (Hotfix)" or "BUGS - Priority" but NOT "BUG V5" or "BUGFIX"
        const exactWordPattern = new RegExp(`^${key}(?:\\s*[\\(\\-\\:]|$)`);
        if (exactWordPattern.test(sectionLabel)) {
          types.add(value);
          found = true;
          break;
        }
      }

      // If no mapping found, treat the section label as a custom type
      // Accept any section label with letters, numbers, accents, spaces
      if (!found && /^[A-ZÀ-ÿ0-9\s_-]+$/i.test(sectionLabel)) {
        // Use the section label as type ID (replace spaces with underscore, uppercase)
        const customTypeId = sectionLabel.replace(/\s+/g, '_').toUpperCase();
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
