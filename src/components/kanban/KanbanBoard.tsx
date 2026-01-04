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
import { useKanbanColumnWidths, KANBAN_BASE_WIDTH, type WidthMultiplier } from '../../hooks/useKanbanColumnWidths';

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
  const { getMultiplier, getWidth, toggleWidth } = useKanbanColumnWidths();

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
                width={getWidth(type.id)}
                multiplier={getMultiplier(type.id)}
                onToggleWidth={() => toggleWidth(type.id)}
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
  width: number;
  multiplier: WidthMultiplier;
  onToggleWidth: () => void;
}
function SortableKanbanColumnWithStyles({ type, items, onItemClick, width, multiplier, onToggleWidth }: SortableKanbanColumnProps) {
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

  const isDouble = multiplier === 2;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: bgColor,
        borderColor: borderColor,
        width: `${width}px`,
        minWidth: `${KANBAN_BASE_WIDTH}px`,
      }}
      className="flex flex-col rounded-lg border max-h-[calc(100vh-200px)] transition-all duration-200"
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
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWidth();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                transition-all duration-150 ease-out
                ${isDouble
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-white/50 text-gray-600 hover:bg-white/80'
                }
              `}
              title={isDouble ? 'Réduire (1 carte)' : 'Élargir (2 cartes)'}
            >
              {isDouble ? '2x' : '1x'}
            </button>
            <span className="text-sm" style={{ color: type.color, opacity: 0.75 }}>{items.length}</span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Aucun item
          </div>
        ) : shouldVirtualize ? (
          // Virtualized rendering for large lists (single column only for now)
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
          // Classic rendering - grid for 2x mode, single column for 1x
          <div className={isDouble ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
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
