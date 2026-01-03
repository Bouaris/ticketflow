/**
 * Backlog Manager App
 *
 * Application principale pour gérer le Product Backlog.
 */

import { useState, useCallback } from 'react';
import { useBacklog } from './hooks/useBacklog';
import { useFileAccess } from './hooks/useFileAccess';
import { useScreenshotFolder } from './hooks/useScreenshotFolder';
import { useTypeConfig } from './hooks/useTypeConfig';
import { Header } from './components/layout/Header';
import { FilterBar } from './components/filter/FilterBar';
import { ListView } from './components/list/ListView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ItemDetailPanel } from './components/detail/ItemDetailPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { TypeConfigModal } from './components/settings/TypeConfigModal';
import { ItemEditorModal, type ItemFormData } from './components/editor/ItemEditorModal';
import { WelcomePage } from './components/welcome/WelcomePage';
import { hasApiKey, refineItem } from './lib/ai';
import type { BacklogItem } from './types/backlog';
import type { TypeDefinition } from './types/typeConfig';
import { isFileSystemAccessSupported } from './lib/fileSystem';
import { getScreenshotMarkdownRef } from './lib/screenshots';
import { joinPath, isTauri, getDirFromPath } from './lib/tauri-bridge';

// Helper to generate rawMarkdown from form data
function generateRawMarkdown(data: ItemFormData): string {
  const lines: string[] = [];

  // Header
  const emoji = data.emoji ? `${data.emoji} ` : '';
  lines.push(`### ${data.id} | ${emoji}${data.title}`);

  // Metadata
  if (data.component) {
    lines.push(`**Composant:** ${data.component}`);
  }
  if (data.module) {
    lines.push(`**Module:** ${data.module}`);
  }
  if (data.severity) {
    const severityLabels: Record<string, string> = {
      P0: 'P0 - Bloquant',
      P1: 'P1 - Critique',
      P2: 'P2 - Moyenne',
      P3: 'P3 - Faible',
      P4: 'P4 - Mineure',
    };
    lines.push(`**Sévérité:** ${severityLabels[data.severity] || data.severity}`);
  }
  if (data.priority) {
    lines.push(`**Priorité:** ${data.priority}`);
  }
  if (data.effort) {
    const effortLabels: Record<string, string> = {
      XS: 'XS (Extra Small)',
      S: 'S (Small)',
      M: 'M (Medium)',
      L: 'L (Large)',
      XL: 'XL (Extra Large)',
    };
    lines.push(`**Effort:** ${effortLabels[data.effort] || data.effort}`);
  }

  // Description
  if (data.description) {
    lines.push(`**Description:** ${data.description}`);
  }

  // User Story
  if (data.userStory) {
    lines.push('');
    lines.push('**User Story:**');
    lines.push(`> ${data.userStory}`);
  }

  // Reproduction
  if (data.reproduction.length > 0) {
    lines.push('');
    lines.push('**Reproduction:**');
    data.reproduction.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  }

  // Specs
  if (data.specs.length > 0) {
    lines.push('');
    lines.push('**Spécifications:**');
    data.specs.forEach(spec => {
      lines.push(`- ${spec}`);
    });
  }

  // Criteria
  if (data.criteria.length > 0) {
    lines.push('');
    lines.push(`**Critères d'acceptation:**`);
    data.criteria.forEach(criterion => {
      const check = criterion.checked ? 'x' : ' ';
      lines.push(`- [${check}] ${criterion.text}`);
    });
  }

  // Dependencies
  if (data.dependencies.length > 0) {
    lines.push('');
    lines.push('**Dépendances:**');
    data.dependencies.forEach(dep => {
      lines.push(`- ${dep}`);
    });
  }

  // Constraints
  if (data.constraints.length > 0) {
    lines.push('');
    lines.push('**Contraintes:**');
    data.constraints.forEach(constraint => {
      lines.push(`- ${constraint}`);
    });
  }

  // Screenshots
  if (data.screenshots.length > 0) {
    lines.push('');
    lines.push('**Screenshots:**');
    data.screenshots.forEach(screenshot => {
      lines.push(getScreenshotMarkdownRef(screenshot.filename, screenshot.alt));
    });
  }

  // Separator
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function App() {
  // File access
  const fileAccess = useFileAccess();

  // Screenshot folder
  const screenshotFolder = useScreenshotFolder();

  // Backlog state
  const backlog = useBacklog();

  // Type configuration (dynamic types)
  const typeConfig = useTypeConfig();

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTypeConfigOpen, setIsTypeConfigOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

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
    // Ask confirmation if there are unsaved changes
    if (fileAccess.isDirty) {
      if (!window.confirm('Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?')) {
        return;
      }
    }
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

  // Handle AI refinement
  const handleRefineWithAI = useCallback(async (item: BacklogItem) => {
    if (!hasApiKey()) {
      setIsSettingsOpen(true);
      return;
    }

    setIsRefining(true);
    const result = await refineItem(item);
    setIsRefining(false);

    if (result.success && result.refinedItem) {
      if (window.confirm('Appliquer les suggestions de Gemini ?')) {
        backlog.updateItemById(item.id, result.refinedItem);
        fileAccess.setDirty(true);
      }
    } else {
      alert(`Erreur: ${result.error}`);
    }
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

  // Handle delete item
  const handleDeleteItem = useCallback(async (id: string) => {
    if (window.confirm(`Supprimer l'item ${id} ?`)) {
      // Delete associated screenshots
      if (screenshotFolder.isReady) {
        await screenshotFolder.deleteTicketScreenshots(id);
      }
      backlog.deleteItem(id);
      fileAccess.setDirty(true);
    }
  }, [backlog, fileAccess, screenshotFolder]);

  // Handle save item (from editor modal)
  const handleSaveItem = useCallback((data: ItemFormData, isNew: boolean) => {
    const rawMarkdown = generateRawMarkdown(data);

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

  // Determine if we should show welcome page
  const shouldShowWelcome = showWelcome || !backlog.backlog;
  const shouldShowTauriWelcome = shouldShowWelcome && isTauri();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header - Hidden on Tauri welcome page */}
      {!shouldShowTauriWelcome && (
        <Header
          fileName={fileAccess.fileName}
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
            className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
            title="Paramètres"
          >
            <SettingsIcon />
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
            onReset={backlog.resetFilters}
          />

          {/* View */}
          {backlog.viewMode === 'kanban' ? (
            <KanbanBoard
              itemsByType={backlog.itemsByType}
              types={typeConfig.sortedTypes}
              onItemClick={handleItemClick}
              onTypesReorder={typeConfig.reorderTypesAtIndex}
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
        onDelete={handleDeleteItem}
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
        screenshotOps={{
          isReady: screenshotFolder.isReady,
          needsPermission: screenshotFolder.needsPermission,
          isProcessing: screenshotFolder.isProcessing,
          onRequestAccess: screenshotFolder.requestFolderAccess,
          saveBlob: screenshotFolder.saveScreenshotBlob,
          importFile: screenshotFolder.importScreenshotFile,
          getUrl: screenshotFolder.getScreenshotUrl,
          deleteFile: screenshotFolder.deleteScreenshotFile,
        }}
      />

      {/* Settings modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Type Config modal */}
      <TypeConfigModal
        isOpen={isTypeConfigOpen}
        types={typeConfig.sortedTypes}
        onSave={typeConfig.setTypes}
        onCancel={() => setIsTypeConfigOpen(false)}
      />

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
    </div>
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
