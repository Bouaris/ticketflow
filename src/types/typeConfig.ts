/**
 * TypeConfig - Dynamic type configuration system
 *
 * Allows users to create custom item types instead of hardcoded ones.
 */

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
}

export interface TypeConfig {
  /** List of type definitions */
  types: TypeDefinition[];
  /** Version for future migrations */
  version: number;
}

// ============================================================
// DEFAULT TYPES FOR NEW PROJECTS
// ============================================================

export const DEFAULT_TYPES: TypeDefinition[] = [
  { id: 'BUG', label: 'Bugs', color: '#ef4444', order: 0 },
  { id: 'CT', label: 'Court Terme', color: '#3b82f6', order: 1 },
  { id: 'LT', label: 'Long Terme', color: '#8b5cf6', order: 2 },
  { id: 'AUTRE', label: 'Autres Idées', color: '#6b7280', order: 3 },
];

export const DEFAULT_TYPE_CONFIG: TypeConfig = {
  types: DEFAULT_TYPES,
  version: 1,
};

// ============================================================
// LEGACY TYPE MAPPING (for backward compatibility)
// ============================================================

export const LEGACY_TYPE_MAP: Record<string, TypeDefinition> = {
  BUG: { id: 'BUG', label: 'Bugs', color: '#ef4444', order: 0 },
  EXT: { id: 'EXT', label: 'Extension', color: '#3b82f6', order: 1 },
  ADM: { id: 'ADM', label: 'Admin', color: '#10b981', order: 2 },
  COS: { id: 'COS', label: 'Cosium API', color: '#f59e0b', order: 3 },
  LT: { id: 'LT', label: 'Long Terme', color: '#8b5cf6', order: 4 },
};

// ============================================================
// STORAGE
// ============================================================

const TYPE_CONFIG_STORAGE_KEY = 'ticketflow-type-config';

/**
 * Load type config from localStorage for a specific project
 */
export function loadTypeConfig(projectPath: string): TypeConfig | null {
  try {
    const key = `${TYPE_CONFIG_STORAGE_KEY}-${hashPath(projectPath)}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
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
 * Detect types from markdown content by scanning for item IDs
 */
export function detectTypesFromMarkdown(markdown: string): string[] {
  const typePattern = /###\s*([A-Z]+)-\d+/g;
  const types = new Set<string>();

  let match;
  while ((match = typePattern.exec(markdown)) !== null) {
    types.add(match[1]);
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
      return { ...LEGACY_TYPE_MAP[typeId], order: index };
    }
    // Create new type with auto-generated color
    return {
      id: typeId,
      label: typeId.charAt(0) + typeId.slice(1).toLowerCase(),
      color: getAutoColor(index),
      order: index,
    };
  });

  return { types, version: 1 };
}

/**
 * Merge detected types with existing config
 * - Keep existing labels/colors for types that exist in both
 * - Add new types from detected
 * - Remove types not in detected (sync with file)
 */
export function mergeTypesWithDetected(
  existingConfig: TypeConfig | null,
  detectedTypes: string[]
): TypeConfig {
  const result: TypeDefinition[] = [];

  detectedTypes.forEach((typeId, index) => {
    // Check if exists in current config (preserve user customizations)
    const existing = existingConfig?.types.find(t => t.id === typeId);
    if (existing) {
      result.push({ ...existing, order: index });
    } else if (LEGACY_TYPE_MAP[typeId]) {
      // Use legacy mapping for known types
      result.push({ ...LEGACY_TYPE_MAP[typeId], order: index });
    } else {
      // Create new type with auto-generated label and color
      result.push({
        id: typeId,
        label: typeId.charAt(0) + typeId.slice(1).toLowerCase(),
        color: getAutoColor(index),
        order: index,
      });
    }
  });

  return { types: result, version: 1 };
}

/**
 * Generate a color based on index
 */
function getAutoColor(index: number): string {
  const colors = [
    '#ef4444', // red
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];
  return colors[index % colors.length];
}

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
 * Add a new type to config
 */
export function addType(config: TypeConfig, type: Omit<TypeDefinition, 'order'>): TypeConfig {
  const maxOrder = Math.max(...config.types.map(t => t.order), -1);
  return {
    ...config,
    types: [...config.types, { ...type, order: maxOrder + 1 }],
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
 * Remove a type from config
 */
export function removeType(config: TypeConfig, typeId: string): TypeConfig {
  return {
    ...config,
    types: config.types.filter(t => t.id !== typeId),
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
