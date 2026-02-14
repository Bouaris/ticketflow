/**
 * PaletteResultItem - Individual result row in the command palette.
 *
 * Displays a label with search term highlighting, an optional keyboard
 * shortcut badge, and scroll-into-view behavior when selected.
 */

import { useRef, useEffect } from 'react';
import { HighlightMatch } from './HighlightMatch';

interface PaletteResultItemProps {
  label: string;
  shortcut?: string;
  isSelected: boolean;
  matchedTerms: string[];
  onClick: () => void;
}

export function PaletteResultItem({
  label,
  shortcut,
  isSelected,
  matchedTerms,
  onClick,
}: PaletteResultItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Scroll into view when selected via keyboard navigation
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <button
      ref={ref}
      type="button"
      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left rounded-lg transition-colors ${
        isSelected
          ? 'bg-accent-soft text-accent-text'
          : 'text-on-surface hover:bg-surface-alt'
      }`}
      onClick={onClick}
    >
      <span className="truncate">
        <HighlightMatch text={label} terms={matchedTerms} />
      </span>
      {shortcut && (
        <kbd className="ml-3 flex-shrink-0 text-xs text-on-surface-secondary bg-surface px-1.5 py-0.5 rounded border border-outline font-mono">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
