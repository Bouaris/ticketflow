/**
 * CommandPalette - Main overlay component with search input and keyboard navigation.
 *
 * Renders as a centered overlay via React portal. Manages keyboard navigation
 * (ArrowUp/Down, Enter, Escape) and groups results by category with section headers.
 *
 * This component is purely presentational -- it receives results, query state,
 * and callbacks as props. Wiring to hooks/registry happens in Plan 10-03.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, SparklesIcon } from '../ui/Icons';
import { PaletteResultItem } from './PaletteResultItem';
import { PaletteResultGroup } from './PaletteResultGroup';

// ── Types ────────────────────────────────────────────────────

export interface PaletteResult {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  matchedTerms: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  results: PaletteResult[];
  recentResults: PaletteResult[];
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: (id: string) => void;
  placeholder?: string;
  noResultsText?: string;
  categoryLabels?: Record<string, string>;
  /** When present, renders a special NL command row at the top of results */
  nlCommand?: { label: string };
}

// ── Helpers ──────────────────────────────────────────────────

/** Group results by category, preserving order of first appearance. */
function groupByCategory(items: PaletteResult[]): Map<string, PaletteResult[]> {
  const groups = new Map<string, PaletteResult[]>();
  for (const item of items) {
    const existing = groups.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }
  return groups;
}

// ── Component ────────────────────────────────────────────────

export function CommandPalette({
  isOpen,
  onClose,
  results,
  recentResults,
  query,
  onQueryChange,
  onExecute,
  placeholder = 'Search...',
  noResultsText = 'No results',
  categoryLabels = {},
  nlCommand,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nlRowRef = useRef<HTMLButtonElement>(null);

  // Determine which results to display
  const displayResults = query.trim() === '' ? recentResults : results;

  // Offset for NL command row (index 0 when present)
  const nlOffset = nlCommand ? 1 : 0;

  // Build flat list for keyboard navigation + grouped structure with indices for rendering
  const { flatList, groupedWithIndices, totalCount } = useMemo(() => {
    const flat: PaletteResult[] = [];
    const groups = groupByCategory(displayResults);
    const withIndices: { category: string; items: { item: PaletteResult; flatIndex: number }[] }[] = [];

    let index = nlOffset; // Start after NL command row if present
    for (const [category, items] of groups.entries()) {
      const indexedItems = items.map((item) => {
        const entry = { item, flatIndex: index };
        index++;
        return entry;
      });
      flat.push(...items);
      withIndices.push({ category, items: indexedItems });
    }

    return { flatList: flat, groupedWithIndices: withIndices, totalCount: flat.length + nlOffset };
  }, [displayResults, nlOffset]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatList.length, nlOffset]);

  // Auto-focus input and select text when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, totalCount - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          // NL command is index 0 when present
          if (nlCommand && selectedIndex === 0) {
            onExecute('nl:command');
          } else if (totalCount > nlOffset && flatList[selectedIndex - nlOffset]) {
            onExecute(flatList[selectedIndex - nlOffset].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatList, selectedIndex, onExecute, onClose, nlCommand, totalCount, nlOffset],
  );

  // Scroll NL row into view when selected
  useEffect(() => {
    if (nlCommand && selectedIndex === 0 && nlRowRef.current) {
      nlRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, nlCommand]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-surface rounded-xl shadow-2xl dark:shadow-none dark:ring-1 dark:ring-outline overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline">
          <SearchIcon className="w-5 h-5 text-on-surface-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-secondary/50 text-base outline-none"
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2 px-2">
          {/* NL command row (always first when present) */}
          {nlCommand && (
            <button
              ref={nlRowRef}
              type="button"
              className={`w-full flex items-center gap-2 bg-accent-soft/50 border border-accent/20 rounded-lg px-3 py-2.5 mb-1 text-sm text-left transition-colors ${
                selectedIndex === 0 ? 'ring-2 ring-accent' : ''
              }`}
              onClick={() => onExecute('nl:command')}
            >
              <SparklesIcon className="w-4 h-4 text-accent-text flex-shrink-0" />
              <span className="text-accent-text font-medium truncate">{nlCommand.label}</span>
            </button>
          )}

          {totalCount === nlOffset && query.trim() !== '' && !nlCommand ? (
            <div className="px-3 py-6 text-sm text-on-surface-secondary text-center">
              {noResultsText}
            </div>
          ) : totalCount === 0 && query.trim() === '' ? (
            <div className="px-3 py-6 text-sm text-on-surface-secondary text-center">
              {placeholder}
            </div>
          ) : (
            groupedWithIndices.map(({ category, items }) => {
              const header = categoryLabels[category] || category;
              return (
                <div key={category}>
                  <PaletteResultGroup label={header} />
                  {items.map(({ item, flatIndex }) => (
                    <PaletteResultItem
                      key={item.id}
                      label={item.label}
                      shortcut={item.shortcut}
                      isSelected={flatIndex === selectedIndex}
                      matchedTerms={item.matchedTerms}
                      onClick={() => onExecute(item.id)}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
