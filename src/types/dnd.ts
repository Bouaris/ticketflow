/**
 * Drag and Drop type definitions for @dnd-kit
 * Discriminated union to distinguish column vs card drags
 */

// Discriminated union for drag data
export type DragData =
  | { type: 'column'; columnId: string }
  | { type: 'card'; itemId: string; sourceType: string };

// Type guard for column drag
export function isColumnDrag(
  data: DragData | undefined
): data is { type: 'column'; columnId: string } {
  return data?.type === 'column';
}

// Type guard for card drag
export function isCardDrag(
  data: DragData | undefined
): data is { type: 'card'; itemId: string; sourceType: string } {
  return data?.type === 'card';
}
