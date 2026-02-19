/**
 * ProjectWorkspace - Keyed boundary for project state isolation
 *
 * When rendered with key={projectPath}, React completely destroys and
 * recreates this component tree when the key changes. This guarantees
 * no state leakage between projects.
 *
 * Orchestrates 4 extracted hooks and delegates rendering of dialogs
 * to WorkspaceDialogs.
 *
 * @module components/workspace/ProjectWorkspace
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { track } from '../../lib/telemetry';
import { useBacklogDB, type BacklogFilters } from '../../hooks/useBacklogDB';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import { useTemplates } from '../../hooks/useTemplates';
import { useAIBacklogSuggestions } from '../../hooks/useAIBacklogSuggestions';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useChatPanel } from '../../hooks/useChatPanel';
import { useQuickCapture } from '../../hooks/useQuickCapture';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useFeatureTooltips } from '../../hooks/useFeatureTooltips';
import { useWorkspaceModals } from '../../hooks/useWorkspaceModals';
import { useWorkspaceItemActions } from '../../hooks/useWorkspaceItemActions';
import { useWorkspaceBulkOps } from '../../hooks/useWorkspaceBulkOps';
import { useWorkspaceTypeSync } from '../../hooks/useWorkspaceTypeSync';
import { useWorkspacePalette } from '../../hooks/useWorkspacePalette';
import { SHORTCUTS } from '../../constants/shortcuts';
import { STORAGE_KEYS } from '../../constants/storage';
import { useTranslation } from '../../i18n';
import { Header } from '../layout/Header';
import { FilterBar } from '../filter/FilterBar';
import { ListView } from '../list/ListView';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { ItemDetailPanel } from '../detail/ItemDetailPanel';
import { BulkActionBar } from '../ui/BulkActionBar';
import { DependencyGraph } from '../relations/DependencyGraph';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { ArchiveTab } from '../archive/ArchiveTab';
import { ChatPanel } from '../chat/ChatPanel';
import { FeatureTooltip } from '../onboarding/FeatureTooltip';
import { WorkspaceDialogs } from './WorkspaceDialogs';
import { PlusIcon, SparklesIcon, ChatIcon, TagIcon, SettingsIcon, UploadIcon } from '../ui/Icons';
import { type ScreenshotOperations } from '../editor/ItemEditorModal';
import { addRecentItem, type WorkspaceActions } from '../../lib/command-registry';
import { isTauri, getFolderName } from '../../lib/tauri-bridge';
import { hasApiKey, getProvider } from '../../lib/ai';
import type { BacklogItem, Priority, Effort } from '../../types/backlog';
import type { UseScreenshotFolderReturn } from '../../hooks/useScreenshotFolder';
import type { UseTypeConfigReturn } from '../../hooks/useTypeConfig';

// ============================================================
// TYPES
// ============================================================

export interface ProjectWorkspaceProps {
  projectPath: string;
  typeConfig: UseTypeConfigReturn;
  screenshotFolder: UseScreenshotFolderReturn;
  onOpenTypeConfig: () => void;
  onOpenProjectSettings: () => void;
  onOpenSettings: () => void;
  onOpenAISettings: () => void;
  onGoHome?: () => void;
  showUpdateBadge?: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export function ProjectWorkspace({
  projectPath,
  typeConfig,
  screenshotFolder,
  onOpenTypeConfig,
  onOpenProjectSettings,
  onOpenSettings,
  onOpenAISettings,
  onGoHome,
  showUpdateBadge,
}: ProjectWorkspaceProps) {
  // ============================================================
  // PROJECT-SPECIFIC HOOKS (reset on project change via key)
  // ============================================================

  const backlog = useBacklogDB(projectPath);
  const aiSuggestions = useAIBacklogSuggestions(backlog.allItems, projectPath);
  const { templates } = useTemplates(projectPath, backlog.projectId ?? null);
  const { t } = useTranslation();
  const featureTooltips = useFeatureTooltips();

  const selectableItemIds = useMemo(
    () => backlog.filteredItems.map(i => i.id),
    [backlog.filteredItems]
  );
  const multiSelect = useMultiSelect({ itemIds: selectableItemIds });

  // Extracted hooks
  const modals = useWorkspaceModals();
  const itemActions = useWorkspaceItemActions({ backlog, modals, screenshotFolder, projectPath, t });
  const bulkOps = useWorkspaceBulkOps({ backlog, modals, multiSelect, projectPath, screenshotFolder });
  useWorkspaceTypeSync({ backlog, typeConfig, projectPath });

  // ============================================================
  // HANDLERS REMAINING IN COMPONENT
  // ============================================================

  // handleUpdateItem stays here because it uses featureTooltips + tooltip setters
  const [showInlineTooltip, setShowInlineTooltip] = useState(false);
  const handleUpdateItem = useCallback(async (itemId: string, updates: Partial<BacklogItem>) => {
    if (featureTooltips.shouldShow('inlineEdit')) {
      setShowInlineTooltip(true);
      featureTooltips.markSeen('inlineEdit');
      setTimeout(() => setShowInlineTooltip(false), 3000);
    }
    await backlog.updateItemById(itemId, updates);
  }, [backlog, featureTooltips]);

  // Chat panel
  const handleChatOpenItemById = useCallback((itemId: string) => {
    const item = backlog.allItems.find(i => i.id === itemId);
    if (item) backlog.selectItem(item);
  }, [backlog]);

  const handleChatAddRelation = useCallback(async (
    sourceId: string, targetId: string, relationType: string, reason?: string
  ) => {
    const pid = backlog.projectId;
    if (pid === null || pid === undefined) return;
    const { addRelation: dbAddRelation } = await import('../../db/queries/relations');
    await dbAddRelation(projectPath, pid, sourceId, targetId,
      relationType as 'blocks' | 'blocked-by' | 'related-to', undefined, reason);
  }, [projectPath, backlog.projectId]);

  const chatPanel = useChatPanel({
    projectPath, projectId: backlog.projectId ?? null, items: backlog.allItems,
    locale: (localStorage.getItem(STORAGE_KEYS.LOCALE) as 'fr' | 'en') || 'fr',
    onUpdateItem: handleUpdateItem, onOpenItem: handleChatOpenItemById,
    onAddRelation: handleChatAddRelation,
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleChatToggle = useCallback(() => setIsChatOpen(prev => !prev), []);

  useEffect(() => {
    if (isChatOpen && backlog.projectId) chatPanel.loadHistory();
  }, [isChatOpen, backlog.projectId, chatPanel.loadHistory]);

  // Telemetry: project_opened fires once after data loads
  const hasFiredProjectOpened = useRef(false);
  useEffect(() => {
    if (!backlog.isLoading && !hasFiredProjectOpened.current) {
      hasFiredProjectOpened.current = true;
      track('project_opened', { has_items: backlog.allItems.length > 0, item_count: backlog.allItems.length });
    }
  }, [backlog.isLoading, backlog.allItems.length]);

  useQuickCapture(projectPath, () => modals.setIsQuickCaptureOpen(true));

  const savedViewsHook = useSavedViews(projectPath, backlog.projectId ?? null, t);

  useEffect(() => {
    multiSelect.clearSelection();
  }, [backlog.viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relations version (triggers DependencyGraph refresh)
  const [relationsVersion, setRelationsVersion] = useState(0);
  const handleRelationsChange = useCallback(() => setRelationsVersion(v => v + 1), []);

  // ============================================================
  // FEATURE TOOLTIPS
  // ============================================================

  const [showPaletteTooltip, setShowPaletteTooltip] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showDragTooltip, setShowDragTooltip] = useState(false);

  useEffect(() => {
    if (modals.isPaletteOpen && featureTooltips.shouldShow('commandPalette')) setShowPaletteTooltip(true);
  }, [modals.isPaletteOpen, featureTooltips]);

  useEffect(() => {
    if (isChatOpen && featureTooltips.shouldShow('chatPanel')) setShowChatTooltip(true);
  }, [isChatOpen, featureTooltips]);

  // ============================================================
  // NAVIGATION & SETTINGS HANDLERS
  // ============================================================

  const handleItemClick = useCallback((item: BacklogItem) => {
    addRecentItem(projectPath, item.id);
    backlog.selectItem(item);
  }, [backlog, projectPath]);

  const handleCloseDetail = useCallback(() => backlog.selectItem(null), [backlog]);

  const handleToggleCriterion = useCallback((itemId: string, criterionIndex: number) => {
    backlog.toggleItemCriterion(itemId, criterionIndex);
  }, [backlog]);

  const handleMoveItem = useCallback((itemId: string, targetType: string) => {
    if (featureTooltips.shouldShow('dragDrop')) {
      setShowDragTooltip(true);
      featureTooltips.markSeen('dragDrop');
      setTimeout(() => setShowDragTooltip(false), 3000);
    }
    backlog.moveItemToType(itemId, targetType);
  }, [backlog, featureTooltips]);

  const handleOpenSettings = useCallback(() => { track('settings_opened', { panel: 'app' }); onOpenSettings(); }, [onOpenSettings]);
  const handleOpenAISettings = useCallback(() => { track('settings_opened', { panel: 'ai' }); onOpenAISettings(); }, [onOpenAISettings]);
  const handleOpenTypeConfig = useCallback(() => { track('settings_opened', { panel: 'type_config' }); onOpenTypeConfig(); }, [onOpenTypeConfig]);
  const handleOpenProjectSettings = useCallback(() => { track('settings_opened', { panel: 'project' }); onOpenProjectSettings(); }, [onOpenProjectSettings]);

  const handleViewModeChange = useCallback((mode: Parameters<typeof backlog.setViewMode>[0]) => {
    track('view_switched', { to: mode });
    backlog.setViewMode(mode);
  }, [backlog]);

  const handleApplyView = useCallback((filters: BacklogFilters) => backlog.setFilters(filters), [backlog]);
  const handleSaveView = useCallback((name: string) => savedViewsHook.saveCurrentView(name, backlog.filters), [savedViewsHook, backlog.filters]);
  const handleDeleteView = useCallback((viewId: number) => savedViewsHook.deleteView(viewId), [savedViewsHook]);

  // ============================================================
  // KEYBOARD SHORTCUT HANDLERS
  // ============================================================

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const items = backlog.filteredItems;
    if (!items.length) return;
    const current = backlog.selectedItem;
    if (!current) { backlog.selectItem(items[0]); return; }
    const idx = items.findIndex(i => i.id === current.id);
    if (idx === -1) { backlog.selectItem(items[0]); return; }
    const next = direction === 'down' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    backlog.selectItem(items[next]);
  }, [backlog]);

  const handleCyclePriority = useCallback(async () => {
    const item = backlog.selectedItem;
    if (!item || item.type === 'BUG') return;
    const cycle: (Priority | undefined)[] = ['Haute', 'Moyenne', 'Faible', undefined];
    const next = cycle[(cycle.indexOf(item.priority) + 1) % cycle.length];
    await backlog.updateItemById(item.id, { priority: next });
    modals.setQuickActionToast(`${t.editor.priority}: ${next ? t.priority[next] : t.bulk.noPriority}`);
    setTimeout(() => modals.setQuickActionToast(null), 1500);
  }, [backlog, modals, t]);

  const handleCycleEffort = useCallback(async () => {
    const item = backlog.selectedItem;
    if (!item) return;
    const cycle: (Effort | undefined)[] = ['XS', 'S', 'M', 'L', 'XL', undefined];
    const next = cycle[(cycle.indexOf(item.effort) + 1) % cycle.length];
    await backlog.updateItemById(item.id, { effort: next });
    modals.setQuickActionToast(`${t.editor.effort}: ${next ?? t.bulk.noEffort}`);
    setTimeout(() => modals.setQuickActionToast(null), 1500);
  }, [backlog, modals, t]);

  // ============================================================
  // COMMAND PALETTE & SHORTCUTS WIRING
  // ============================================================

  const workspaceActions: WorkspaceActions = useMemo(() => ({
    createItem: itemActions.handleCreateItem,
    setView: handleViewModeChange,
    openSettings: handleOpenSettings,
    openTypeConfig: handleOpenTypeConfig,
    toggleAIPanel: () => modals.setIsAIAnalysisPanelOpen(prev => !prev),
    showHelp: () => modals.setIsHelpModalOpen(true),
    undo: backlog.undo,
    redo: backlog.redo,
    quickCapture: () => { if (!isTauri()) modals.setIsQuickCaptureOpen(true); },
    openBulkImport: itemActions.handleOpenBulkImport,
  }), [itemActions.handleCreateItem, handleViewModeChange, handleOpenSettings,
       handleOpenTypeConfig, backlog.undo, backlog.redo, itemActions.handleOpenBulkImport, modals]);

  const palette = useWorkspacePalette({
    backlog, typeConfig, modals, projectPath, t, workspaceActions,
  });

  const hasOpenModal = modals.isEditorOpen || modals.isHelpModalOpen ||
    modals.archiveConfirmModal.isOpen || modals.deleteConfirmModal.isOpen ||
    modals.bulkDeleteConfirm || modals.bulkArchiveConfirm || modals.isAIAnalysisPanelOpen ||
    (modals.exportModal?.isOpen ?? false) ||
    modals.isPaletteOpen || modals.isQuickCaptureOpen || modals.isBulkImportOpen;

  const shortcutContext = useMemo(() => ({
    hasOpenModal,
    hasSelection: backlog.selectedItem !== null,
  }), [hasOpenModal, backlog.selectedItem]);

  const shortcutActions = useMemo(() => [
    { ...SHORTCUTS.COMMAND_PALETTE, handler: palette.handlePaletteToggle },
    { ...SHORTCUTS.CHAT_PANEL, handler: handleChatToggle },
    { ...SHORTCUTS.QUICK_CAPTURE, handler: () => { if (!isTauri()) modals.setIsQuickCaptureOpen(true); } },
    { ...SHORTCUTS.BULK_IMPORT, handler: itemActions.handleOpenBulkImport },
    { ...SHORTCUTS.NEW_ITEM, handler: itemActions.handleCreateItem },
    { ...SHORTCUTS.NAVIGATE_UP, handler: () => handleNavigate('up') },
    { ...SHORTCUTS.NAVIGATE_DOWN, handler: () => handleNavigate('down') },
    { ...SHORTCUTS.SHOW_HELP, handler: () => modals.setIsHelpModalOpen(true) },
    { ...SHORTCUTS.CLOSE_PANEL, handler: () => {
      if (multiSelect.hasSelection) multiSelect.clearSelection();
      else handleCloseDetail();
    }},
    { ...SHORTCUTS.EDIT_ITEM, handler: () => { if (backlog.selectedItem) itemActions.handleEditItem(backlog.selectedItem); } },
    { ...SHORTCUTS.DELETE_ITEM, handler: () => { if (backlog.selectedItem) itemActions.handleDeleteRequest(backlog.selectedItem); } },
    { ...SHORTCUTS.ARCHIVE_ITEM, handler: () => { if (backlog.selectedItem) itemActions.handleArchiveItem(backlog.selectedItem); } },
    { ...SHORTCUTS.UNDO, handler: backlog.undo },
    { ...SHORTCUTS.REDO, handler: backlog.redo },
    { ...SHORTCUTS.SELECT_ALL, handler: multiSelect.selectAll },
    { ...SHORTCUTS.CYCLE_PRIORITY, handler: handleCyclePriority },
    { ...SHORTCUTS.CYCLE_EFFORT, handler: handleCycleEffort },
    { ...SHORTCUTS.VIEW_KANBAN, handler: () => handleViewModeChange('kanban') },
    { ...SHORTCUTS.VIEW_LIST, handler: () => handleViewModeChange('list') },
    { ...SHORTCUTS.VIEW_GRAPH, handler: () => handleViewModeChange('graph') },
    { ...SHORTCUTS.VIEW_DASHBOARD, handler: () => handleViewModeChange('dashboard') },
  ], [palette.handlePaletteToggle, handleChatToggle, itemActions, handleNavigate,
      handleCloseDetail, handleCyclePriority, handleCycleEffort, backlog, handleViewModeChange,
      multiSelect.hasSelection, multiSelect.clearSelection, multiSelect.selectAll, modals]);

  useGlobalShortcuts(shortcutActions, shortcutContext);

  // ============================================================
  // MEMOIZED VALUES
  // ============================================================

  const screenshotOps: ScreenshotOperations = useMemo(() => ({
    isReady: screenshotFolder.isReady,
    needsPermission: screenshotFolder.needsPermission,
    isProcessing: screenshotFolder.isProcessing,
    onRequestAccess: screenshotFolder.requestFolderAccess,
    saveBlob: screenshotFolder.saveScreenshotBlob,
    importFile: screenshotFolder.importScreenshotFile,
    getUrl: screenshotFolder.getScreenshotUrl,
    deleteFile: screenshotFolder.deleteScreenshotFile,
  }), [screenshotFolder.isReady, screenshotFolder.needsPermission, screenshotFolder.isProcessing,
       screenshotFolder.requestFolderAccess, screenshotFolder.saveScreenshotBlob,
       screenshotFolder.importScreenshotFile, screenshotFolder.getScreenshotUrl,
       screenshotFolder.deleteScreenshotFile]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        projectName={getFolderName(projectPath)}
        isLoading={backlog.isLoading}
        viewMode={backlog.viewMode}
        hasProject={true}
        onOpenFile={() => {}}
        onViewModeChange={handleViewModeChange}
        onOpenProjectSettings={handleOpenProjectSettings}
        onOpenAISettings={handleOpenAISettings}
        showAISettingsBadge={!hasApiKey(getProvider())}
        onGoHome={onGoHome}
        canUndo={backlog.canUndo}
        canRedo={backlog.canRedo}
        onUndo={backlog.undo}
        onRedo={backlog.redo}
      />

      {/* Fixed bottom toolbar (hidden in archive mode) */}
      {backlog.viewMode !== 'archive' && (
        <div className="fixed bottom-4 right-4 flex items-center gap-1 z-30 bg-surface border border-outline rounded-lg shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline p-1">
          <button onClick={itemActions.handleCreateItem} className="p-2.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors" title={t.common.createNewItem}>
            <PlusIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-outline mx-0.5" />
          <button onClick={itemActions.handleOpenBulkImport} className="p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors" title={`${t.bulkImport.title} (Ctrl+Shift+I)`}>
            <UploadIcon className="w-4.5 h-4.5" />
          </button>
          <button onClick={() => modals.setIsAIAnalysisPanelOpen(true)} className="relative p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors" title={t.common.aiAnalysis}>
            <SparklesIcon className="w-4.5 h-4.5" />
            {aiSuggestions.analysis && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-surface" />}
          </button>
          <div className="relative">
            <button onClick={handleChatToggle} className={`relative p-2.5 rounded-md transition-colors ${isChatOpen ? 'bg-accent text-white' : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'}`} title={`${t.chat.title} (Ctrl+J)`}>
              <ChatIcon className="w-4.5 h-4.5" />
            </button>
            <FeatureTooltip visible={showChatTooltip} message={t.featureTooltips.chatPanel} position="left" onDismiss={() => { setShowChatTooltip(false); featureTooltips.markSeen('chatPanel'); }} />
          </div>
          <button onClick={handleOpenTypeConfig} className="p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors" title={t.common.configureTypes}>
            <TagIcon className="w-4.5 h-4.5" />
          </button>
          <button onClick={handleOpenSettings} className="relative p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors" title={t.common.parameters}>
            <SettingsIcon className="w-4.5 h-4.5" />
            {showUpdateBadge && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-surface animate-pulse" />}
          </button>
        </div>
      )}

      {/* Main layout: chat side panel + workspace content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatPanel.messages}
          state={chatPanel.state}
          error={chatPanel.error}
          items={backlog.allItems}
          onSend={chatPanel.send}
          onClear={chatPanel.clear}
          onOpenItem={(item: BacklogItem) => backlog.selectItem(item)}
          suggestions={chatPanel.suggestions}
          onSendSuggestion={chatPanel.sendSuggestion}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Filter bar (hidden in dashboard / archive mode) */}
          {backlog.viewMode !== 'dashboard' && backlog.viewMode !== 'archive' && (
            <div className="relative">
              <FilterBar
                filters={backlog.filters}
                totalCount={backlog.allItems.length}
                filteredCount={backlog.filteredItems.length}
                types={typeConfig.sortedTypes}
                onFiltersChange={backlog.setFilters}
                onToggleTypeVisibility={typeConfig.toggleTypeVisibility}
                onReset={backlog.resetFilters}
                savedViews={savedViewsHook.savedViews}
                defaultViews={savedViewsHook.defaultViews}
                onApplyView={handleApplyView}
                onSaveView={handleSaveView}
                onDeleteView={handleDeleteView}
                t={t}
              />
              <FeatureTooltip visible={showPaletteTooltip} message={t.featureTooltips.commandPalette} position="bottom" onDismiss={() => { setShowPaletteTooltip(false); featureTooltips.markSeen('commandPalette'); }} />
            </div>
          )}

          {/* View */}
          <div className="relative flex-1 min-h-0 overflow-auto">
            {backlog.viewMode === 'archive' && backlog.projectId ? (
              <ArchiveTab projectPath={projectPath} projectId={backlog.projectId} onRestore={itemActions.handleRestoreFromArchive} onDeletePermanently={itemActions.handleDeleteFromArchive} onPurgeArchive={itemActions.handlePurgeArchive} />
            ) : backlog.viewMode === 'dashboard' && backlog.projectId ? (
              <AnalyticsDashboard projectPath={projectPath} projectId={backlog.projectId} />
            ) : backlog.viewMode === 'graph' && backlog.projectId ? (
              <DependencyGraph projectPath={projectPath} projectId={backlog.projectId} items={backlog.allItems} onSelectItem={handleItemClick} relationsVersion={relationsVersion} />
            ) : backlog.viewMode === 'kanban' ? (
              <KanbanBoard
                itemsByType={backlog.itemsByType}
                types={typeConfig.sortedTypes}
                onItemClick={handleItemClick}
                onTypesReorder={typeConfig.reorderTypesAtIndex}
                onMoveItem={handleMoveItem}
                projectPath={projectPath}
                getItemScore={aiSuggestions.analysis ? aiSuggestions.getItemScore : undefined}
                getBlockingInfo={aiSuggestions.analysis ? aiSuggestions.getBlockingInfo : undefined}
                onInlineUpdate={handleUpdateItem}
                isSelected={multiSelect.isSelected}
                onSelectionClick={multiSelect.handleSelectionClick}
                onQuickDelete={itemActions.handleDeleteRequest}
                onQuickValidate={itemActions.handleQuickValidate}
                onQuickExport={itemActions.handleQuickExport}
                onQuickArchive={itemActions.handleArchiveItem}
              />
            ) : (
              <ListView
                items={backlog.filteredItems}
                onItemClick={handleItemClick}
                getItemScore={aiSuggestions.analysis ? aiSuggestions.getItemScore : undefined}
                getBlockingInfo={aiSuggestions.analysis ? aiSuggestions.getBlockingInfo : undefined}
                onInlineUpdate={handleUpdateItem}
                isSelected={multiSelect.isSelected}
                onSelectionClick={multiSelect.handleSelectionClick}
                onQuickDelete={itemActions.handleDeleteRequest}
                onQuickValidate={itemActions.handleQuickValidate}
                onQuickExport={itemActions.handleQuickExport}
                onQuickArchive={itemActions.handleArchiveItem}
              />
            )}
            <FeatureTooltip visible={showInlineTooltip} message={t.featureTooltips.inlineEdit} position="top" onDismiss={() => setShowInlineTooltip(false)} />
            <FeatureTooltip visible={showDragTooltip} message={t.featureTooltips.dragDrop} position="top" onDismiss={() => setShowDragTooltip(false)} />
          </div>

        </div>
      </div>

      {/* Detail panel */}
      <ItemDetailPanel
        item={backlog.selectedItem}
        onClose={handleCloseDetail}
        onToggleCriterion={handleToggleCriterion}
        onUpdate={handleUpdateItem}
        onEdit={itemActions.handleEditItem}
        onDeleteRequest={itemActions.handleDeleteRequest}
        onArchive={itemActions.handleArchiveItem}
        onExport={itemActions.handleExportItem}
        getScreenshotUrl={screenshotFolder.isReady ? screenshotFolder.getScreenshotUrl : undefined}
        projectPath={projectPath}
        items={backlog.allItems}
        projectId={backlog.projectId}
        typeConfigs={typeConfig.sortedTypes}
        onRelationsChange={handleRelationsChange}
      />

      {/* Error display (from backlog hook) */}
      {backlog.error && (
        <div className="fixed bottom-4 left-4 right-24 bg-danger-soft border border-danger text-danger-text px-4 py-3 rounded-lg z-[100]">
          {backlog.error}
        </div>
      )}

      {/* Bulk action bar */}
      {multiSelect.selectedCount > 0 && (
        <BulkActionBar
          selectedCount={multiSelect.selectedCount}
          onClearSelection={multiSelect.clearSelection}
          onBulkPriority={bulkOps.handleBulkPriority}
          onBulkEffort={bulkOps.handleBulkEffort}
          onBulkType={bulkOps.handleBulkType}
          onBulkValidate={bulkOps.handleBulkValidate}
          onBulkArchive={bulkOps.handleBulkArchiveRequest}
          onBulkDelete={bulkOps.handleBulkDeleteRequest}
          types={typeConfig.sortedTypes}
        />
      )}

      {/* All modals, dialogs, palette, quick capture, toasts */}
      <WorkspaceDialogs
        modals={modals}
        itemActions={itemActions}
        bulkOps={bulkOps}
        aiSuggestions={aiSuggestions}
        backlogAllItems={backlog.allItems}
        backlogProjectId={backlog.projectId}
        backlogReload={backlog.reload}
        backlogExistingIds={backlog.existingIds}
        sortedTypes={typeConfig.sortedTypes}
        screenshotOps={screenshotOps}
        projectPath={projectPath}
        templates={templates}
        selectedCount={multiSelect.selectedCount}
        nlCommand={palette.nlCommand}
        paletteResults={palette.paletteResults}
        recentResults={palette.recentResults}
        handlePaletteExecute={palette.handlePaletteExecute}
        handlePaletteClose={palette.handlePaletteClose}
        t={t}
      />
    </div>
  );
}

// ============================================================
// EXPORTS
// ============================================================

export type { UseBacklogDBReturn } from '../../hooks/useBacklogDB';
