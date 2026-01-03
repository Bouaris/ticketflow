/**
 * NewProjectDialog - Dialog for creating a new TICKETFLOW_Backlog.md file
 * with customizable types
 */

import { useState } from 'react';
import { BACKLOG_FILE_NAME } from '../../types/project';
import { DEFAULT_TYPES, type TypeDefinition } from '../../types/typeConfig';
import { TypeConfigEditor } from '../settings/TypeConfigEditor';

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

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showAdvanced) {
      onConfirm(types);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Generate template preview based on types
  const sortedTypes = [...types].sort((a, b) => a.order - b.order);
  const templatePreview = `# TICKETFLOW Backlog\n\n${sortedTypes.map(t => `## ${t.label}`).join('\n\n')}\n`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        onKeyDown={handleKeyDown}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl w-full transition-all duration-200 ${
            showAdvanced ? 'max-w-2xl' : 'max-w-md'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Nouveau projet Ticketflow
                </h2>
                <p className="text-sm text-gray-500">
                  dans {folderName}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              Aucun fichier <code className="bg-gray-100 px-1.5 py-0.5 rounded text-blue-600 font-mono text-xs">{BACKLOG_FILE_NAME}</code> trouvé dans ce dossier.
            </p>

            {/* Types Section */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                <ChevronIcon className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                Personnaliser les types ({types.length})
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apercu du fichier
              </label>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono overflow-x-auto max-h-32 border border-gray-200">
                {templatePreview}
              </pre>
            </div>

            {/* Path Info */}
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 rounded-lg p-3 border border-blue-100">
              <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <span className="break-all">
                Fichier créé : <strong>{folderPath}/{BACKLOG_FILE_NAME}</strong>
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => onConfirm(types)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer le projet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Icons
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
