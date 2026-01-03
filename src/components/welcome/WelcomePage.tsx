/**
 * WelcomePage - Full-screen project launcher (GitHub Desktop style)
 *
 * Shows on app launch to select or create a project.
 * No header bar - clean launcher interface.
 */

import { useState } from 'react';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import type { Project } from '../../types/project';
import { VISIBLE_PROJECTS_COUNT, BACKLOG_FILE_NAME } from '../../types/project';
import type { TypeDefinition } from '../../types/typeConfig';
import { useProjects } from '../../hooks/useProjects';
import { getFolderName } from '../../lib/tauri-bridge';
import { APP_VERSION } from '../../lib/version';

interface WelcomePageProps {
  onProjectSelect: (projectPath: string, backlogFile: string, types?: TypeDefinition[]) => void;
}

export function WelcomePage({ onProjectSelect }: WelcomePageProps) {
  const {
    projects,
    isLoading,
    error,
    isTauriMode,
    openProjectDirectory,
    createNewBacklog,
    addProject,
    removeProject,
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

  // Visible projects based on showAll toggle
  const visibleProjects = showAllProjects
    ? projects
    : projects.slice(0, VISIBLE_PROJECTS_COUNT);

  const hasMoreProjects = projects.length > VISIBLE_PROJECTS_COUNT;

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
      // Project no longer exists - offer to remove
      const shouldRemove = window.confirm(
        `Le fichier "${project.backlogFile}" n'existe plus dans "${project.name}".\n\nVoulez-vous retirer ce projet de la liste ?`
      );
      if (shouldRemove) {
        removeProject(project.id);
      }
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
      alert('Erreur lors de la création du fichier.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <LogoIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ticketflow</h1>
          <p className="text-gray-500">Gestionnaire de backlog produit</p>
        </div>

        {/* Main Action Button */}
        <button
          onClick={handleOpenFolder}
          disabled={isLoading || !isTauriMode}
          className="
            w-full py-4 px-6 mb-8
            bg-blue-600 text-white text-lg font-medium
            rounded-xl shadow-lg hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all hover:shadow-xl
            flex items-center justify-center gap-3
          "
        >
          {isLoading ? (
            <>
              <SpinnerIcon className="w-5 h-5 animate-spin" />
              Chargement...
            </>
          ) : (
            <>
              <FolderOpenIcon className="w-5 h-5" />
              Ouvrir un dossier
            </>
          )}
        </button>

        {/* Web mode warning */}
        {!isTauriMode && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-sm text-amber-800">
              La sélection de dossier nécessite la version desktop.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Recent Projects */}
        {projects.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Projets récents
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-3">
              {visibleProjects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={handleSelectProject}
                  onRemove={removeProject}
                  onValidate={validateProject}
                />
              ))}
            </div>

            {/* Show more button */}
            {hasMoreProjects && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="
                  w-full mt-4 py-2 px-4
                  text-sm text-gray-600 hover:text-gray-900
                  hover:bg-gray-100 rounded-lg
                  transition-colors
                "
              >
                {showAllProjects
                  ? 'Voir moins'
                  : `Voir plus (${projects.length - VISIBLE_PROJECTS_COUNT} autres)`
                }
              </button>
            )}
          </div>
        )}

        {/* Empty state for first launch */}
        {projects.length === 0 && !isLoading && (
          <div className="text-center text-gray-500">
            <p className="text-sm">
              Sélectionnez un dossier contenant votre fichier BACKLOG.md
            </p>
            <p className="text-xs mt-2 text-gray-400">
              ou créez un nouveau projet dans un dossier vide
            </p>
          </div>
        )}

        {/* Version footer */}
        <div className="mt-12 text-center text-xs text-gray-400">
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
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
