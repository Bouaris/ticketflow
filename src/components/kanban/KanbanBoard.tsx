/**
 * KanbanBoard component with columns per item type.
 */

import type { BacklogItem, ItemType } from '../../types/backlog';
import { TYPE_LABELS } from '../../types/backlog';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  itemsByType: Record<ItemType, BacklogItem[]>;
  onItemClick: (item: BacklogItem) => void;
}

const COLUMN_ORDER: ItemType[] = ['BUG', 'EXT', 'ADM', 'COS', 'LT'];

const COLUMN_COLORS: Record<ItemType, { bg: string; border: string; header: string }> = {
  BUG: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800' },
  EXT: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800' },
  ADM: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800' },
  COS: { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-cyan-100 text-cyan-800' },
  LT: { bg: 'bg-gray-50', border: 'border-gray-200', header: 'bg-gray-100 text-gray-800' },
};

export function KanbanBoard({ itemsByType, onItemClick }: KanbanBoardProps) {
  const totalItems = Object.values(itemsByType).reduce((sum, items) => sum + items.length, 0);

  if (totalItems === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Aucun item à afficher
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      <div className="flex gap-4 min-w-max h-full">
        {COLUMN_ORDER.map(type => (
          <KanbanColumn
            key={type}
            type={type}
            items={itemsByType[type]}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// KANBAN COLUMN
// ============================================================

interface KanbanColumnProps {
  type: ItemType;
  items: BacklogItem[];
  onItemClick: (item: BacklogItem) => void;
}

function KanbanColumn({ type, items, onItemClick }: KanbanColumnProps) {
  const colors = COLUMN_COLORS[type];

  return (
    <div className={`flex flex-col w-80 rounded-lg border ${colors.border} ${colors.bg}`}>
      {/* Header */}
      <div className={`px-4 py-3 rounded-t-lg ${colors.header}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{TYPE_LABELS[type]}</h3>
          <span className="text-sm opacity-75">{items.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Aucun item
          </div>
        ) : (
          items.map(item => (
            <KanbanCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}
