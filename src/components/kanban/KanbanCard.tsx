/**
 * KanbanCard component - Individual card in a Kanban column.
 * Supports drag & drop for cross-column movement.
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { BacklogItem } from '../../types/backlog';
import type { DragData } from '../../types/dnd';
import type { ItemPriorityScore, BlockingBug } from '../../types/ai';
import { SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';
import { CriteriaProgress } from '../ui/Progress';
import { CameraIcon } from '../ui/Icons';
import { ScoreBadge } from '../ai/AIPriorityScore';
import { AIBlockingIndicator } from '../ai/AIBlockingIndicator';

interface KanbanCardProps {
  item: BacklogItem;
  onClick: () => void;
  columnType?: string;      // Parent column type for drag data
  isDragOverlay?: boolean;  // True when rendered in DragOverlay (disables drag)
  aiScore?: ItemPriorityScore | null;  // AI priority score
  blockingInfo?: BlockingBug | null;   // Blocking bug info
}

export function KanbanCard({
  item,
  onClick,
  columnType,
  isDragOverlay = false,
  aiScore,
  blockingInfo,
}: KanbanCardProps) {
  // Drag data for cross-column movement
  const dragData: DragData = {
    type: 'card',
    itemId: item.id,
    sourceType: columnType || item.type,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `card-${item.id}`,
    data: dragData,
    disabled: isDragOverlay, // Disable drag on overlay clone
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragOverlay ? 'grabbing' : 'grab',
  };
  const criteriaProgress = item.criteria
    ? {
        completed: item.criteria.filter(c => c.checked).length,
        total: item.criteria.length,
      }
    : null;

  // Handle click - only trigger if not dragging
  const handleClick = () => {
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-gray-300 transition-all select-none ${
        isDragOverlay ? 'rotate-3 scale-105 shadow-xl' : ''
      }`}
    >
      {/* Header: ID + Emoji + Screenshot indicator + AI indicators */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">{item.id}</span>
        {item.emoji && <span className="text-sm">{item.emoji}</span>}
        {item.screenshots && item.screenshots.length > 0 && (
          <span className="text-gray-400" title={`${item.screenshots.length} capture(s)`}>
            <CameraIcon />
          </span>
        )}

        {/* AI indicators - pushed to the right */}
        <div className="ml-auto flex items-center gap-1">
          {blockingInfo && (
            <AIBlockingIndicator
              blocksCount={blockingInfo.blocksCount}
              severity={blockingInfo.severity}
              recommendation={blockingInfo.recommendation}
              size="sm"
            />
          )}
          {aiScore && (
            <ScoreBadge
              score={aiScore.score}
              size="sm"
              factors={aiScore.factors}
              rationale={aiScore.rationale}
            />
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {item.title}
      </h4>

      {/* Description preview */}
      {item.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {item.severity && <SeverityBadge severity={item.severity} size="sm" />}
        {item.priority && <PriorityBadge priority={item.priority} size="sm" />}
        {item.effort && <EffortBadge effort={item.effort} size="sm" />}
      </div>

      {/* Module/Component */}
      {(item.module || item.component) && (
        <div className="text-xs text-gray-400 mb-2 truncate">
          {item.module || item.component}
        </div>
      )}

      {/* Criteria Progress */}
      {criteriaProgress && criteriaProgress.total > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <CriteriaProgress
            completed={criteriaProgress.completed}
            total={criteriaProgress.total}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
