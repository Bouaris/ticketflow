/**
 * TypeConfigEditor - Edit type definitions (create, edit, delete, reorder)
 */

import { useState } from 'react';
import type { TypeDefinition } from '../../types/typeConfig';

interface TypeConfigEditorProps {
  types: TypeDefinition[];
  onChange: (types: TypeDefinition[]) => void;
  /** Compact mode for dialogs */
  compact?: boolean;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#6b7280', // gray
];

export function TypeConfigEditor({ types, onChange, compact = false }: TypeConfigEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newType, setNewType] = useState({ id: '', label: '', color: '#3b82f6' });

  const handleAddType = () => {
    if (!newType.id.trim() || !newType.label.trim()) return;

    const id = newType.id.toUpperCase().replace(/[^A-Z]/g, '');
    if (types.some(t => t.id === id)) {
      alert('Ce code existe déjà');
      return;
    }

    const maxOrder = Math.max(...types.map(t => t.order), -1);
    onChange([...types, { id, label: newType.label.trim(), color: newType.color, order: maxOrder + 1 }]);
    setNewType({ id: '', label: '', color: '#3b82f6' });
  };

  const handleUpdateType = (typeId: string, updates: Partial<TypeDefinition>) => {
    onChange(types.map(t => t.id === typeId ? { ...t, ...updates } : t));
  };

  const handleDeleteType = (typeId: string) => {
    if (types.length <= 1) {
      alert('Vous devez garder au moins un type');
      return;
    }
    onChange(types.filter(t => t.id !== typeId));
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
            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
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
                className="w-16 px-2 py-1 text-xs font-mono bg-gray-200 rounded text-gray-500"
                title="Le code ne peut pas être modifié"
              />
            ) : (
              <span className="w-16 px-2 py-1 text-xs font-mono bg-gray-200 rounded text-gray-600">
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
                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <span
                className="flex-1 px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 rounded"
                onClick={() => setEditingId(type.id)}
                title="Cliquer pour modifier"
              >
                {type.label}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Monter"
              >
                <ChevronUpIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                disabled={index === sortedTypes.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Descendre"
              >
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteType(type.id)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Supprimer"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Type */}
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
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
          className="w-16 px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={newType.label}
          onChange={(e) => setNewType({ ...newType, label: e.target.value })}
          placeholder="Nom du type..."
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
        />
        <button
          onClick={handleAddType}
          disabled={!newType.id.trim() || !newType.label.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Ajouter
        </button>
      </div>

      {/* Quick Colors */}
      <div className="flex flex-wrap gap-1">
        {PRESET_COLORS.slice(0, compact ? 10 : 17).map((color) => (
          <button
            key={color}
            onClick={() => setNewType({ ...newType, color })}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
              newType.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

// Icons
function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
