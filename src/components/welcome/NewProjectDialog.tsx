/**
 * NewProjectDialog - Dialog for creating a new TICKETFLOW_Backlog.md file
 * with customizable types
 */

import { useState } from 'react';
import { BACKLOG_FILE_NAME } from '../../types/project';
import { DEFAULT_TYPES, type TypeDefinition } from '../../types/typeConfig';
import { TypeConfigEditor } from '../settings/TypeConfigEditor';
import { FileIcon, InfoIcon, ChevronRightIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

interface NewProjectDialogProps {
  isOpen: boolean;
  folderName: string;
  folderPath: string;
  onConfirm: (types: TypeDefinition[]) => void;
  onCancel: () => void;
}

export function NewProjectDialog({
  isOpen,
  folderName,
  folderPath,
  onConfirm,
  onCancel,
}: NewProjectDialogProps) {
  const [types, setTypes] = useState<TypeDefinition[]>(DEFAULT_TYPES);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showAdvanced) {
      onConfirm(types);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Generate template preview based on types (matches useProjects.createNewBacklog)
  const sortedTypes = [...types].sort((a, b) => a.order - b.order);
  const tocEntries = sortedTypes.map((t, i) =>
    `${i + 1}. [${t.label}](#${i + 1}-${t.label.toLowerCase().replace(/\s+/g, '-')})`
  ).join('\n');
  const sections = sortedTypes.map((t, i) =>
    `## ${i + 1}. ${t.label.toUpperCase()}`
  ).join('\n\n---\n\n');
  const templatePreview = `# ${folderName} - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : ${new Date().toISOString().split('T')[0]}

---

## Table des matières
${tocEntries}
${sortedTypes.length + 1}. [Légende](#${sortedTypes.length + 1}-legende)

---

${sections}

---

## ${sortedTypes.length + 1}. Légende
(Effort, Conventions, Sévérité, Priorité...)
`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay z-50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        onKeyDown={handleKeyDown}
      >
        <div
          className={`bg-surface rounded-xl shadow-2xl w-full transition-all duration-200 ${
            showAdvanced ? 'max-w-2xl' : 'max-w-md'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
                <FileIcon className="w-5 h-5 text-accent-text" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-on-surface">
                  {t.welcome.newTicketflowProject}
                </h2>
                <p className="text-sm text-on-surface-muted">
                  dans {folderName}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-on-surface-secondary">
              {t.welcome.noFileFoundInFolder}
            </p>

            {/* Types Section */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-on-surface-secondary hover:text-accent-text transition-colors"
              >
                <ChevronRightIcon className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                {t.welcome.customizeTypes} ({types.length})
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-surface-alt rounded-lg border border-outline">
                  <TypeConfigEditor
                    types={types}
                    onChange={setTypes}
                    compact
                  />
                </div>
              )}
            </div>

            {/* Template Preview */}
            <div>
              <label className="block text-sm font-medium text-on-surface-secondary mb-2">
                {t.welcome.filePreview}
              </label>
              <pre className="bg-surface-alt rounded-lg p-3 text-xs text-on-surface-secondary font-mono overflow-x-auto max-h-32 border border-outline">
                {templatePreview}
              </pre>
            </div>

            {/* Path Info */}
            <div className="flex items-start gap-2 text-xs text-on-surface-muted bg-accent-soft rounded-lg p-3 border border-blue-100">
              <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-accent-text" />
              <span className="break-all">
                {t.welcome.fileCreatedAt} : <strong>{folderPath}/{BACKLOG_FILE_NAME}</strong>
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg transition-colors"
            >
              {t.action.cancel}
            </button>
            <button
              onClick={() => onConfirm(types)}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              {t.welcome.createProject}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
