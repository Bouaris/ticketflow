/**
 * ListEditor - Reusable list editor component
 *
 * For editing lists of strings with add/remove/update capabilities.
 * Extracted from ItemEditorModal.
 */

import { PlusIcon, TrashIcon } from './Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface ListEditorProps {
  /** Field label */
  label: string;
  /** List items */
  items: string[];
  /** Add new item handler */
  onAdd: () => void;
  /** Update item handler */
  onUpdate: (index: number, value: string) => void;
  /** Remove item handler */
  onRemove: (index: number) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Show numbered items */
  numbered?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class */
  className?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export function ListEditor({
  label,
  items,
  onAdd,
  onUpdate,
  onRemove,
  placeholder,
  numbered = false,
  emptyMessage,
  className = '',
}: ListEditorProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t.placeholder.addElement;
  const resolvedEmptyMessage = emptyMessage ?? t.common.noItems;
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-on-surface-secondary">{label}</label>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 text-sm text-accent-text hover:bg-accent-soft rounded-lg flex items-center gap-1 transition-colors"
        >
          <PlusIcon />
          {t.action.add}
        </button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-6 bg-surface-alt rounded-lg border border-dashed border-outline">
          <p className="text-sm text-on-surface-faint">{resolvedEmptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <ListEditorItem
              key={index}
              value={item}
              index={index}
              numbered={numbered}
              placeholder={resolvedPlaceholder}
              onUpdate={(value) => onUpdate(index, value)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// LIST ITEM COMPONENT
// ============================================================

interface ListEditorItemProps {
  value: string;
  index: number;
  numbered: boolean;
  placeholder: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

function ListEditorItem({
  value,
  index,
  numbered,
  placeholder,
  onUpdate,
  onRemove,
}: ListEditorItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 group">
      {numbered && (
        <span className="w-6 h-6 rounded-full bg-surface-alt text-on-surface-muted text-xs flex items-center justify-center font-medium shrink-0">
          {index + 1}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-on-surface-faint hover:text-danger-text opacity-0 group-hover:opacity-100 transition-all"
        aria-label={t.action.delete}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ============================================================
// CHECKBOX LIST EDITOR
// ============================================================

interface CheckboxItem {
  text: string;
  checked: boolean;
}

interface CheckboxListEditorProps {
  /** Field label */
  label: string;
  /** Checkbox items */
  items: CheckboxItem[];
  /** Add new item handler */
  onAdd: () => void;
  /** Update item text handler */
  onUpdateText: (index: number, text: string) => void;
  /** Toggle item checked state handler */
  onToggle: (index: number) => void;
  /** Remove item handler */
  onRemove: (index: number) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class */
  className?: string;
}

export function CheckboxListEditor({
  label,
  items,
  onAdd,
  onUpdateText,
  onToggle,
  onRemove,
  placeholder,
  emptyMessage,
  className = '',
}: CheckboxListEditorProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t.placeholder.criterion;
  const resolvedEmptyMessage = emptyMessage ?? t.editor.noCriteria;
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-on-surface-secondary">{label}</label>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 text-sm text-accent-text hover:bg-accent-soft rounded-lg flex items-center gap-1 transition-colors"
        >
          <PlusIcon />
          {t.action.add}
        </button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-surface-alt rounded-xl border-2 border-dashed border-outline">
          <p className="text-on-surface-muted">{resolvedEmptyMessage}</p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 text-accent-text hover:underline text-sm"
          >
            {t.editor.addFirstCriterion}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3 group">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(index)}
                className="w-5 h-5 rounded border-input-border text-accent focus:ring-accent"
              />
              <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdateText(index, e.target.value)}
                placeholder={resolvedPlaceholder}
                className="flex-1 px-4 py-2 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 text-on-surface-faint hover:text-danger-text opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={t.action.delete}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
