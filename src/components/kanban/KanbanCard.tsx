/**
 * KanbanCard component - Individual card in a Kanban column.
 * Supports drag & drop for cross-column movement.
 * Phase 11: Supports inline editing of title and badges.
 * Phase 13: Hover scale animation via nested motion.div (avoids dnd-kit transform conflicts).
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'motion/react';
import type { BacklogItem, Priority, Effort, Severity } from '../../types/backlog';
import type { DragData } from '../../types/dnd';
import type { ItemPriorityScore, BlockingBug } from '../../types/ai';
import { SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';
import { CriteriaProgress } from '../ui/Progress';
import { CameraIcon, CheckIcon, TrashIcon, CheckCircleIcon, CopyIcon, ArchiveIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';
import { ScoreBadge } from '../ai/AIPriorityScore';
import { AIBlockingIndicator } from '../ai/AIBlockingIndicator';
import { InlineEditField } from '../ui/InlineEditField';
import { InlineSelect, type InlineSelectOption } from '../ui/InlineSelect';
import { SPRING_PRESETS } from '../../lib/animation-presets';

// Phase 11: Inline editing option constants
const PRIORITY_OPTIONS: InlineSelectOption<Priority>[] = [
  { value: 'Haute', label: 'Haute' },
  { value: 'Moyenne', label: 'Moyenne' },
  { value: 'Faible', label: 'Faible' },
];

const EFFORT_OPTIONS: InlineSelectOption<Effort>[] = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
];

const SEVERITY_OPTIONS: InlineSelectOption<Severity>[] = [
  { value: 'P0', label: 'P0 - Bloquant' },
  { value: 'P1', label: 'P1 - Critique' },
  { value: 'P2', label: 'P2 - Moyenne' },
  { value: 'P3', label: 'P3 - Faible' },
  { value: 'P4', label: 'P4 - Mineure' },
];

interface KanbanCardProps {
  item: BacklogItem;
  onClick: () => void;
  columnType?: string;
  isDragOverlay?: boolean;
  aiScore?: ItemPriorityScore | null;
  blockingInfo?: BlockingBug | null;
  onInlineUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  // Phase 11: Multi-selection (wired from KanbanBoard)
  isSelected?: boolean;
  onSelectionClick?: (itemId: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  // Quick-004: Quick action buttons (hover overlay)
  onQuickDelete?: (item: BacklogItem) => void;
  onQuickValidate?: (item: BacklogItem) => void;
  onQuickExport?: (item: BacklogItem) => void;
  onQuickArchive?: (item: BacklogItem) => void;
}

export function KanbanCard({
  item,
  onClick,
  columnType,
  isDragOverlay = false,
  aiScore,
  blockingInfo,
  onInlineUpdate,
  isSelected,
  onSelectionClick,
  onQuickDelete,
  onQuickValidate,
  onQuickExport,
  onQuickArchive,
}: KanbanCardProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

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
    disabled: isDragOverlay,
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

  // Handle click - selection with modifiers, detail panel otherwise
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    // Ctrl/Meta/Shift+Click -> selection mode
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && onSelectionClick) {
      onSelectionClick(item.id, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
      return;
    }
    onClick();
  };

  // Determine if hover animation should be active
  const enableHover = !isDragOverlay && !shouldReduceMotion;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`select-none ${
        isDragOverlay ? 'rotate-3 scale-105' : ''
      } ${isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface rounded-lg' : ''}`}
    >
      {/* Nested motion.div for hover animation - separate from dnd-kit transforms */}
      <motion.div
        whileHover={enableHover ? { scale: 1.02 } : undefined}
        transition={SPRING_PRESETS.snappy}
        className={`relative group bg-surface rounded-lg border border-outline p-3 shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline hover:shadow-md dark:hover:shadow-none hover:border-outline-strong transition-shadow ${
          isDragOverlay ? 'shadow-xl dark:shadow-none' : ''
        }`}
      >
        {/* Quick Actions - visible on hover */}
        {(onQuickDelete || onQuickValidate || onQuickExport || onQuickArchive) && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {onQuickValidate && (() => {
              const isValidated = item.criteria && item.criteria.length > 0 && item.criteria.every(c => c.checked);
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickValidate(item); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-1 rounded shadow-sm transition-colors ${
                    isValidated
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-surface/90 hover:bg-green-100 dark:hover:bg-green-900/30 text-on-surface-muted hover:text-green-600'
                  }`}
                  title={isValidated ? t.quickActions.unvalidate : t.quickActions.validate}
                >
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                </button>
              );
            })()}
            {onQuickExport && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickExport(item); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 rounded bg-surface/90 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-on-surface-muted hover:text-blue-600 transition-colors shadow-sm"
                title={t.quickActions.export}
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {onQuickArchive && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickArchive(item); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 rounded bg-surface/90 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-on-surface-muted hover:text-amber-600 transition-colors shadow-sm"
                title={t.quickActions.archive}
              >
                <ArchiveIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {onQuickDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickDelete(item); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 rounded bg-surface/90 hover:bg-red-100 dark:hover:bg-red-900/30 text-on-surface-muted hover:text-red-600 transition-colors shadow-sm"
                title={t.quickActions.delete}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Selection checkbox overlay */}
        {onSelectionClick && (
          <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
            isSelected
              ? 'bg-accent border-accent text-white'
              : 'bg-surface border-outline opacity-0 group-hover:opacity-100'
          }`}>
            {isSelected && <CheckIcon className="w-3 h-3" />}
          </div>
        )}

        {/* Header: ID + Emoji + Screenshot indicator + AI indicators */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-on-surface-muted">{item.id}</span>
          {item.emoji && <span className="text-sm">{item.emoji}</span>}
          {item.screenshots && item.screenshots.length > 0 && (
            <span className="text-on-surface-faint" title={`${item.screenshots.length} capture(s)`}>
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

        {/* Title - Phase 11: Inline editing */}
        <h4 className="text-sm font-medium text-on-surface mb-2 line-clamp-2">
          <InlineEditField
            value={item.title}
            onSave={(newTitle) => onInlineUpdate?.(item.id, { title: newTitle })}
            disabled={!onInlineUpdate}
          />
        </h4>

        {/* Description preview */}
        {item.description && (
          <p className="text-xs text-on-surface-muted mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Badges - Phase 11: Inline editing via InlineSelect */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {item.severity && (
            onInlineUpdate ? (
              <InlineSelect<Severity>
                value={item.severity}
                options={SEVERITY_OPTIONS}
                onSelect={(severity) => onInlineUpdate(item.id, { severity })}
                allowClear={false}
                renderTrigger={({ onClick: triggerClick }) => (
                  <span onClick={triggerClick} className="cursor-pointer">
                    <SeverityBadge severity={item.severity!} size="sm" />
                  </span>
                )}
              />
            ) : (
              <SeverityBadge severity={item.severity} size="sm" />
            )
          )}
          {item.priority && (
            onInlineUpdate ? (
              <InlineSelect<Priority>
                value={item.priority}
                options={PRIORITY_OPTIONS}
                onSelect={(priority) => onInlineUpdate(item.id, { priority })}
                allowClear={false}
                renderTrigger={({ onClick: triggerClick }) => (
                  <span onClick={triggerClick} className="cursor-pointer">
                    <PriorityBadge priority={item.priority!} size="sm" />
                  </span>
                )}
              />
            ) : (
              <PriorityBadge priority={item.priority} size="sm" />
            )
          )}
          {item.effort && (
            onInlineUpdate ? (
              <InlineSelect<Effort>
                value={item.effort}
                options={EFFORT_OPTIONS}
                onSelect={(effort) => onInlineUpdate(item.id, { effort })}
                allowClear={false}
                renderTrigger={({ onClick: triggerClick }) => (
                  <span onClick={triggerClick} className="cursor-pointer">
                    <EffortBadge effort={item.effort!} size="sm" />
                  </span>
                )}
              />
            ) : (
              <EffortBadge effort={item.effort} size="sm" />
            )
          )}
        </div>

        {/* Module/Component */}
        {(item.module || item.component) && (
          <div className="text-xs text-on-surface-faint mb-2 truncate">
            {item.module || item.component}
          </div>
        )}

        {/* Criteria Progress */}
        {criteriaProgress && criteriaProgress.total > 0 && (
          <div className="mt-2 pt-2 border-t border-outline">
            <CriteriaProgress
              completed={criteriaProgress.completed}
              total={criteriaProgress.total}
              size="sm"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
