/**
 * Modal - Unified modal component
 *
 * Consistent backdrop and animation for all modals in the app.
 */

import { useEffect, useCallback } from 'react';
import { CloseIcon } from './Icons';

// ============================================================
// TYPES
// ============================================================

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title (optional) */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether to close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Whether to close on Escape key */
  closeOnEscape?: boolean;
  /** Additional class for content container */
  className?: string;
  /** Header content (replaces default title) */
  header?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
}

// ============================================================
// SIZE CLASSES
// ============================================================

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'inset-4 md:inset-10',
};

// ============================================================
// COMPONENT
// ============================================================

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  header,
  footer,
}: ModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (closeOnEscape && e.key === 'Escape') {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isFullSize = size === 'full';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`
          fixed z-50 bg-white shadow-xl overflow-hidden flex flex-col
          ${isFullSize
            ? sizeClasses.full + ' rounded-2xl'
            : `${sizeClasses[size]} w-full top-[4vh] bottom-[4vh] left-1/2 -translate-x-1/2 rounded-xl`
          }
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header - flex-shrink-0 prevents shrinking */}
        {(title || header || showCloseButton) && (
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            {header || (
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        {/* Content - min-h-0 allows shrinking below content size */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer - flex-shrink-0 prevents shrinking, always visible */}
        {footer && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}

interface ModalActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: 'primary' | 'danger';
}

export function ModalActions({
  onCancel,
  onConfirm,
  cancelLabel = 'Annuler',
  confirmLabel = 'Confirmer',
  isLoading = false,
  isDisabled = false,
  variant = 'primary',
}: ModalActionsProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    danger: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <ModalFooter>
      <button
        onClick={onCancel}
        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
        disabled={isLoading}
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading || isDisabled}
        className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Chargement...
          </span>
        ) : (
          confirmLabel
        )}
      </button>
    </ModalFooter>
  );
}
