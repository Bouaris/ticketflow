/**
 * ArchiveTab component - View for archived backlog items.
 *
 * Displays archived items with search, type filter, and detail view.
 * Supports restoration to active backlog and permanent deletion.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ArchivedItem } from '../../db/transforms';
import { getArchivedItems, searchArchivedItems } from '../../db/queries/archive';
import { ArchiveIcon, SearchIcon, TrashIcon, ArrowLeftIcon, CloseIcon } from '../ui/Icons';
import { SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';
import { useTranslation } from '../../i18n';
import { ConfirmModal } from '../ui/ConfirmModal';
import { SPRING_PRESETS } from '../../lib/animation-presets';

interface ArchiveTabProps {
  projectPath: string;
  projectId: number;
  onRestore: (item: ArchivedItem) => Promise<void>;
  onDeletePermanently: (itemId: string) => Promise<void>;
  onPurgeArchive: () => Promise<void>;
}

type ConfirmAction = { type: 'restore' | 'delete'; item: ArchivedItem } | { type: 'purge' } | null;

export function ArchiveTab({
  projectPath,
  projectId,
  onRestore,
  onDeletePermanently,
  onPurgeArchive,
}: ArchiveTabProps) {
  const { t } = useTranslation();
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ArchivedItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // Load archived items
  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = searchQuery.trim()
        ? await searchArchivedItems(projectPath, projectId, searchQuery)
        : await getArchivedItems(projectPath, projectId);
      setArchivedItems(items);
    } catch (error) {
      console.error('[ArchiveTab] Failed to load archived items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, projectId, searchQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filter by type
  const filteredItems = typeFilter
    ? archivedItems.filter((item) => item.type === typeFilter)
    : archivedItems;

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(archivedItems.map((item) => item.type)));

  // Handle restore
  const handleRestoreClick = (item: ArchivedItem) => {
    setConfirmAction({ type: 'restore', item });
  };

  const handleConfirmRestore = async () => {
    if (!confirmAction || confirmAction.type !== 'restore') return;
    try {
      await onRestore(confirmAction.item);
      setConfirmAction(null);
      setSelectedItem(null);
      await loadItems(); // Refresh list
    } catch (error) {
      console.error('[ArchiveTab] Restore failed:', error);
    }
  };

  // Handle permanent delete
  const handleDeleteClick = (item: ArchivedItem) => {
    setConfirmAction({ type: 'delete', item });
  };

  const handleConfirmDelete = async () => {
    if (!confirmAction || confirmAction.type !== 'delete') return;
    try {
      await onDeletePermanently(confirmAction.item.id);
      setConfirmAction(null);
      setSelectedItem(null);
      await loadItems(); // Refresh list
    } catch (error) {
      console.error('[ArchiveTab] Delete failed:', error);
    }
  };

  // Handle purge archive
  const handlePurgeClick = () => {
    if (archivedItems.length === 0) return;
    setConfirmAction({ type: 'purge' });
  };

  const handleConfirmPurge = async () => {
    if (!confirmAction || confirmAction.type !== 'purge') return;
    try {
      await onPurgeArchive();
      setConfirmAction(null);
      setSelectedItem(null);
      await loadItems(); // Refresh list
    } catch (error) {
      console.error('[ArchiveTab] Purge failed:', error);
    }
  };

  // Format date
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-full">
      {/* Left panel: List */}
      <div className="flex-1 flex flex-col border-r border-outline">
        {/* Top bar */}
        <div className="border-b border-outline bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArchiveIcon className="w-5 h-5 text-on-surface-secondary" />
              <h2 className="text-lg font-semibold text-on-surface">{t.archive.title}</h2>
              <span className="text-sm text-on-surface-muted">
                ({filteredItems.length} {t.archive.itemCount})
              </span>
            </div>
            {archivedItems.length > 0 && (
              <button
                onClick={handlePurgeClick}
                title={t.archive.purge}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                {t.archive.purge}
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.archive.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-outline rounded-lg text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Type filter pills */}
          {uniqueTypes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setTypeFilter(null)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  typeFilter === null
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface-alt text-on-surface-muted hover:bg-surface-hover'
                }`}
              >
                All
              </button>
              {uniqueTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    typeFilter === type
                      ? 'bg-accent text-accent-text'
                      : 'bg-surface-alt text-on-surface-muted hover:bg-surface-hover'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-on-surface-muted">{t.common.loadingDots}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <ArchiveIcon className="w-12 h-12 text-on-surface-faint mb-4" />
              <p className="text-on-surface-muted">{t.archive.emptyState}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={SPRING_PRESETS.snappy}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 border-b border-outline cursor-pointer transition-colors ${
                    selectedItem?.id === item.id
                      ? 'bg-accent-soft'
                      : 'hover:bg-surface-alt'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-1 bg-surface-alt rounded border border-outline">
                          {item.id}
                        </span>
                        {item.emoji && (
                          <span className="text-base">{item.emoji}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-on-surface truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-on-surface-muted mt-1">
                        {t.archive.archivedAt} {formatDate(item.archivedAt)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.priority && (
                          <PriorityBadge
                            priority={item.priority}
                            size="sm"
                          />
                        )}
                        {item.effort && (
                          <EffortBadge
                            effort={item.effort}
                            size="sm"
                          />
                        )}
                        {item.severity && (
                          <SeverityBadge
                            severity={item.severity}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreClick(item);
                        }}
                        title={t.archive.restore}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                      >
                        <ArrowLeftIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(item);
                        }}
                        title={t.archive.deletePermanently}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Right panel: Detail view */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={SPRING_PRESETS.snappy}
            className="w-full sm:w-96 md:max-w-xl bg-surface border-l border-outline flex flex-col"
          >
            {/* Detail header */}
            <div className="border-b border-outline p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-1 bg-surface-alt rounded border border-outline">
                      {selectedItem.id}
                    </span>
                    {selectedItem.emoji && (
                      <span className="text-lg">{selectedItem.emoji}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-on-surface">
                    {selectedItem.title}
                  </h3>
                  <p className="text-xs text-on-surface-muted mt-1">
                    {t.archive.archivedAt} {formatDate(selectedItem.archivedAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 text-on-surface-muted hover:text-on-surface rounded"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Detail content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Badges */}
              {(selectedItem.priority || selectedItem.effort || selectedItem.severity) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedItem.priority && (
                    <PriorityBadge priority={selectedItem.priority} size="sm" />
                  )}
                  {selectedItem.effort && (
                    <EffortBadge effort={selectedItem.effort} size="sm" />
                  )}
                  {selectedItem.severity && (
                    <SeverityBadge severity={selectedItem.severity} size="sm" />
                  )}
                </div>
              )}

              {/* Description */}
              {selectedItem.description && (
                <div>
                  <h4 className="text-sm font-semibold text-on-surface mb-2">
                    {t.editor.description}
                  </h4>
                  <p className="text-sm text-on-surface-secondary whitespace-pre-wrap">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* User Story */}
              {selectedItem.userStory && (
                <div>
                  <h4 className="text-sm font-semibold text-on-surface mb-2">
                    {t.editor.userStory}
                  </h4>
                  <p className="text-sm text-on-surface-secondary italic">
                    {selectedItem.userStory}
                  </p>
                </div>
              )}

              {/* Criteria */}
              {selectedItem.criteria && selectedItem.criteria.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-on-surface mb-2">
                    {t.editor.criteria}
                  </h4>
                  <ul className="space-y-1">
                    {selectedItem.criteria.map((criterion, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className={criterion.checked ? 'text-green-600' : 'text-on-surface-muted'}>
                          {criterion.checked ? '✓' : '○'}
                        </span>
                        <span className={criterion.checked ? 'line-through text-on-surface-muted' : 'text-on-surface-secondary'}>
                          {criterion.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs */}
              {selectedItem.specs && selectedItem.specs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-on-surface mb-2">
                    {t.editor.specs}
                  </h4>
                  <ul className="list-disc list-inside text-sm text-on-surface-secondary space-y-1">
                    {selectedItem.specs.map((spec, idx) => (
                      <li key={idx}>{spec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-outline p-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleRestoreClick(selectedItem)}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeftIcon className="w-4 h-4" />
                  {t.archive.restore}
                </span>
              </button>
              <button
                onClick={() => handleDeleteClick(selectedItem)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                <span className="flex items-center justify-center gap-2">
                  <TrashIcon className="w-4 h-4" />
                  {t.archive.deletePermanently}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm modals */}
      {confirmAction?.type === 'restore' && (
        <ConfirmModal
          isOpen={true}
          title={t.archive.restore}
          message={t.archive.restoreConfirm}
          confirmLabel={t.archive.restore}
          cancelLabel={t.action.cancel}
          onConfirm={handleConfirmRestore}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction?.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t.archive.deletePermanently}
          message={t.archive.deleteConfirm}
          confirmLabel={t.action.delete}
          cancelLabel={t.action.cancel}
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction?.type === 'purge' && (
        <ConfirmModal
          isOpen={true}
          title={t.archive.purge}
          message={t.archive.purgeConfirm}
          confirmLabel={t.archive.purge}
          cancelLabel={t.action.cancel}
          variant="danger"
          onConfirm={handleConfirmPurge}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
