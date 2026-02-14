/**
 * ConfirmModal - Confirmation dialog with customizable actions
 */

import { Modal, ModalActions } from './Modal';
import { WarningIcon, SparklesIcon } from './Icons';
import { useTranslation } from '../../i18n';

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
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'warning',
  isLoading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm;
  const resolvedCancelLabel = cancelLabel ?? t.action.cancel;
  const iconColors = {
    primary: 'text-accent-text bg-accent-soft',
    warning: 'text-amber-500 bg-amber-100',
    danger: 'text-danger-text bg-danger-soft',
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
          cancelLabel={resolvedCancelLabel}
          confirmLabel={resolvedConfirmLabel}
          variant={variant === 'danger' ? 'danger' : 'primary'}
          isLoading={isLoading}
        />
      }
    >
      <div className="text-center">
        <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${iconColors[variant]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-on-surface mb-2">{title}</h3>
        <p className="text-on-surface-secondary">{message}</p>
      </div>
    </Modal>
  );
}
