/**
 * ItemDetailPanel - Slide-over panel showing item details.
 * Uses Modal component with variant='panel' for consistent behavior.
 */

import { useState, useEffect } from 'react';
import type { BacklogItem } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';
import { Modal } from '../ui/Modal';
import { ItemBadge, SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';
import { ScreenshotGallery } from './ScreenshotGallery';
import { AIRefineModal } from '../editor/AIRefineModal';
import {
  SparklesIcon,
  CloseIcon,
  EditIcon,
  TrashIcon,
  ArchiveIcon,
  CheckCircleIcon,
  ExportIcon,
} from '../ui/Icons';
import { RelationManager } from '../relations/RelationManager';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { useTranslation } from '../../i18n';

interface ItemDetailPanelProps {
  item: BacklogItem | null;
  onClose: () => void;
  onToggleCriterion: (itemId: string, criterionIndex: number) => void;
  onUpdate?: (itemId: string, updates: Partial<BacklogItem>) => void;
  onEdit?: (item: BacklogItem) => void;
  onDelete?: (item: BacklogItem) => void;
  onDeleteRequest?: (item: BacklogItem) => void;
  onArchive?: (item: BacklogItem) => void;
  onExport?: (item: BacklogItem) => void;
  getScreenshotUrl?: (filename: string) => Promise<string | null>;
  projectPath?: string;
  items?: BacklogItem[];
  projectId?: number | null;
  typeConfigs?: TypeDefinition[];
  onRelationsChange?: () => void;
}

export function ItemDetailPanel({
  item,
  onClose,
  onToggleCriterion,
  onUpdate,
  onEdit,
  onDelete,
  onDeleteRequest,
  onArchive,
  onExport,
  getScreenshotUrl,
  projectPath,
  items,
  projectId,
  typeConfigs,
  onRelationsChange,
}: ItemDetailPanelProps) {
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const { t } = useTranslation();

  // Reset markdown view mode when item changes
  useEffect(() => {
    setShowRawMarkdown(false);
  }, [item?.id]);

  // Handle refinement acceptance
  const handleAcceptRefinement = (refinedItem: Partial<BacklogItem>) => {
    if (item && onUpdate) {
      onUpdate(item.id, refinedItem);
    }
    setShowRefineModal(false);
  };

  // Footer content - rendered outside scrollable area via Modal's footer prop
  const footerContent = item ? (
    <div className="space-y-3">
      {/* Completion indicator */}
      {item.criteria && item.criteria.length > 0 && item.criteria.every(c => c.checked) && (
        <div className="flex items-center gap-2 p-3 bg-success-soft border border-green-200 dark:border-green-500/30 rounded-lg">
          <CheckCircleIcon className="w-5 h-5 text-success-text" />
          <span className="text-sm font-medium text-success-text">
            {t.detail.completed}
          </span>
        </div>
      )}

      {/* Edit & Delete row */}
      <div className="flex gap-3">
        {onEdit && (
          <button
            onClick={() => onEdit(item)}
            aria-label={t.detail.editButton}
            className="flex-1 py-2.5 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-all flex items-center justify-center gap-2"
          >
            <EditIcon className="w-4 h-4" />
            {t.detail.editButton}
          </button>
        )}
        {onArchive && (
          <button
            onClick={() => onArchive(item)}
            className="py-2.5 px-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all flex items-center justify-center gap-2"
            title={t.detail.archiveButton}
            aria-label={t.detail.archiveButton}
          >
            <ArchiveIcon className="w-4 h-4" />
          </button>
        )}
        {(onDeleteRequest || onDelete) && (
          <button
            onClick={() => {
              if (onDeleteRequest) {
                onDeleteRequest(item);
              } else if (onDelete) {
                onDelete(item);
              }
            }}
            className="py-2.5 px-4 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all flex items-center justify-center gap-2"
            title={t.detail.deleteButton}
            aria-label={t.detail.deleteButton}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* AI button */}
      {onUpdate && (
        <button
          onClick={() => setShowRefineModal(true)}
          aria-label={t.detail.refineWithAI}
          className="w-full py-2.5 px-4 bg-accent text-white hover:bg-accent-hover font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <SparklesIcon className="w-5 h-5" />
          {t.detail.refineWithAI}
        </button>
      )}

      {/* Export button */}
      {onExport && (
        <button
          onClick={() => onExport(item)}
          aria-label={t.detail.exportTicket}
          className="w-full py-2.5 px-4 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 font-medium rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-all flex items-center justify-center gap-2"
        >
          <ExportIcon className="w-4 h-4" />
          {t.detail.exportTicket}
        </button>
      )}
    </div>
  ) : undefined;

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      variant="panel"
      showCloseButton={false}
      footer={footerContent}
    >
      {item && (
        <>
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-outline px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-on-surface-muted">{item.id}</span>
                <ItemBadge type={item.type} />
                {item.emoji && <span className="text-lg">{item.emoji}</span>}
              </div>
              <h2 className="text-xl font-semibold text-on-surface">{item.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-on-surface-faint hover:text-on-surface-secondary rounded-lg hover:bg-surface-alt"
              aria-label={t.detail.closePanel}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            {item.severity && <SeverityBadge severity={item.severity} />}
            {item.priority && <PriorityBadge priority={item.priority} />}
            {item.effort && <EffortBadge effort={item.effort} />}
          </div>

          {/* Component/Module */}
          {(item.component || item.module) && (
            <Section title={item.component ? t.editor.component : t.editor.module}>
              <p className="text-on-surface-secondary">{item.component || item.module}</p>
            </Section>
          )}

          {/* Description */}
          {item.description && (
            <Section
              title="Description"
              trailing={
                <MarkdownToggle
                  isRaw={showRawMarkdown}
                  onToggle={() => setShowRawMarkdown(prev => !prev)}
                  label={showRawMarkdown ? t.markdown.rendered : t.markdown.raw}
                  title={t.markdown.toggle}
                />
              }
            >
              {showRawMarkdown ? (
                <p className="text-on-surface-secondary whitespace-pre-wrap">{item.description}</p>
              ) : (
                <MarkdownRenderer content={item.description} />
              )}
            </Section>
          )}

          {/* User Story */}
          {item.userStory && (
            <Section title="User Story">
              {showRawMarkdown ? (
                <blockquote className="border-l-4 border-accent pl-4 italic text-on-surface-secondary">
                  {item.userStory}
                </blockquote>
              ) : (
                <MarkdownRenderer content={item.userStory} />
              )}
            </Section>
          )}

          {/* Reproduction */}
          {item.reproduction && item.reproduction.length > 0 && (
            <Section title="Reproduction">
              <ol className="list-decimal list-inside space-y-1">
                {item.reproduction.map((step, i) => (
                  <li key={i} className="text-on-surface-secondary">{step}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Specifications */}
          {item.specs && item.specs.length > 0 && (
            <Section title={t.editor.specs}>
              <ul className="list-disc list-inside space-y-1">
                {item.specs.map((spec, i) => (
                  <li key={i} className="text-on-surface-secondary">{spec}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Screens */}
          {item.screens && item.screens.length > 0 && (
            <Section title={t.editor.screens}>
              <ol className="list-decimal list-inside space-y-1">
                {item.screens.map((screen, i) => (
                  <li key={i} className="text-on-surface-secondary">{screen}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Acceptance Criteria */}
          {item.criteria && item.criteria.length > 0 && (
            <Section title={t.editor.criteria}>
              <div className="space-y-2">
                {item.criteria.map((criterion, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-alt cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={criterion.checked}
                      onChange={() => onToggleCriterion(item.id, i)}
                      className="mt-0.5 rounded border-input-border text-accent focus:ring-accent"
                    />
                    <span className={`text-on-surface-secondary ${criterion.checked ? 'line-through text-on-surface-faint' : ''}`}>
                      {criterion.text}
                    </span>
                  </label>
                ))}
              </div>
              <CriteriaProgress criteria={item.criteria} />
            </Section>
          )}

          {/* Dependencies */}
          {item.dependencies && item.dependencies.length > 0 && (
            <Section title={t.editor.dependencies}>
              <ul className="list-disc list-inside space-y-1">
                {item.dependencies.map((dep, i) => (
                  <li key={i} className="text-on-surface-secondary">{dep}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Relations */}
          {projectPath && projectId && (
            <RelationManager
              itemId={item.id}
              projectPath={projectPath}
              projectId={projectId}
              allItems={items || []}
              onRelationsChange={onRelationsChange}
            />
          )}

          {/* Constraints */}
          {item.constraints && item.constraints.length > 0 && (
            <Section title={t.editor.constraints}>
              <ul className="list-disc list-inside space-y-1">
                {item.constraints.map((constraint, i) => (
                  <li key={i} className="text-on-surface-secondary">{constraint}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Screenshots */}
          {item.screenshots && item.screenshots.length > 0 && getScreenshotUrl && (
            <Section title="">
              <ScreenshotGallery
                screenshots={item.screenshots}
                getUrl={getScreenshotUrl}
              />
            </Section>
          )}
        </div>
        </>
      )}

      {/* AI Refine Modal */}
      {item && (
        <AIRefineModal
          isOpen={showRefineModal}
          onClose={() => setShowRefineModal(false)}
          item={item}
          onAccept={handleAcceptRefinement}
          projectPath={projectPath}
          items={items}
          projectId={projectId}
          typeConfigs={typeConfigs}
        />
      )}
    </Modal>
  );
}

// ============================================================
// SECTION COMPONENT
// ============================================================

function Section({ title, children, trailing }: { title: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-on-surface-muted uppercase tracking-wide">
          {title}
        </h3>
        {trailing}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// MARKDOWN TOGGLE
// ============================================================

function MarkdownToggle({ isRaw, onToggle, label, title }: {
  isRaw: boolean;
  onToggle: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`text-xs px-2 py-1 rounded border transition-colors ${
        isRaw
          ? 'border-outline text-on-surface-muted hover:bg-surface-alt'
          : 'border-accent/30 text-accent-text bg-accent/5 hover:bg-accent/10'
      }`}
      title={title}
    >
      {label}
    </button>
  );
}

// ============================================================
// CRITERIA PROGRESS
// ============================================================

function CriteriaProgress({ criteria }: { criteria: { checked: boolean }[] }) {
  const { t } = useTranslation();
  const completed = criteria.filter(c => c.checked).length;
  const total = criteria.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="mt-4 p-3 bg-surface-alt rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-on-surface-secondary">{t.detail.progress}</span>
        <span className="text-sm text-on-surface-muted">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-outline rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percentage === 100 ? 'bg-green-500' :
            percentage >= 50 ? 'bg-amber-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-on-surface-muted text-right">
        {completed}/{total} {t.detail.criteriaCompleted}
      </div>
    </div>
  );
}
