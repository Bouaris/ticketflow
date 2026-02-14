/**
 * SavedViewSelector - Dropdown for selecting, saving, and managing filter views.
 *
 * Displays default suggested views and user-saved views.
 * Allows saving the current filter as a named view and deleting saved views.
 *
 * @module components/filter/SavedViewSelector
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { SavedView } from '../../hooks/useSavedViews';
import type { BacklogFilters } from '../../hooks/useBacklogDB';
import type { Translations } from '../../i18n/types';
import { BookmarkIcon, TrashIcon, PlusIcon, ChevronDownIcon } from '../ui/Icons';

// ============================================================
// TYPES
// ============================================================

interface SavedViewSelectorProps {
  savedViews: SavedView[];
  defaultViews: SavedView[];
  hasActiveFilters: boolean;
  onApplyView: (filters: BacklogFilters) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (viewId: number) => void;
  t: Translations;
}

// ============================================================
// COMPONENT
// ============================================================

export function SavedViewSelector({
  savedViews,
  defaultViews,
  hasActiveFilters,
  onApplyView,
  onSaveView,
  onDeleteView,
  t,
}: SavedViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
        setNewViewName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when saving mode is activated
  useEffect(() => {
    if (isSaving && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSaving]);

  const handleSave = useCallback(() => {
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    onSaveView(trimmed);
    setNewViewName('');
    setIsSaving(false);
  }, [newViewName, onSaveView]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsSaving(false);
      setNewViewName('');
    }
  }, [handleSave]);

  const handleApply = useCallback((view: SavedView) => {
    onApplyView(view.filters);
    setIsOpen(false);
  }, [onApplyView]);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={t.views.title}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          isOpen
            ? 'bg-accent-soft border-accent/30 text-accent-text'
            : 'bg-surface border-outline-strong text-on-surface-secondary hover:bg-surface-alt'
        }`}
      >
        <span className="flex items-center gap-1">
          <BookmarkIcon className="w-4 h-4" />
          {t.views.title}
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-outline rounded-lg shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline z-20 min-w-[240px]">
          {/* Default Views Section */}
          <div className="px-3 py-2 text-xs font-semibold text-on-surface-faint uppercase tracking-wider border-b border-outline">
            {t.views.defaultViews}
          </div>
          <div className="py-1">
            {defaultViews.map(view => (
              <button
                key={view.id}
                onClick={() => handleApply(view)}
                className="w-full text-left px-3 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt transition-colors"
              >
                {view.name}
              </button>
            ))}
          </div>

          {/* User Saved Views Section */}
          <div className="px-3 py-2 text-xs font-semibold text-on-surface-faint uppercase tracking-wider border-t border-outline">
            {t.views.savedViews}
          </div>
          <div className="py-1">
            {savedViews.length === 0 ? (
              <div className="px-3 py-2 text-sm text-on-surface-faint italic">
                {t.views.noSavedViews}
              </div>
            ) : (
              savedViews.map(view => (
                <div
                  key={view.id}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt transition-colors group"
                >
                  <button
                    onClick={() => handleApply(view)}
                    className="flex-1 text-left truncate"
                  >
                    {view.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteView(view.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-faint hover:text-danger transition-all"
                    aria-label={t.views.deleteView}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Save Current Filter */}
          {hasActiveFilters && (
            <div className="border-t border-outline px-3 py-2">
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.views.viewNamePlaceholder}
                    className="flex-1 px-2 py-1.5 text-sm border border-input-border rounded bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!newViewName.trim()}
                    className="px-2 py-1.5 text-sm font-medium text-white bg-accent rounded hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t.action.save}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSaving(true)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-accent-text hover:bg-accent-soft rounded transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t.views.saveView}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
