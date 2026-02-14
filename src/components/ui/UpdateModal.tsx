/**
 * UpdateModal - Modal for app update notifications and progress.
 *
 * Shows when a new version is available with:
 * - Version info and release notes
 * - Download progress bar
 * - Install/Later buttons
 */

import { Modal, ModalFooter } from './Modal';
import { DownloadIcon, SparklesIcon } from './Icons';
import { useTranslation } from '../../i18n';

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
  onClearError: () => void;
}

export function UpdateModal({
  isOpen,
  updateInfo,
  downloading,
  progress,
  error,
  onInstall,
  onDismiss,
  onClearError,
}: UpdateModalProps) {
  const { t } = useTranslation();
  if (!isOpen || !updateInfo) return null;

  const formattedDate = updateInfo.date
    ? new Date(updateInfo.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={downloading ? () => {} : onDismiss}
      closeOnBackdrop={!downloading}
      closeOnEscape={!downloading}
      title={t.update.available}
      size="sm"
      footer={
        <ModalFooter>
          {!downloading && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg transition-colors"
            >
              {t.action.cancel}
            </button>
          )}
          <button
            onClick={onInstall}
            disabled={downloading}
            className="px-4 py-2 text-sm bg-accent text-white hover:bg-accent-hover rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.update.installing}
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                {t.action.apply}
              </>
            )}
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {/* Version info */}
        <div className="flex items-center gap-3 p-4 bg-accent-soft rounded-xl">
          <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline">
            <SparklesIcon className="w-6 h-6 text-accent-text" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-on-surface-muted">v{updateInfo.currentVersion}</span>
              <span className="text-on-surface-faint">&rarr;</span>
              <span className="text-sm font-semibold text-accent-text">v{updateInfo.version}</span>
            </div>
            {formattedDate && (
              <p className="text-xs text-on-surface-muted mt-0.5">{formattedDate}</p>
            )}
          </div>
        </div>

        {/* Release notes */}
        {updateInfo.body && (
          <div className="p-3 bg-surface-alt rounded-lg">
            <h4 className="text-xs font-medium text-on-surface-muted uppercase tracking-wide mb-2">
              {t.settings.changelog}
            </h4>
            <p className="text-sm text-on-surface-secondary whitespace-pre-line leading-relaxed">
              {updateInfo.body}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {downloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-secondary">{t.update.downloading}</span>
              <span className="font-medium text-accent-text">{progress}%</span>
            </div>
            <div className="h-2 bg-outline rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-danger-soft border border-danger rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-danger-text">{error}</p>
              <button
                onClick={onClearError}
                className="text-danger-text hover:text-danger-text text-xs font-medium"
              >
                {t.action.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
