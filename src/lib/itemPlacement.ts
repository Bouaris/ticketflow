/**
 * Item Placement Service
 *
 * Strategies for finding the correct section to place items.
 * Used by addItem and moveItemToType operations.
 */

import type { Section, ItemType, BacklogItem, RawSection, TableGroup } from '../types/backlog';
import { isBacklogItem } from '../types/guards';

/** Union type for section items */
type SectionItem = BacklogItem | RawSection | TableGroup;

/**
 * Mapping of type IDs to possible section title labels.
 * Used for matching sections by title when no items of the type exist yet.
 */
const TYPE_LABEL_MAP: Record<string, string[]> = {
  'BUG': ['BUGS', 'BUG'],
  'CT': ['COURT TERME', 'CT', 'COURT-TERME'],
  'LT': ['LONG TERME', 'LT', 'LONG-TERME'],
  'AUTRE': ['AUTRES', 'AUTRE', 'IDÉES', 'IDEES', 'AUTRES IDÉES'],
  'TEST': ['TESTS', 'TEST'],
  'DFA': ['DADA', 'DFA'],
};

/**
 * Convert a custom type ID back to possible section title labels.
 * Examples:
 *   "BUG_V5" → ["BUG V5", "BUG_V5"]
 *   "EXT_CHROME" → ["EXT CHROME", "EXT_CHROME", "EXTENSION CHROME"]
 */
function getLabelsForCustomType(typeId: string): string[] {
  const labels: string[] = [];

  // Add the exact type ID
  labels.push(typeId);

  // Add version with spaces instead of underscores
  if (typeId.includes('_')) {
    labels.push(typeId.replace(/_/g, ' '));
  }

  return labels;
}

/**
 * Find the target section index for placing an item of a given type.
 * Uses multiple strategies in order of priority:
 *
 * 1. Find section with existing items of the same type
 * 2. Match section by title/label
 * 3. Check for HTML comment marker <!-- Type: X -->
 * 4. Fallback to first non-raw section
 * 5. Ultimate fallback: section 0
 *
 * @param sections The sections to search
 * @param targetType The type of item being placed
 * @returns The index of the target section
 */
export function findTargetSectionIndex(
  sections: Section[],
  targetType: ItemType
): number {
  // Strategy 1: Find section with existing items of same type
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const hasMatchingType = section.items.some((item: SectionItem) =>
      isBacklogItem(item) && item.type === targetType
    );
    if (hasMatchingType) {
      return i;
    }
  }

  // Strategy 2: Match section by title/label (for NEW types with no existing items)
  // First try the standard mapping, then fall back to custom type conversion
  const matchLabels = TYPE_LABEL_MAP[targetType] || getLabelsForCustomType(targetType);
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const titleUpper = section.title.toUpperCase();
    // Check if any label matches (exact or contains)
    if (matchLabels.some(label => {
      const labelUpper = label.toUpperCase();
      return titleUpper === labelUpper || titleUpper.includes(labelUpper);
    })) {
      return i;
    }
  }

  // Strategy 3: Check for HTML comment marker <!-- Type: X -->
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const hasTypeMarker = section.items.some((item: SectionItem) => {
      if ('rawMarkdown' in item) {
        const marker = `<!-- Type: ${targetType} -->`;
        return item.rawMarkdown.includes(marker);
      }
      return false;
    });
    if (hasTypeMarker) {
      return i;
    }
  }

  // Strategy 4: Match empty sections by title (for custom types with empty sections)
  // This catches sections that have no items but match by title
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Check if this is an empty section or has only raw-section marker
    const isEmpty = section.items.length === 0 ||
      (section.items.length === 1 &&
       'type' in section.items[0] &&
       section.items[0].type === 'raw-section');

    if (isEmpty) {
      const titleUpper = section.title.toUpperCase();
      const customLabels = getLabelsForCustomType(targetType);
      if (customLabels.some(label => {
        const labelUpper = label.toUpperCase();
        return titleUpper === labelUpper || titleUpper.includes(labelUpper);
      })) {
        return i;
      }
    }
  }

  // Strategy 5: Fallback to first non-raw section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const firstItem = section.items[0] as SectionItem | undefined;
    const isRawSection = section.items.length > 0 &&
      firstItem &&
      'type' in firstItem &&
      firstItem.type === 'raw-section';
    if (!isRawSection) {
      return i;
    }
  }

  // Strategy 6: Ultimate fallback - section 0
  return 0;
}

/**
 * Generate a new item ID for a given type.
 * Format: TYPE-XXX where XXX is a zero-padded number.
 *
 * @deprecated Use getNextItemNumber from db/queries/counters.ts instead.
 * This in-memory scan doesn't account for archived or deleted items,
 * which can cause ID reuse.
 *
 * @param existingIds All existing item IDs in the backlog
 * @param targetType The type prefix for the new ID
 * @returns A new unique ID string
 */
export function generateItemId(existingIds: string[], targetType: ItemType): string {
  const prefix = targetType;
  const existingNumbers = existingIds
    .filter(id => id.startsWith(prefix + '-'))
    .map(id => parseInt(id.split('-')[1], 10))
    .filter(n => !isNaN(n));

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

/**
 * Type label mapping for section removal.
 * Maps type IDs to their possible section title variations.
 */
export const TYPE_TO_SECTION_LABELS: Record<string, string[]> = {
  'BUG': ['BUGS', 'BUG'],
  'CT': ['COURT TERME', 'COURT-TERME', 'CT'],
  'LT': ['LONG TERME', 'LONG-TERME', 'LT'],
  'AUTRE': ['AUTRES IDÉES', 'AUTRES IDEES', 'AUTRES', 'AUTRE'],
  'TEST': ['TESTS', 'TEST'],
};
