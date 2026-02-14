/**
 * RelationManager - Compact UI for viewing and managing ticket relations.
 *
 * Displays existing relations with color-coded badges and provides
 * an add form with searchable dropdown for creating new relations.
 * Integrated into the ItemDetailPanel.
 */

import { useState, useMemo } from 'react';
import type { BacklogItem } from '../../types/backlog';
import type { RelationType } from '../../types/relations';
import { RELATION_LABELS } from '../../types/relations';
import { useRelations } from '../../hooks/useRelations';
import { PlusIcon, TrashIcon, CheckIcon, CloseIcon, SparklesIcon, SearchIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface RelationManagerProps {
  itemId: string;
  projectPath: string;
  projectId: number;
  allItems: BacklogItem[];
  onRelationsChange?: () => void;
}

// ============================================================
// RELATION TYPE STYLING
// ============================================================

const RELATION_COLORS: Record<RelationType, { badge: string; text: string }> = {
  'blocks': {
    badge: 'bg-danger-soft text-danger-text border-danger',
    text: 'text-danger-text',
  },
  'blocked-by': {
    badge: 'bg-amber-100 text-amber-700 border-warning-text/30',
    text: 'text-warning-text',
  },
  'related-to': {
    badge: 'bg-accent-soft text-accent-text border-accent/30',
    text: 'text-accent-text',
  },
};

const RELATION_TYPE_OPTIONS: { value: RelationType; label: string }[] = [
  { value: 'blocks', label: 'Bloque' },
  { value: 'blocked-by', label: 'Bloqu\u00e9 par' },
  { value: 'related-to', label: 'Li\u00e9 \u00e0' },
];

// ============================================================
// COMPONENT
// ============================================================

export function RelationManager({
  itemId,
  projectPath,
  projectId,
  allItems,
  onRelationsChange,
}: RelationManagerProps) {
  const { relations, isLoading, addRelation, removeRelation } = useRelations(
    projectPath,
    projectId,
    itemId
  );
  const { t } = useTranslation();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationType>('related-to');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // IDs already related to this item (exclude from dropdown)
  const relatedIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add(itemId); // Exclude self
    for (const rel of relations) {
      ids.add(rel.targetId);
      ids.add(rel.sourceId);
    }
    return ids;
  }, [itemId, relations]);

  // Filtered items for the dropdown
  const availableItems = useMemo(() => {
    const filtered = allItems.filter(item => !relatedIds.has(item.id));
    if (!searchQuery.trim()) return filtered.slice(0, 10);

    const query = searchQuery.toLowerCase();
    return filtered
      .filter(item =>
        item.id.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [allItems, relatedIds, searchQuery]);

  // Handle adding a relation
  const handleAdd = async () => {
    if (!selectedTargetId) return;

    setIsAdding(true);
    try {
      await addRelation(selectedTargetId, selectedType, reason || undefined);
      onRelationsChange?.();
      // Reset form
      setSelectedTargetId(null);
      setSearchQuery('');
      setReason('');
      setShowAddForm(false);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowAddForm(false);
    setSelectedTargetId(null);
    setSearchQuery('');
    setReason('');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide">
          {t.relations.title}
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="p-1 text-on-surface-faint hover:text-accent-text hover:bg-accent-soft rounded transition-colors"
            title={t.relations.add}
            aria-label={t.relations.add}
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-on-surface-faint">{t.common.loadingDots}</p>
      )}

      {/* Relation list */}
      {relations.length > 0 ? (
        <div className="space-y-2">
          {relations.map(rel => {
            const colors = RELATION_COLORS[rel.relationType];
            return (
              <div
                key={rel.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-alt group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Relation type badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors.badge}`}>
                    {RELATION_LABELS[rel.relationType]}
                  </span>

                  {/* Target item */}
                  <span className="text-sm font-mono text-on-surface-secondary truncate">
                    {rel.targetId}
                  </span>

                  {/* AI indicator */}
                  {rel.confidence !== null && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600 border border-purple-200" title={`Confiance: ${Math.round(rel.confidence * 100)}%`}>
                      <SparklesIcon className="w-3 h-3" />
                      IA
                    </span>
                  )}
                </div>

                {/* Remove button */}
                <button
                  onClick={async () => {
                    await removeRelation(rel.id);
                    onRelationsChange?.();
                  }}
                  className="p-1 text-on-surface-faint hover:text-danger-text opacity-0 group-hover:opacity-100 transition-all"
                  title={t.relations.deleteRelation}
                  aria-label={`${t.relations.deleteRelation} ${rel.targetId}`}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : !isLoading && !showAddForm ? (
        <p className="text-sm text-on-surface-faint italic">{t.relations.noRelations}</p>
      ) : null}

      {/* Add form */}
      {showAddForm && (
        <div className="mt-3 p-3 border border-outline rounded-lg bg-surface space-y-3">
          {/* Relation type selector */}
          <div>
            <label className="block text-xs font-medium text-on-surface-muted mb-1">Type</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as RelationType)}
              className="w-full text-sm bg-input-bg text-on-surface border border-outline-strong rounded-md px-2 py-1.5 focus:ring-1 focus:ring-accent focus:border-accent"
            >
              {RELATION_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Target item search */}
          <div>
            <label className="block text-xs font-medium text-on-surface-muted mb-1">Ticket cible</label>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSelectedTargetId(null);
                }}
                placeholder={t.relations.searchPlaceholder}
                className="w-full text-sm border border-outline-strong rounded-md pl-7 pr-2 py-1.5 focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>

            {/* Selected item display */}
            {selectedTargetId && (
              <div className="mt-1 flex items-center gap-2 px-2 py-1 bg-accent-soft border border-accent/30 rounded text-sm">
                <span className="font-mono text-accent-text">{selectedTargetId}</span>
                <span className="text-on-surface-secondary truncate">
                  {allItems.find(i => i.id === selectedTargetId)?.title}
                </span>
                <button
                  onClick={() => {
                    setSelectedTargetId(null);
                    setSearchQuery('');
                  }}
                  className="ml-auto p-0.5 text-on-surface-faint hover:text-on-surface-secondary"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Dropdown list */}
            {!selectedTargetId && (searchQuery.trim() || availableItems.length > 0) && (
              <div className="mt-1 max-h-32 overflow-y-auto border border-outline rounded-md bg-surface">
                {availableItems.length > 0 ? (
                  availableItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedTargetId(item.id);
                        setSearchQuery(item.id);
                      }}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-alt flex items-center gap-2 border-b border-outline last:border-b-0"
                    >
                      <span className="font-mono text-on-surface-muted flex-shrink-0">{item.id}</span>
                      <span className="text-on-surface-secondary truncate">{item.title}</span>
                    </button>
                  ))
                ) : searchQuery.trim() ? (
                  <div className="px-2 py-1.5 text-sm text-on-surface-faint italic">
                    {t.relations.noTicketFound}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Optional reason */}
          <div>
            <label className="block text-xs font-medium text-on-surface-muted mb-1">Raison (optionnel)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Partage le m\u00eame module..."
              className="w-full text-sm border border-outline-strong rounded-md px-2 py-1.5 focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!selectedTargetId || isAdding}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {t.action.add}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-on-surface-secondary bg-surface-alt rounded-md hover:bg-outline transition-colors"
            >
              {t.action.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
