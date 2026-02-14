/**
 * WelcomeScreen - Browser welcome screen component
 *
 * Displayed when no file is loaded in web browser mode.
 * Offers options to reload the last file or open a new one.
 */

import { FileIcon, RefreshIcon, FolderIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onLoadStored: () => void;
  hasStoredHandle: boolean;
}

export function WelcomeScreen({ onOpenFile, onLoadStored, hasStoredHandle }: WelcomeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 bg-accent-soft rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FileIcon className="w-10 h-10 text-accent-text" />
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-3">
          {t.welcome.backlogManager}
        </h2>
        <p className="text-on-surface-secondary mb-6">
          {t.welcome.backlogManagerDesc}
        </p>

        <div className="flex flex-col gap-3">
          {/* Bouton principal : Recharger le dernier fichier si disponible */}
          {hasStoredHandle ? (
            <button
              onClick={onLoadStored}
              className="w-full px-6 py-3 bg-accent text-white hover:bg-accent-hover font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <RefreshIcon />
              Recharger PRODUCT_BACKLOG.md
            </button>
          ) : null}

          {/* Bouton secondaire : Ouvrir un autre fichier */}
          <button
            onClick={onOpenFile}
            className={`w-full px-6 py-3 font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 ${
              hasStoredHandle
                ? 'bg-surface-alt text-on-surface-secondary hover:bg-outline'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            <FolderIcon />
            {hasStoredHandle ? t.welcome.openAnotherFile : t.welcome.openFile}
          </button>
        </div>

        <p className="text-xs text-on-surface-faint mt-4">
          Fichiers Markdown (.md) supportés
        </p>
      </div>
    </div>
  );
}
