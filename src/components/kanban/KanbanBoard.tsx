/**
 * KanbanBoard component with dynamic columns per item type.
 * Supports drag & drop for:
 *  - Reordering columns (horizontal)
 *  - Moving cards between columns (cross-type migration)
 * Uses virtual scrolling for performance with large lists.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../i18n';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
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
import type { ItemPriorityScore, BlockingBug } from '../../types/ai';
import { isColumnDrag, isCardDrag, type DragData } from '../../types/dnd';
import { KanbanCard } from './KanbanCard';
import { GripIcon } from '../ui/Icons';
import { hexToRgba } from '../../lib/utils';
import { useKanbanColumnWidths, KANBAN_BASE_WIDTH, type WidthMultiplier } from '../../hooks/useKanbanColumnWidths';
import { SPRING_PRESETS } from '../../lib/animation-presets';

// Only virtualize columns with many items (avoids height estimation issues for small lists)
const VIRTUALIZATION_THRESHOLD = 15;

interface KanbanBoardProps {
  itemsByType: Record<string, BacklogItem[]>;
  types: TypeDefinition[];
  onItemClick: (item: BacklogItem) => void;
  onTypesReorder?: (fromIndex: number, toIndex: number) => void;
  onMoveItem?: (itemId: string, targetType: string) => void;
  projectPath?: string;
  // AI Analysis getters (optional)
  getItemScore?: (itemId: string) => ItemPriorityScore | null;
  getBlockingInfo?: (itemId: string) => BlockingBug | null;
  // Phase 11: Inline editing
  onInlineUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  // Phase 11: Multi-selection
  isSelected?: (itemId: string) => boolean;
  onSelectionClick?: (itemId: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  // Quick-004: Quick action buttons
  onQuickDelete?: (item: BacklogItem) => void;
  onQuickValidate?: (item: BacklogItem) => void;
  onQuickExport?: (item: BacklogItem) => void;
  onQuickArchive?: (item: BacklogItem) => void;
}

export function KanbanBoard({
  itemsByType,
  types,
  onItemClick,
  onTypesReorder,
  onMoveItem,
  projectPath,
  getItemScore,
  getBlockingInfo,
  onInlineUpdate,
  isSelected,
  onSelectionClick,
  onQuickDelete,
  onQuickValidate,
  onQuickExport,
  onQuickArchive,
}: KanbanBoardProps) {
  const totalItems = Object.values(itemsByType).reduce((sum, items) => sum + items.length, 0);
  const { getMultiplier, getWidth, toggleWidth } = useKanbanColumnWidths(projectPath);

  // Drag state for dual-drag (columns + cards)
  const [activeDragType, setActiveDragType] = useState<'column' | 'card' | null>(null);
  const [activeItem, setActiveItem] = useState<BacklogItem | null>(null);

  // Filter types to only show columns where visible=true
  const visibleTypes = useMemo(() => {
    return types.filter(type => type.visible);
  }, [types]);

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

  // Custom collision detection: closestCenter for columns, pointerWithin for cards
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    if (activeDragType === 'column') {
      return closestCenter(args);
    }
    // For cards, use pointerWithin to detect which column we're over
    return pointerWithin(args);
  }, [activeDragType]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DragData | undefined;

    if (isColumnDrag(data)) {
      setActiveDragType('column');
      setActiveItem(null);
    } else if (isCardDrag(data)) {
      setActiveDragType('card');
      // Find the item for DragOverlay
      const sourceItems = itemsByType[data.sourceType] || [];
      const item = sourceItems.find(i => i.id === data.itemId);
      setActiveItem(item || null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset drag state
    const wasCardDrag = activeDragType === 'card';
    setActiveDragType(null);
    setActiveItem(null);

    if (!over) return;

    const activeData = active.data.current as DragData | undefined;

    // Column reordering
    if (isColumnDrag(activeData) && active.id !== over.id && onTypesReorder) {
      const oldIndex = types.findIndex(t => t.id === active.id);
      const newIndex = types.findIndex(t => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onTypesReorder(oldIndex, newIndex);
      }
      return;
    }

    // Card drop onto column
    if (isCardDrag(activeData) && wasCardDrag && onMoveItem) {
      // over.id is the droppable column ID (type ID)
      const overId = String(over.id);
      // Extract target type: if overId starts with 'drop-', it's a column drop zone
      const targetType = overId.startsWith('drop-') ? overId.slice(5) : overId;

      // Only move if dropping on different column
      if (targetType !== activeData.sourceType && types.some(t => t.id === targetType)) {
        onMoveItem(activeData.itemId, targetType);
      }
    }
  };

  const { t } = useTranslation();

  if (totalItems === 0 && visibleTypes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-on-surface-muted">
        {t.empty.noItems}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
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
                isDropTarget={activeDragType === 'card'}
                getItemScore={getItemScore}
                getBlockingInfo={getBlockingInfo}
                onInlineUpdate={onInlineUpdate}
                isSelected={isSelected}
                onSelectionClick={onSelectionClick}
                onQuickDelete={onQuickDelete}
                onQuickValidate={onQuickValidate}
                onQuickExport={onQuickExport}
                onQuickArchive={onQuickArchive}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drag Overlay for visual feedback - no inline editing during drag */}
        <DragOverlay>
          {activeItem && activeDragType === 'card' && (
            <motion.div
              initial={{ scale: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              animate={{ scale: 1.05, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
              transition={SPRING_PRESETS.gentle}
              className="w-72"
            >
              <KanbanCard
                item={activeItem}
                onClick={() => {}}
                isDragOverlay
                aiScore={getItemScore?.(activeItem.id)}
                blockingInfo={getBlockingInfo?.(activeItem.id)}
              />
            </motion.div>
          )}
        </DragOverlay>
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
  isDropTarget?: boolean;
  getItemScore?: (itemId: string) => ItemPriorityScore | null;
  getBlockingInfo?: (itemId: string) => BlockingBug | null;
  onInlineUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  // Phase 11: Multi-selection
  isSelected?: (itemId: string) => boolean;
  onSelectionClick?: (itemId: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  // Quick-004: Quick action buttons
  onQuickDelete?: (item: BacklogItem) => void;
  onQuickValidate?: (item: BacklogItem) => void;
  onQuickExport?: (item: BacklogItem) => void;
  onQuickArchive?: (item: BacklogItem) => void;
}
function SortableKanbanColumnWithStyles({
  type,
  items,
  onItemClick,
  width,
  multiplier,
  onToggleWidth,
  isDropTarget = false,
  getItemScore,
  getBlockingInfo,
  onInlineUpdate,
  isSelected,
  onSelectionClick,
  onQuickDelete,
  onQuickValidate,
  onQuickExport,
  onQuickArchive,
}: SortableKanbanColumnProps) {
  // Sortable for column reordering (header drag)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: type.id,
    data: { type: 'column', columnId: type.id } as DragData,
  });

  // Droppable for receiving cards
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-${type.id}`,
    data: { columnId: type.id },
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const { t } = useTranslation();

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

  // Visual feedback when card is dragged over this column
  const dropHighlight = isDropTarget && isOver
    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-surface'
    : '';

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
      className={`flex flex-col rounded-lg border max-h-[calc(100vh-200px)] transition-all duration-200 ${dropHighlight}`}
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
              aria-label={isDouble ? 'Réduire la colonne à 1 carte' : 'Élargir la colonne à 2 cartes'}
              className={`
                px-1.5 py-0.5 text-[10px] font-medium rounded
                transition-all duration-150 ease-out
                ${isDouble
                  ? 'bg-accent/10 text-accent hover:bg-accent/20'
                  : 'bg-surface-alt/50 text-on-surface-secondary hover:bg-surface-alt/80'
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
          <div className="text-center text-on-surface-faint text-sm py-8">
            {t.common.noItems}
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
                    columnType={type.id}
                    aiScore={getItemScore?.(item.id)}
                    blockingInfo={getBlockingInfo?.(item.id)}
                    onInlineUpdate={onInlineUpdate}
                    isSelected={isSelected?.(item.id)}
                    onSelectionClick={onSelectionClick}
                    onQuickDelete={onQuickDelete}
                    onQuickValidate={onQuickValidate}
                    onQuickExport={onQuickExport}
                    onQuickArchive={onQuickArchive}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Classic rendering - grid for 2x mode, single column for 1x
          // AnimatePresence for enter/exit animations on cards
          <AnimatePresence mode="popLayout">
            <div className={isDouble ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {items.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={SPRING_PRESETS.snappy}
                >
                  <KanbanCard
                    item={item}
                    onClick={() => onItemClick(item)}
                    columnType={type.id}
                    aiScore={getItemScore?.(item.id)}
                    blockingInfo={getBlockingInfo?.(item.id)}
                    onInlineUpdate={onInlineUpdate}
                    isSelected={isSelected?.(item.id)}
                    onSelectionClick={onSelectionClick}
                    onQuickDelete={onQuickDelete}
                    onQuickValidate={onQuickValidate}
                    onQuickExport={onQuickExport}
                    onQuickArchive={onQuickArchive}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
