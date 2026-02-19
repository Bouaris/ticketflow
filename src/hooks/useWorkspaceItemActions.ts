/**
 * useWorkspaceItemActions - CRUD and action handlers for ProjectWorkspace
 *
 * Extracts all item action handlers from ProjectWorkspace into a focused hook.
 * Handles: create, edit, save, delete, archive, restore, export, quick actions,
 * and bulk import lifecycle.
 *
 * @module hooks/useWorkspaceItemActions
 */

import { useCallback } from 'react';
import { track } from '../lib/telemetry';
import { buildItemMarkdown } from '../lib/serializer';
import { insertArchivedItem, deleteArchivedItem, getArchivedItemScreenshots, getArchivedScreenshotFilenames, purgeAllArchivedItems } from '../db/queries/archive';
import { addRecentItem } from '../lib/command-registry';
import type { BacklogItem } from '../types/backlog';
import type { ItemFormData } from '../components/editor/ItemEditorModal';
import type { ArchivedItem } from '../db/transforms';
import type { UseBacklogDBReturn } from './useBacklogDB';
import type { UseScreenshotFolderReturn } from './useScreenshotFolder';
import type { UseWorkspaceModalsReturn } from './useWorkspaceModals';
import type { Translations } from '../i18n';

// ============================================================
// TYPES
// ============================================================

export interface UseWorkspaceItemActionsParams {
  backlog: UseBacklogDBReturn;
  modals: UseWorkspaceModalsReturn;
  screenshotFolder: UseScreenshotFolderReturn;
  projectPath: string;
  t: Translations;
}

export interface UseWorkspaceItemActionsReturn {
  // CRUD navigation
  handleCreateItem: () => void;
  handleEditItem: (item: BacklogItem) => void;
  handleSaveItem: (data: ItemFormData, isNew: boolean) => Promise<void>;

  // Confirmation flows
  handleArchiveItem: (item: BacklogItem) => void;
  handleDeleteRequest: (item: BacklogItem) => void;
  confirmDeleteItem: () => Promise<void>;
  confirmArchive: () => Promise<void>;

  // Archive tab actions
  handleRestoreFromArchive: (archivedItem: ArchivedItem) => Promise<void>;
  handleDeleteFromArchive: (itemId: string) => Promise<void>;
  handlePurgeArchive: () => Promise<void>;

  // Quick actions
  handleQuickValidate: (item: BacklogItem) => Promise<void>;
  handleQuickExport: (item: BacklogItem) => Promise<void>;
  handleExportItem: (item: BacklogItem) => void;

