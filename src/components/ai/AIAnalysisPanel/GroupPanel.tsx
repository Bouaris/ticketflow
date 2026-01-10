/**
 * GroupPanel - Display AI-suggested item groupings
 */

import { useState } from 'react';
import type { ItemGroup, SuggestionDecision } from '../../../types/ai';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, CloseIcon } from '../../ui/Icons';

interface GroupPanelProps {
  groups: ItemGroup[];
  decisions: Map<string, SuggestionDecision>;
  onAccept?: (groupId: string) => void;
  onReject?: (groupId: string) => void;
  className?: string;
}

export function GroupPanel({
  groups,
  decisions,
  onAccept,
  onReject,
  className = '',
}: GroupPanelProps) {
  if (groups.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Regroupements suggérés ({groups.length})
      </h4>

      <div className="space-y-2">
        {groups.map((group) => (
          <GroupCard
            key={group.groupId}
            group={group}
            decision={decisions.get(group.groupId)}
            onAccept={onAccept ? () => onAccept(group.groupId) : undefined}
            onReject={onReject ? () => onReject(group.groupId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

interface GroupCardProps {
  group: ItemGroup;
  decision?: SuggestionDecision;
  onAccept?: () => void;
  onReject?: () => void;
}

function GroupCard({ group, decision, onAccept, onReject }: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColors = {
    accepted: 'border-green-200 bg-green-50',
    rejected: 'border-red-200 bg-red-50 opacity-60',
    default: 'border-gray-200 bg-white',
  };

  const status = decision?.decision || 'default';

  return (
    <div
      className={`
        rounded-lg border transition-colors
        ${statusColors[status === 'modified' ? 'accepted' : status]}
      `}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Réduire' : 'Développer'} le groupe ${group.name}`}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        )}
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium text-gray-900 truncate">
            {group.name}
          </h5>
          <p className="text-xs text-gray-500">
            {group.items.length} items
          </p>
        </div>

        {/* Status badge */}
        {decision && (
          <span
            className={`
              px-1.5 py-0.5 text-[10px] font-medium rounded
              ${decision.decision === 'accepted'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
              }
            `}
          >
            {decision.decision === 'accepted' ? 'Accepté' : 'Rejeté'}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Rationale */}
          <p className="text-xs text-gray-600 leading-relaxed">
            {group.rationale}
          </p>

          {/* Items list */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-500 uppercase">
              Items ({group.items.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {group.items.map((itemId, index) => (
                <span
                  key={itemId}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-700 rounded"
                >
                  {index + 1}. {itemId}
                </span>
              ))}
            </div>
          </div>

          {/* Suggested order */}
          {group.suggestedOrder.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase">
                Ordre suggéré
              </p>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                {group.suggestedOrder.map((itemId, index) => (
                  <span key={itemId} className="flex items-center">
                    {index > 0 && <span className="mx-1">→</span>}
                    <span className="font-mono">{itemId}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!decision && (onAccept || onReject) && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {onAccept && (
                <button
                  onClick={onAccept}
                  aria-label={`Accepter le regroupement ${group.name}`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                           text-green-700 bg-green-100 hover:bg-green-200
                           rounded transition-colors"
                >
                  <CheckIcon className="w-3 h-3" />
                  Accepter
                </button>
              )}
              {onReject && (
                <button
                  onClick={onReject}
                  aria-label={`Rejeter le regroupement ${group.name}`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                           text-red-700 bg-red-100 hover:bg-red-200
                           rounded transition-colors"
                >
                  <CloseIcon className="w-3 h-3" />
                  Rejeter
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
