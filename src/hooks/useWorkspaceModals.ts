/**
 * useWorkspaceModals - Modal and dialog state for ProjectWorkspace
 *
 * Extracts all modal/dialog/notification state from ProjectWorkspace
 * into a focused hook. Pure local state — no external dependencies.
 *
 * @module hooks/useWorkspaceModals
 */

import { useState } from 'react';
import type { BacklogItem } from '../types/backlog';

// ============================================================
// TYPES
// ============================================================

export interface UseWorkspaceModalsReturn {
  // Editor modal
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  editingItem: BacklogItem | null;
  setEditingItem: (item: BacklogItem | null) => void;

  // Export modal (FIX BUG-002: only stores itemId)
  exportModal: { isOpen: boolean; itemId: string } | null;
  setExportModal: (modal: { isOpen: boolean; itemId: string } | null) => void;

  // Archive confirmation
  archiveConfirmModal: { isOpen: boolean; item: BacklogItem | null };
  setArchiveConfirmModal: (modal: { isOpen: boolean; item: BacklogItem | null }) => void;

  // Delete confirmation
  deleteConfirmModal: { isOpen: boolean; item: BacklogItem | null };
  setDeleteConfirmModal: (modal: { isOpen: boolean; item: BacklogItem | null }) => void;

  // Error notification
  errorNotification: string | null;
  setErrorNotification: (msg: string | null) => void;

  // Operation guards (prevent double-click)
  isArchiving: boolean;
  setIsArchiving: (v: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (v: boolean) => void;

  // Help modal
  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (open: boolean) => void;

  // Quick action toast
  quickActionToast: string | null;
  setQuickActionToast: (msg: string | null) => void;

  // Bulk delete confirmation
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: (v: boolean) => void;
  idsToDelete: string[];
  setIdsToDelete: (ids: string[]) => void;

  // Bulk archive confirmation
  bulkArchiveConfirm: boolean;
  setBulkArchiveConfirm: (v: boolean) => void;
  idsToArchive: string[];
  setIdsToArchive: (ids: string[]) => void;

  // Command palette
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  paletteQuery: string;
  setPaletteQuery: (q: string) => void;

  // Quick capture
  isQuickCaptureOpen: boolean;
  setIsQuickCaptureOpen: (open: boolean) => void;

  // Bulk import wizard
  isBulkImportOpen: boolean;
  setIsBulkImportOpen: (open: boolean) => void;

  // AI Analysis panel
  isAIAnalysisPanelOpen: boolean;
  setIsAIAnalysisPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Manages all modal, dialog, and notification state for the workspace.
 * Pure local state — takes no parameters.
 */
export function useWorkspaceModals(): UseWorkspaceModalsReturn {
  // Editor modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklogItem | null>(null);

  // Export modal (FIX BUG-002: only stores itemId, content generated at render time)
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    itemId: string;
  } | null>(null);

  // Archive confirmation
  const [archiveConfirmModal, setArchiveConfirmModal] = useState<{
    isOpen: boolean;
    item: BacklogItem | null;
  }>({ isOpen: false, item: null });

  // Delete confirmation
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    item: BacklogItem | null;
  }>({ isOpen: false, item: null });

  // Error notification
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // Operation guards
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Help modal
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Quick action toast
  const [quickActionToast, setQuickActionToast] = useState<string | null>(null);

  // Bulk delete confirmation
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  // Bulk archive confirmation
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [idsToArchive, setIdsToArchive] = useState<string[]>([]);

  // Command palette
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Quick capture
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);

  // Bulk import wizard
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // AI Analysis panel
  const [isAIAnalysisPanelOpen, setIsAIAnalysisPanelOpen] = useState(false);

  return {
    isEditorOpen,
    setIsEditorOpen,
    editingItem,
    setEditingItem,
    exportModal,
    setExportModal,
    archiveConfirmModal,
    setArchiveConfirmModal,
    deleteConfirmModal,
    setDeleteConfirmModal,
    errorNotification,
    setErrorNotification,
    isArchiving,
    setIsArchiving,
    isDeleting,
    setIsDeleting,
    isHelpModalOpen,
    setIsHelpModalOpen,
    quickActionToast,
    setQuickActionToast,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    idsToDelete,
    setIdsToDelete,
    bulkArchiveConfirm,
    setBulkArchiveConfirm,
    idsToArchive,
    setIdsToArchive,
    isPaletteOpen,
    setIsPaletteOpen,
    paletteQuery,
    setPaletteQuery,
    isQuickCaptureOpen,
    setIsQuickCaptureOpen,
    isBulkImportOpen,
    setIsBulkImportOpen,
    isAIAnalysisPanelOpen,
    setIsAIAnalysisPanelOpen,
  };
}
