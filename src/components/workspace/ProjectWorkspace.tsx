/**
 * ProjectWorkspace - Keyed boundary for project state isolation
 *
 * When rendered with key={projectPath}, React completely destroys and
 * recreates this component tree when the key changes. This guarantees
 * no state leakage between projects.
 *
 * ALL project-specific hooks MUST be inside this component:
 * - useBacklogDB(projectPath)
 * - useAIBacklogSuggestions(items, projectPath)
 *
 * @module components/workspace/ProjectWorkspace
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useBacklogDB, type BacklogFilters } from '../../hooks/useBacklogDB';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import { useTemplates } from '../../hooks/useTemplates';
import { useAIBacklogSuggestions } from '../../hooks/useAIBacklogSuggestions';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useChatPanel } from '../../hooks/useChatPanel';
import { useCommandSearch } from '../../hooks/useCommandSearch';
import { useQuickCapture } from '../../hooks/useQuickCapture';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useFeatureTooltips } from '../../hooks/useFeatureTooltips';
import { SHORTCUTS } from '../../constants/shortcuts';
import { useTranslation } from '../../i18n';
import { Header } from '../layout/Header';
import { FilterBar } from '../filter/FilterBar';
import { ListView } from '../list/ListView';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { ItemDetailPanel } from '../detail/ItemDetailPanel';
import { ItemEditorModal, type ItemFormData, type ScreenshotOperations } from '../editor/ItemEditorModal';
import { ExportModal } from '../export/ExportModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { BulkActionBar } from '../ui/BulkActionBar';
import { AIAnalysisPanel } from '../ai/AIAnalysisPanel';
import { DependencyGraph } from '../relations/DependencyGraph';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { ArchiveTab } from '../archive/ArchiveTab';
import { ShortcutHelpModal } from '../shortcuts/ShortcutHelpModal';
import { CommandPalette, type PaletteResult } from '../palette/CommandPalette';
import { ChatPanel } from '../chat/ChatPanel';
import { QuickCapture } from '../capture/QuickCapture';
import { BulkImportWizard } from '../import/BulkImportWizard';
import { FeatureTooltip } from '../onboarding/FeatureTooltip';
import { PlusIcon, SparklesIcon, ChatIcon, TagIcon, SettingsIcon, UploadIcon } from '../ui/Icons';
import { buildItemMarkdown } from '../../lib/serializer';
import { getStaticCommands, buildItemCommands, parseNLCommand, addRecentItem, getRecentItemIds, type WorkspaceActions } from '../../lib/command-registry';
import { isTauri, getFolderName } from '../../lib/tauri-bridge';
import { insertArchivedItem, deleteArchivedItem, getArchivedScreenshotFilenames, getArchivedItemScreenshots, purgeAllArchivedItems } from '../../db/queries/archive';
import { deleteItem as dbDeleteItemDirect, updateItem as dbUpdateItemDirect } from '../../db/queries/items';
import { bulkUpsertTypeConfigs, deleteTypeConfig } from '../../db/queries/type-configs';
import { getAllSections, deleteSection as dbDeleteSection } from '../../db/queries/sections';
import type { ArchivedItem } from '../../db/transforms';
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
  onGoHome,
  showUpdateBadge,
}: ProjectWorkspaceProps) {
  // ============================================================
  // PROJECT-SPECIFIC HOOKS (reset on project change via key)
  // ============================================================

  // Backlog state (SQLite-backed) - loads from DB when projectPath changes
  const backlog = useBacklogDB(projectPath);

  // AI Analysis - resets completely on project change
  const aiSuggestions = useAIBacklogSuggestions(backlog.allItems, projectPath);

  // Templates - seeds built-ins and loads for current project
  const { templates } = useTemplates(projectPath, backlog.projectId ?? null);

  // Translations
  const { t } = useTranslation();

  // Feature Tooltips (progressive disclosure for first-time features)
  const featureTooltips = useFeatureTooltips();

  // Multi-select for bulk operations
  const selectableItemIds = useMemo(
    () => backlog.filteredItems.map(i => i.id),
    [backlog.filteredItems]
  );
  const multiSelect = useMultiSelect({ itemIds: selectableItemIds });

  // Handle update item (for AI refinement, detail panel, and chat actions)
  const handleUpdateItem = useCallback(async (itemId: string, updates: Partial<BacklogItem>) => {
    // Track first inline edit (when called from KanbanCard/ListView inline editors)
    if (featureTooltips.shouldShow('inlineEdit')) {
      setShowInlineTooltip(true);
      featureTooltips.markSeen('inlineEdit');
      // Auto-dismiss after showing briefly
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
    sourceId: string,
    targetId: string,
    relationType: string,
    reason?: string
  ) => {
    const pid = backlog.projectId;
    if (pid === null || pid === undefined) return;
    const { addRelation: dbAddRelation } = await import('../../db/queries/relations');
    await dbAddRelation(
      projectPath,
      pid,
      sourceId,
      targetId,
      relationType as 'blocks' | 'blocked-by' | 'related-to',
      undefined,
      reason
    );
  }, [projectPath, backlog.projectId]);

  const chatPanel = useChatPanel({
    projectPath,
    projectId: backlog.projectId ?? null,
    items: backlog.allItems,
    locale: (localStorage.getItem('ticketflow-locale') as 'fr' | 'en') || 'fr',
    onUpdateItem: handleUpdateItem,
    onOpenItem: handleChatOpenItemById,
    onAddRelation: handleChatAddRelation,
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleChatToggle = useCallback(() => {
    setIsChatOpen(prev => !prev);
  }, []);

  // Load chat history when panel opens
  useEffect(() => {
    if (isChatOpen && backlog.projectId) {
      chatPanel.loadHistory();
    }
  }, [isChatOpen, backlog.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Type Config ↔ SQLite sync ----
  // SQLite is the source of truth for types. On mount, we sync DB → typeConfig hook.
  // After that, user changes in typeConfig are persisted back to SQLite.
  //
  // KEY DESIGN DECISION: We track the "DB snapshot" of types to distinguish between
  // "sortedTypes changed because we loaded from DB" (don't persist) vs.
  // "sortedTypes changed because user edited" (persist).
  const prevTypesRef = useRef<Set<string>>(new Set());
  const typesInitFromDbRef = useRef(false);
  // Serialized snapshot of types loaded from DB — used to skip no-op persists
  const dbSnapshotRef = useRef<string>('');

  // Step 1: When DB finishes loading, sync SQLite types → typeConfig hook
  // CRITICAL: depends on both projectId AND typeConfigs because React may
  // deliver them in separate render batches (they're set across await boundaries
  // in useBacklogDB.loadFromDB). Without typeConfigs in deps, this effect would
  // only fire on the projectId render, see empty typeConfigs, and never re-fire.
  useEffect(() => {
    if (backlog.projectId && backlog.typeConfigs && backlog.typeConfigs.length > 0) {
      // Avoid re-initializing if we already synced from DB for this mount
      if (typesInitFromDbRef.current) {
        return;
      }
      // SQLite types are the source of truth — override any defaults
      const dbTypes = backlog.typeConfigs.map((c, i) => ({
        id: c.id,
        label: c.label,
        color: c.color,
        order: c.order ?? i,
        visible: c.visible !== false,
      }));
      typeConfig.initializeWithTypes(projectPath, dbTypes);
      // Seed the prev-tracker so the persistence effect doesn't see false deletions
      prevTypesRef.current = new Set(backlog.typeConfigs.map(t => t.id));
      typesInitFromDbRef.current = true;
      // Snapshot what sortedTypes will look like after initializeWithTypes.
      // initializeWithTypes re-indexes order to sequential 0, 1, 2... so we
      // replicate that here to ensure the snapshot matches sortedTypes exactly.
      dbSnapshotRef.current = JSON.stringify(
        [...dbTypes]
          .map((t, i) => ({ ...t, order: i }))
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(t => ({ id: t.id, label: t.label, color: t.color, visible: t.visible, order: t.order }))
      );
    }
  }, [backlog.projectId, backlog.typeConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Persist type config changes to SQLite (only after DB sync)
  useEffect(() => {
    // Don't persist until we've synced from SQLite
    if (!backlog.projectId || !typesInitFromDbRef.current) {
      return;
    }

    const currentTypeIds = new Set(typeConfig.sortedTypes.map(t => t.id));
    const currentSnapshot = JSON.stringify(
      [...typeConfig.sortedTypes]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(t => ({ id: t.id, label: t.label, color: t.color, visible: t.visible, order: t.order }))
    );

    // Skip if types match what was just loaded from DB (no user changes yet)
    if (currentSnapshot === dbSnapshotRef.current) {
      // Still update prevTypesRef to track the baseline
      prevTypesRef.current = currentTypeIds;
      return;
    }

    const prevTypeIds = prevTypesRef.current;

    // Detect deleted types (were in prev, not in current)
    const deletedTypeIds = Array.from(prevTypeIds).filter(id => !currentTypeIds.has(id));

    // Persist changes asynchronously
    (async () => {
      try {
        // Delete removed types from SQLite + clean up orphaned sections
        if (deletedTypeIds.length > 0) {
          const sections = await getAllSections(projectPath, backlog.projectId!);
          const deletedSet = new Set(deletedTypeIds.map(id => id.toUpperCase()));

          for (const typeId of deletedTypeIds) {
            await deleteTypeConfig(projectPath, backlog.projectId!, typeId);
          }

          // Remove empty sections whose title matches a deleted type
          for (const section of sections) {
            const normalizedTitle = section.title.toUpperCase().replace(/\s+/g, '_');
            if (deletedSet.has(normalizedTitle) || deletedSet.has(section.title.toUpperCase())) {
              await dbDeleteSection(projectPath, section.id);
            }
          }
        }

        // Upsert all current types (handles additions and updates)
        if (typeConfig.sortedTypes.length > 0) {
          await bulkUpsertTypeConfigs(
            projectPath,
            backlog.projectId!,
            typeConfig.sortedTypes.map(t => ({
              id: t.id,
              label: t.label,
              color: t.color,
              order: t.order,
              visible: t.visible,
            }))
          );
        }

        // Update DB snapshot after successful persist so future loads match
        dbSnapshotRef.current = currentSnapshot;
      } catch (error) {
        console.error('[ProjectWorkspace] Failed to persist type config changes:', error);
      }
    })();

    // Update ref for next comparison
    prevTypesRef.current = currentTypeIds;
  }, [projectPath, backlog.projectId, typeConfig.sortedTypes]);

  // Quick Capture (Tauri global shortcut + web fallback)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  useQuickCapture(projectPath, () => setIsQuickCaptureOpen(true));

  // Bulk Import Wizard
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Saved Views (persistent filter views)
  const savedViewsHook = useSavedViews(projectPath, backlog.projectId ?? null, t);

  // Clear selection when view mode changes
  useEffect(() => {
    multiSelect.clearSelection();
  }, [backlog.viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // PROJECT-SPECIFIC UI STATE (reset on project change via key)
  // ============================================================

  const [relationsVersion, setRelationsVersion] = useState(0);
  const handleRelationsChange = useCallback(() => {
    setRelationsVersion(v => v + 1);
  }, []);

  const [isAIAnalysisPanelOpen, setIsAIAnalysisPanelOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

  // FIX BUG-002: Store only itemId, generate content at render time
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    itemId: string;
  } | null>(null);

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

  // Operation guards to prevent double-click
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Shortcut help modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Quick action toast (brief feedback for priority/effort cycling)
  const [quickActionToast, setQuickActionToast] = useState<string | null>(null);

  // Bulk delete confirmation state
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  // Bulk archive confirmation state
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [idsToArchive, setIdsToArchive] = useState<string[]>([]);

  // Command palette state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // ============================================================
  // FEATURE TOOLTIPS (progressive disclosure)
  // ============================================================

  // Tooltip visibility state
  const [showPaletteTooltip, setShowPaletteTooltip] = useState(false);
  const [showChatTooltip, setShowChatTooltip] = useState(false);
  const [showInlineTooltip, setShowInlineTooltip] = useState(false);
  const [showDragTooltip, setShowDragTooltip] = useState(false);

  // Detect first-time command palette usage
  useEffect(() => {
    if (isPaletteOpen && featureTooltips.shouldShow('commandPalette')) {
      setShowPaletteTooltip(true);
    }
  }, [isPaletteOpen, featureTooltips]);

  // Detect first-time chat panel usage
  useEffect(() => {
    if (isChatOpen && featureTooltips.shouldShow('chatPanel')) {
      setShowChatTooltip(true);
    }
  }, [isChatOpen, featureTooltips]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // Handle item click (with recent tracking)
  const handleItemClick = useCallback((item: BacklogItem) => {
    addRecentItem(projectPath, item.id);
    backlog.selectItem(item);
  }, [backlog, projectPath]);

  // Handle close detail panel
  const handleCloseDetail = useCallback(() => {
    backlog.selectItem(null);
  }, [backlog]);

  // Handle criterion toggle
  const handleToggleCriterion = useCallback((itemId: string, criterionIndex: number) => {
    backlog.toggleItemCriterion(itemId, criterionIndex);
  }, [backlog]);

  // Handle cross-column drag & drop (move item to different type)
  const handleMoveItem = useCallback((itemId: string, targetType: string) => {
    // Track first drag-drop
    if (featureTooltips.shouldShow('dragDrop')) {
      setShowDragTooltip(true);
      featureTooltips.markSeen('dragDrop');
      // Auto-dismiss after showing briefly
      setTimeout(() => setShowDragTooltip(false), 3000);
    }

    backlog.moveItemToType(itemId, targetType);
  }, [backlog, featureTooltips]);

  // Handle create new item
  const handleCreateItem = useCallback(() => {
    setEditingItem(null);
    setIsEditorOpen(true);
  }, []);

  // Handle open bulk import wizard
  const handleOpenBulkImport = useCallback(() => {
    setIsBulkImportOpen(true);
  }, []);

  // Handle bulk import created (triggers backlog reload)
  const handleBulkImportCreated = useCallback(async () => {
    await backlog.reload();
  }, [backlog]);

  // Handle edit item (with recent tracking)
  const handleEditItem = useCallback((item: BacklogItem) => {
    addRecentItem(projectPath, item.id);
    setEditingItem(item);
    setIsEditorOpen(true);
    backlog.selectItem(null); // Close detail panel
  }, [backlog, projectPath]);

  // Handle archive item - open confirmation modal
  const handleArchiveItem = useCallback((item: BacklogItem) => {
    setArchiveConfirmModal({ isOpen: true, item });
  }, []);

  // Handle delete request - open confirmation modal
  const handleDeleteRequest = useCallback((item: BacklogItem) => {
    setDeleteConfirmModal({ isOpen: true, item });
  }, []);

  // Quick-004: Toggle validate/unvalidate all criteria on an item
  const handleQuickValidate = useCallback(async (item: BacklogItem) => {
    if (!item.criteria || item.criteria.length === 0) {
      // No criteria — validate by adding nothing, just show feedback
      setQuickActionToast(t.quickActions.validateToast);
      setTimeout(() => setQuickActionToast(null), 1500);
      return;
    }

    const allChecked = item.criteria.every(c => c.checked);

    if (allChecked) {
      // Toggle OFF: uncheck all criteria
      const updatedCriteria = item.criteria.map(c => ({ ...c, checked: false }));
      await backlog.updateItemById(item.id, { criteria: updatedCriteria });
      setQuickActionToast(t.quickActions.unvalidateToast);
    } else {
      // Toggle ON: check all criteria
      const updatedCriteria = item.criteria.map(c => ({ ...c, checked: true }));
      await backlog.updateItemById(item.id, { criteria: updatedCriteria });
      setQuickActionToast(t.quickActions.validateToast);
    }

    setTimeout(() => setQuickActionToast(null), 1500);
  }, [backlog, t]);

  // Quick-004: Export item Markdown to clipboard
  const handleQuickExport = useCallback(async (item: BacklogItem) => {
    const markdown = buildItemMarkdown(item);
    try {
      await navigator.clipboard.writeText(markdown);
      setQuickActionToast(t.quickActions.exportToast);
    } catch {
      setQuickActionToast(t.error.clipboardError);
    }
    setTimeout(() => setQuickActionToast(null), 1500);
  }, [t]);

  // Confirm delete item
  const confirmDeleteItem = useCallback(async () => {
    if (isDeleting) {
      return;
    }
    const item = deleteConfirmModal.item;
    setDeleteConfirmModal({ isOpen: false, item: null });

    if (!item) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete associated screenshots using actual filenames from item
      if (screenshotFolder.isReady && item.screenshots && item.screenshots.length > 0) {
        for (const screenshot of item.screenshots) {
          await screenshotFolder.deleteScreenshotFile(screenshot.filename);
        }
      }
      await backlog.deleteItem(item.id);
      backlog.selectItem(null);
    } catch (error) {
      console.error('[DEBUG-WS-DELETE] FAILED:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrorNotification(`${t.error.deletionFailed}: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmModal, backlog, screenshotFolder, isDeleting]);

  // Confirm archive item - saves to SQLite instead of markdown file
  const confirmArchive = useCallback(async () => {
    if (isArchiving) {
      return;
    }
    const item = archiveConfirmModal.item;
    setArchiveConfirmModal({ isOpen: false, item: null });

    if (!item || !backlog.projectId) {
      return;
    }

    setIsArchiving(true);
    try {
      // Insert into archived_items table (screenshots are kept in the archive)
      await insertArchivedItem(projectPath, item, backlog.projectId);

      // Remove from active backlog
      await backlog.deleteItem(item.id);
      backlog.selectItem(null);

      // Refresh archived IDs to keep existingIds accurate for ID generation
      await backlog.refreshArchivedIds();

    } catch (error) {
      console.error('[DEBUG-ARCHIVE] FAILED:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrorNotification(`${t.error.archivingFailed}: ${msg}`);
    } finally {
      setIsArchiving(false);
    }
  }, [archiveConfirmModal, backlog, projectPath, isArchiving]);

  // Restore archived item to backlog
  const handleRestoreFromArchive = useCallback(async (archivedItem: ArchivedItem) => {
    try {
      // Re-create the item in the backlog
      const restoredItem: BacklogItem = {
        id: archivedItem.id,
        type: archivedItem.type,
        title: archivedItem.title,
        emoji: archivedItem.emoji,
        component: archivedItem.component,
        module: archivedItem.module,
        severity: archivedItem.severity,
        priority: archivedItem.priority,
        effort: archivedItem.effort,
        description: archivedItem.description,
        userStory: archivedItem.userStory,
        specs: archivedItem.specs,
        criteria: archivedItem.criteria,
        screenshots: archivedItem.screenshots,
        rawMarkdown: '',
        sectionIndex: 0,
      };
      await backlog.addItem(restoredItem);
      await deleteArchivedItem(projectPath, archivedItem.id);
      // Refresh archived IDs to keep existingIds accurate for ID generation
      await backlog.refreshArchivedIds();
    } catch (error) {
      console.error('Failed to restore item:', error);
      setErrorNotification(t.error.restorationFailed);
    }
  }, [backlog, projectPath]);

  // Permanently delete archived item (+ its screenshots from disk)
  const handleDeleteFromArchive = useCallback(async (itemId: string) => {
    try {
      // Delete associated screenshot files from disk
      if (screenshotFolder.isReady) {
        const filenames = await getArchivedItemScreenshots(projectPath, itemId);
        for (const filename of filenames) {
          await screenshotFolder.deleteScreenshotFile(filename);
        }
      }
      await deleteArchivedItem(projectPath, itemId);
      // Refresh archived IDs to keep existingIds accurate for ID generation
      await backlog.refreshArchivedIds();
    } catch (error) {
      console.error('Failed to delete archived item:', error);
      setErrorNotification(t.error.deletionFailed);
    }
  }, [projectPath, screenshotFolder, backlog]);

  // Purge all archived items (+ their screenshots from disk)
  const handlePurgeArchive = useCallback(async () => {
    if (!backlog.projectId) return;
    try {
      // Collect all screenshot filenames from archived items
      if (screenshotFolder.isReady) {
        const filenames = await getArchivedScreenshotFilenames(projectPath, backlog.projectId);
        for (const filename of filenames) {
          await screenshotFolder.deleteScreenshotFile(filename);
        }
      }
      await purgeAllArchivedItems(projectPath, backlog.projectId);
      // Refresh archived IDs to keep existingIds accurate for ID generation
      await backlog.refreshArchivedIds();
    } catch (error) {
      console.error('Failed to purge archive:', error);
      setErrorNotification(t.error.purgeFailed);
    }
  }, [projectPath, backlog.projectId, screenshotFolder, backlog]);

  // Handle export item (for clipboard)
  // FIX BUG-002: Only store itemId, content is generated at render time in ExportModal
  const handleExportItem = useCallback((item: BacklogItem) => {
    setExportModal({
      isOpen: true,
      itemId: item.id,
    });
  }, []);

  // Handle save item (from editor modal)
  const handleSaveItem = useCallback(async (data: ItemFormData, isNew: boolean) => {
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

    try {
      if (isNew) {
        await backlog.addItem(item);
      } else {
        await backlog.updateItemById(item.id, item);
      }
    } catch (error) {
      console.error('[DEBUG-WS-SAVE] FAILED:', error);
      const errorMessage = error instanceof Error ? error.message : t.error.saveFailed;
      setErrorNotification(errorMessage);
      // Re-throw to prevent modal from closing
      throw error;
    }
  }, [backlog]);

  // ============================================================
  // SAVED VIEWS HANDLERS
  // ============================================================

  const handleApplyView = useCallback((filters: BacklogFilters) => {
    backlog.setFilters(filters);
  }, [backlog]);

  const handleSaveView = useCallback((name: string) => {
    savedViewsHook.saveCurrentView(name, backlog.filters);
  }, [savedViewsHook, backlog.filters]);

  const handleDeleteView = useCallback((viewId: number) => {
    savedViewsHook.deleteView(viewId);
  }, [savedViewsHook]);

  // ============================================================
  // KEYBOARD SHORTCUT HANDLERS
  // ============================================================

  // Navigate between items with arrow keys
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    const items = backlog.filteredItems;
    if (items.length === 0) return;

    const current = backlog.selectedItem;
    if (!current) {
      backlog.selectItem(items[0]);
      return;
    }

    const currentIndex = items.findIndex(i => i.id === current.id);
    if (currentIndex === -1) {
      backlog.selectItem(items[0]);
      return;
    }

    const nextIndex = direction === 'down'
      ? Math.min(currentIndex + 1, items.length - 1)
      : Math.max(currentIndex - 1, 0);

    backlog.selectItem(items[nextIndex]);
  }, [backlog]);

  // Cycle priority on selected item: Haute -> Moyenne -> Faible -> none
  const handleCyclePriority = useCallback(async () => {
    const item = backlog.selectedItem;
    if (!item || item.type === 'BUG') return; // BUGs use severity, not priority
    const cycle: (Priority | undefined)[] = ['Haute', 'Moyenne', 'Faible', undefined];
    const idx = cycle.indexOf(item.priority);
    const next = cycle[(idx + 1) % cycle.length];
    await backlog.updateItemById(item.id, { priority: next });
    setQuickActionToast(`${t.editor.priority}: ${next ? t.priority[next] : t.bulk.noPriority}`);
    setTimeout(() => setQuickActionToast(null), 1500);
  }, [backlog]);

  // Cycle effort on selected item: XS -> S -> M -> L -> XL -> none
  const handleCycleEffort = useCallback(async () => {
    const item = backlog.selectedItem;
    if (!item) return;
    const cycle: (Effort | undefined)[] = ['XS', 'S', 'M', 'L', 'XL', undefined];
    const idx = cycle.indexOf(item.effort);
    const next = cycle[(idx + 1) % cycle.length];
    await backlog.updateItemById(item.id, { effort: next });
    setQuickActionToast(`${t.editor.effort}: ${next ?? t.bulk.noEffort}`);
    setTimeout(() => setQuickActionToast(null), 1500);
  }, [backlog]);

  // ============================================================
  // BULK OPERATION HANDLERS
  // ============================================================

  // Retry helper: individual DB ops may hit SQLITE_BUSY from
  // fire-and-forget history saves on the connection pool.
  // No withTransaction — each op is atomic, retried independently.
  const retryOnBusy = useCallback(async <T,>(fn: () => Promise<T>, maxRetries = 5): Promise<T> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('database is locked') && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('retryOnBusy: unreachable');
  }, []);

  const handleBulkPriority = useCallback(async (priority: Priority | undefined) => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;
    for (const id of ids) {
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { priority }));
    }
    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect.selectedIdsArray, multiSelect.clearSelection, projectPath, backlog, retryOnBusy]);

  const handleBulkEffort = useCallback(async (effort: Effort | undefined) => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;
    for (const id of ids) {
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { effort }));
    }
    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect.selectedIdsArray, multiSelect.clearSelection, projectPath, backlog, retryOnBusy]);

  const handleBulkType = useCallback(async (type: string) => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;
    for (const id of ids) {
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { type }));
    }
    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect.selectedIdsArray, multiSelect.clearSelection, projectPath, backlog, retryOnBusy]);

  const handleBulkDeleteRequest = useCallback(() => {
    if (multiSelect.selectedCount > 0) {
      setIdsToDelete(multiSelect.selectedIdsArray);
      setBulkDeleteConfirm(true);
    }
  }, [multiSelect.selectedCount, multiSelect.selectedIdsArray]);

  const confirmBulkDelete = useCallback(async () => {
    setBulkDeleteConfirm(false);
    if (idsToDelete.length === 0) return;

    // Delete screenshots (filesystem ops, no DB contention)
    for (const id of idsToDelete) {
      const item = backlog.allItems.find(i => i.id === id);
      if (screenshotFolder.isReady && item?.screenshots && item.screenshots.length > 0) {
        for (const screenshot of item.screenshots) {
          await screenshotFolder.deleteScreenshotFile(screenshot.filename);
        }
      }
    }

    // Sequential deletes with retry — no transaction wrapper needed
    for (const id of idsToDelete) {
      await retryOnBusy(() => dbDeleteItemDirect(projectPath, id));
    }

    backlog.selectItem(null);
    multiSelect.clearSelection();
    setIdsToDelete([]);
    await backlog.reload();
  }, [idsToDelete, projectPath, backlog, screenshotFolder, multiSelect, retryOnBusy]);

  const handleBulkValidate = useCallback(async () => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;

    for (const id of ids) {
      const item = backlog.allItems.find(i => i.id === id);
      if (!item?.criteria?.length) continue;

      const allChecked = item.criteria.every(c => c.checked);
      const updatedCriteria = item.criteria.map(c => ({ ...c, checked: !allChecked }));
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { criteria: updatedCriteria }));
    }

    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect.selectedIdsArray, multiSelect.clearSelection, projectPath, backlog, retryOnBusy]);

  const handleBulkArchiveRequest = useCallback(() => {
    if (multiSelect.selectedCount > 0) {
      setIdsToArchive(multiSelect.selectedIdsArray);
      setBulkArchiveConfirm(true);
    }
  }, [multiSelect.selectedCount, multiSelect.selectedIdsArray]);

  const confirmBulkArchive = useCallback(async () => {
    setBulkArchiveConfirm(false);
    if (idsToArchive.length === 0 || !backlog.projectId) return;

    for (const id of idsToArchive) {
      const item = backlog.allItems.find(i => i.id === id);
      if (!item) continue;

      await retryOnBusy(() => insertArchivedItem(projectPath, item, backlog.projectId!));
      await retryOnBusy(() => dbDeleteItemDirect(projectPath, id));
    }

    backlog.selectItem(null);
    multiSelect.clearSelection();
    setIdsToArchive([]);
    await backlog.reload();
    await backlog.refreshArchivedIds();
  }, [idsToArchive, projectPath, backlog, multiSelect, retryOnBusy]);

  // ============================================================
  // COMMAND PALETTE WIRING
  // ============================================================

  const workspaceActions: WorkspaceActions = useMemo(() => ({
    createItem: handleCreateItem,
    setView: backlog.setViewMode,
    openSettings: onOpenSettings,
    openTypeConfig: onOpenTypeConfig,
    toggleAIPanel: () => setIsAIAnalysisPanelOpen(prev => !prev),
    showHelp: () => setIsHelpModalOpen(true),
    undo: backlog.undo,
    redo: backlog.redo,
    quickCapture: () => {
      if (isTauri()) {
        // In Tauri, the global shortcut hook handles opening the window
      } else {
        setIsQuickCaptureOpen(true);
      }
    },
    openBulkImport: handleOpenBulkImport,
  }), [handleCreateItem, backlog.setViewMode, onOpenSettings,
       onOpenTypeConfig, backlog.undo, backlog.redo, handleOpenBulkImport]);

  const allCommands = useMemo(() => {
    const staticCmds = getStaticCommands(t, workspaceActions);
    const itemCmds = buildItemCommands(backlog.allItems, (item) => {
      addRecentItem(projectPath, item.id);
      backlog.selectItem(item);
      setIsPaletteOpen(false);
      setPaletteQuery('');
    });
    return [...staticCmds, ...itemCmds];
  }, [t, workspaceActions, backlog, projectPath]);

  const { search: paletteSearch } = useCommandSearch(allCommands);

  const paletteResults: PaletteResult[] = useMemo(() => {
    if (!paletteQuery.trim()) return [];
    const results = paletteSearch(paletteQuery);
    return results.map(r => {
      const cmd = allCommands.find(c => c.id === r.id);
      return {
        id: r.id,
        label: r.label,
        category: r.category,
        shortcut: cmd?.shortcut,
        matchedTerms: r.queryTerms,
      };
    });
  }, [paletteQuery, paletteSearch, allCommands]);

  const recentResults: PaletteResult[] = useMemo(() => {
    const recentIds = getRecentItemIds(projectPath);
    if (recentIds.length === 0) return [];
    const results: PaletteResult[] = [];
    for (const id of recentIds) {
      const item = backlog.allItems.find(i => i.id === id);
      if (item) {
        results.push({
          id: `item:${item.id}`,
          label: `${item.id} ${item.emoji || ''} ${item.title}`.trim(),
          category: 'recent',
          matchedTerms: [],
        });
      }
    }
    return results;
  }, [projectPath, backlog.allItems]);

  const nlCommand = useMemo(() => {
    if (!paletteQuery.trim()) return undefined;
    const result = parseNLCommand(paletteQuery, typeConfig.sortedTypes, {
      createItemOfType: () => {
        setIsPaletteOpen(false);
        setPaletteQuery('');
        setEditingItem(null);
        setIsEditorOpen(true);
      },
      switchView: (view) => {
        backlog.setViewMode(view);
        setIsPaletteOpen(false);
        setPaletteQuery('');
      },
    });
    if (!result) return undefined;
    return { label: result.label, handler: result.handler };
  }, [paletteQuery, typeConfig.sortedTypes, backlog]);

  const handlePaletteExecute = useCallback((id: string) => {
    if (id === 'nl:command' && nlCommand) {
      nlCommand.handler();
      return;
    }
    const cmd = allCommands.find(c => c.id === id);
    if (cmd) {
      cmd.handler();
      setIsPaletteOpen(false);
      setPaletteQuery('');
    }
  }, [allCommands, nlCommand]);

  // Handle opening item from chat citation
  const handleChatOpenItem = useCallback((item: BacklogItem) => {
    backlog.selectItem(item);
  }, [backlog]);

  const handlePaletteClose = useCallback(() => {
    setIsPaletteOpen(false);
    setPaletteQuery('');
  }, []);

  const handlePaletteToggle = useCallback(() => {
    setIsPaletteOpen(prev => {
      if (prev) setPaletteQuery('');
      return !prev;
    });
  }, []);

  // ============================================================
  // KEYBOARD SHORTCUTS WIRING
  // ============================================================

  const hasOpenModal = isEditorOpen || isHelpModalOpen ||
    archiveConfirmModal.isOpen || deleteConfirmModal.isOpen ||
    bulkDeleteConfirm || bulkArchiveConfirm || isAIAnalysisPanelOpen || (exportModal?.isOpen ?? false) ||
    isPaletteOpen || isQuickCaptureOpen || isBulkImportOpen;

  const shortcutContext = useMemo(() => ({
    hasOpenModal,
    hasSelection: backlog.selectedItem !== null,
  }), [hasOpenModal, backlog.selectedItem]);

  const shortcutActions = useMemo(() => [
    // Command palette (must be first - toggle behavior, fires even with modal open)
    { ...SHORTCUTS.COMMAND_PALETTE, handler: handlePaletteToggle },
    // Chat panel toggle (fires even with modal open)
    { ...SHORTCUTS.CHAT_PANEL, handler: handleChatToggle },

    // Quick Capture (web fallback - in Tauri, the global shortcut handles it)
    { ...SHORTCUTS.QUICK_CAPTURE, handler: () => {
      if (!isTauri()) setIsQuickCaptureOpen(true);
    }},

    // Bulk Import
    { ...SHORTCUTS.BULK_IMPORT, handler: handleOpenBulkImport },

    // Navigation
    { ...SHORTCUTS.NEW_ITEM, handler: handleCreateItem },
    { ...SHORTCUTS.NAVIGATE_UP, handler: () => handleNavigate('up') },
    { ...SHORTCUTS.NAVIGATE_DOWN, handler: () => handleNavigate('down') },
    { ...SHORTCUTS.SHOW_HELP, handler: () => setIsHelpModalOpen(true) },
    { ...SHORTCUTS.CLOSE_PANEL, handler: () => {
      if (multiSelect.hasSelection) {
        multiSelect.clearSelection();
      } else {
        handleCloseDetail();
      }
    }},

    // Editing
    { ...SHORTCUTS.EDIT_ITEM, handler: () => {
      if (backlog.selectedItem) handleEditItem(backlog.selectedItem);
    }},
    { ...SHORTCUTS.DELETE_ITEM, handler: () => {
      if (backlog.selectedItem) handleDeleteRequest(backlog.selectedItem);
    }},
    { ...SHORTCUTS.ARCHIVE_ITEM, handler: () => {
      if (backlog.selectedItem) handleArchiveItem(backlog.selectedItem);
    }},
    { ...SHORTCUTS.UNDO, handler: backlog.undo },
    { ...SHORTCUTS.REDO, handler: backlog.redo },
    { ...SHORTCUTS.SELECT_ALL, handler: multiSelect.selectAll },

    // Quick actions
    { ...SHORTCUTS.CYCLE_PRIORITY, handler: handleCyclePriority },
    { ...SHORTCUTS.CYCLE_EFFORT, handler: handleCycleEffort },

    // View switching
    { ...SHORTCUTS.VIEW_KANBAN, handler: () => backlog.setViewMode('kanban') },
    { ...SHORTCUTS.VIEW_LIST, handler: () => backlog.setViewMode('list') },
    { ...SHORTCUTS.VIEW_GRAPH, handler: () => backlog.setViewMode('graph') },
    { ...SHORTCUTS.VIEW_DASHBOARD, handler: () => backlog.setViewMode('dashboard') },
  ], [handlePaletteToggle, handleChatToggle, handleOpenBulkImport, handleCreateItem, handleNavigate,
      handleCloseDetail, handleEditItem, handleDeleteRequest, handleArchiveItem,
      handleCyclePriority, handleCycleEffort, backlog,
      multiSelect.hasSelection, multiSelect.clearSelection, multiSelect.selectAll]);

  useGlobalShortcuts(shortcutActions, shortcutContext);

  // ============================================================
  // MEMOIZED VALUES
  // ============================================================

  // Memoize screenshotOps to prevent unnecessary re-renders
  const screenshotOps: ScreenshotOperations = useMemo(() => ({
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - project-specific controls */}
      <Header
        projectName={getFolderName(projectPath)}
        isLoading={backlog.isLoading}
        viewMode={backlog.viewMode}
        hasProject={true}
        onOpenFile={() => {}} // Not used in project context
        onViewModeChange={backlog.setViewMode}
        onOpenProjectSettings={onOpenProjectSettings}
        onGoHome={onGoHome}
        canUndo={backlog.canUndo}
        canRedo={backlog.canRedo}
        onUndo={backlog.undo}
        onRedo={backlog.redo}
      />

      {/* Linear-style Toolbar (hidden in archive mode) */}
      {backlog.viewMode !== 'archive' && (
      <div className="fixed bottom-4 right-4 flex items-center gap-1 z-30 bg-surface border border-outline rounded-lg shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline p-1">
        {/* Create new item button */}
        <button
          onClick={handleCreateItem}
          className="p-2.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
          title={t.common.createNewItem}
        >
          <PlusIcon className="w-5 h-5" />
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-outline mx-0.5" />

        {/* Bulk Import button */}
        <button
          onClick={handleOpenBulkImport}
          className="p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors"
          title={`${t.bulkImport.title} (Ctrl+Shift+I)`}
        >
          <UploadIcon className="w-4.5 h-4.5" />
        </button>

        {/* AI Analysis button */}
        <button
          onClick={() => setIsAIAnalysisPanelOpen(true)}
          className="relative p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors"
          title={t.common.aiAnalysis}
        >
          <SparklesIcon className="w-4.5 h-4.5" />
          {/* Badge if analysis is available */}
          {aiSuggestions.analysis && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-surface" />
          )}
        </button>

        {/* AI Chat button */}
        <div className="relative">
          <button
            onClick={handleChatToggle}
            className={`relative p-2.5 rounded-md transition-colors ${
              isChatOpen
                ? 'bg-accent text-white'
                : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'
            }`}
            title={`${t.chat.title} (Ctrl+J)`}
          >
            <ChatIcon className="w-4.5 h-4.5" />
          </button>
          {/* Chat Panel Tooltip */}
          <FeatureTooltip
            visible={showChatTooltip}
            message={t.featureTooltips.chatPanel}
            position="left"
            onDismiss={() => {
              setShowChatTooltip(false);
              featureTooltips.markSeen('chatPanel');
            }}
          />
        </div>

        {/* Type config button */}
        <button
          onClick={onOpenTypeConfig}
          className="p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors"
          title={t.common.configureTypes}
        >
          <TagIcon className="w-4.5 h-4.5" />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="relative p-2.5 bg-surface text-on-surface-secondary rounded-md hover:bg-surface-alt transition-colors"
          title={t.common.parameters}
        >
          <SettingsIcon className="w-4.5 h-4.5" />
          {/* Badge notification: update dismissed but available */}
          {showUpdateBadge && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-surface animate-pulse" />
          )}
        </button>
      </div>
      )}

      {/* Main layout: chat side panel + workspace content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat Side Panel (integrated, not overlay) */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatPanel.messages}
          state={chatPanel.state}
          error={chatPanel.error}
          items={backlog.allItems}
          onSend={chatPanel.send}
          onClear={chatPanel.clear}
          onOpenItem={handleChatOpenItem}
          suggestions={chatPanel.suggestions}
          onSendSuggestion={chatPanel.sendSuggestion}
        />

        {/* Workspace content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* Filter bar (hidden in dashboard mode) */}
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
          {/* Command Palette Tooltip */}
          <FeatureTooltip
            visible={showPaletteTooltip}
            message={t.featureTooltips.commandPalette}
            position="bottom"
            onDismiss={() => {
              setShowPaletteTooltip(false);
              featureTooltips.markSeen('commandPalette');
            }}
          />
        </div>
      )}

      {/* View */}
      <div className="relative flex-1 min-h-0 overflow-auto">
        {backlog.viewMode === 'archive' && backlog.projectId ? (
          <ArchiveTab
            projectPath={projectPath}
            projectId={backlog.projectId}
            onRestore={handleRestoreFromArchive}
            onDeletePermanently={handleDeleteFromArchive}
            onPurgeArchive={handlePurgeArchive}
          />
        ) : backlog.viewMode === 'dashboard' && backlog.projectId ? (
          <AnalyticsDashboard
            projectPath={projectPath}
            projectId={backlog.projectId}
          />
        ) : backlog.viewMode === 'graph' && backlog.projectId ? (
          <DependencyGraph
            projectPath={projectPath}
            projectId={backlog.projectId}
            items={backlog.allItems}
            onSelectItem={handleItemClick}
            relationsVersion={relationsVersion}
          />
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
            onInlineUpdate={handleUpdateItem} // Phase 11: Inline editing
            isSelected={multiSelect.isSelected}
            onSelectionClick={multiSelect.handleSelectionClick}
            onQuickDelete={handleDeleteRequest}
            onQuickValidate={handleQuickValidate}
            onQuickExport={handleQuickExport}
            onQuickArchive={handleArchiveItem}
          />
        ) : (
          <ListView
            items={backlog.filteredItems}
            onItemClick={handleItemClick}
            getItemScore={aiSuggestions.analysis ? aiSuggestions.getItemScore : undefined}
            getBlockingInfo={aiSuggestions.analysis ? aiSuggestions.getBlockingInfo : undefined}
            onInlineUpdate={handleUpdateItem} // Phase 11: Inline editing
            isSelected={multiSelect.isSelected}
            onSelectionClick={multiSelect.handleSelectionClick}
            onQuickDelete={handleDeleteRequest}
            onQuickValidate={handleQuickValidate}
            onQuickExport={handleQuickExport}
            onQuickArchive={handleArchiveItem}
          />
        )}
        {/* Inline Edit Tooltip */}
        <FeatureTooltip
          visible={showInlineTooltip}
          message={t.featureTooltips.inlineEdit}
          position="top"
          onDismiss={() => setShowInlineTooltip(false)}
        />
        {/* Drag-Drop Tooltip */}
        <FeatureTooltip
          visible={showDragTooltip}
          message={t.featureTooltips.dragDrop}
          position="top"
          onDismiss={() => setShowDragTooltip(false)}
        />
      </div>

        </div>{/* end workspace content */}
      </div>{/* end flex layout */}

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
        projectPath={projectPath}
        items={backlog.allItems}
        projectId={backlog.projectId}
        typeConfigs={typeConfig.sortedTypes}
        onRelationsChange={handleRelationsChange}
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
        projectPath={projectPath}
        items={backlog.allItems}
        projectId={backlog.projectId}
        templates={templates}
      />

      {/* Export modal */}
      {/* FIX BUG-002: Item is fetched fresh from backlog at render time */}
      {exportModal && (
        <ExportModal
          isOpen={exportModal.isOpen}
          onClose={() => setExportModal(null)}
          item={backlog.allItems.find(i => i.id === exportModal.itemId) || null}
          sourcePath={projectPath}
          screenshotBasePath={`${projectPath}\\.backlog-assets\\screenshots`}
        />
      )}

      {/* Error display */}
      {backlog.error && (
        <div className="fixed bottom-4 left-4 right-24 bg-danger-soft border border-danger text-danger-text px-4 py-3 rounded-lg z-[100]">
          {backlog.error}
        </div>
      )}

      {/* Error notification toast */}
      {errorNotification && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[999] flex items-center gap-3">
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
        title={`${t.quickActions.archive} ?`}
        message={`${archiveConfirmModal.item?.id || ''} - ${t.quickActions.archiveToast}`}
        confirmLabel={t.quickActions.archive}
        cancelLabel={t.action.cancel}
        variant="warning"
        onConfirm={confirmArchive}
        onCancel={() => setArchiveConfirmModal({ isOpen: false, item: null })}
      />

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title={t.quickActions.deleteConfirmTitle}
        message={`${deleteConfirmModal.item?.id || ''} ${t.quickActions.deleteConfirmMessage}`}
        confirmLabel={t.action.delete}
        cancelLabel={t.action.cancel}
        variant="danger"
        onConfirm={confirmDeleteItem}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, item: null })}
      />

      {/* Bulk delete confirmation modal */}
      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title={t.bulk.deleteSelected}
        message={`${multiSelect.selectedCount} ${t.bulk.selectedCount}`}
        confirmLabel={t.action.delete}
        cancelLabel={t.action.cancel}
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      {/* Bulk archive confirmation modal */}
      <ConfirmModal
        isOpen={bulkArchiveConfirm}
        title={t.bulk.archiveSelected}
        message={`${idsToArchive.length} ${t.bulk.selectedCount}`}
        confirmLabel={t.quickActions.archive}
        cancelLabel={t.action.cancel}
        variant="warning"
        onConfirm={confirmBulkArchive}
        onCancel={() => setBulkArchiveConfirm(false)}
      />

      {/* Bulk action bar */}
      {multiSelect.selectedCount > 0 && (
        <BulkActionBar
          selectedCount={multiSelect.selectedCount}
          onClearSelection={multiSelect.clearSelection}
          onBulkPriority={handleBulkPriority}
          onBulkEffort={handleBulkEffort}
          onBulkType={handleBulkType}
          onBulkValidate={handleBulkValidate}
          onBulkArchive={handleBulkArchiveRequest}
          onBulkDelete={handleBulkDeleteRequest}
          types={typeConfig.sortedTypes}
        />
      )}

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        isOpen={isAIAnalysisPanelOpen}
        onClose={() => setIsAIAnalysisPanelOpen(false)}
        aiSuggestions={aiSuggestions}
        itemCount={backlog.allItems.length}
      />

      {/* Shortcut Help Modal */}
      <ShortcutHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={handlePaletteClose}
        results={paletteResults}
        recentResults={recentResults}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        onExecute={handlePaletteExecute}
        placeholder={t.palette.placeholder}
        noResultsText={t.palette.noResults}
        categoryLabels={t.palette.categories}
        nlCommand={nlCommand}
      />

      {/* Quick Capture Modal (web mode only - in Tauri, capture is a separate window) */}
      {isQuickCaptureOpen && !isTauri() && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm">
          <QuickCapture
            projectPath={projectPath}
            onClose={() => setIsQuickCaptureOpen(false)}
            onCreated={() => {
              backlog.reload();
              setIsQuickCaptureOpen(false);
            }}
          />
        </div>
      )}

      {/* Bulk Import Wizard */}
      <BulkImportWizard
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        projectPath={projectPath}
        projectId={backlog.projectId!}
        items={backlog.allItems}
        typeConfigs={typeConfig.sortedTypes}
        onCreated={handleBulkImportCreated}
      />

      {/* Quick Action Toast */}
      {quickActionToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-none">
          {quickActionToast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EXPORTS
// ============================================================

// Export backlog-related types for use with ProjectWorkspace
export type { UseBacklogDBReturn } from '../../hooks/useBacklogDB';
