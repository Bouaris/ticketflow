/**
 * FilterBar component for filtering backlog items.
 */

import type { BacklogFilters } from '../../hooks/useBacklogDB';
import type { SavedView } from '../../hooks/useSavedViews';
import type { Priority, Effort, Severity } from '../../types/backlog';
import type { Translations } from '../../i18n/types';
import { useTranslation } from '../../i18n';
import { PRIORITY_LABELS, SEVERITY_LABELS } from '../../constants/labels';
import type { TypeDefinition } from '../../types/typeConfig';
import { SearchIcon, ChevronDownIcon } from '../ui/Icons';
import { SavedViewSelector } from './SavedViewSelector';

interface FilterBarProps {
  filters: BacklogFilters;
  totalCount: number;
  filteredCount: number;
  types: TypeDefinition[];
  onFiltersChange: (filters: Partial<BacklogFilters>) => void;
  onToggleTypeVisibility: (typeId: string) => void;
  onReset: () => void;
  // Saved views (optional - gracefully hidden if not provided)
  savedViews?: SavedView[];
  defaultViews?: SavedView[];
  onApplyView?: (filters: BacklogFilters) => void;
  onSaveView?: (name: string) => void;
  onDeleteView?: (viewId: number) => void;
  t?: Translations;
}

export function FilterBar({
  filters,
  totalCount,
  filteredCount,
  types,
  onFiltersChange,
  onToggleTypeVisibility,
  onReset,
  savedViews,
  defaultViews,
  onApplyView,
  onSaveView,
  onDeleteView,
  t,
}: FilterBarProps) {
  const { t: ti } = useTranslation();
  // Count hidden types (visible=false)
  const hiddenTypesCount = types.filter(tp => !tp.visible).length;

  const hasActiveFilters =
    hiddenTypesCount > 0 ||
    filters.priorities.length > 0 ||
    filters.efforts.length > 0 ||
    filters.severities.length > 0 ||
    filters.search.trim() !== '';

  return (
    <div className="bg-surface border-b border-outline px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-faint" />
          <input
            type="text"
            placeholder={ti.placeholder.search}
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 text-sm border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          />
        </div>

        {/* Type Visibility Filter */}
        <TypeVisibilityDropdown
          types={types}
          onToggle={onToggleTypeVisibility}
        />

        {/* Priority Filter */}
        <FilterDropdown
          label={ti.editor.priority}
          options={(['Haute', 'Moyenne', 'Faible'] as Priority[]).map(p => ({
            value: p,
            label: PRIORITY_LABELS[p],
          }))}
          selected={filters.priorities}
          onChange={(priorities) => onFiltersChange({ priorities: priorities as Priority[] })}
        />

        {/* Effort Filter */}
        <FilterDropdown
          label={ti.editor.effort}
          options={(['XS', 'S', 'M', 'L', 'XL'] as Effort[]).map(e => ({
            value: e,
            label: e,
          }))}
          selected={filters.efforts}
          onChange={(efforts) => onFiltersChange({ efforts: efforts as Effort[] })}
        />

        {/* Severity Filter (for bugs) */}
        <FilterDropdown
          label={ti.editor.severity}
          options={(['P0', 'P1', 'P2', 'P3', 'P4'] as Severity[]).map(s => ({
            value: s,
            label: `${s} - ${SEVERITY_LABELS[s]}`,
          }))}
          selected={filters.severities}
          onChange={(severities) => onFiltersChange({ severities: severities as Severity[] })}
        />

        {/* Saved Views Selector */}
        {t && savedViews && defaultViews && onApplyView && onSaveView && onDeleteView && (
          <SavedViewSelector
            savedViews={savedViews}
            defaultViews={defaultViews}
            hasActiveFilters={hasActiveFilters}
            onApplyView={onApplyView}
            onSaveView={onSaveView}
            onDeleteView={onDeleteView}
            t={t}
          />
        )}

        {/* Reset & Count */}
        <div className="flex items-center gap-3 ml-auto">
          {hasActiveFilters && (
            <button
              onClick={onReset}
              aria-label={ti.action.refresh}
              className="text-sm text-on-surface-muted hover:text-on-surface-secondary underline"
            >
              {ti.action.refresh}
            </button>
          )}
          <span className="text-sm text-on-surface-muted">
            {filteredCount} / {totalCount} items
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TYPE VISIBILITY DROPDOWN
// ============================================================

interface TypeVisibilityDropdownProps {
  types: TypeDefinition[];
  onToggle: (typeId: string) => void;
}

function TypeVisibilityDropdown({ types, onToggle }: TypeVisibilityDropdownProps) {
  const { t } = useTranslation();
  const visibleCount = types.filter(tp => tp.visible).length;
  const hasHidden = visibleCount < types.length;

  return (
    <div className="relative group">
      <button
        aria-label={t.filter.byType}
        aria-haspopup="true"
        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          hasHidden
            ? 'bg-accent-soft border-accent/30 text-accent-text'
            : 'bg-surface border-outline-strong text-on-surface-secondary hover:bg-surface-alt'
        }`}
      >
        <span className="flex items-center gap-1">
          Type
          {hasHidden && (
            <span className="bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {visibleCount}
            </span>
          )}
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 bg-surface border border-outline rounded-lg shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
        <div className="py-1">
          {types.map(type => (
            <label
              key={type.id}
              className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt cursor-pointer"
            >
              <input
                type="checkbox"
                checked={type.visible}
                onChange={() => onToggle(type.id)}
                className="rounded border-input-border text-accent focus:ring-accent"
              />
              {type.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FILTER DROPDOWN
// ============================================================

interface FilterDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function FilterDropdown({ label, options, selected, onChange }: FilterDropdownProps) {
  const { t } = useTranslation();
  const isActive = selected.length > 0;

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative group">
      <button
        aria-label={`${t.filter.byLabel} ${label}`}
        aria-haspopup="true"
        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          isActive
            ? 'bg-accent-soft border-accent/30 text-accent-text'
            : 'bg-surface border-outline-strong text-on-surface-secondary hover:bg-surface-alt'
        }`}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive && (
            <span className="bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 bg-surface border border-outline rounded-lg shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
        <div className="py-1">
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="rounded border-input-border text-accent focus:ring-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
