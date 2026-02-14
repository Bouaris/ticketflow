/**
 * ItemCitation - Clickable inline badge for item IDs in chat responses
 *
 * Renders a clickable badge when the item exists in the backlog,
 * or a plain monospace span when the item is not found.
 *
 * @module components/chat/ItemCitation
 */

import type { BacklogItem } from '../../types/backlog';

// ============================================================
// TYPES
// ============================================================

interface ItemCitationProps {
  itemId: string;
  items: BacklogItem[];
  onOpenItem: (item: BacklogItem) => void;
}

// ============================================================
// COMPONENT
// ============================================================

export function ItemCitation({ itemId, items, onOpenItem }: ItemCitationProps) {
  const item = items.find(i => i.id === itemId);

  if (!item) {
    return (
      <span className="font-mono text-xs text-on-surface-secondary">
        {itemId}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenItem(item)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/10 text-accent rounded text-xs font-mono hover:bg-accent/20 transition-colors cursor-pointer"
    >
      {item.emoji && <span>{item.emoji}</span>}
      {itemId}
    </button>
  );
}
