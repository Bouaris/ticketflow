/**
 * KanbanBoard component with dynamic columns per item type.
 * Supports drag & drop for reordering columns.
 * Uses virtual scrolling for performance with large lists.
 */

import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BacklogItem } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';
import { KanbanCard } from './KanbanCard';
import { GripIcon } from '../ui/Icons';
import { hexToRgba } from '../../lib/utils';

// Only virtualize columns with many items (avoids height estimation issues for small lists)
const VIRTUALIZATION_THRESHOLD = 15;

interface KanbanBoardProps {
  itemsByType: Record<string, BacklogItem[]>;
  types: TypeDefinition[];
  onItemClick: (item: BacklogItem) => void;
  onTypesReorder?: (fromIndex: number, toIndex: number) => void;
}

export function KanbanBoard({ itemsByType, types, onItemClick, onTypesReorder }: KanbanBoardProps) {
  const totalItems = Object.values(itemsByType).reduce((sum, items) => sum + items.length, 0);

  // Filter types to only show columns with items
  const visibleTypes = useMemo(() => {
    return types.filter(type => (itemsByType[type.id]?.length ?? 0) > 0);
  }, [types, itemsByType]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onTypesReorder) {
      // Use original types array for reordering to preserve correct indices
      const oldIndex = types.findIndex(t => t.id === active.id);
      const newIndex = types.findIndex(t => t.id === over.id);
      onTypesReorder(oldIndex, newIndex);
    }
  };

  if (totalItems === 0 && visibleTypes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Aucun item à afficher
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleTypes.map(t => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 min-w-max h-full">
            {visibleTypes.map(type => (
              <SortableKanbanColumnWithStyles
                key={type.id}
                type={type}
                items={itemsByType[type.id] || []}
                onItemClick={onItemClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ============================================================
// SORTABLE KANBAN COLUMN (with dynamic colors)
// ============================================================

interface SortableKanbanColumnProps {
  type: TypeDefinition;
  items: BacklogItem[];
  onItemClick: (item: BacklogItem) => void;
}
function SortableKanbanColumnWithStyles({ type, items, onItemClick }: SortableKanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  // Only virtualize large lists to avoid height estimation issues
  const shouldVirtualize = items.length > VIRTUALIZATION_THRESHOLD;

  // Virtualizer for card list (only used when shouldVirtualize is true)
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Increased estimate for safety margin
    overscan: 3, // Render 3 extra items above/below
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Generate background with opacity
  const bgColor = hexToRgba(type.color, 0.05);
  const borderColor = hexToRgba(type.color, 0.3);
  const headerBgColor = hexToRgba(type.color, 0.15);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
      className="flex flex-col w-full sm:w-72 md:w-80 rounded-lg border max-h-[calc(100vh-200px)]"
    >
      {/* Header - Draggable */}
      <div
        {...attributes}
        {...listeners}
        style={{ backgroundColor: headerBgColor }}
        className="px-4 py-3 rounded-t-lg cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripIcon className="w-4 h-4 opacity-50" />
            <h3 className="font-semibold" style={{ color: type.color }}>{type.label}</h3>
          </div>
          <span className="text-sm" style={{ color: type.color, opacity: 0.75 }}>{items.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Aucun item
          </div>
        ) : shouldVirtualize ? (
          // Virtualized rendering for large lists
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '12px',
                  }}
                >
                  <KanbanCard
                    item={item}
                    onClick={() => onItemClick(item)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Classic rendering for small lists (avoids height estimation issues)
          <div className="space-y-3">
            {items.map(item => (
              <KanbanCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