  // Bulk import
  handleOpenBulkImport: () => void;
  handleBulkImportCreated: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Provides all item CRUD and action handlers for the workspace.
 *
 * @param params - backlog state, modal state, screenshot folder, projectPath, translations
 */
export function useWorkspaceItemActions({
  backlog,
  modals,
  screenshotFolder,
  projectPath,
  t,
}: UseWorkspaceItemActionsParams): UseWorkspaceItemActionsReturn {

  // ---- Create / Edit ----

  const handleCreateItem = useCallback(() => {
    modals.setEditingItem(null);
    modals.setIsEditorOpen(true);
  }, [modals]);

  const handleEditItem = useCallback((item: BacklogItem) => {
    addRecentItem(projectPath, item.id);
    modals.setEditingItem(item);
    modals.setIsEditorOpen(true);
    backlog.selectItem(null); // Close detail panel
  }, [backlog, modals, projectPath]);

  // ---- Save (editor modal submit) ----

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
        track('ticket_created', { type: item.type, via: 'editor' });
      } else {
        await backlog.updateItemById(item.id, item);
      }
    } catch (error) {
      console.error('[DEBUG-WS-SAVE] FAILED:', error);
      const errorMessage = error instanceof Error ? error.message : t.error.saveFailed;
      modals.setErrorNotification(errorMessage);
      // Re-throw to prevent modal from closing
      throw error;
    }
  }, [backlog, modals, t]);

  // ---- Archive confirmation flow ----

  const handleArchiveItem = useCallback((item: BacklogItem) => {
    modals.setArchiveConfirmModal({ isOpen: true, item });
  }, [modals]);

  const confirmArchive = useCallback(async () => {
    if (modals.isArchiving) return;
    const item = modals.archiveConfirmModal.item;
    modals.setArchiveConfirmModal({ isOpen: false, item: null });

    if (!item || !backlog.projectId) return;

    modals.setIsArchiving(true);
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
      modals.setErrorNotification(`${t.error.archivingFailed}: ${msg}`);
    } finally {
      modals.setIsArchiving(false);
    }
  }, [backlog, modals, projectPath, t]);

  // ---- Delete confirmation flow ----

  const handleDeleteRequest = useCallback((item: BacklogItem) => {
    modals.setDeleteConfirmModal({ isOpen: true, item });
  }, [modals]);

  const confirmDeleteItem = useCallback(async () => {
    if (modals.isDeleting) return;
    const item = modals.deleteConfirmModal.item;
    modals.setDeleteConfirmModal({ isOpen: false, item: null });

    if (!item) return;

    modals.setIsDeleting(true);
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
      modals.setErrorNotification(`${t.error.deletionFailed}: ${msg}`);
    } finally {
      modals.setIsDeleting(false);
    }
  }, [backlog, modals, screenshotFolder, t]);

  // ---- Archive tab: restore / delete / purge ----

  const handleRestoreFromArchive = useCallback(async (archivedItem: ArchivedItem) => {
    try {
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
      modals.setErrorNotification(t.error.restorationFailed);
    }
  }, [backlog, modals, projectPath, t]);

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
      modals.setErrorNotification(t.error.deletionFailed);
    }
  }, [backlog, modals, projectPath, screenshotFolder, t]);

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
      modals.setErrorNotification(t.error.purgeFailed);
    }
  }, [backlog, modals, projectPath, screenshotFolder, t]);

  // ---- Quick actions ----

  const handleQuickValidate = useCallback(async (item: BacklogItem) => {
    if (!item.criteria || item.criteria.length === 0) {
      modals.setQuickActionToast(t.quickActions.validateToast);
      setTimeout(() => modals.setQuickActionToast(null), 1500);
      return;
    }

    const allChecked = item.criteria.every(c => c.checked);

    if (allChecked) {
      const updatedCriteria = item.criteria.map(c => ({ ...c, checked: false }));
      await backlog.updateItemById(item.id, { criteria: updatedCriteria });
      modals.setQuickActionToast(t.quickActions.unvalidateToast);
    } else {
      const updatedCriteria = item.criteria.map(c => ({ ...c, checked: true }));
      await backlog.updateItemById(item.id, { criteria: updatedCriteria });
      modals.setQuickActionToast(t.quickActions.validateToast);
    }

    setTimeout(() => modals.setQuickActionToast(null), 1500);
  }, [backlog, modals, t]);

  const handleQuickExport = useCallback(async (item: BacklogItem) => {
    const markdown = buildItemMarkdown(item);
    try {
      await navigator.clipboard.writeText(markdown);
      modals.setQuickActionToast(t.quickActions.exportToast);
    } catch {
      modals.setQuickActionToast(t.error.clipboardError);
    }
    setTimeout(() => modals.setQuickActionToast(null), 1500);
  }, [modals, t]);

  // Handle export item (for ExportModal)
  // FIX BUG-002: Only store itemId, content is generated at render time in ExportModal
  const handleExportItem = useCallback((item: BacklogItem) => {
    modals.setExportModal({ isOpen: true, itemId: item.id });
  }, [modals]);

  // ---- Bulk import ----

  const handleOpenBulkImport = useCallback(() => {
    modals.setIsBulkImportOpen(true);
  }, [modals]);

  const handleBulkImportCreated = useCallback(async () => {
    await backlog.reload();
  }, [backlog]);

  return {
    handleCreateItem,
    handleEditItem,
    handleSaveItem,
    handleArchiveItem,
    handleDeleteRequest,
    confirmDeleteItem,
    confirmArchive,
    handleRestoreFromArchive,
    handleDeleteFromArchive,
    handlePurgeArchive,
    handleQuickValidate,
    handleQuickExport,
    handleExportItem,
    handleOpenBulkImport,
    handleBulkImportCreated,
  };
}
