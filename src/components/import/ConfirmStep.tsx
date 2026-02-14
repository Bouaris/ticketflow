/**
 * ConfirmStep - Step 4 of the Bulk Import Wizard.
 *
 * Shows a summary of selected tickets grouped by type, and
 * confirm/success states. Tickets are auto-routed to their
 * matching section by type (no manual section selector needed).
 *
 * @module components/import/ConfirmStep
 */

import { CheckCircleIcon, SpinnerIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';
import type { BulkProposal } from '../../lib/ai-bulk';

// ============================================================
// TYPES
// ============================================================

interface ConfirmStepProps {
  selectedProposals: BulkProposal[];
  onConfirm: () => void;
  onBack: () => void;
  isCreating: boolean;
  createdCount: number;
  onClose: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_PREVIEW_ITEMS = 10;

// ============================================================
// COMPONENT
// ============================================================

export function ConfirmStep({
  selectedProposals,
  onConfirm,
  onBack,
  isCreating,
  createdCount,
  onClose,
}: ConfirmStepProps) {
  const { t } = useTranslation();

  // -- Success state --
  if (createdCount > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <CheckCircleIcon className="w-16 h-16 text-success" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-on-surface">
            {t.bulkImport.created.replace('{count}', String(createdCount))}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          {t.action.close}
        </button>
      </div>
    );
  }

  // -- Group by type for display --
  const typeGroups = new Map<string, BulkProposal[]>();
  for (const p of selectedProposals) {
    const type = p.suggestedType || 'CT';
    const group = typeGroups.get(type) || [];
    group.push(p);
    typeGroups.set(type, group);
  }

  const visibleProposals = selectedProposals.slice(0, MAX_PREVIEW_ITEMS);
  const overflowCount = selectedProposals.length - MAX_PREVIEW_ITEMS;

  // Build type summary: "2 BUG, 1 CT, 1 LT"
  const typeSummary = Array.from(typeGroups.entries())
    .map(([type, items]) => `${items.length} ${type}`)
    .join(', ');

  return (
    <div className="space-y-5">
      {/* Summary heading */}
      <div>
        <h3 className="text-base font-semibold text-on-surface">
          {t.bulkImport.confirmTitle}
        </h3>
        <p className="text-sm text-on-surface-muted mt-1">
          {t.bulkImport.confirmAutoRoute
            ? t.bulkImport.confirmAutoRoute
                .replace('{count}', String(selectedProposals.length))
                .replace('{types}', typeSummary)
            : `${selectedProposals.length} ticket(s) — ${typeSummary}`}
        </p>
      </div>

      {/* Ticket preview list */}
      <div className="space-y-1.5">
        <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">
          {t.bulkImport.selectedCount.replace('{count}', String(selectedProposals.length))}
        </p>
        <div className="border border-outline rounded-lg divide-y divide-outline overflow-hidden">
          {visibleProposals.map(proposal => (
            <div
              key={proposal.tempId}
              className="flex items-center gap-2 px-3 py-2 text-sm"
            >
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white flex-shrink-0"
                style={{ backgroundColor: '#6b7280' }}
              >
                {proposal.suggestedType}
              </span>
              <span className="text-on-surface truncate">{proposal.title}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="px-3 py-2 text-xs text-on-surface-muted text-center">
              +{overflowCount} {t.common.items}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-outline">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className="px-4 py-2 text-on-surface-secondary hover:bg-surface-alt rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {t.bulkImport.back}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isCreating || selectedProposals.length === 0}
          className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              {t.bulkImport.creating}
            </span>
          ) : (
            t.bulkImport.confirmButton.replace('{count}', String(selectedProposals.length))
          )}
        </button>
      </div>
    </div>
  );
}
