/**
 * WhatsNewModal - Display changelog entries after app updates
 *
 * Shows cumulative version changes since user's last visit,
 * or full changelog when opened from settings.
 */

import { useMemo } from 'react';
import { Modal, ModalFooter } from './Modal';
import { SparklesIcon, CheckCircleIcon, InfoIcon } from './Icons';
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
  Ajouté: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Corrigé: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Modifié: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Supprimé: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  Refactoring: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Tests: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

function getSectionStyle(type: string) {
  return SECTION_STYLES[type] || SECTION_STYLES['Ajouté'];
}

export function WhatsNewModal({ isOpen, onClose, sinceVersion }: WhatsNewModalProps) {
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
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
      >
        <CheckCircleIcon className="w-4 h-4" />
        Compris !
      </button>
    </ModalFooter>
  );

  const title = isFiltered ? `Nouveautés v${APP_VERSION}` : 'Changelog';

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
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <SparklesIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {versions.length} nouvelle{versions.length > 1 ? 's' : ''} version
                {versions.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-gray-600">
                Voici ce qui a changé depuis votre dernière visite
              </p>
            </div>
          </div>
        )}

        {/* No new versions */}
        {versions.length === 0 && (
          <div className="text-center py-8">
            <InfoIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Aucune nouveauté pour le moment</p>
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
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Version header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">v{version.version}</span>
        </div>
        <span className="text-sm text-gray-500">{formattedDate}</span>
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
                  <li key={itemIdx} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">-</span>
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
