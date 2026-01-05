/**
 * Backlog Manager App
 *
 * Application principale pour gérer le Product Backlog.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useBacklog } from './hooks/useBacklog';
import { useFileAccess } from './hooks/useFileAccess';
import { useScreenshotFolder } from './hooks/useScreenshotFolder';
import { useTypeConfig } from './hooks/useTypeConfig';
import { useUpdater } from './hooks/useUpdater';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Header } from './components/layout/Header';
import { FilterBar } from './components/filter/FilterBar';
import { ListView } from './components/list/ListView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ItemDetailPanel } from './components/detail/ItemDetailPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { TypeConfigModal } from './components/settings/TypeConfigModal';
import { ItemEditorModal, type ItemFormData } from './components/editor/ItemEditorModal';
import { WelcomePage } from './components/welcome/WelcomePage';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { ExportModal } from './components/export/ExportModal';
import { initSecureStorage } from './lib/ai';
import { exportItemForClipboard, buildItemMarkdown } from './lib/serializer';
import type { BacklogItem } from './types/backlog';
import type { TypeDefinition } from './types/typeConfig';
import { isFileSystemAccessSupported } from './lib/fileSystem';
import { joinPath, isTauri, getDirFromPath, getFolderName, forceQuit, listenTrayQuitRequested } from './lib/tauri-bridge';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { UpdateModal } from './components/ui/UpdateModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PlusIcon, SettingsIcon, TagIcon } from './components/ui/Icons';

function App() {
  // File access
  const fileAccess = useFileAccess();

  // Screenshot folder
  const screenshotFolder = useScreenshotFolder();

  // Backlog state
  const backlog = useBacklog();

  // Type configuration (dynamic types)
  const typeConfig = useTypeConfig();

  // Auto-updater (Tauri only)
  const updater = useUpdater();

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTypeConfigOpen, setIsTypeConfigOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    content: string;
    itemId: string;
  } | null>(null);
  const [showQuitConfirmModal, setShowQuitConfirmModal] = useState(false);
  const [showHomeConfirmModal, setShowHomeConfirmModal] = useState(false);

  // Archive confirmation state
  const [archiveConfirmModal, setArchiveConfirmModal] = useState<{
    isOpen: boolean;
    item: BacklogItem | null;
  }>({ isOpen: false, item: null });

  // Delete confirmation state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    item: BacklogItem | null;
  }>({ isOpen: false, item: null });

  // Error notification state
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // Initialize secure storage for API keys on startup
  useEffect(() => {
    initSecureStorage();
  }, []);

  // Update window title based on project
  useEffect(() => {
    const projectPath = typeConfig.projectPath;

    if (projectPath) {
      const projectName = getFolderName(projectPath);
      document.title = `Ticketflow - ${projectName}`;
    } else {
      document.title = 'Ticketflow';
    }
  }, [typeConfig.projectPath]);

  // Auto-dismiss error notifications after 5 seconds
  useEffect(() => {
    if (errorNotification) {
      const timer = setTimeout(() => setErrorNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorNotification]);

  // Keyboard shortcuts for undo/redo
  useKeyboardShortcuts({ onUndo: backlog.undo, onRedo: backlog.redo });

  // Tray quit listener (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenTrayQuitRequested(() => {
      if (fileAccess.isDirty) {
        setShowQuitConfirmModal(true);
      } else {
        forceQuit();
      }
    }).then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [fileAccess.isDirty]);

  // Handle file open
  const handleOpenFile = useCallback(async () => {
    const content = await fileAccess.openFile();
    if (content) {
      backlog.loadFromMarkdown(content);
      // Initialize type config from file content
      if (fileAccess.filePath) {
        const projectDir = getDirFromPath(fileAccess.filePath);
        typeConfig.initializeForProject(projectDir, content);
      }
      setShowWelcome(false);
    }
  }, [fileAccess, backlog, typeConfig]);

  // Handle project selection from WelcomePage
  const handleProjectSelect = useCallback(async (projectPath: string, backlogFile: string, types?: TypeDefinition[]) => {
    const fullPath = joinPath(projectPath, backlogFile);
    const content = await fileAccess.loadFromPath(fullPath);
    if (content) {
      backlog.loadFromMarkdown(content);
      // Initialize type config - use provided types for new projects, otherwise detect from content
      if (types && types.length > 0) {
        // New project with custom types - initialize with those types
        typeConfig.initializeWithTypes(projectPath, types);
      } else {
        // Existing project - detect types from content
        typeConfig.initializeForProject(projectPath, content);
      }
      setShowWelcome(false);
    }
  }, [fileAccess, backlog, typeConfig]);

  // Handle go home (return to welcome page)
  const handleGoHome = useCallback(() => {
    // Show confirmation modal if there are unsaved changes
    if (fileAccess.isDirty) {
      setShowHomeConfirmModal(true);
      return;
    }
    backlog.reset();
    fileAccess.closeFile();
    setShowWelcome(true);
  }, [backlog, fileAccess]);

  // Confirm go home (after user confirms in modal)
  const confirmGoHome = useCallback(() => {
    setShowHomeConfirmModal(false);
    backlog.reset();
    fileAccess.closeFile();
    setShowWelcome(true);
  }, [backlog, fileAccess]);

  // Handle save
  const handleSave = useCallback(async () => {
    const markdown = backlog.toMarkdown();
    const success = await fileAccess.save(markdown);
    if (success) {
      fileAccess.setDirty(false);
    }
  }, [backlog, fileAccess]);

  // Handle maintenance corrections from AI
  const handleApplyMaintenanceCorrections = useCallback(async (correctedMarkdown: string) => {
    const success = await fileAccess.save(correctedMarkdown);
    if (success) {
      backlog.loadFromMarkdown(correctedMarkdown);
      fileAccess.setDirty(false);
    }
  }, [backlog, fileAccess]);

  // Handle item click
  const handleItemClick = useCallback((item: BacklogItem) => {
    backlog.selectItem(item);
  }, [backlog]);

  // Handle close detail panel
  const handleCloseDetail = useCallback(() => {
    backlog.selectItem(null);
  }, [backlog]);

  // Handle criterion toggle
  const handleToggleCriterion = useCallback((itemId: string, criterionIndex: number) => {
    backlog.toggleItemCriterion(itemId, criterionIndex);
    fileAccess.setDirty(true);
  }, [backlog, fileAccess]);

  // Handle cross-column drag & drop (move item to different type)
  const handleMoveItem = useCallback((itemId: string, targetType: string) => {
    backlog.moveItemToType(itemId, targetType);
    fileAccess.setDirty(true);
  }, [backlog, fileAccess]);

  // Handle update item (for AI refinement from detail panel)
  const handleUpdateItem = useCallback((itemId: string, updates: Partial<BacklogItem>) => {
    backlog.updateItemById(itemId, updates);
    fileAccess.setDirty(true);
  }, [backlog, fileAccess]);

  // Handle load stored file
  const handleLoadStoredFile = useCallback(async () => {
    const content = await fileAccess.loadStoredFile();
    if (content) {
      backlog.loadFromMarkdown(content);
      // Initialize type config from file content
      if (fileAccess.filePath) {
        const projectDir = getDirFromPath(fileAccess.filePath);
        typeConfig.initializeForProject(projectDir, content);
      }
      setShowWelcome(false);
    }
  }, [fileAccess, backlog, typeConfig]);

  // Handle type config save - creates sections for new types
  const handleTypeConfigSave = useCallback((newTypes: TypeDefinition[]) => {
    // Find types that were added (exist in newTypes but not in current types)
    const currentTypeIds = new Set(typeConfig.sortedTypes.map(t => t.id));
    const addedTypes = newTypes.filter(t => !currentTypeIds.has(t.id));

    // Create sections for new types
    for (const newType of addedTypes) {
      backlog.addSection(newType.id, newType.label);
    }

    // If any sections were added, mark file as dirty
    if (addedTypes.length > 0) {
      fileAccess.setDirty(true);
    }

    // Save the type config
    typeConfig.setTypes(newTypes);
  }, [typeConfig, backlog, fileAccess]);

  // Handle type deletion - removes section from backlog AND type from config
  const handleDeleteType = useCallback((typeId: string) => {
    // 1. Remove section from backlog (modifies markdown structure)
    backlog.removeSection(typeId);

    // 2. Remove type from config (adds to deletedTypes to prevent re-creation)
    typeConfig.removeTypeById(typeId);

    // 3. Mark file as dirty to trigger save
    fileAccess.setDirty(true);
  }, [backlog, typeConfig, fileAccess]);

  // Handle create new item
  const handleCreateItem = useCallback(() => {
    setEditingItem(null);
    setIsEditorOpen(true);
  }, []);

  // Handle edit item
  const handleEditItem = useCallback((item: BacklogItem) => {
    setEditingItem(item);
    setIsEditorOpen(true);
    backlog.selectItem(null); // Close detail panel
  }, [backlog]);

  // Handle archive item - open confirmation modal
  const handleArchiveItem = useCallback((item: BacklogItem) => {
    setArchiveConfirmModal({ isOpen: true, item });
  }, []);

  // Handle delete request - open confirmation modal
  const handleDeleteRequest = useCallback((item: BacklogItem) => {
    setDeleteConfirmModal({ isOpen: true, item });
  }, []);

  // Confirm delete item
  const confirmDeleteItem = useCallback(async () => {
    const item = deleteConfirmModal.item;
    setDeleteConfirmModal({ isOpen: false, item: null });

    if (!item) return;

    // Delete associated screenshots using actual filenames from item
    if (screenshotFolder.isReady && item.screenshots && item.screenshots.length > 0) {
      for (const screenshot of item.screenshots) {
        await screenshotFolder.deleteScreenshotFile(screenshot.filename);
      }
    }
    backlog.deleteItem(item.id);
    backlog.selectItem(null);
    fileAccess.setDirty(true);
  }, [deleteConfirmModal, backlog, fileAccess, screenshotFolder]);

  // Confirm archive item
  const confirmArchive = useCallback(async () => {
    const item = archiveConfirmModal.item;
    setArchiveConfirmModal({ isOpen: false, item: null });

    if (!item) return;

    try {
      // Create archive entry
      const today = new Date().toISOString().split('T')[0];
      const archiveEntry = `
### ${item.id} | ${item.emoji || ''} ${item.title}
**Archivé le:** ${today}
**Statut:** Complété
${item.description ? `**Description:** ${item.description}` : ''}

---
`;

      // Get archive file path (same directory as backlog)
      if (fileAccess.filePath) {
        const archivePath = fileAccess.filePath.replace('TICKETFLOW_Backlog.md', 'TICKETFLOW_Archive.md');

        // Import Tauri bridge functions
        const { isTauri, fileExists, readTextFileContents, writeTextFileContents } = await import('./lib/tauri-bridge');

        if (isTauri()) {
          // Read or create archive file
          let archiveContent = `# ticketflow - Archives

> Items archivés du backlog
> Dernière mise à jour : ${today}

---

## Archives

`;
          const exists = await fileExists(archivePath);
          if (exists) {
            archiveContent = await readTextFileContents(archivePath);
          }

          // Append new entry
          archiveContent += archiveEntry;

          // Update date in header
          archiveContent = archiveContent.replace(
            /Dernière mise à jour : \d{4}-\d{2}-\d{2}/,
            `Dernière mise à jour : ${today}`
          );

          // Save archive
          await writeTextFileContents(archivePath, archiveContent);
        }
      }

      // Delete associated screenshots using actual filenames from item
      if (screenshotFolder.isReady && item.screenshots && item.screenshots.length > 0) {
        for (const screenshot of item.screenshots) {
          await screenshotFolder.deleteScreenshotFile(screenshot.filename);
        }
      }

      // Remove from backlog
      backlog.deleteItem(item.id);
      backlog.selectItem(null);
      fileAccess.setDirty(true);

    } catch (error) {
      console.error('Failed to archive item:', error);
      setErrorNotification('Erreur lors de l\'archivage');
    }
  }, [archiveConfirmModal, backlog, fileAccess, screenshotFolder]);

  // Handle export item (for clipboard)
  const handleExportItem = useCallback((item: BacklogItem) => {
    const sourcePath = fileAccess.filePath || 'Unknown';

    // Calculate absolute screenshot base path from file path
    let screenshotBasePath: string | undefined;
    if (fileAccess.filePath) {
      const dir = getDirFromPath(fileAccess.filePath);
      screenshotBasePath = `${dir}\\.backlog-assets\\screenshots`;
    }

    const content = exportItemForClipboard(item, sourcePath, screenshotBasePath);

    setExportModal({
      isOpen: true,
      content,
      itemId: item.id,
    });
  }, [fileAccess.filePath]);

  // Handle save item (from editor modal)
  const handleSaveItem = useCallback((data: ItemFormData, isNew: boolean) => {
    const rawMarkdown = buildItemMarkdown(data);

    const item: BacklogItem = {
      id: data.id,
      type: data.type,
      title: data.title,
      emoji: data.emoji,
      component: data.component,
      module: data.module,
      severity: data.severity,
      priority: data.priority,
      effort: data.effort,
      description: data.description,
      userStory: data.userStory,
      specs: data.specs.filter(s => s.trim()),
      reproduction: data.reproduction.filter(s => s.trim()),
      criteria: data.criteria.filter(c => c.text.trim()),
      dependencies: data.dependencies.filter(s => s.trim()),
      constraints: data.constraints.filter(s => s.trim()),
      screenshots: data.screenshots,
      rawMarkdown,
      sectionIndex: 0,
    };

    if (isNew) {
      backlog.addItem(item);
    } else {
      backlog.updateItemById(item.id, item);
    }

    fileAccess.setDirty(true);
  }, [backlog, fileAccess]);

  // Check browser support
  if (!isFileSystemAccessSupported()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Navigateur non supporté
          </h1>
          <p className="text-gray-600 mb-6">
            Cette application utilise l'API File System Access qui n'est disponible que sur Chrome et Edge.
          </p>
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Télécharger Chrome
          </a>
        </div>
      </div>
    );
  }

  // Memoize screenshotOps to prevent unnecessary re-renders
  const screenshotOps = useMemo(() => ({
    isReady: screenshotFolder.isReady,
    needsPermission: screenshotFolder.needsPermission,
    isProcessing: screenshotFolder.isProcessing,
    onRequestAccess: screenshotFolder.requestFolderAccess,
    saveBlob: screenshotFolder.saveScreenshotBlob,
    importFile: screenshotFolder.importScreenshotFile,
    getUrl: screenshotFolder.getScreenshotUrl,
    deleteFile: screenshotFolder.deleteScreenshotFile,
  }), [
    screenshotFolder.isReady,
    screenshotFolder.needsPermission,
    screenshotFolder.isProcessing,
    screenshotFolder.requestFolderAccess,
    screenshotFolder.saveScreenshotBlob,
    screenshotFolder.importScreenshotFile,
    screenshotFolder.getScreenshotUrl,
    screenshotFolder.deleteScreenshotFile,
  ]);

  // Determine if we should show welcome page
  const shouldShowWelcome = showWelcome || !backlog.backlog;
  const shouldShowTauriWelcome = shouldShowWelcome && isTauri();

  return (
    <ErrorBoundary>
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header - Hidden on Tauri welcome page */}
      {!shouldShowTauriWelcome && (
        <Header
          fileName={fileAccess.fileName}
          projectName={typeConfig.projectPath ? getFolderName(typeConfig.projectPath) : null}
          isDirty={fileAccess.isDirty}
          isLoading={fileAccess.isLoading || backlog.isLoading}
          viewMode={backlog.viewMode}
          onOpenFile={handleOpenFile}
          onSave={handleSave}
          onViewModeChange={backlog.setViewMode}
          onGoHome={isTauri() ? handleGoHome : undefined}
        />
      )}

      {/* FAB Buttons - Hide on Tauri welcome page */}
      {!shouldShowTauriWelcome && (
        <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-30">
          {/* Create new item button - only show when backlog is loaded */}
          {backlog.backlog && (
            <button
              onClick={handleCreateItem}
              className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              title="Créer un nouvel item"
            >
              <PlusIcon className="w-6 h-6" />
            </button>
          )}

          {/* Type config button - only show when backlog is loaded */}
          {backlog.backlog && (
            <button
              onClick={() => setIsTypeConfigOpen(true)}
              className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
              title="Configurer les types"
            >
              <TagIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="relative p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
            title="Paramètres"
          >
            <SettingsIcon className="w-5 h-5 text-gray-600" />
            {/* Badge notification: update dismissed but available */}
            {updater.dismissed && updater.available && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* Main content */}
      {shouldShowWelcome ? (
        shouldShowTauriWelcome ? (
          <WelcomePage onProjectSelect={handleProjectSelect} />
        ) : (
          <WelcomeScreen
            onOpenFile={handleOpenFile}
            onLoadStored={handleLoadStoredFile}
            hasStoredHandle={fileAccess.hasStoredHandle}
          />
        )
      ) : (
        <>
          {/* Filter bar */}
          <FilterBar
            filters={backlog.filters}
            totalCount={backlog.allItems.length}
            filteredCount={backlog.filteredItems.length}
            types={typeConfig.sortedTypes}
            onFiltersChange={backlog.setFilters}
            onToggleTypeVisibility={typeConfig.toggleTypeVisibility}
            onReset={backlog.resetFilters}
          />

          {/* View */}
          {backlog.viewMode === 'kanban' ? (
            <KanbanBoard
              itemsByType={backlog.itemsByType}
              types={typeConfig.sortedTypes}
              onItemClick={handleItemClick}
              onTypesReorder={typeConfig.reorderTypesAtIndex}
              onMoveItem={handleMoveItem}
              projectPath={typeConfig.projectPath || undefined}
            />
          ) : (
            <ListView
              items={backlog.filteredItems}
              onItemClick={handleItemClick}
            />
          )}
        </>
      )}

      {/* Detail panel */}
      <ItemDetailPanel
        item={backlog.selectedItem}
        onClose={handleCloseDetail}
        onToggleCriterion={handleToggleCriterion}
        onUpdate={handleUpdateItem}
        onEdit={handleEditItem}
        onDeleteRequest={handleDeleteRequest}
        onArchive={handleArchiveItem}
        onExport={handleExportItem}
        getScreenshotUrl={screenshotFolder.isReady ? screenshotFolder.getScreenshotUrl : undefined}
        projectPath={typeConfig.projectPath || undefined}
      />

      {/* Item Editor Modal */}
      <ItemEditorModal
        isOpen={isEditorOpen}
        item={editingItem}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveItem}
        existingIds={backlog.existingIds}
        types={typeConfig.sortedTypes}
        screenshotOps={screenshotOps}
        projectPath={typeConfig.projectPath || undefined}
      />

      {/* Settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        updater={updater}
        markdownContent={backlog.allItems.length > 0 ? backlog.toMarkdown() : undefined}
        onApplyCorrections={handleApplyMaintenanceCorrections}
      />

      {/* Type Config modal */}
      <TypeConfigModal
        isOpen={isTypeConfigOpen}
        types={typeConfig.sortedTypes}
        onSave={handleTypeConfigSave}
        onDeleteType={handleDeleteType}
        onCancel={() => setIsTypeConfigOpen(false)}
      />

      {/* Export modal */}
      {exportModal && (
        <ExportModal
          isOpen={exportModal.isOpen}
          onClose={() => setExportModal(null)}
          content={exportModal.content}
          itemId={exportModal.itemId}
        />
      )}

      {/* Error display */}
      {(fileAccess.error || backlog.error) && (
        <div className="fixed bottom-4 left-4 right-24 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg z-30">
          {fileAccess.error || backlog.error}
        </div>
      )}

      {/* Error notification toast */}
      {errorNotification && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <span>{errorNotification}</span>
          <button
            onClick={() => setErrorNotification(null)}
            className="text-white/80 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Archive confirmation modal */}
      <ConfirmModal
        isOpen={archiveConfirmModal.isOpen}
        title="Archiver cet item ?"
        message={`L'item ${archiveConfirmModal.item?.id || ''} sera déplacé vers TICKETFLOW_Archive.md`}
        confirmLabel="Archiver"
        cancelLabel="Annuler"
        variant="warning"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveConfirmModal({ isOpen: false, item: null })}
      />

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title="Supprimer cet item ?"
        message={`L'item ${deleteConfirmModal.item?.id || ''} sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={confirmDeleteItem}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, item: null })}
      />

      {/* Quit confirmation modal (Tauri tray) */}
      <ConfirmModal
        isOpen={showQuitConfirmModal}
        title="Quitter sans sauvegarder ?"
        message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
        confirmLabel="Quitter"
        cancelLabel="Annuler"
        variant="warning"
        onConfirm={() => forceQuit()}
        onCancel={() => setShowQuitConfirmModal(false)}
      />

      {/* Home confirmation modal */}
      <ConfirmModal
        isOpen={showHomeConfirmModal}
        title="Quitter sans sauvegarder ?"
        message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment retourner à l'accueil ?"
        confirmLabel="Quitter"
        cancelLabel="Annuler"
        variant="warning"
        onConfirm={confirmGoHome}
        onCancel={() => setShowHomeConfirmModal(false)}
      />

      {/* Update modal (Tauri only) - uses showModal for smart dismiss */}
      <UpdateModal
        isOpen={updater.showModal}
        updateInfo={updater.available}
        downloading={updater.downloading}
        progress={updater.progress}
        error={updater.error}
        onInstall={updater.installUpdate}
        onDismiss={updater.dismissUpdate}
        onClearError={updater.clearError}
      />
    </div>
    </ErrorBoundary>
  );
}

export default App;
