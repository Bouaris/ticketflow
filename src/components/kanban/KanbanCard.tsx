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
      {/* Header: ID + Emoji + Screenshot indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">{item.id}</span>
        {item.emoji && <span className="text-sm">{item.emoji}</span>}
        {item.screenshots && item.screenshots.length > 0 && (
          <span className="text-gray-400" title={`${item.screenshots.length} capture(s)`}>
            <CameraIcon />
          </span>
        )}
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

// Camera icon for screenshot indicator
function CameraIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
