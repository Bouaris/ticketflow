/**
 * FilterBar component for filtering backlog items.
 */

import type { BacklogFilters } from '../../hooks/useBacklog';
import type {
  ItemType,
  Priority,
  Effort,
  Severity,
} from '../../types/backlog';
import {
  TYPE_LABELS,
  PRIORITY_LABELS,
  SEVERITY_LABELS,
} from '../../types/backlog';

interface FilterBarProps {
  filters: BacklogFilters;
  totalCount: number;
  filteredCount: number;
  onFiltersChange: (filters: Partial<BacklogFilters>) => void;
  onReset: () => void;
}

export function FilterBar({
  filters,
  totalCount,
  filteredCount,
  onFiltersChange,
  onReset,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.efforts.length > 0 ||
    filters.severities.length > 0 ||
    filters.search.trim() !== '';

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par ID, titre, description..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Type Filter */}
        <FilterDropdown
          label="Type"
          options={(['BUG', 'EXT', 'ADM', 'COS', 'LT'] as ItemType[]).map(t => ({
            value: t,
            label: TYPE_LABELS[t],
          }))}
          selected={filters.types}
          onChange={(types) => onFiltersChange({ types: types as ItemType[] })}
        />

        {/* Priority Filter */}
        <FilterDropdown
          label="Priorité"
          options={(['Haute', 'Moyenne', 'Faible'] as Priority[]).map(p => ({
            value: p,
            label: PRIORITY_LABELS[p],
          }))}
          selected={filters.priorities}
          onChange={(priorities) => onFiltersChange({ priorities: priorities as Priority[] })}
        />

        {/* Effort Filter */}
        <FilterDropdown
          label="Effort"
          options={(['XS', 'S', 'M', 'L', 'XL'] as Effort[]).map(e => ({
            value: e,
            label: e,
          }))}
          selected={filters.efforts}
          onChange={(efforts) => onFiltersChange({ efforts: efforts as Effort[] })}
        />

        {/* Severity Filter (for bugs) */}
        <FilterDropdown
          label="Sévérité"
          options={(['P0', 'P1', 'P2', 'P3', 'P4'] as Severity[]).map(s => ({
            value: s,
            label: `${s} - ${SEVERITY_LABELS[s]}`,
          }))}
          selected={filters.severities}
          onChange={(severities) => onFiltersChange({ severities: severities as Severity[] })}
        />

        {/* Reset & Count */}
        <div className="flex items-center gap-3 ml-auto">
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Réinitialiser
            </button>
          )}
          <span className="text-sm text-gray-500">
            {filteredCount} / {totalCount} items
          </span>
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
        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          isActive
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
        <div className="py-1">
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
