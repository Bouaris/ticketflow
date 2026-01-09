/**
 * Header component with file controls, undo/redo, and view toggle.
 */

import type { ViewMode } from '../../hooks/useBacklog';
import { HomeIcon, KanbanIcon, ListIcon, FolderIcon, FloppyDiskIcon, SettingsIcon, ArrowLeftIcon, ArrowRightIcon } from '../ui/Icons';

interface HeaderProps {
  fileName: string | null;
  projectName: string | null;
  isDirty: boolean;
  isLoading: boolean;
  viewMode: ViewMode;
  hasProject: boolean;
  onOpenFile: () => void;
  onSave: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenProjectSettings: () => void;
  onGoHome?: () => void;
  // Undo/Redo
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function Header({
  fileName,
  projectName,
  isDirty,
  isLoading,
  viewMode,
  hasProject,
  onOpenFile,
  onSave,
  onViewModeChange,
  onOpenProjectSettings,
  onGoHome,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Logo, Undo/Redo & File info */}
        <div className="flex items-center gap-4">
          {/* Home button (only in Tauri mode) */}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Retour à l'accueil"
              aria-label="Retour à l'accueil"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
          )}

          {/* Undo/Redo buttons - only show when handlers are provided */}
          {(onUndo || onRedo) && (
            <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 rounded-lg transition-colors ${
                  canUndo
                    ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Annuler (Ctrl+Z)"
                aria-label="Annuler"
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 rounded-lg transition-colors ${
                  canRedo
                    ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title="Rétablir (Ctrl+Y)"
                aria-label="Rétablir"
              >
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900">
            Ticketflow
          </h1>

          {(projectName || fileName) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">|</span>
              <span className="text-gray-700 font-medium">{projectName || fileName}</span>
              {isDirty && (
                <span className="text-amber-500" title="Unsaved changes">
                  •
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1" role="group" aria-label="Mode d'affichage">
          <button
            onClick={() => onViewModeChange('kanban')}
            aria-label="Vue Kanban"
            aria-pressed={viewMode === 'kanban'}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <KanbanIcon className="w-4 h-4" />
              Kanban
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            aria-label="Vue Liste"
            aria-pressed={viewMode === 'list'}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <ListIcon className="w-4 h-4" />
              Liste
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {hasProject && (
            <button
              onClick={onOpenProjectSettings}
              aria-label="Paramètres du projet"
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                Paramètres Projet
              </span>
            </button>
          )}

          <button
            onClick={onOpenFile}
            disabled={isLoading}
            aria-label="Ouvrir un fichier"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FolderIcon className="w-4 h-4" />
              Ouvrir
            </span>
          </button>

          {fileName && (
            <button
              onClick={onSave}
              disabled={isLoading || !isDirty}
              aria-label="Sauvegarder le fichier"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2">
                <FloppyDiskIcon className="w-4 h-4" />
                Sauvegarder
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
