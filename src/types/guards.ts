/**
 * Type Guards centralisés
 *
 * Single source of truth pour les fonctions de discrimination de types.
 */

import type { BacklogItem, TableGroup, RawSection } from './backlog';
import { PARSER_PATTERNS } from '../constants/patterns';

// ============================================================
// BACKLOG ITEM GUARDS
// ============================================================

/**
 * Check if an item is a BacklogItem (not TableGroup or RawSection)
 *
 * Used to discriminate the union type in sections.items
 */
export function isBacklogItem(
  item: BacklogItem | TableGroup | RawSection
): item is BacklogItem {
  // Must have 'id' property
  if (!('id' in item)) return false;

  // TableGroup has 'items' array - BacklogItem doesn't
  if ('items' in item) return false;

  // RawSection has type 'raw-section'
  if ('type' in item && item.type === 'raw-section') return false;

  // Accept any type that matches the uppercase pattern
  return typeof item.type === 'string' && PARSER_PATTERNS.TYPE_ID.test(item.type);
}

/**
 * Check if an item is a TableGroup
 */
export function isTableGroup(
  item: BacklogItem | TableGroup | RawSection
): item is TableGroup {
  return 'type' in item && item.type === 'table-group';
}

/**
 * Check if an item is a RawSection
 */
export function isRawSection(
  item: BacklogItem | TableGroup | RawSection
): item is RawSection {
  return 'type' in item && item.type === 'raw-section';
}

// ============================================================
// UTILITY GUARDS
// ============================================================

/**
 * Check if a value is a valid ItemType (uppercase letters only)
 */
export function isValidItemType(value: unknown): value is string {
  return typeof value === 'string' && PARSER_PATTERNS.TYPE_ID.test(value);
}

/**
 * Check if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}
