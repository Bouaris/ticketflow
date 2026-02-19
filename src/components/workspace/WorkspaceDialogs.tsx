/**
 * WorkspaceDialogs - All modal and dialog renders for ProjectWorkspace
 *
 * Pure render component. Receives state and handlers as props.
 * No local state or effects — everything comes from the parent.
 *
 * @module components/workspace/WorkspaceDialogs
 */

import { ItemEditorModal, type ScreenshotOperations } from '../editor/ItemEditorModal';
import { ExportModal } from '../export/ExportModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AIAnalysisPanel } from '../ai/AIAnalysisPanel';
import { ShortcutHelpModal } from '../shortcuts/ShortcutHelpModal';
import { CommandPalette, type PaletteResult } from '../palette/CommandPalette';
import { QuickCapture } from '../capture/QuickCapture';
import { BulkImportWizard } from '../import/BulkImportWizard';
import { isTauri } from '../../lib/tauri-bridge';
import type { BacklogItem } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';
import type { TicketTemplate } from '../../db/queries/templates';
import type { UseWorkspaceModalsReturn } from '../../hooks/useWorkspaceModals';
import type { UseWorkspaceItemActionsReturn } from '../../hooks/useWorkspaceItemActions';
import type { UseWorkspaceBulkOpsReturn } from '../../hooks/useWorkspaceBulkOps';
import type { UseAIBacklogSuggestionsReturn } from '../../hooks/useAIBacklogSuggestions';
import type { Translations } from '../../i18n';

interface WorkspaceDialogsProps {
  modals: UseWorkspaceModalsReturn;
  itemActions: UseWorkspaceItemActionsReturn;
  bulkOps: UseWorkspaceBulkOpsReturn;
  aiSuggestions: UseAIBacklogSuggestionsReturn;
  backlogAllItems: BacklogItem[];
  backlogProjectId: number | null | undefined;
  backlogReload: () => Promise<void>;
  backlogExistingIds: string[];
  sortedTypes: TypeDefinition[];
  screenshotOps: ScreenshotOperations;
  projectPath: string;
  templates: TicketTemplate[] | undefined;
  selectedCount: number;
  nlCommand: { label: string; handler: () => void } | undefined;
  paletteResults: PaletteResult[];
  recentResults: PaletteResult[];
  handlePaletteExecute: (id: string) => void;
  handlePaletteClose: () => void;
  t: Translations;
}

