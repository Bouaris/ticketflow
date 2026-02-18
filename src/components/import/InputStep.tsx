/**
 * InputStep - Step 1 of the Bulk Import Wizard.
 *
 * Provides a textarea for raw text input and a react-dropzone
 * image upload zone with provider vision validation.
 *
 * @module components/import/InputStep
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon, CloseIcon, WarningIcon } from '../ui/Icons';
import { ProviderToggle } from '../ui/ProviderToggle';
import type { AIProvider } from '../../lib/ai';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface InputStepProps {
  rawText: string;
  onRawTextChange: (text: string) => void;
  images: File[];
  onImagesChange: (images: File[]) => void;
  supportsVision: boolean;
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export function InputStep({
  rawText,
  onRawTextChange,
  images,
  onImagesChange,
  supportsVision,
  provider,
  onProviderChange,
  onSubmit,
  isSubmitting,
}: InputStepProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cleanup object URLs when images change
  useEffect(() => {
    // Revoke previous URLs
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    // Create new URLs
    previewUrlsRef.current = images.map(file => URL.createObjectURL(file));

    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      onImagesChange([...images, ...accepted].slice(0, 5));
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback(
    (index: number) => {
      onImagesChange(images.filter((_, i) => i !== index));
    },
    [images, onImagesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024,
    disabled: !supportsVision,
    onDrop,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = (rawText.trim() || images.length > 0) && !isSubmitting;

  return (
    <div className="space-y-4">
      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={rawText}
        onChange={e => onRawTextChange(e.target.value)}
        placeholder={t.bulkImport.inputPlaceholder}
        className="w-full min-h-[200px] p-4 bg-surface border border-outline rounded-lg text-on-surface placeholder:text-on-surface-faint resize-y focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <p className="text-xs text-on-surface-muted">{t.bulkImport.inputHint}</p>

      {/* Image dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          !supportsVision
            ? 'border-outline bg-surface-alt opacity-60 cursor-not-allowed'
            : isDragActive
              ? 'border-accent bg-accent/5'
              : 'border-outline hover:border-accent/50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className="w-8 h-8 mx-auto mb-2 text-on-surface-muted" />

        {!supportsVision ? (
          <div className="space-y-1">
            <p className="text-sm text-on-surface-muted">{t.bulkImport.imageUploadLabel}</p>
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 text-warning rounded text-xs">
              <WarningIcon className="w-3.5 h-3.5" />
              {t.bulkImport.imageProviderWarning.replace('{provider}', provider)}
            </div>
          </div>
        ) : isDragActive ? (
          <p className="text-sm text-accent font-medium">{t.bulkImport.imageUploadDragActive}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-on-surface-muted">{t.bulkImport.imageUploadLabel}</p>
            <p className="text-xs text-on-surface-faint">{t.bulkImport.imageUploadHint}</p>
          </div>
        )}
      </div>

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative group rounded-lg overflow-hidden border border-outline bg-surface-alt"
            >
              <img
                src={previewUrlsRef.current[index] || ''}
                alt={file.name}
                className="w-full h-20 object-cover"
              />
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer: provider toggle + submit */}
      <div className="flex items-center justify-between">
        <ProviderToggle value={provider} onChange={onProviderChange} size="sm" />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.bulkImport.extract}
        </button>
      </div>
    </div>
  );
}
