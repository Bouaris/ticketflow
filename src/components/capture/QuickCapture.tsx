/**
 * Quick Capture Component
 *
 * Minimal capture form for rapid ticket creation.
 * Works as a standalone secondary window (Tauri) or modal overlay (web).
 *
 * QuickCapture: The form itself (title, type, priority, submit)
 * QuickCaptureApp: Standalone wrapper for the Tauri secondary window
 *
 * @module components/capture/QuickCapture
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getDatabase } from '../../db/database';
import { getProjectByPath } from '../../db/queries/projects';
import { insertItem } from '../../db/queries/items';
import { getNextItemNumber } from '../../db/queries/counters';
import { buildItemMarkdown } from '../../lib/serializer';
import { useTranslation } from '../../i18n';
import { isTauri } from '../../lib/tauri-bridge';
import type { BacklogItem, Priority } from '../../types/backlog';

// ============================================================
// TYPES
// ============================================================

interface TypeOption {
  id: string;
  label: string;
  color: string;
}

interface QuickCaptureProps {
  projectPath: string;
  onClose: () => void;
  onCreated?: () => void;
}

// ============================================================
// QUICK CAPTURE FORM
// ============================================================

export function QuickCapture({ projectPath, onClose, onCreated }: QuickCaptureProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load type configs from DB
  useEffect(() => {
    let cancelled = false;
    async function loadTypes() {
      try {
        const db = await getDatabase(projectPath);
        const rows = await db.select<{ id: string; label: string; color: string }[]>(
          'SELECT id, label, color FROM type_configs WHERE project_id = (SELECT id FROM projects WHERE path = $1 LIMIT 1) ORDER BY position ASC',
          [projectPath]
        );
        if (!cancelled && rows.length > 0) {
          setTypes(rows);
          setTypeId(rows[0].id);
        }
      } catch (err) {
        console.error('[QuickCapture] Failed to load types:', err);
      }
    }
    loadTypes();
    return () => { cancelled = true; };
  }, [projectPath]);

  // Auto-focus title input
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !typeId || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get project info
      const project = await getProjectByPath(projectPath);
      if (!project) throw new Error('Project not found');

      // Get sections for this project
      const db = await getDatabase(projectPath);
      const sections = await db.select<{ id: number; title: string }[]>(
        'SELECT id, title FROM sections WHERE project_id = $1 ORDER BY position ASC',
        [project.id]
      );

      // Find the section matching the type
      // Convention: section title matches type label or fallback to first section
      const typeLabel = types.find(t => t.id === typeId)?.label;
      const targetSection = sections.find(s =>
        s.title.toLowerCase().includes(typeId.toLowerCase()) ||
        (typeLabel && s.title.toLowerCase().includes(typeLabel.toLowerCase()))
      ) || sections[0];

      if (!targetSection) throw new Error('No section found');

      // Generate next ID using monotonic counter
      const nextNum = await getNextItemNumber(projectPath, project.id, typeId);
      const itemId = `${typeId}-${String(nextNum).padStart(3, '0')}`;

      // Build the BacklogItem
      const newItem: BacklogItem = {
        id: itemId,
        type: typeId,
        title: title.trim(),
        priority: priority || undefined,
        rawMarkdown: '',
        sectionIndex: 0,
      };
      newItem.rawMarkdown = buildItemMarkdown(newItem);

      // Insert into DB
      await insertItem(projectPath, newItem, project.id, targetSection.id);

      // Show success feedback
      setShowSuccess(true);
      setTimeout(() => {
        onCreated?.();
        onClose();
      }, 800);
    } catch (err) {
      console.error('[QuickCapture] Failed to create item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create item');
      setIsSubmitting(false);
    }
  }, [title, typeId, priority, isSubmitting, projectPath, types, onCreated, onClose]);

  // Handle Enter in title field
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, title]);

  if (showSuccess) {
    return (
      <div
        className="w-full max-w-md mx-auto bg-surface rounded-xl shadow-2xl dark:shadow-none dark:ring-1 dark:ring-outline p-8 text-center cursor-pointer"
        onClick={onClose}
        title={t.capture.cancel}
      >
        <div className="text-3xl mb-3">&#10003;</div>
        <p className="text-on-surface font-medium">{t.capture.created}</p>
        <p className="text-on-surface-secondary text-xs mt-2">{t.capture.clickToClose}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto bg-surface rounded-xl shadow-2xl dark:shadow-none dark:ring-1 dark:ring-outline overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-on-surface">{t.capture.title}</h2>
      </div>

      {/* Form fields */}
      <div className="px-5 pb-4 space-y-3">
        {/* Title input */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.capture.titlePlaceholder}
          className="w-full px-3 py-2.5 bg-surface-alt text-on-surface rounded-lg border border-outline focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-on-surface-secondary/50 text-sm"
          autoFocus
          required
        />

        {/* Type + Priority row */}
        <div className="flex gap-2">
          <select
            value={typeId}
            onChange={e => setTypeId(e.target.value)}
            className="flex-1 px-3 py-2 bg-surface-alt text-on-surface rounded-lg border border-outline focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
          >
            {types.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
            {types.length === 0 && (
              <option value="">{t.capture.typePlaceholder}</option>
            )}
          </select>

          <select
            value={priority}
            onChange={e => setPriority(e.target.value as Priority | '')}
            className="flex-1 px-3 py-2 bg-surface-alt text-on-surface rounded-lg border border-outline focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
          >
            <option value="">{t.capture.priorityPlaceholder}</option>
            <option value="Haute">{t.priority.Haute}</option>
            <option value="Moyenne">{t.priority.Moyenne}</option>
            <option value="Faible">{t.priority.Faible}</option>
          </select>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-on-surface-secondary hover:text-on-surface rounded-lg hover:bg-surface-alt transition-colors"
        >
          {t.capture.cancel}
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="px-5 py-2 text-sm bg-accent text-on-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSubmitting ? '...' : t.capture.submit}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// STANDALONE WINDOW WRAPPER (Tauri secondary window)
// ============================================================

export function QuickCaptureApp() {
  const { t } = useTranslation();
  const projectPath = new URLSearchParams(window.location.search).get('project');

  const handleClose = useCallback(async () => {
    if (isTauri()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch (err) {
        console.warn('[QuickCapture] Window close failed, trying destroy:', err);
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
        } catch {
          // Last resort: hide via DOM
          window.close();
        }
      }
    }
  }, []);

  if (!projectPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <p className="text-on-surface-secondary text-sm">{t.error.tauriRequired}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface p-4"
      data-tauri-drag-region
    >
      <QuickCapture
        projectPath={decodeURIComponent(projectPath)}
        onClose={handleClose}
      />
    </div>
  );
}
