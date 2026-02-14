/**
 * BulkActionBar - Floating toolbar for bulk operations on selected items.
 *
 * Appears at bottom center when items are multi-selected. Provides
 * dropdowns for bulk priority/effort/type changes and a delete button.
 * All actions are delegated to parent via callbacks.
 *
 * @module components/ui/BulkActionBar
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CloseIcon, TrashIcon, ChevronDownIcon, CheckCircleIcon, ArchiveIcon } from './Icons';
import { useTranslation } from '../../i18n';
import type { Priority, Effort } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';

// ============================================================
// TYPES
// ============================================================

interface BulkActionBarProps {
  selectedCount: number;
  onBulkPriority: (priority: Priority | undefined) => void;
  onBulkEffort: (effort: Effort | undefined) => void;
  onBulkType: (type: string) => void;
  onBulkValidate: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  types: TypeDefinition[];
}

type DropdownId = 'priority' | 'effort' | 'type' | null;

// ============================================================
// CONSTANTS
// ============================================================

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'Haute', label: 'Haute' },
  { value: 'Moyenne', label: 'Moyenne' },
  { value: 'Faible', label: 'Faible' },
];

const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
];

// ============================================================
// MINI DROPDOWN
// ============================================================

interface MiniDropdownProps {
  id: DropdownId;
  label: string;
  isOpen: boolean;
  onToggle: (id: DropdownId) => void;
  children: React.ReactNode;
}

function MiniDropdown({ id, label, isOpen, onToggle, children }: MiniDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(isOpen ? null : id);
        }}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-alt hover:bg-surface-alt/80 text-on-surface-secondary transition-colors"
      >
        {label}
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-0 z-50 min-w-[120px] bg-surface border border-outline rounded-lg shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT
// ============================================================

export function BulkActionBar({
  selectedCount,
  onBulkPriority,
  onBulkEffort,
  onBulkType,
  onBulkValidate,
  onBulkArchive,
  onBulkDelete,
  onClearSelection,
  types,
}: BulkActionBarProps) {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);

  const handleToggle = useCallback((id: DropdownId) => {
    setOpenDropdown(id);
  }, []);

  const handlePrioritySelect = useCallback((priority: Priority | undefined) => {
    setOpenDropdown(null);
    onBulkPriority(priority);
  }, [onBulkPriority]);

  const handleEffortSelect = useCallback((effort: Effort | undefined) => {
    setOpenDropdown(null);
    onBulkEffort(effort);
  }, [onBulkEffort]);

  const handleTypeSelect = useCallback((type: string) => {
    setOpenDropdown(null);
    onBulkType(type);
  }, [onBulkType]);

  // Close dropdown on Escape
  useEffect(() => {
    if (openDropdown === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenDropdown(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdown]);

  const optionClasses = 'w-full text-left px-3 py-1.5 text-xs hover:bg-surface-alt transition-colors text-on-surface';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-surface/95 backdrop-blur-sm border border-outline rounded-xl shadow-xl dark:shadow-none dark:ring-1 dark:ring-outline px-4 py-3">
      {/* Left: Selection count */}
      <span className="text-sm font-medium text-on-surface whitespace-nowrap">
        {selectedCount} {t.bulk.selectedCount}
      </span>

      {/* Separator */}
      <div className="w-px h-5 bg-outline" />

      {/* Center: Action buttons */}
      <div className="flex items-center gap-2">
        {/* Priority dropdown */}
        <MiniDropdown
          id="priority"
          label={t.editor.priority}
          isOpen={openDropdown === 'priority'}
          onToggle={handleToggle}
        >
          <button
            type="button"
            onClick={() => handlePrioritySelect(undefined)}
            className={`${optionClasses} text-on-surface-muted`}
          >
            {t.bulk.noPriority}
          </button>
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePrioritySelect(opt.value)}
              className={optionClasses}
            >
              {opt.label}
            </button>
          ))}
        </MiniDropdown>

        {/* Effort dropdown */}
        <MiniDropdown
          id="effort"
          label={t.editor.effort}
          isOpen={openDropdown === 'effort'}
          onToggle={handleToggle}
        >
          <button
            type="button"
            onClick={() => handleEffortSelect(undefined)}
            className={`${optionClasses} text-on-surface-muted`}
          >
            {t.bulk.noEffort}
          </button>
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleEffortSelect(opt.value)}
              className={optionClasses}
            >
              {opt.label}
            </button>
          ))}
        </MiniDropdown>

        {/* Type dropdown */}
        <MiniDropdown
          id="type"
          label={t.editor.type}
          isOpen={openDropdown === 'type'}
          onToggle={handleToggle}
        >
          {types.map((tp) => (
            <button
              key={tp.id}
              type="button"
              onClick={() => handleTypeSelect(tp.id)}
              className={`${optionClasses} flex items-center gap-2`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: tp.color }}
              />
              {tp.label}
            </button>
          ))}
        </MiniDropdown>

        {/* Separator */}
        <div className="w-px h-5 bg-outline" />

        {/* Validate button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBulkValidate();
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 transition-colors"
        >
          <CheckCircleIcon className="w-3.5 h-3.5" />
          {t.quickActions.validate}
        </button>

        {/* Archive button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBulkArchive();
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950 transition-colors"
        >
          <ArchiveIcon className="w-3.5 h-3.5" />
          {t.quickActions.archive}
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBulkDelete();
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-danger-text hover:bg-danger-soft transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          {t.action.delete}
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-outline" />

      {/* Right: Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClearSelection();
        }}
        className="p-1 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-alt transition-colors"
        title={t.bulk.deselectAll}
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
