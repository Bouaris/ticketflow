/**
 * ExportModal - Modal for exporting ticket content as markdown
 *
 * Displays formatted markdown with a copy-to-clipboard button.
 */

import { useState, useCallback } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { CopyIcon, CheckIcon } from '../ui/Icons';

// ============================================================
// TYPES
// ============================================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  itemId: string;
}

// ============================================================
// COMPONENT
// ============================================================

export function ExportModal({ isOpen, onClose, content, itemId }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Échec de la copie dans le presse-papier');
    }
  }, [content]);

  const footer = (
    <ModalFooter>
      <button
        onClick={onClose}
        aria-label="Fermer la fenêtre d'export"
        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
      >
        Fermer
      </button>
      <button
        onClick={handleCopy}
        aria-label={copied ? 'Contenu copié' : 'Copier dans le presse-papier'}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          copied
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {copied ? (
          <>
            <CheckIcon className="w-4 h-4" />
            Copié !
          </>
        ) : (
          <>
            <CopyIcon className="w-4 h-4" />
            Copier
          </>
        )}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Exporter ${itemId}`}
      size="lg"
      footer={footer}
    >
      <div className="bg-gray-100 rounded-lg p-4 overflow-hidden">
        <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
          {content}
        </pre>
      </div>
    </Modal>
  );
}
