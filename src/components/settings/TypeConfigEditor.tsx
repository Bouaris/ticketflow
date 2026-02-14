/**
 * TypeConfigEditor - Edit type definitions (create, edit, delete, reorder)
 */

import { useState } from 'react';
import type { TypeDefinition } from '../../types/typeConfig';
import { PRESET_COLORS } from '../../constants/colors';
import { ChevronUpIcon, ChevronDownIcon, TrashIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

interface TypeConfigEditorProps {
  types: TypeDefinition[];
  onChange: (types: TypeDefinition[]) => void;
  /** Called when a type is deleted (to persist deletion across reloads) */
  onDeleteType?: (typeId: string) => void;
  /** Compact mode for dialogs */
  compact?: boolean;
}

export function TypeConfigEditor({ types, onChange, onDeleteType, compact = false }: TypeConfigEditorProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newType, setNewType] = useState({ id: '', label: '', color: '#3b82f6' });

  const handleAddType = () => {
    if (!newType.id.trim() || !newType.label.trim()) return;

    const id = newType.id.toUpperCase().replace(/[^A-Z]/g, '');
    if (types.some(t => t.id === id)) {
      alert(t.validation.typeExists);
      return;
    }

    const maxOrder = Math.max(...types.map(t => t.order), -1);
    onChange([...types, { id, label: newType.label.trim(), color: newType.color, order: maxOrder + 1, visible: true }]);
    setNewType({ id: '', label: '', color: '#3b82f6' });
  };

  const handleUpdateType = (typeId: string, updates: Partial<TypeDefinition>) => {
    onChange(types.map(t => t.id === typeId ? { ...t, ...updates } : t));
  };

  const handleDeleteType = (typeId: string) => {
    if (types.length <= 1) {
      alert(t.validation.minOneType);
      return;
    }
    // Use onDeleteType if available (persists deletion), otherwise fallback to onChange
    if (onDeleteType) {
      onDeleteType(typeId);
    } else {
      onChange(types.filter(t => t.id !== typeId));
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const sorted = [...types].sort((a, b) => a.order - b.order);
    [sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]];
    onChange(sorted.map((t, i) => ({ ...t, order: i })));
  };

  const handleMoveDown = (index: number) => {
    const sorted = [...types].sort((a, b) => a.order - b.order);
    if (index === sorted.length - 1) return;
    [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
    onChange(sorted.map((t, i) => ({ ...t, order: i })));
  };

  const sortedTypes = [...types].sort((a, b) => a.order - b.order);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Type List */}
      <div className={`space-y-2 ${compact ? 'max-h-48' : 'max-h-64'} overflow-y-auto`}>
        {sortedTypes.map((type, index) => (
          <div
            key={type.id}
            className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg border border-outline"
          >
            {/* Color Picker */}
            <div className="relative">
              <input
                type="color"
                value={type.color}
                onChange={(e) => handleUpdateType(type.id, { color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0"
                style={{ backgroundColor: type.color }}
              />
            </div>

            {/* ID (readonly or editing) */}
            {editingId === type.id ? (
              <input
                type="text"
                value={type.id}
                disabled
                className="w-16 px-2 py-1 text-xs font-mono bg-outline rounded text-on-surface-muted"
                title={t.typeConfig.codeNotEditable}
              />
            ) : (
              <span className="w-16 px-2 py-1 text-xs font-mono bg-outline rounded text-on-surface-secondary">
                {type.id}
              </span>
            )}

            {/* Label */}
            {editingId === type.id ? (
              <input
                type="text"
                value={type.label}
                onChange={(e) => handleUpdateType(type.id, { label: e.target.value })}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                autoFocus
                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
              />
            ) : (
              <span
                className="flex-1 px-2 py-1 text-sm cursor-pointer hover:bg-surface-alt rounded"
                onClick={() => setEditingId(type.id)}
                title={t.typeConfig.clickToEdit}
              >
                {type.label}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="p-1 text-on-surface-faint hover:text-on-surface-secondary disabled:opacity-30"
                title={t.action.moveUp}
              >
                <ChevronUpIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === sortedTypes.length - 1}
                className="p-1 text-on-surface-faint hover:text-on-surface-secondary disabled:opacity-30"
                title={t.action.moveDown}
              >
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteType(type.id)}
                className="p-1 text-on-surface-faint hover:text-danger-text"
                title={t.action.delete}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Type */}
      <div className="flex items-center gap-2 p-2 bg-accent-soft rounded-lg border border-accent/30">
        <input
          type="color"
          value={newType.color}
          onChange={(e) => setNewType({ ...newType, color: e.target.value })}
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
        <input
          type="text"
          value={newType.id}
          onChange={(e) => setNewType({ ...newType, id: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
          placeholder="CODE"
          maxLength={6}
          className="w-16 px-2 py-1 text-xs font-mono border border-outline-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          value={newType.label}
          onChange={(e) => setNewType({ ...newType, label: e.target.value })}
          placeholder={t.typeConfig.typeName}
          className="flex-1 px-2 py-1 text-sm border border-outline-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
          onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
        />
        <button
          onClick={handleAddType}
          disabled={!newType.id.trim() || !newType.label.trim()}
          className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.action.add}
        </button>
      </div>

      {/* Quick Colors */}
      <div className="flex flex-wrap gap-1">
        {PRESET_COLORS.slice(0, compact ? 10 : 17).map((color) => (
          <button
            key={color}
            onClick={() => setNewType({ ...newType, color })}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
              newType.color === color ? 'border-on-surface scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
