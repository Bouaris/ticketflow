/**
 * KanbanCard component - Individual card in a Kanban column.
 */

import type { BacklogItem } from '../../types/backlog';
import { SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';

interface KanbanCardProps {
  item: BacklogItem;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: KanbanCardProps) {
  const criteriaProgress = item.criteria
    ? {
        completed: item.criteria.filter(c => c.checked).length,
        total: item.criteria.length,
      }
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer transition-all"
    >
      {/* Header: ID + Emoji */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">{item.id}</span>
        {item.emoji && <span className="text-sm">{item.emoji}</span>}
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
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                criteriaProgress.completed === criteriaProgress.total
                  ? 'bg-green-500'
                  : criteriaProgress.completed > 0
                  ? 'bg-amber-500'
                  : 'bg-gray-300'
              }`}
              style={{
                width: `${(criteriaProgress.completed / criteriaProgress.total) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400">
            {criteriaProgress.completed}/{criteriaProgress.total}
          </span>
        </div>
      )}
    </div>
  );
}
