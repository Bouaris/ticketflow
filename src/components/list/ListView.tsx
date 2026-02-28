/**
 * ListView component - Table view of backlog items.
 * Phase 11: Supports inline editing of title and badge fields.
 * Phase 35: Virtualized rendering via @tanstack/react-virtual for 500+ items performance.
 *           ListViewRow wrapped in React.memo to prevent unnecessary re-renders.
 */

import { useState, useMemo, memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BacklogItem, Priority, Effort, Severity } from '../../types/backlog';
import type { ItemPriorityScore, BlockingBug } from '../../types/ai';
import { PRIORITY_LABELS } from '../../constants/labels';
import { ItemBadge } from '../shared/ItemBadge';
import { CriteriaProgress } from '../ui/Progress';
import { CameraIcon, CheckIcon, TrashIcon, CheckCircleIcon, CopyIcon, ArchiveIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';
import { ScoreBadgeInline } from '../ai/AIPriorityScore';
import { AIBlockingBadge } from '../ai/AIBlockingIndicator';
import { InlineEditField } from '../ui/InlineEditField';
import { InlineSelect, type InlineSelectOption } from '../ui/InlineSelect';

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

// Severity options will be built using translations inside the component

interface ListViewProps {
  items: BacklogItem[];
  onItemClick: (item: BacklogItem) => void;
  // AI Analysis getters (optional)
  getItemScore?: (itemId: string) => ItemPriorityScore | null;
  getBlockingInfo?: (itemId: string) => BlockingBug | null;
  // Phase 11: Inline editing
  onInlineUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  // Phase 11: Multi-selection
  isSelected?: (itemId: string) => boolean;
  onSelectionClick?: (itemId: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  // Quick-004: Quick action buttons (hover row)
  onQuickDelete?: (item: BacklogItem) => void;
  onQuickValidate?: (item: BacklogItem) => void;
  onQuickExport?: (item: BacklogItem) => void;
  onQuickArchive?: (item: BacklogItem) => void;
}

type SortField = 'id' | 'type' | 'title' | 'priority' | 'effort' | 'severity' | 'aiScore';
type SortDirection = 'asc' | 'desc';

// ============================================================
// ListViewRow — memo-wrapped for performance
// ============================================================

interface ListViewRowProps {
  item: BacklogItem;
  aiScore: ItemPriorityScore | null | undefined;
  blockingInfo: BlockingBug | null | undefined;
  isSelected: boolean;
  hasAIAnalysis: boolean;
  severityOptions: InlineSelectOption<Severity>[];
  onRowClick: (item: BacklogItem, e: React.MouseEvent) => void;
  onInlineUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  onSelectionClick?: (itemId: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  onQuickDelete?: (item: BacklogItem) => void;
  onQuickValidate?: (item: BacklogItem) => void;
  onQuickExport?: (item: BacklogItem) => void;
  onQuickArchive?: (item: BacklogItem) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const ListViewRow = memo(function ListViewRow({
  item,
  aiScore,
  blockingInfo,
  isSelected,
  hasAIAnalysis,
  severityOptions,
  onRowClick,
  onInlineUpdate,
  onSelectionClick,
  onQuickDelete,
  onQuickValidate,
  onQuickExport,
  onQuickArchive,
  t,
}: ListViewRowProps) {
  return (
    <tr
      onClick={(e) => onRowClick(item, e)}
      className={`group hover:bg-surface-alt cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/10' : ''
      }`}
    >
      {/* Selection checkbox cell */}
      {onSelectionClick && (
        <td className="px-2 py-3 whitespace-nowrap">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mx-auto ${
            isSelected
              ? 'bg-accent border-accent text-white'
              : 'bg-surface border-outline'
          }`}>
            {isSelected && <CheckIcon className="w-3 h-3" />}
          </div>
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-on-surface">{item.id}</span>
          {blockingInfo && (
            <AIBlockingBadge
              blocksCount={blockingInfo.blocksCount}
              severity={blockingInfo.severity}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <ItemBadge type={item.type} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {item.emoji && <span>{item.emoji}</span>}
          {/* Phase 11: Inline title editing */}
          <InlineEditField
            value={item.title}
            onSave={(newTitle) => onInlineUpdate?.(item.id, { title: newTitle })}
            className="text-sm text-on-surface line-clamp-1"
            disabled={!onInlineUpdate}
          />
          {item.screenshots && item.screenshots.length > 0 && (
            <span className="text-on-surface-faint flex-shrink-0" title={`${item.screenshots.length} capture(s)`}>
              <CameraIcon />
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {item.priority && (
          onInlineUpdate ? (
            <InlineSelect<Priority>
              value={item.priority}
              options={PRIORITY_OPTIONS}
              onSelect={(priority) => onInlineUpdate(item.id, { priority })}
              allowClear={false}
              renderTrigger={({ onClick: triggerClick }) => (
                <span onClick={triggerClick} className={`cursor-pointer text-xs font-medium px-2 py-1 rounded ${
                  item.priority === 'Haute' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                  item.priority === 'Moyenne' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {PRIORITY_LABELS[item.priority!]}
                </span>
              )}
            />
          ) : (
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              item.priority === 'Haute' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
              item.priority === 'Moyenne' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {PRIORITY_LABELS[item.priority]}
            </span>
          )
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {item.effort && (
          onInlineUpdate ? (
            <InlineSelect<Effort>
              value={item.effort}
              options={EFFORT_OPTIONS}
              onSelect={(effort) => onInlineUpdate(item.id, { effort })}
              allowClear={false}
              renderTrigger={({ onClick: triggerClick }) => (
                <span onClick={triggerClick} className={`cursor-pointer text-xs font-medium px-2 py-1 rounded ${
                  item.effort === 'XS' || item.effort === 'S' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  item.effort === 'M' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {item.effort}
                </span>
              )}
            />
          ) : (
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              item.effort === 'XS' || item.effort === 'S' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              item.effort === 'M' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {item.effort}
            </span>
          )
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {item.severity && (
          onInlineUpdate ? (
            <InlineSelect<Severity>
              value={item.severity}
              options={severityOptions}
              onSelect={(severity) => onInlineUpdate(item.id, { severity })}
              allowClear={false}
              renderTrigger={({ onClick: triggerClick }) => (
                <span onClick={triggerClick} className={`cursor-pointer text-xs font-medium px-2 py-1 rounded ${
                  item.severity === 'P0' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                  item.severity === 'P1' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                  item.severity === 'P2' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {item.severity}
                </span>
              )}
            />
          ) : (
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              item.severity === 'P0' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
              item.severity === 'P1' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
              item.severity === 'P2' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {item.severity}
            </span>
          )
        )}
      </td>
      {hasAIAnalysis && (
        <td className="px-4 py-3 whitespace-nowrap">
          {aiScore && (
            <ScoreBadgeInline score={aiScore.score} />
          )}
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">
        {item.criteria && item.criteria.length > 0 && (
          <CriteriaProgress
            completed={item.criteria.filter(c => c.checked).length}
            total={item.criteria.length}
            size="sm"
          />
        )}
      </td>
      {(onQuickDelete || onQuickValidate || onQuickExport || onQuickArchive) && (
        <td className="px-2 py-3 whitespace-nowrap">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onQuickValidate && (() => {
              const isValidated = item.criteria && item.criteria.length > 0 && item.criteria.every(c => c.checked);
              return (
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickValidate(item); }}
                  className={`p-1 rounded transition-colors ${
                    isValidated
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-on-surface-muted hover:text-green-600 dark:hover:text-green-400'
                  }`}
                  title={isValidated ? t.quickActions.unvalidate : t.quickActions.validate}
                >
                  <CheckCircleIcon className="w-4 h-4" />
                </button>
              );
            })()}
            {onQuickExport && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickExport(item); }}
                className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-on-surface-muted hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={t.quickActions.export}
              >
                <CopyIcon className="w-4 h-4" />
              </button>
            )}
            {onQuickArchive && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickArchive(item); }}
                className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-on-surface-muted hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title={t.quickActions.archive}
              >
                <ArchiveIcon className="w-4 h-4" />
              </button>
            )}
            {onQuickDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickDelete(item); }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-on-surface-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title={t.quickActions.delete}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

// ============================================================
// ListView — virtualized main component
// ============================================================

export function ListView({ items, onItemClick, getItemScore, getBlockingInfo, onInlineUpdate, isSelected, onSelectionClick, onQuickDelete, onQuickValidate, onQuickExport, onQuickArchive }: ListViewProps) {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Build severity options with translations
  const severityOptions: InlineSelectOption<Severity>[] = useMemo(() => [
    { value: 'P0', label: t.severityFull.P0 },
    { value: 'P1', label: t.severityFull.P1 },
    { value: 'P2', label: t.severityFull.P2 },
    { value: 'P3', label: t.severityFull.P3 },
    { value: 'P4', label: t.severityFull.P4 },
  ], [t]);

  // Check if AI analysis is available
  const hasAIAnalysis = !!getItemScore;

  const sortedItems = useMemo(() => [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'id':
        comparison = a.id.localeCompare(b.id);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'priority': {
        const priorityOrder = { Haute: 0, Moyenne: 1, Faible: 2 };
        const aPriority = a.priority ? priorityOrder[a.priority] : 3;
        const bPriority = b.priority ? priorityOrder[b.priority] : 3;
        comparison = aPriority - bPriority;
        break;
      }
      case 'effort': {
        const effortOrder = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };
        const aEffort = a.effort ? effortOrder[a.effort] : 5;
        const bEffort = b.effort ? effortOrder[b.effort] : 5;
        comparison = aEffort - bEffort;
        break;
      }
      case 'severity': {
        const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
        const aSeverity = a.severity ? severityOrder[a.severity] : 5;
        const bSeverity = b.severity ? severityOrder[b.severity] : 5;
        comparison = aSeverity - bSeverity;
        break;
      }
      case 'aiScore': {
        const aScore = getItemScore?.(a.id)?.score ?? -1;
        const bScore = getItemScore?.(b.id)?.score ?? -1;
        comparison = bScore - aScore; // Higher scores first by default
        break;
      }
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  }), [items, sortField, sortDirection, getItemScore]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle row click - selection with modifiers, detail panel otherwise
  const handleRowClick = (item: BacklogItem, e: React.MouseEvent) => {
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && onSelectionClick) {
      onSelectionClick(item.id, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
      return;
    }
    onItemClick(item);
  };

  // Scroll container ref for virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Estimated row height in px (~52px per row with badges)
    overscan: 10, // Render 10 extra rows above/below viewport for smooth scrolling
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Padding-based virtualization spacers
  // Spacer rows push visible rows to the correct scroll position without position:absolute
  // (which browser table layout engines ignore on <tr> elements)
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-on-surface-muted uppercase tracking-wider cursor-pointer hover:bg-surface-alt select-none"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-accent-text">
            {sortDirection === 'asc' ? '\u2191' : '\u2193'}
          </span>
        )}
      </span>
    </th>
  );

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-on-surface-muted">
        {t.empty.noItems}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <table className="min-w-full divide-y divide-outline">
        <thead className="bg-surface-alt sticky top-0">
          <tr>
            {/* Selection checkbox column */}
            {onSelectionClick && (
              <th className="w-10 px-2 py-3" />
            )}
            <SortHeader field="id">ID</SortHeader>
            <SortHeader field="type">Type</SortHeader>
            <SortHeader field="title">{t.editor.title}</SortHeader>
            <SortHeader field="priority">{t.editor.priority}</SortHeader>
            <SortHeader field="effort">{t.editor.effort}</SortHeader>
            <SortHeader field="severity">{t.editor.severity}</SortHeader>
            {hasAIAnalysis && (
              <SortHeader field="aiScore">Score IA</SortHeader>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-muted uppercase tracking-wider">
              {t.editor.criteria}
            </th>
            {(onQuickDelete || onQuickValidate || onQuickExport || onQuickArchive) && (
              <th className="px-2 py-3 text-left text-xs font-medium text-on-surface-muted uppercase tracking-wider w-28">
                {/* Actions column - header empty for clean look */}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-outline">
          {/* Top spacer row — creates empty space for items above the viewport */}
          {paddingTop > 0 && (
            <tr><td style={{ height: `${paddingTop}px` }} colSpan={999} /></tr>
          )}

          {/* Visible rows only — virtualized */}
          {virtualItems.map(virtualRow => {
            const item = sortedItems[virtualRow.index];
            const aiScore = getItemScore?.(item.id);
            const blockingInfo = getBlockingInfo?.(item.id);
            const itemIsSelected = isSelected?.(item.id) ?? false;

            return (
              <ListViewRow
                key={item.id}
                item={item}
                aiScore={aiScore}
                blockingInfo={blockingInfo}
                isSelected={itemIsSelected}
                hasAIAnalysis={hasAIAnalysis}
                severityOptions={severityOptions}
                onRowClick={handleRowClick}
                onInlineUpdate={onInlineUpdate}
                onSelectionClick={onSelectionClick}
                onQuickDelete={onQuickDelete}
                onQuickValidate={onQuickValidate}
                onQuickExport={onQuickExport}
                onQuickArchive={onQuickArchive}
                t={t}
              />
            );
          })}

          {/* Bottom spacer row — creates empty space for items below the viewport */}
          {paddingBottom > 0 && (
            <tr><td style={{ height: `${paddingBottom}px` }} colSpan={999} /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
