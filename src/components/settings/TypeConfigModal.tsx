/**
 * TypeConfigModal - Modal dialog for editing type configuration
 */

import type { TypeDefinition } from '../../types/typeConfig';
import { TypeConfigEditor } from './TypeConfigEditor';
import { useTranslation } from '../../i18n';

interface TypeConfigModalProps {
  isOpen: boolean;
  types: TypeDefinition[];
  onSave: (types: TypeDefinition[]) => void;
  onDeleteType: (typeId: string) => void;
  onCancel: () => void;
}

export function TypeConfigModal({
  isOpen,
  types,
  onSave,
  onDeleteType,
  onCancel,
}: TypeConfigModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay z-50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                {t.typeConfig.title}
              </h2>
              <p className="text-sm text-on-surface-muted">
                {t.typeConfig.configureDesc}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TypeConfigEditor
              types={types}
              onChange={(newTypes) => onSave(newTypes)}
              onDeleteType={onDeleteType}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline flex items-center justify-between">
            <p className="text-xs text-on-surface-muted">
              {t.typeConfig.autoSaved}
            </p>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-surface-alt text-on-surface-secondary rounded-lg hover:bg-outline transition-colors"
            >
              {t.action.close}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Icons
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
