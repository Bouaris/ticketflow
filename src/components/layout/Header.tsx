/**
 * Header component with file controls, undo/redo, and view toggle.
 */

import type { ViewMode } from '../../hooks/useBacklogDB';
import { HomeIcon, KanbanIcon, ListIcon, GraphIcon, ChartBarIcon, ArchiveIcon, FolderIcon, SettingsIcon, ArrowLeftIcon, ArrowRightIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

interface HeaderProps {
  projectName: string | null;
  isLoading: boolean;
  viewMode: ViewMode;
  hasProject: boolean;
  onOpenFile: () => void;
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
  projectName,
  isLoading,
  viewMode,
  hasProject,
  onOpenFile,
  onViewModeChange,
  onOpenProjectSettings,
  onGoHome,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="bg-surface border-b border-outline px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Logo, Undo/Redo & File info */}
        <div className="flex items-center gap-4 min-w-0 shrink-0">
          {/* Home button (only in Tauri mode) */}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="p-2 text-on-surface-muted hover:text-accent-text hover:bg-accent-soft rounded-lg transition-colors"
              title={t.nav.home}
              aria-label={t.nav.home}
            >
              <HomeIcon className="w-5 h-5" />
            </button>
          )}

          {/* Undo/Redo buttons - only show when handlers are provided */}
          {(onUndo || onRedo) && (
            <div className="flex items-center gap-1 border-r border-outline pr-4">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 rounded-lg transition-colors ${
                  canUndo
                    ? 'text-on-surface-secondary hover:text-accent-text hover:bg-accent-soft'
                    : 'text-on-surface-faint cursor-not-allowed'
                }`}
                title={`${t.action.undo} (Ctrl+Z)`}
                aria-label={t.action.undo}
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 rounded-lg transition-colors ${
                  canRedo
                    ? 'text-on-surface-secondary hover:text-accent-text hover:bg-accent-soft'
                    : 'text-on-surface-faint cursor-not-allowed'
                }`}
                title={`${t.action.redo} (Ctrl+Y)`}
                aria-label={t.action.redo}
              >
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          <h1 className="text-xl font-bold text-on-surface">
            Ticketflow
          </h1>

          {projectName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-on-surface-muted">|</span>
              <span className="text-on-surface-secondary font-medium truncate max-w-[200px]">{projectName}</span>
            </div>
          )}
        </div>

        {/* Center: View Toggle */}
        <div className="flex items-center bg-surface-alt rounded-lg p-1 min-w-0 shrink" role="group">
          <button
            onClick={() => onViewModeChange('kanban')}
            aria-label={t.nav.kanban}
            aria-pressed={viewMode === 'kanban'}
            className={`px-2 py-1.5 lg:px-4 lg:py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'kanban'
                ? 'bg-surface text-on-surface shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-2">
              <KanbanIcon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.nav.kanban}</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            aria-label={t.nav.list}
            aria-pressed={viewMode === 'list'}
            className={`px-2 py-1.5 lg:px-4 lg:py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-surface text-on-surface shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-2">
              <ListIcon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.nav.list}</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('graph')}
            aria-label={t.nav.graph}
            aria-pressed={viewMode === 'graph'}
            className={`px-2 py-1.5 lg:px-4 lg:py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'graph'
                ? 'bg-surface text-on-surface shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-2">
              <GraphIcon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.nav.graph}</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('dashboard')}
            aria-label={t.nav.dashboard}
            aria-pressed={viewMode === 'dashboard'}
            className={`px-2 py-1.5 lg:px-4 lg:py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-surface text-on-surface shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.nav.dashboard}</span>
            </span>
          </button>
          <button
            onClick={() => onViewModeChange('archive')}
            aria-label={t.nav.archive}
            aria-pressed={viewMode === 'archive'}
            className={`px-2 py-1.5 lg:px-4 lg:py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'archive'
                ? 'bg-surface text-on-surface shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline'
                : 'text-on-surface-muted hover:text-on-surface'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArchiveIcon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.nav.archive}</span>
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
          {hasProject && (
            <button
              onClick={onOpenProjectSettings}
              aria-label={t.common.parameters}
              className="px-2.5 py-2 xl:px-4 text-sm font-medium text-accent-text bg-accent-soft border border-accent/30 rounded-lg hover:bg-accent-soft transition-colors"
            >
              <span className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden xl:inline">{t.common.parameters}</span>
              </span>
            </button>
          )}

          {/* Open file button - only in web mode (Tauri has Home button) */}
          {!onGoHome && (
            <button
              onClick={onOpenFile}
              disabled={isLoading}
              aria-label={t.action.openFile}
              className="px-2.5 py-2 xl:px-4 text-sm font-medium text-on-surface-secondary bg-surface border border-outline-strong rounded-lg hover:bg-surface-alt disabled:opacity-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4" />
                <span className="hidden xl:inline">{t.action.openFile}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
