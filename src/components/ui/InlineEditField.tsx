/**
 * InlineEditField - Double-click-to-edit text field component.
 *
 * Renders a span in display mode. On double-click, switches to an input
 * for inline editing. Saves on Enter/blur, cancels on Escape.
 *
 * @module components/ui/InlineEditField
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface InlineEditFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;          // Applied to the display span
  inputClassName?: string;     // Applied to the input
  placeholder?: string;
  maxLength?: number;          // Default 200
  minLength?: number;          // Default 1 (prevents empty saves)
  disabled?: boolean;          // Disables double-click editing
}

export function InlineEditField({
  value,
  onSave,
  className = '',
  inputClassName = '',
  placeholder = '',
  maxLength = 200,
  minLength = 1,
  disabled = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus and select all text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    // Prevent parent click handlers (e.g., opening detail panel)
    e.stopPropagation();
    setEditValue(value);
    setIsEditing(true);
  }, [disabled, value]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed.length >= minLength && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [editValue, minLength, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  // Prevent click inside input from propagating to parent (e.g., row click)
  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={handleInputClick}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`bg-input-bg text-on-surface border border-outline rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent w-full ${inputClassName}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`${disabled ? '' : 'cursor-text hover:bg-surface-alt/50 rounded px-0.5 -mx-0.5'} ${className}`}
      title={disabled ? undefined : 'Double-cliquer pour editer'}
    >
      {value || placeholder}
    </span>
  );
}
