/**
 * Modal - Unified modal component
 *
 * Consistent backdrop and animation for all modals in the app.
 * Uses motion AnimatePresence for entry/exit animations.
 */

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CloseIcon } from './Icons';
import { useTranslation } from '../../i18n';
import {
  SPRING_PRESETS,
  MODAL_VARIANTS,
  PANEL_VARIANTS,
  BACKDROP_VARIANTS,
  INSTANT_TRANSITION,
} from '../../lib/animation-presets';

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
  /** Variant: centered modal or right slide-over panel */
  variant?: 'modal' | 'panel';
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
  variant = 'modal',
}: ModalProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

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

  const isFullSize = size === 'full';
  const isPanel = variant === 'panel';

  // Panel variant: slide-over from right (no animate-slide-in, handled by motion)
  const panelClasses = 'right-0 top-0 h-full w-full max-w-xl rounded-none';

  // Modal variant: centered with size
  const modalClasses = isFullSize
    ? sizeClasses.full + ' rounded-2xl'
    : `${sizeClasses[size]} w-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl max-h-[92vh]`;

  // Determine transition based on reduced motion preference
  const contentTransition = shouldReduceMotion
    ? INSTANT_TRANSITION
    : isPanel
      ? SPRING_PRESETS.gentle
      : SPRING_PRESETS.snappy;

  const backdropTransition = shouldReduceMotion
    ? INSTANT_TRANSITION
    : { duration: 0.2 };

  const contentVariants = isPanel ? PANEL_VARIANTS : MODAL_VARIANTS;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-overlay"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
            variants={BACKDROP_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={backdropTransition}
          />

          {/* Modal / Panel */}
          <motion.div
            className={`
              fixed z-50 bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-outline overflow-hidden flex flex-col
              ${isPanel ? panelClasses : modalClasses}
              ${className}
            `}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={contentTransition}
          >
            {/* Header - flex-shrink-0 prevents shrinking */}
            {(title || header || showCloseButton) && (
              <div className="flex-shrink-0 px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-alt">
                {header || (
                  <h2 id="modal-title" className="text-lg font-semibold text-on-surface">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 text-on-surface-faint hover:text-on-surface-secondary rounded-lg hover:bg-surface-alt transition-colors"
                    aria-label={t.action.close}
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
              <div className="flex-shrink-0 px-6 py-4 border-t border-outline bg-surface-alt">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
  cancelLabel,
  confirmLabel,
  isLoading = false,
  isDisabled = false,
  variant = 'primary',
}: ModalActionsProps) {
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t.action.cancel;
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm;
  const variantClasses = {
    primary: 'bg-accent hover:bg-accent-hover',
    danger: 'bg-danger hover:bg-danger',
  };

  return (
    <ModalFooter>
      <button
        onClick={onCancel}
        className="px-4 py-2 text-on-surface-secondary hover:bg-surface-alt rounded-lg font-medium transition-colors"
        disabled={isLoading}
      >
        {resolvedCancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading || isDisabled}
        className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t.common.loadingDots}
          </span>
        ) : (
          resolvedConfirmLabel
        )}
      </button>
    </ModalFooter>
  );
}
