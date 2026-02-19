/**
 * useWorkspaceBulkOps - Bulk operation handlers for ProjectWorkspace
 *
 * Extracts all multi-select bulk action handlers from ProjectWorkspace.
 * Handles: bulk priority, effort, type, delete, validate, and archive operations.
 *
 * @module hooks/useWorkspaceBulkOps
 */

import { useCallback } from 'react';
import { insertArchivedItem } from '../db/queries/archive';
import { deleteItem as dbDeleteItemDirect, updateItem as dbUpdateItemDirect } from '../db/queries/items';
import type { Priority, Effort } from '../types/backlog';
import type { UseBacklogDBReturn } from './useBacklogDB';
import type { UseScreenshotFolderReturn } from './useScreenshotFolder';
import type { UseWorkspaceModalsReturn } from './useWorkspaceModals';
import { useMultiSelect } from './useMultiSelect';

type UseMultiSelectReturn = ReturnType<typeof useMultiSelect>;

// ============================================================
// TYPES
// ============================================================

export interface UseWorkspaceBulkOpsParams {
  backlog: UseBacklogDBReturn;
  modals: UseWorkspaceModalsReturn;
  multiSelect: UseMultiSelectReturn;
  projectPath: string;
  screenshotFolder: UseScreenshotFolderReturn;
}

export interface UseWorkspaceBulkOpsReturn {
  handleBulkPriority: (priority: Priority | undefined) => Promise<void>;
  handleBulkEffort: (effort: Effort | undefined) => Promise<void>;
  handleBulkType: (type: string) => Promise<void>;
  handleBulkDeleteRequest: () => void;
  confirmBulkDelete: () => Promise<void>;
  handleBulkValidate: () => Promise<void>;
  handleBulkArchiveRequest: () => void;
  confirmBulkArchive: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Provides all bulk operation handlers for the workspace.
 *
 * @param params - backlog state, modal state, multiSelect state, projectPath, screenshotFolder
 */
export function useWorkspaceBulkOps({
  backlog,
  modals,
  multiSelect,
  projectPath,
  screenshotFolder,
}: UseWorkspaceBulkOpsParams): UseWorkspaceBulkOpsReturn {

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
  }, [multiSelect, projectPath, backlog, retryOnBusy]);

  const handleBulkEffort = useCallback(async (effort: Effort | undefined) => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;
    for (const id of ids) {
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { effort }));
    }
    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect, projectPath, backlog, retryOnBusy]);

  const handleBulkType = useCallback(async (type: string) => {
    const ids = multiSelect.selectedIdsArray;
    if (ids.length === 0) return;
    for (const id of ids) {
      await retryOnBusy(() => dbUpdateItemDirect(projectPath, id, { type }));
    }
    multiSelect.clearSelection();
    await backlog.reload();
  }, [multiSelect, projectPath, backlog, retryOnBusy]);

  const handleBulkDeleteRequest = useCallback(() => {
    if (multiSelect.selectedCount > 0) {
      modals.setIdsToDelete(multiSelect.selectedIdsArray);
      modals.setBulkDeleteConfirm(true);
    }
  }, [multiSelect, modals]);

  const confirmBulkDelete = useCallback(async () => {
    modals.setBulkDeleteConfirm(false);
    if (modals.idsToDelete.length === 0) return;

    // Delete screenshots (filesystem ops, no DB contention)
    for (const id of modals.idsToDelete) {
      const item = backlog.allItems.find(i => i.id === id);
      if (screenshotFolder.isReady && item?.screenshots && item.screenshots.length > 0) {
        for (const screenshot of item.screenshots) {
          await screenshotFolder.deleteScreenshotFile(screenshot.filename);
        }
      }
    }

    // Sequential deletes with retry — no transaction wrapper needed
    for (const id of modals.idsToDelete) {
      await retryOnBusy(() => dbDeleteItemDirect(projectPath, id));
    }

    backlog.selectItem(null);
    multiSelect.clearSelection();
    modals.setIdsToDelete([]);
    await backlog.reload();
  }, [modals, backlog, screenshotFolder, multiSelect, projectPath, retryOnBusy]);

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
  }, [multiSelect, backlog, projectPath, retryOnBusy]);

  const handleBulkArchiveRequest = useCallback(() => {
    if (multiSelect.selectedCount > 0) {
      modals.setIdsToArchive(multiSelect.selectedIdsArray);
      modals.setBulkArchiveConfirm(true);
    }
  }, [multiSelect, modals]);

  const confirmBulkArchive = useCallback(async () => {
    modals.setBulkArchiveConfirm(false);
    if (modals.idsToArchive.length === 0 || !backlog.projectId) return;

    for (const id of modals.idsToArchive) {
      const item = backlog.allItems.find(i => i.id === id);
      if (!item) continue;

      await retryOnBusy(() => insertArchivedItem(projectPath, item, backlog.projectId!));
      await retryOnBusy(() => dbDeleteItemDirect(projectPath, id));
    }

    backlog.selectItem(null);
    multiSelect.clearSelection();
    modals.setIdsToArchive([]);
    await backlog.reload();
    await backlog.refreshArchivedIds();
  }, [modals, backlog, multiSelect, projectPath, retryOnBusy]);

  return {
    handleBulkPriority,
    handleBulkEffort,
    handleBulkType,
    handleBulkDeleteRequest,
    confirmBulkDelete,
    handleBulkValidate,
    handleBulkArchiveRequest,
    confirmBulkArchive,
  };
}
