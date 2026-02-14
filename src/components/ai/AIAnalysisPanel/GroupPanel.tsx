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
      <h4 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide">
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
    accepted: 'border-green-200 bg-success-soft',
    rejected: 'border-danger bg-danger-soft opacity-60',
    default: 'border-outline bg-surface',
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
          <ChevronDownIcon className="w-4 h-4 text-on-surface-faint" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-on-surface-faint" />
        )}
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium text-on-surface truncate">
            {group.name}
          </h5>
          <p className="text-xs text-on-surface-muted">
            {group.items.length} items
          </p>
        </div>

        {/* Status badge */}
        {decision && (
          <span
            className={`
              px-1.5 py-0.5 text-[10px] font-medium rounded
              ${decision.decision === 'accepted'
                ? 'bg-success-soft text-success-text'
                : 'bg-danger-soft text-danger-text'
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
          <p className="text-xs text-on-surface-secondary leading-relaxed">
            {group.rationale}
          </p>

          {/* Items list */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-on-surface-muted uppercase">
              Items ({group.items.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {group.items.map((itemId, index) => (
                <span
                  key={itemId}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-alt text-on-surface-secondary rounded"
                >
                  {index + 1}. {itemId}
                </span>
              ))}
            </div>
          </div>

          {/* Suggested order */}
          {group.suggestedOrder.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-on-surface-muted uppercase">
                Ordre suggéré
              </p>
              <div className="flex items-center gap-1 text-[10px] text-on-surface-muted">
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
            <div className="flex items-center gap-2 pt-2 border-t border-outline">
              {onAccept && (
                <button
                  onClick={onAccept}
                  aria-label={`Accepter le regroupement ${group.name}`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                           text-success-text bg-success-soft hover:bg-green-200
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
                           text-danger-text bg-danger-soft hover:bg-red-200
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
