/**
 * ProcessingStep - Step 2 of the Bulk Import Wizard.
 *
 * Shows a centered spinner with processing message, optional batch progress,
 * and a cancel button.
 *
 * @module components/import/ProcessingStep
 */

import { SpinnerIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface ProcessingStepProps {
  onCancel: () => void;
  /** Optional batch progress indicator */
  progress?: { current: number; total: number };
}

// ============================================================
// COMPONENT
// ============================================================

export function ProcessingStep({ onCancel, progress }: ProcessingStepProps) {
  const { t } = useTranslation();

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-on-surface">
          {t.bulkImport.processingTitle}
        </h3>
        <p className="text-sm text-on-surface-muted">
          {t.bulkImport.processingDescription}
        </p>

        {/* Batch progress indicator */}
        {progress && progress.total > 1 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-on-surface-secondary">
              {t.bulkImport.processingProgress
                .replace('{current}', String(progress.current))
                .replace('{total}', String(progress.total))}
            </p>
            <div className="w-48 mx-auto h-2 bg-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-on-surface-secondary hover:bg-surface-alt rounded-lg font-medium transition-colors"
      >
        {t.bulkImport.cancelExtraction}
      </button>
    </div>
  );
}
