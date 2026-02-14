/**
 * ScreenshotEditor - Component for adding/viewing/deleting screenshots
 *
 * Features:
 * - CTRL+V paste support
 * - Import button with file picker
 * - Drag & drop support
 * - Thumbnail grid display
 * - Delete button per screenshot
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Screenshot } from '../../types/backlog';
import { extractImageFromClipboard, isValidImageFile } from '../../lib/screenshots';
import {
  ImageIcon,
  UploadIcon,
  CloseIcon,
  FolderIcon,
  FolderOpenIcon,
} from '../ui/Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface ScreenshotEditorProps {
  ticketId: string;
  screenshots: Screenshot[];
  isReady: boolean;
  needsPermission: boolean;
  isProcessing: boolean;
  onAdd: (filename: string) => void;
  onRemove: (filename: string) => void;
  onRequestAccess: () => Promise<boolean>;
  saveBlob: (ticketId: string, blob: Blob) => Promise<string | null>;
  importFile: (ticketId: string, file: File) => Promise<string | null>;
  getUrl: (filename: string) => Promise<string | null>;
}

// ============================================================
// COMPONENT
// ============================================================

export function ScreenshotEditor({
  ticketId,
  screenshots,
  isReady,
  needsPermission,
  isProcessing,
  onAdd,
  onRemove,
  onRequestAccess,
  saveBlob,
  importFile,
  getUrl,
}: ScreenshotEditorProps) {
  const { t } = useTranslation();
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load thumbnails for existing screenshots
  useEffect(() => {
    async function loadThumbnails() {
      const newThumbnails = new Map<string, string>();
      for (const screenshot of screenshots) {
        if (!thumbnails.has(screenshot.filename)) {
          const url = await getUrl(screenshot.filename);
          if (url) {
            newThumbnails.set(screenshot.filename, url);
          }
        } else {
          newThumbnails.set(screenshot.filename, thumbnails.get(screenshot.filename)!);
        }
      }
      setThumbnails(newThumbnails);
    }

    if (isReady && screenshots.length > 0) {
      loadThumbnails();
    } else if (screenshots.length === 0) {
      // Cleanup old thumbnails
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
      setThumbnails(new Map());
    }
  }, [isReady, screenshots, getUrl]);

  // Cleanup thumbnails on unmount
  useEffect(() => {
    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Handle paste event (CTRL+V)
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (isPasting) return;

      const file = extractImageFromClipboard(e.clipboardData);
      if (!file) return;

      e.preventDefault();

      // If folder not ready, request access first
      if (!isReady) {
        if (needsPermission) {
          const granted = await onRequestAccess();
          if (!granted) return;
        } else {
          return; // Not supported or other issue
        }
      }

      setIsPasting(true);

      const filename = await saveBlob(ticketId, file);
      if (filename) {
        onAdd(filename);
      }

      setIsPasting(false);
    },
    [isReady, isPasting, needsPermission, ticketId, saveBlob, onAdd, onRequestAccess]
  );

  // Register global paste listener (works anywhere in the component)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Check if we're in this component's context (modal is open)
      const container = containerRef.current;
      if (!container) return;

      // Check if the component is visible (in viewport)
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      handlePaste(e);
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  // Handle file import via button
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !isReady) return;

      for (const file of files) {
        if (isValidImageFile(file)) {
          const filename = await importFile(ticketId, file);
          if (filename) {
            onAdd(filename);
          }
        }
      }

      // Reset input
      e.target.value = '';
    },
    [isReady, ticketId, importFile, onAdd]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!isReady) return;

      const files = e.dataTransfer.files;
      for (const file of files) {
        if (isValidImageFile(file)) {
          const filename = await importFile(ticketId, file);
          if (filename) {
            onAdd(filename);
          }
        }
      }
    },
    [isReady, ticketId, importFile, onAdd]
  );

  // Handle screenshot removal
  const handleRemove = useCallback(
    (filename: string) => {
      // Revoke object URL
      const url = thumbnails.get(filename);
      if (url) {
        URL.revokeObjectURL(url);
        setThumbnails((prev) => {
          const next = new Map(prev);
          next.delete(filename);
          return next;
        });
      }
      onRemove(filename);
    },
    [onRemove, thumbnails]
  );

  // Permission required state
  if (needsPermission) {
    return (
      <div className="p-4 bg-warning-soft border border-warning-text/30 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FolderIcon className="w-5 h-5 text-warning-text" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              {t.screenshot.permissionRequired}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {t.screenshot.permissionDesc}
            </p>
            <button
              onClick={onRequestAccess}
              disabled={isProcessing}
              aria-label="Autoriser l'accès au dossier"
              className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner />
                  {t.screenshot.authorizing}
                </>
              ) : (
                <>
                  <FolderOpenIcon className="w-4 h-4" />
                  {t.screenshot.authorize}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`p-4 border-2 border-dashed rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
        isDragging
          ? 'border-accent bg-accent-soft'
          : 'border-outline-strong bg-surface-alt hover:border-outline-strong'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-on-surface-muted" />
          <label className="text-sm font-medium text-on-surface-secondary">
            {t.screenshot.title}
          </label>
          <span className="text-xs text-on-surface-faint bg-outline px-2 py-0.5 rounded">
            CTRL+V
          </span>
        </div>
        <button
          onClick={handleImportClick}
          disabled={!isReady || isProcessing}
          aria-label={t.screenshot.importButton}
          className="px-3 py-1.5 text-sm text-accent-text hover:bg-accent-soft rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <UploadIcon className="w-4 h-4" />
          {t.action.import}
        </button>
      </div>

      {/* Thumbnails grid */}
      {screenshots.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {screenshots.map((screenshot) => (
            <div
              key={screenshot.filename}
              className="relative group aspect-video bg-surface rounded-lg overflow-hidden border border-outline shadow-sm hover:shadow-md transition-shadow"
            >
              {thumbnails.get(screenshot.filename) ? (
                <img
                  src={thumbnails.get(screenshot.filename)}
                  alt={screenshot.alt || screenshot.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface-alt">
                  <LoadingSpinner />
                </div>
              )}

              {/* Delete overlay */}
              <button
                onClick={() => handleRemove(screenshot.filename)}
                aria-label={t.screenshot.deleteCapture}
                className="absolute top-1.5 right-1.5 p-1.5 bg-danger-soft0 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger shadow-lg"
                title={t.action.delete}
              >
                <CloseIcon className="w-3 h-3" />
              </button>

              {/* Filename tooltip */}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">
                  {screenshot.filename}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-outline flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-on-surface-faint" />
          </div>
          <p className="text-sm text-on-surface-muted">
            {t.screenshot.dropImages}
          </p>
          <p className="text-xs text-on-surface-faint mt-1">
            {t.screenshot.pasteHint}
          </p>
        </div>
      )}

      {/* Processing indicator */}
      {(isPasting || isProcessing) && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-accent-text">
          <LoadingSpinner />
          {t.screenshot.saving}
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOADING SPINNER
// ============================================================

function LoadingSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-outline-strong border-t-blue-600 rounded-full animate-spin" />
  );
}
