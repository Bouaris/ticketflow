/**
 * WhatsNewModal - Display changelog entries after app updates
 *
 * Shows cumulative version changes since user's last visit,
 * or full changelog when opened from settings.
 */

import { useMemo } from 'react';
import { Modal, ModalFooter } from './Modal';
import { SparklesIcon, CheckCircleIcon, InfoIcon } from './Icons';
import { useTranslation } from '../../i18n';
import { APP_VERSION } from '../../lib/version';
import {
  getChangelogContent,
  parseChangelog,
  getVersionsSince,
  setLastSeenVersion,
  type ChangelogVersion,
} from '../../lib/changelog';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, show only versions after this one. If null, show all. */
  sinceVersion?: string | null;
}

// Section type to style mapping
const SECTION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Ajouté: { bg: 'bg-success-soft', text: 'text-success-text', border: 'border-green-200 dark:border-green-500/30' },
  Corrigé: { bg: 'bg-accent-soft', text: 'text-accent-text', border: 'border-blue-200 dark:border-blue-500/30' },
  Modifié: { bg: 'bg-warning-soft', text: 'text-warning-text', border: 'border-amber-200 dark:border-amber-500/30' },
  Supprimé: { bg: 'bg-danger-soft', text: 'text-danger-text', border: 'border-red-200 dark:border-red-500/30' },
  Refactoring: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-500/30' },
  Tests: { bg: 'bg-surface-alt', text: 'text-on-surface-secondary', border: 'border-outline' },
};

function getSectionStyle(type: string) {
  return SECTION_STYLES[type] || SECTION_STYLES['Ajouté'];
}

export function WhatsNewModal({ isOpen, onClose, sinceVersion }: WhatsNewModalProps) {
  const { t } = useTranslation();
  // Parse changelog and filter versions
  const { versions, isFiltered } = useMemo(() => {
    const content = getChangelogContent();
    const allVersions = parseChangelog(content);

    if (sinceVersion) {
      return {
        versions: getVersionsSince(allVersions, sinceVersion),
        isFiltered: true,
      };
    }

    return { versions: allVersions, isFiltered: false };
  }, [sinceVersion]);

  // Handle close - mark version as seen
  const handleClose = () => {
    setLastSeenVersion(APP_VERSION);
    onClose();
  };

  const footerContent = (
    <ModalFooter>
      <button
        onClick={handleClose}
        className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover flex items-center gap-2 transition-colors"
      >
        <CheckCircleIcon className="w-4 h-4" />
        Compris !
      </button>
    </ModalFooter>
  );

  const title = isFiltered ? `${t.whatsNew.title} v${APP_VERSION}` : 'Changelog';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={footerContent}
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {/* Header message for filtered view */}
        {isFiltered && versions.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-accent-soft rounded-xl">
            <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shadow-sm dark:shadow-none dark:ring-1 dark:ring-outline">
              <SparklesIcon className="w-6 h-6 text-accent-text" />
            </div>
            <div>
              <h3 className="font-medium text-on-surface">
                {versions.length} nouvelle{versions.length > 1 ? 's' : ''} version
                {versions.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-on-surface-secondary">
                Voici ce qui a changé depuis votre dernière visite
              </p>
            </div>
          </div>
        )}

        {/* No new versions */}
        {versions.length === 0 && (
          <div className="text-center py-8">
            <InfoIcon className="w-12 h-12 mx-auto text-on-surface-faint mb-4" />
            <p className="text-on-surface-secondary">{t.whatsNew.noNews}</p>
          </div>
        )}

        {/* Version list */}
        {versions.map((version) => (
          <VersionCard key={version.version} version={version} />
        ))}
      </div>
    </Modal>
  );
}

interface VersionCardProps {
  version: ChangelogVersion;
}

function VersionCard({ version }: VersionCardProps) {
  const formattedDate = new Date(version.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="border border-outline rounded-xl overflow-hidden">
      {/* Version header */}
      <div className="px-4 py-3 bg-surface-alt border-b border-outline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-on-surface">v{version.version}</span>
        </div>
        <span className="text-sm text-on-surface-muted">{formattedDate}</span>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-4">
        {version.sections.map((section, idx) => {
          const style = getSectionStyle(section.type);
          return (
            <div key={idx} className={`rounded-lg p-3 ${style.bg} border ${style.border}`}>
              <h4 className={`text-sm font-medium mb-2 ${style.text}`}>{section.type}</h4>
              <ul className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-sm text-on-surface-secondary flex items-start gap-2">
                    <span className="text-on-surface-faint mt-0.5">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
