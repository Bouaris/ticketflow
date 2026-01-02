/**
 * Header component with file controls and view toggle.
 */

import type { ViewMode } from '../../hooks/useBacklog';

interface HeaderProps {
  fileName: string | null;
  isDirty: boolean;
  isLoading: boolean;
  viewMode: ViewMode;
  onOpenFile: () => void;
  onSave: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function Header({
  fileName,
  isDirty,
  isLoading,
  viewMode,
  onOpenFile,
  onSave,
  onViewModeChange,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Logo & File info */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            Backlog Manager
          </h1>

          {fileName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">|</span>
              <span className="text-gray-700 font-medium">{fileName}</span>
              {isDirty && (
                <span className="text-amber-500" title="Unsaved changes">
                  •
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <KanbanIcon />
              Kanban
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <ListIcon />
              Liste
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenFile}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FolderIcon />
              Ouvrir
            </span>
          </button>

          {fileName && (
            <button
              onClick={onSave}
              disabled={isLoading || !isDirty}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2">
                <SaveIcon />
                Sauvegarder
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================
// ICONS
// ============================================================

function KanbanIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}
