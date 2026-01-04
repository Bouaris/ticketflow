/**
 * ItemDetailPanel - Slide-over panel showing item details.
 */

import { useEffect, useRef } from 'react';
import type { BacklogItem } from '../../types/backlog';
import { ItemBadge, SeverityBadge, PriorityBadge, EffortBadge } from '../shared/ItemBadge';
import { ScreenshotGallery } from './ScreenshotGallery';
import { SparklesIcon } from '../ui/Icons';

interface ItemDetailPanelProps {
  item: BacklogItem | null;
  onClose: () => void;
  onToggleCriterion: (itemId: string, criterionIndex: number) => void;
  onRefineWithAI?: (item: BacklogItem) => void;
  onEdit?: (item: BacklogItem) => void;
  onDelete?: (item: BacklogItem) => void;
  onDeleteRequest?: (item: BacklogItem) => void;
  onArchive?: (item: BacklogItem) => void;
  onExport?: (item: BacklogItem) => void;
  getScreenshotUrl?: (filename: string) => Promise<string | null>;
}

export function ItemDetailPanel({
  item,
  onClose,
  onToggleCriterion,
  onRefineWithAI,
  onEdit,
  onDelete,
  onDeleteRequest,
  onArchive,
  onExport,
  getScreenshotUrl,
}: ItemDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (item) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl z-50 overflow-y-auto animate-slide-in"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-gray-500">{item.id}</span>
                <ItemBadge type={item.type} />
                {item.emoji && <span className="text-lg">{item.emoji}</span>}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <CloseIcon />
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
            <Section title={item.component ? 'Composant' : 'Module'}>
              <p className="text-gray-700">{item.component || item.module}</p>
            </Section>
          )}

          {/* Description */}
          {item.description && (
            <Section title="Description">
              <p className="text-gray-700 whitespace-pre-wrap">{item.description}</p>
            </Section>
          )}

          {/* User Story */}
          {item.userStory && (
            <Section title="User Story">
              <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-600">
                {item.userStory}
              </blockquote>
            </Section>
          )}

          {/* Reproduction */}
          {item.reproduction && item.reproduction.length > 0 && (
            <Section title="Reproduction">
              <ol className="list-decimal list-inside space-y-1">
                {item.reproduction.map((step, i) => (
                  <li key={i} className="text-gray-700">{step}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Specifications */}
          {item.specs && item.specs.length > 0 && (
            <Section title="Spécifications">
              <ul className="list-disc list-inside space-y-1">
                {item.specs.map((spec, i) => (
                  <li key={i} className="text-gray-700">{spec}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Screens */}
          {item.screens && item.screens.length > 0 && (
            <Section title="Écrans">
              <ol className="list-decimal list-inside space-y-1">
                {item.screens.map((screen, i) => (
                  <li key={i} className="text-gray-700">{screen}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Acceptance Criteria */}
          {item.criteria && item.criteria.length > 0 && (
            <Section title="Critères d'acceptation">
              <div className="space-y-2">
                {item.criteria.map((criterion, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={criterion.checked}
                      onChange={() => onToggleCriterion(item.id, i)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-gray-700 ${criterion.checked ? 'line-through text-gray-400' : ''}`}>
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
            <Section title="Dépendances">
              <ul className="list-disc list-inside space-y-1">
                {item.dependencies.map((dep, i) => (
                  <li key={i} className="text-gray-700">{dep}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Constraints */}
          {item.constraints && item.constraints.length > 0 && (
            <Section title="Contraintes">
              <ul className="list-disc list-inside space-y-1">
                {item.constraints.map((constraint, i) => (
                  <li key={i} className="text-gray-700">{constraint}</li>
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

        {/* Footer with action buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3">
          {/* Completion indicator */}
          {item.criteria && item.criteria.length > 0 && item.criteria.every(c => c.checked) && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircleIcon />
              <span className="text-sm font-medium text-green-700">
                Item complété à 100%
              </span>
            </div>
          )}

          {/* Edit & Delete row */}
          <div className="flex gap-3">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <EditIcon />
                Éditer
              </button>
            )}
            {onArchive && (
              <button
                onClick={() => onArchive(item)}
                className="py-2.5 px-4 bg-amber-100 text-amber-700 font-medium rounded-lg hover:bg-amber-200 transition-all flex items-center justify-center gap-2"
                title="Archiver cet item"
              >
                <ArchiveIcon />
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
                className="py-2.5 px-4 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200 transition-all flex items-center justify-center gap-2"
                title="Supprimer cet item"
              >
                <TrashIcon />
              </button>
            )}
          </div>

          {/* AI button */}
          {onRefineWithAI && (
            <button
              onClick={() => onRefineWithAI(item)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              Affiner avec Gemini
            </button>
          )}

          {/* Export button */}
          {onExport && (
            <button
              onClick={() => onExport(item)}
              className="w-full py-2.5 px-4 bg-teal-100 text-teal-700 font-medium rounded-lg hover:bg-teal-200 transition-all flex items-center justify-center gap-2"
            >
              <ExportIcon />
              Exporter le ticket
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

// ============================================================
// SECTION COMPONENT
// ============================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ============================================================
// CRITERIA PROGRESS
// ============================================================

function CriteriaProgress({ criteria }: { criteria: { checked: boolean }[] }) {
  const completed = criteria.filter(c => c.checked).length;
  const total = criteria.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Progression</span>
        <span className="text-sm text-gray-500">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percentage === 100 ? 'bg-green-500' :
            percentage >= 50 ? 'bg-amber-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500 text-right">
        {completed} sur {total} critères complétés
      </div>
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
