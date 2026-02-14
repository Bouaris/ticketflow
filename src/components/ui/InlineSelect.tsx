/**
 * InlineSelect - Click-to-change dropdown for enum fields.
 *
 * Renders a trigger element (typically a badge). On click, shows a
 * dropdown with selectable options. Supports generic string types
 * for Priority, Effort, Severity, ItemType, etc.
 *
 * @module components/ui/InlineSelect
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../../i18n';

export interface InlineSelectOption<T extends string> {
  value: T;
  label: string;
  color?: string;              // Optional badge color
}

interface InlineSelectProps<T extends string> {
  value: T | undefined;
  options: InlineSelectOption<T>[];
  onSelect: (value: T | undefined) => void;  // undefined = "none" / clear
  renderTrigger: (props: { value: T | undefined; onClick: (e: React.MouseEvent) => void }) => React.ReactNode;
  allowClear?: boolean;        // Show "None" option (default true)
  clearLabel?: string;         // Label for clear option (default "Aucun")
  disabled?: boolean;
  position?: 'below' | 'above'; // Dropdown position (default 'below')
}

export function InlineSelect<T extends string>({
  value,
  options,
  onSelect,
  renderTrigger,
  allowClear = true,
  clearLabel,
  disabled = false,
  position = 'below',
}: InlineSelectProps<T>) {
  const { t } = useTranslation();
  const resolvedClearLabel = clearLabel ?? t.empty.none;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Use capture phase to catch clicks before they propagate
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(prev => !prev);
  }, [disabled]);

  const handleOptionClick = useCallback((optionValue: T | undefined) => {
    onSelect(optionValue);
    setIsOpen(false);
  }, [onSelect]);

  const positionClasses = position === 'above'
    ? 'bottom-full mb-1'
    : 'top-full mt-1';

  return (
    <div ref={containerRef} className="relative inline-block">
      {renderTrigger({ value, onClick: handleTriggerClick })}

      {isOpen && (
        <div
          className={`absolute left-0 ${positionClasses} z-50 min-w-[120px] bg-surface border border-outline rounded-lg shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {allowClear && (
            <button
              type="button"
              onClick={() => handleOptionClick(undefined)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-alt transition-colors ${
                value === undefined ? 'bg-surface-alt font-medium' : ''
              } text-on-surface-muted`}
            >
              {resolvedClearLabel}
            </button>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionClick(option.value)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-alt transition-colors flex items-center gap-2 ${
                value === option.value ? 'bg-surface-alt font-medium' : ''
              } text-on-surface`}
            >
              {option.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
