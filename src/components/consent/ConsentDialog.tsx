/**
 * ConsentDialog — First-Launch GDPR Consent Modal
 *
 * Displayed before any telemetry event is fired.
 * Language: hardcoded English (always, regardless of app locale setting).
 * Buttons: equal visual weight — Accept and Decline are identical in styling (SC1).
 *
 * Requirements: TELE-01
 */

import { Modal } from '../ui/Modal';
import { isTauri } from '../../lib/tauri-bridge';
import { openExternalUrl } from '../../lib/tauri-bridge';

// ============================================================
// TYPES
// ============================================================

interface ConsentDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const PRIVACY_URL = 'https://github.com/Bouaris/ticketflow/blob/master/PRIVACY.md';

// ============================================================
// COMPONENT
// ============================================================

export function ConsentDialog({ isOpen, onAccept, onDecline, onDismiss }: ConsentDialogProps) {
  const handlePrivacyLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isTauri()) {
      openExternalUrl(PRIVACY_URL).catch(console.warn);
    } else {
      window.open(PRIVACY_URL, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss}
      closeOnBackdrop={false}
      closeOnEscape={true}
      showCloseButton={true}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-outline text-on-surface hover:bg-surface-alt transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-outline text-on-surface hover:bg-surface-alt transition-colors"
          >
            Accept
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">
          Help improve Ticketflow
        </h2>

        <p className="text-sm text-on-surface-secondary">
          Ticketflow can collect anonymous usage data to help us understand how the app is
          used and prioritize improvements. You can change this at any time in App Settings.
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-on-surface mb-1">We collect:</p>
            <ul className="text-sm text-on-surface-secondary space-y-1 pl-4">
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                Feature usage (which parts of the app you use)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                Error reports (anonymous crash and error data)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                App version and platform (Windows / Web)
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-on-surface mb-1">We never collect:</p>
            <ul className="text-sm text-on-surface-secondary space-y-1 pl-4">
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                File contents or project names
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                API keys or credentials
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-on-surface-muted flex-shrink-0" />
                Personally identifiable information
              </li>
            </ul>
          </div>
        </div>

        <a
          href={PRIVACY_URL}
          onClick={handlePrivacyLinkClick}
          className="inline-block text-sm text-accent hover:underline"
          rel="noopener noreferrer"
        >
          Read full privacy policy
        </a>
      </div>
    </Modal>
  );
}