export function WorkspaceDialogs({
  modals,
  itemActions,
  bulkOps,
  aiSuggestions,
  backlogAllItems,
  backlogProjectId,
  backlogReload,
  backlogExistingIds,
  sortedTypes,
  screenshotOps,
  projectPath,
  templates,
  selectedCount,
  nlCommand,
  paletteResults,
  recentResults,
  handlePaletteExecute,
  handlePaletteClose,
  t,
}: WorkspaceDialogsProps) {
  return (
    <>
      {/* Item Editor Modal */}
      <ItemEditorModal
        isOpen={modals.isEditorOpen}
        item={modals.editingItem}
        onClose={() => modals.setIsEditorOpen(false)}
        onSave={itemActions.handleSaveItem}
        existingIds={backlogExistingIds}
        types={sortedTypes}
        screenshotOps={screenshotOps}
        projectPath={projectPath}
        items={backlogAllItems}
        projectId={backlogProjectId}
        templates={templates}
      />

      {/* Export modal — FIX BUG-002: item fetched fresh at render time */}
      {modals.exportModal && (
        <ExportModal
          isOpen={modals.exportModal.isOpen}
          onClose={() => modals.setExportModal(null)}
          item={backlogAllItems.find(i => i.id === modals.exportModal!.itemId) || null}
          sourcePath={projectPath}
          screenshotBasePath={`${projectPath}\\.backlog-assets\\screenshots`}
        />
      )}

      {/* Archive confirmation */}
      <ConfirmModal
        isOpen={modals.archiveConfirmModal.isOpen}
        title={`${t.quickActions.archive} ?`}
        message={`${modals.archiveConfirmModal.item?.id || ''} - ${t.quickActions.archiveToast}`}
        confirmLabel={t.quickActions.archive}
        cancelLabel={t.action.cancel}
        variant="warning"
        onConfirm={itemActions.confirmArchive}
        onCancel={() => modals.setArchiveConfirmModal({ isOpen: false, item: null })}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={modals.deleteConfirmModal.isOpen}
        title={t.quickActions.deleteConfirmTitle}
        message={`${modals.deleteConfirmModal.item?.id || ''} ${t.quickActions.deleteConfirmMessage}`}
        confirmLabel={t.action.delete}
        cancelLabel={t.action.cancel}
        variant="danger"
        onConfirm={itemActions.confirmDeleteItem}
        onCancel={() => modals.setDeleteConfirmModal({ isOpen: false, item: null })}
      />

      {/* Bulk delete confirmation */}
      <ConfirmModal
        isOpen={modals.bulkDeleteConfirm}
        title={t.bulk.deleteSelected}
        message={`${selectedCount} ${t.bulk.selectedCount}`}
        confirmLabel={t.action.delete}
        cancelLabel={t.action.cancel}
        variant="danger"
        onConfirm={bulkOps.confirmBulkDelete}
        onCancel={() => modals.setBulkDeleteConfirm(false)}
      />

      {/* Bulk archive confirmation */}
      <ConfirmModal
        isOpen={modals.bulkArchiveConfirm}
        title={t.bulk.archiveSelected}
        message={`${modals.idsToArchive.length} ${t.bulk.selectedCount}`}
        confirmLabel={t.quickActions.archive}
        cancelLabel={t.action.cancel}
        variant="warning"
        onConfirm={bulkOps.confirmBulkArchive}
        onCancel={() => modals.setBulkArchiveConfirm(false)}
      />

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        isOpen={modals.isAIAnalysisPanelOpen}
        onClose={() => modals.setIsAIAnalysisPanelOpen(false)}
        aiSuggestions={aiSuggestions}
        itemCount={backlogAllItems.length}
      />

      {/* Shortcut Help Modal */}
      <ShortcutHelpModal
        isOpen={modals.isHelpModalOpen}
        onClose={() => modals.setIsHelpModalOpen(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={modals.isPaletteOpen}
        onClose={handlePaletteClose}
        results={paletteResults}
        recentResults={recentResults}
        query={modals.paletteQuery}
        onQueryChange={modals.setPaletteQuery}
        onExecute={handlePaletteExecute}
        placeholder={t.palette.placeholder}
        noResultsText={t.palette.noResults}
        categoryLabels={t.palette.categories}
        nlCommand={nlCommand}
      />

      {/* Quick Capture (web only — Tauri uses a separate window) */}
      {modals.isQuickCaptureOpen && !isTauri() && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm">
          <QuickCapture
            projectPath={projectPath}
            onClose={() => modals.setIsQuickCaptureOpen(false)}
            onCreated={() => {
              backlogReload();
              modals.setIsQuickCaptureOpen(false);
            }}
          />
        </div>
      )}

      {/* Bulk Import Wizard */}
      <BulkImportWizard
        isOpen={modals.isBulkImportOpen}
        onClose={() => modals.setIsBulkImportOpen(false)}
        projectPath={projectPath}
        projectId={backlogProjectId!}
        items={backlogAllItems}
        typeConfigs={sortedTypes}
        onCreated={itemActions.handleBulkImportCreated}
      />

      {/* Error notification toast */}
      {modals.errorNotification && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[999] flex items-center gap-3">
          <span>{modals.errorNotification}</span>
          <button
            onClick={() => modals.setErrorNotification(null)}
            className="text-white/80 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Quick Action Toast */}
      {modals.quickActionToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-none">
          {modals.quickActionToast}
        </div>
      )}
    </>
  );
}
