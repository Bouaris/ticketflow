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
      title="Mise à jour disponible"
      size="sm"
      footer={
        <ModalFooter>
          {!downloading && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Plus tard
            </button>
          )}
          <button
            onClick={onInstall}
            disabled={downloading}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Installation...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                Installer maintenant
              </>
            )}
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {/* Version info */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <SparklesIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">v{updateInfo.currentVersion}</span>
              <span className="text-gray-400">→</span>
              <span className="text-sm font-semibold text-purple-600">v{updateInfo.version}</span>
            </div>
            {formattedDate && (
              <p className="text-xs text-gray-500 mt-0.5">{formattedDate}</p>
            )}
          </div>
        </div>

        {/* Release notes */}
        {updateInfo.body && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Notes de version
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {updateInfo.body}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {downloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Téléchargement en cours...</span>
              <span className="font-medium text-purple-600">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={onClearError}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
