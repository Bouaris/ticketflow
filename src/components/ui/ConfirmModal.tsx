/**
 * ConfirmModal - Confirmation dialog with customizable actions
 */

import { Modal, ModalActions } from './Modal';
import { WarningIcon, SparklesIcon } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'warning' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'warning',
  isLoading = false,
}: ConfirmModalProps) {
  const iconColors = {
    primary: 'text-blue-500 bg-blue-100',
    warning: 'text-amber-500 bg-amber-100',
    danger: 'text-red-500 bg-red-100',
  };

  const Icon = variant === 'primary' ? SparklesIcon : WarningIcon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={false}
      footer={
        <ModalActions
          onCancel={onCancel}
          onConfirm={onConfirm}
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          variant={variant === 'danger' ? 'danger' : 'primary'}
          isLoading={isLoading}
        />
      }
    >
      <div className="text-center">
        <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${iconColors[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{message}</p>
      </div>
    </Modal>
  );
}
