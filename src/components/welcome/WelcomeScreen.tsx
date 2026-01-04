/**
 * WelcomeScreen - Browser welcome screen component
 *
 * Displayed when no file is loaded in web browser mode.
 * Offers options to reload the last file or open a new one.
 */

import { FileIcon, RefreshIcon, FolderIcon } from '../ui/Icons';

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onLoadStored: () => void;
  hasStoredHandle: boolean;
}

export function WelcomeScreen({ onOpenFile, onLoadStored, hasStoredHandle }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FileIcon className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Bienvenue dans Backlog Manager
        </h2>
        <p className="text-gray-600 mb-6">
          Gérez votre Product Backlog avec une interface moderne.
        </p>

        <div className="flex flex-col gap-3">
          {/* Bouton principal : Recharger le dernier fichier si disponible */}
          {hasStoredHandle ? (
            <button
              onClick={onLoadStored}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all inline-flex items-center justify-center gap-2"
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
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <FolderIcon />
            {hasStoredHandle ? 'Ouvrir un autre fichier' : 'Ouvrir un fichier'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Fichiers Markdown (.md) supportés
        </p>
      </div>
    </div>
  );
}
