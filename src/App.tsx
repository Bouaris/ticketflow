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
import { Header } from './components/layout/Header';
import { FilterBar } from './components/filter/FilterBar';
import { ListView } from './components/list/ListView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ItemDetailPanel } from './components/detail/ItemDetailPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { TypeConfigModal } from './components/settings/TypeConfigModal';
import { ItemEditorModal, type ItemFormData } from './components/editor/ItemEditorModal';
import { WelcomePage } from './components/welcome/WelcomePage';
import { ExportModal } from './components/export/ExportModal';
import { hasApiKey, refineItem, initSecureStorage } from './lib/ai';
import { exportItemForClipboard, buildItemMarkdown } from './lib/serializer';
import type { BacklogItem } from './types/backlog';
import type { TypeDefinition } from './types/typeConfig';
import { isFileSystemAccessSupported } from './lib/fileSystem';
import { joinPath, isTauri, getDirFromPath, getFolderName, forceQuit, listenTrayQuitRequested } from './lib/tauri-bridge';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { UpdateModal } from './components/ui/UpdateModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

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
  const [isRefining, setIsRefining] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    content: string;
    itemId: string;
  } | null>(null);
  const [showQuitConfirmModal, setShowQuitConfirmModal] = useState(false);
  const [showHomeConfirmModal, setShowHomeConfirmModal] = useState(false);

  // AI refinement confirmation state
  const [aiConfirmModal, setAiConfirmModal] = useState<{
    isOpen: boolean;
    item: BacklogItem | null;
    refinedItem: Partial<BacklogItem> | null;
  }>({ isOpen: false, item: null, refinedItem: null });

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        backlog.undo();
      }

      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        backlog.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [backlog.undo, backlog.redo]);

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

  // Handle AI refinement
  const handleRefineWithAI = useCallback(async (item: BacklogItem) => {
    if (!hasApiKey()) {
      setIsSettingsOpen(true);
      return;
    }

    setIsRefining(true);
    const result = await refineItem(item, {
      projectPath: typeConfig.projectPath || undefined,
    });
    setIsRefining(false);

    if (result.success && result.refinedItem) {
      // Show confirmation modal
      setAiConfirmModal({
        isOpen: true,
        item,
        refinedItem: result.refinedItem,
      });
    } else {
      setErrorNotification(`Erreur IA: ${result.error}`);
    }
  }, [typeConfig.projectPath]);

  // Confirm AI refinement
  const confirmAiRefinement = useCallback(() => {
    if (aiConfirmModal.item && aiConfirmModal.refinedItem) {
      backlog.updateItemById(aiConfirmModal.item.id, aiConfirmModal.refinedItem);
      fileAccess.setDirty(true);
    }
    setAiConfirmModal({ isOpen: false, item: null, refinedItem: null });
  }, [aiConfirmModal, backlog, fileAccess]);

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
              <PlusIcon />
            </button>
          )}

          {/* Type config button - only show when backlog is loaded */}
          {backlog.backlog && (
            <button
              onClick={() => setIsTypeConfigOpen(true)}
              className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
              title="Configurer les types"
            >
              <TagIcon />
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="relative p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
            title="Paramètres"
          >
            <SettingsIcon />
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
        onRefineWithAI={handleRefineWithAI}
        onEdit={handleEditItem}
        onDeleteRequest={handleDeleteRequest}
        onArchive={handleArchiveItem}
        onExport={handleExportItem}
        getScreenshotUrl={screenshotFolder.isReady ? screenshotFolder.getScreenshotUrl : undefined}
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

      {/* Loading overlay for AI */}
      {isRefining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-gray-700">Analyse en cours avec Gemini...</span>
          </div>
        </div>
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

      {/* AI refinement confirmation modal */}
      <ConfirmModal
        isOpen={aiConfirmModal.isOpen}
        title="Appliquer les suggestions IA ?"
        message="L'IA propose des améliorations pour cet item. Voulez-vous les appliquer ?"
        confirmLabel="Appliquer"
        cancelLabel="Annuler"
        variant="primary"
        onConfirm={confirmAiRefinement}
        onCancel={() => setAiConfirmModal({ isOpen: false, item: null, refinedItem: null })}
      />

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

// ============================================================
// WELCOME SCREEN
// ============================================================

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onLoadStored: () => void;
  hasStoredHandle: boolean;
}

function WelcomeScreen({ onOpenFile, onLoadStored, hasStoredHandle }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <DocumentIcon className="w-10 h-10 text-blue-600" />
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

// ============================================================
// ICONS
// ============================================================

function PlusIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

export default App;
