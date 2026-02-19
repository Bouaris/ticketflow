/**
 * WelcomePage - Full-screen project launcher (GitHub Desktop style)
 *
 * Shows on app launch to select or create a project.
 * No header bar - clean launcher interface.
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Project } from '../../types/project';
import { VISIBLE_PROJECTS_COUNT, BACKLOG_FILE_NAME } from '../../types/project';
import type { TypeDefinition } from '../../types/typeConfig';
import { useProjects } from '../../hooks/useProjects';
import { getFolderName } from '../../lib/tauri-bridge';
import { APP_VERSION } from '../../lib/version';
import { useTranslation } from '../../i18n';
import { LogoIcon, FolderOpenIcon, SpinnerIcon } from '../ui/Icons';

interface WelcomePageProps {
  onProjectSelect: (projectPath: string, backlogFile: string, types?: TypeDefinition[]) => void;
}

export function WelcomePage({ onProjectSelect }: WelcomePageProps) {
  const { t } = useTranslation();
  const {
    projects,
    isLoading,
    error,
    isTauriMode,
    openProjectDirectory,
    createNewBacklog,
    addProject,
    removeProject,
    toggleFavorite,
    validateProject,
  } = useProjects();

  const [showAllProjects, setShowAllProjects] = useState(false);
  const [newProjectDialog, setNewProjectDialog] = useState<{
    isOpen: boolean;
    path: string;
    name: string;
  }>({
    isOpen: false,
    path: '',
    name: '',
  });

  // Modal for confirming project removal
  const [confirmRemoveModal, setConfirmRemoveModal] = useState<{
    isOpen: boolean;
    project: Project | null;
  }>({ isOpen: false, project: null });

  // Error notification state
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // Auto-dismiss error notification after 5 seconds
  useEffect(() => {
    if (errorNotification) {
      const timer = setTimeout(() => setErrorNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorNotification]);

  // Split projects into favorites and recent
  const favoriteProjects = projects.filter(p => p.isFavorite);
  const recentProjects = projects.filter(p => !p.isFavorite);
  const visibleRecent = showAllProjects ? recentProjects : recentProjects.slice(0, VISIBLE_PROJECTS_COUNT);
  const hasMoreProjects = recentProjects.length > VISIBLE_PROJECTS_COUNT;

  /**
   * Handle opening a folder
   */
  const handleOpenFolder = async () => {
    const result = await openProjectDirectory();

    if (!result) return; // User cancelled or error

    const { path, scanResult } = result;
    const folderName = getFolderName(path);

    if (scanResult.found && scanResult.file) {
      // Found a backlog file - open it directly
      addProject({
        name: folderName,
        path: path,
        backlogFile: scanResult.file,
      });
      onProjectSelect(path, scanResult.file);
    } else {
      // No TICKETFLOW_Backlog.md found - show create dialog
      setNewProjectDialog({
        isOpen: true,
        path: path,
        name: folderName,
      });
    }
  };

  /**
   * Handle selecting a recent project
   */
  const handleSelectProject = async (project: Project) => {
    // Validate project exists
    const isValid = await validateProject(project);

    if (!isValid) {
      // Project no longer exists - offer to remove via modal
      setConfirmRemoveModal({ isOpen: true, project });
      return;
    }

    // Update lastOpened and open
    addProject({
      name: project.name,
      path: project.path,
      backlogFile: project.backlogFile,
    });
    onProjectSelect(project.path, project.backlogFile);
  };

  /**
   * Handle confirming project removal
   */
  const handleConfirmRemoveProject = () => {
    if (confirmRemoveModal.project) {
      removeProject(confirmRemoveModal.project.id);
    }
    setConfirmRemoveModal({ isOpen: false, project: null });
  };

  /**
   * Handle creating a new TICKETFLOW_Backlog.md file
   */
  const handleCreateNewBacklog = async (types: TypeDefinition[]) => {
    const { path, name } = newProjectDialog;

    try {
      await createNewBacklog(path, types);

      // Add project and open it
      addProject({
        name: name,
        path: path,
        backlogFile: BACKLOG_FILE_NAME,
      });

      setNewProjectDialog({ isOpen: false, path: '', name: '' });
      onProjectSelect(path, BACKLOG_FILE_NAME, types);
    } catch (err) {
      console.error('Failed to create backlog:', err);
      setErrorNotification(t.error.fileCreationError);
    }
  };


  return (
    <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
            <LogoIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">Ticketflow</h1>
          <p className="text-on-surface-muted">{t.welcome.backlogManager}</p>
        </div>

        {/* Main Action Button */}
        <motion.div
          className="mb-8"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <button
            onClick={handleOpenFolder}
            disabled={isLoading || !isTauriMode}
            className="
              w-full py-4 px-6
              bg-accent text-white text-lg font-medium
              rounded-xl shadow-lg hover:bg-accent-hover
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all hover:shadow-xl
              flex items-center justify-center gap-3
            "
          >
            {isLoading ? (
              <>
                <SpinnerIcon className="w-5 h-5 animate-spin" />
                {t.common.loadingDots}
              </>
            ) : (
              <>
                <FolderOpenIcon className="w-5 h-5" />
                {t.welcome.openFolder}
              </>
            )}
          </button>
        </motion.div>

        {/* Web mode warning */}
        {!isTauriMode && (
          <div className="mb-6 p-4 bg-warning-soft border border-warning-text/30 rounded-lg text-center">
            <p className="text-sm text-warning-text">
              La sélection de dossier nécessite la version desktop.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-danger-soft border border-danger rounded-lg text-center">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Favorites Section */}
        {favoriteProjects.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-sm font-medium text-on-surface-muted uppercase tracking-wide flex items-center gap-2">
                <StarFilledIcon className="w-4 h-4 text-amber-400" />
                {t.welcome.favorites}
              </h2>
              <div className="flex-1 h-px bg-outline" />
            </div>
            <div className="space-y-3">
              {favoriteProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProjectCard
                    project={project}
                    onSelect={handleSelectProject}
                    onRemove={removeProject}
                    onValidate={validateProject}
                    onToggleFavorite={toggleFavorite}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-sm font-medium text-on-surface-muted uppercase tracking-wide">
                {t.welcome.recentProjects}
              </h2>
              <div className="flex-1 h-px bg-outline" />
            </div>

            <div className="space-y-3">
              {visibleRecent.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProjectCard
                    project={project}
                    onSelect={handleSelectProject}
                    onRemove={removeProject}
                    onValidate={validateProject}
                    onToggleFavorite={toggleFavorite}
                  />
                </motion.div>
              ))}
            </div>

            {/* Show more button */}
            {hasMoreProjects && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="
                  w-full mt-4 py-2 px-4
                  text-sm text-on-surface-secondary hover:text-on-surface
                  hover:bg-surface-alt rounded-lg
                  transition-colors
                "
              >
                {showAllProjects
                  ? t.welcome.showLess
                  : `${t.welcome.showMore} (${recentProjects.length - VISIBLE_PROJECTS_COUNT})`
                }
              </button>
            )}
          </div>
        )}

        {/* Empty state for first launch */}
        {projects.length === 0 && !isLoading && (
          <div className="text-center text-on-surface-muted">
            <p className="text-sm">
              {t.welcome.emptyStateDesc}
            </p>
            <p className="text-xs mt-2 text-on-surface-faint">
              {t.welcome.emptyStateHint}
            </p>
          </div>
        )}

        {/* Version footer */}
        <div className="mt-12 text-center text-xs text-on-surface-faint">
          Ticketflow v{APP_VERSION}
        </div>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        isOpen={newProjectDialog.isOpen}
        folderName={newProjectDialog.name}
        folderPath={newProjectDialog.path}
        onConfirm={handleCreateNewBacklog}
        onCancel={() => setNewProjectDialog({ isOpen: false, path: '', name: '' })}
      />

      {/* Confirm Remove Project Modal */}
      <ConfirmModal
        isOpen={confirmRemoveModal.isOpen}
        onCancel={() => setConfirmRemoveModal({ isOpen: false, project: null })}
        onConfirm={handleConfirmRemoveProject}
        title={t.welcome.projectNotFound}
        message={
          confirmRemoveModal.project
            ? `"${confirmRemoveModal.project.backlogFile}" ${t.welcome.notFoundDesc} "${confirmRemoveModal.project.name}".\n\n${t.confirm.removeProject}`
            : ''
        }
        confirmLabel={t.welcome.removeFromList}
        cancelLabel={t.action.cancel}
        variant="warning"
      />

      {/* Error Notification Toast */}
      {errorNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 bg-danger text-white rounded-lg shadow-lg">
            <ErrorIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{errorNotification}</span>
            <button
              onClick={() => setErrorNotification(null)}
              className="ml-2 p-1 hover:bg-danger rounded"
            >
              <CloseSmallIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
