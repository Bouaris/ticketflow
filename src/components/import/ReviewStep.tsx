/**
 * ReviewStep - Step 3 of the Bulk Import Wizard.
 *
 * Displays extracted ticket proposals with checkboxes for selection,
 * inline editing for title/type/priority/effort, and confidence badges.
 *
 * @module components/import/ReviewStep
 */

import { useCallback } from 'react';
import { InlineEditField } from '../ui/InlineEditField';
import { InlineSelect } from '../ui/InlineSelect';
import type { InlineSelectOption } from '../ui/InlineSelect';
import { useTranslation } from '../../i18n';
import type { BulkProposal } from '../../lib/ai-bulk';
import type { TypeDefinition } from '../../types/typeConfig';

// ============================================================
// TYPES
// ============================================================

interface ReviewStepProps {
  proposals: BulkProposal[];
  selected: Set<string>;
  editedFields: Map<string, Partial<BulkProposal>>;
  typeConfigs: TypeDefinition[];
  onToggleSelect: (tempId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditField: (tempId: string, field: string, value: unknown) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const PRIORITY_OPTIONS: InlineSelectOption<string>[] = [
  { value: 'Haute', label: 'Haute' },
  { value: 'Moyenne', label: 'Moyenne' },
  { value: 'Faible', label: 'Faible' },
];

const EFFORT_OPTIONS: InlineSelectOption<string>[] = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
];

// ============================================================
// COMPONENT
// ============================================================

export function ReviewStep({
  proposals,
  selected,
  editedFields,
  typeConfigs,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onEditField,
  onNext,
  onBack,
}: ReviewStepProps) {
  const { t } = useTranslation();

  const allSelected = selected.size === proposals.length;

  const typeOptions: InlineSelectOption<string>[] = typeConfigs.map(tc => ({
    value: tc.id,
    label: tc.label,
    color: tc.color,
  }));

  const getFieldValue = useCallback(
    <K extends keyof BulkProposal>(tempId: string, field: K, fallback: BulkProposal[K]): BulkProposal[K] => {
      const edits = editedFields.get(tempId);
      if (edits && field in edits) {
        return (edits as Record<string, unknown>)[field as string] as BulkProposal[K];
      }
      return fallback;
    },
    [editedFields]
  );

  const getTypeLabel = useCallback(
    (typeId: string): string => {
      const tc = typeConfigs.find(t => t.id === typeId);
      return tc?.label || typeId;
    },
    [typeConfigs]
  );

  const getTypeColor = useCallback(
    (typeId: string): string => {
      const tc = typeConfigs.find(t => t.id === typeId);
      return tc?.color || '#6b7280';
    },
    [typeConfigs]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-on-surface">
            {t.bulkImport.reviewTitle}
          </h3>
          <p className="text-sm text-on-surface-muted">
            {t.bulkImport.reviewDescription.replace('{count}', String(proposals.length))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-on-surface-muted">
            {t.bulkImport.selectedCount.replace('{count}', String(selected.size))}
          </span>
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-xs text-accent hover:text-accent-hover font-medium"
          >
            {allSelected ? t.bulkImport.deselectAll : t.bulkImport.selectAll}
          </button>
        </div>
      </div>

      {/* Scrollable ticket list */}
      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        {proposals.map((proposal, index) => {
          const isSelected = selected.has(proposal.tempId);
          const currentType = getFieldValue(proposal.tempId, 'suggestedType', proposal.suggestedType);
          const currentPriority = getFieldValue(proposal.tempId, 'suggestedPriority', proposal.suggestedPriority);
          const currentEffort = getFieldValue(proposal.tempId, 'suggestedEffort', proposal.suggestedEffort);
          const currentTitle = getFieldValue(proposal.tempId, 'title', proposal.title);
          const confidence = (proposal as unknown as Record<string, unknown>).confidence as number | undefined;

          return (
            <div
              key={proposal.tempId}
              className={`rounded-lg border p-3 transition-all ${
                isSelected
                  ? 'border-outline bg-surface hover:bg-surface-alt'
                  : 'border-outline/50 bg-surface opacity-50'
              } ${
                confidence !== undefined && confidence < 60
                  ? 'border-l-4 border-l-warning'
                  : ''
              } ${index % 2 === 0 ? '' : 'bg-surface-alt/30'}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(proposal.tempId)}
                  className="mt-1 rounded border-outline text-accent focus:ring-accent"
                />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Title row */}
                  <div className="flex items-center gap-2">
                    {proposal.emoji && (
                      <span className="text-sm flex-shrink-0">{proposal.emoji}</span>
                    )}
                    <InlineEditField
                      value={currentTitle}
                      onSave={(val) => onEditField(proposal.tempId, 'title', val)}
                      className="font-medium text-on-surface text-sm"
                    />
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Type badge */}
                    <InlineSelect
                      value={currentType}
                      options={typeOptions}
                      onSelect={(val) => onEditField(proposal.tempId, 'suggestedType', val || 'CT')}
                      allowClear={false}
                      renderTrigger={({ value: v, onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getTypeColor(v || 'CT') }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-white/40"
                          />
                          {getTypeLabel(v || 'CT')}
                        </button>
                      )}
                    />

                    {/* Priority badge */}
                    <InlineSelect
                      value={currentPriority as string | undefined}
                      options={PRIORITY_OPTIONS}
                      onSelect={(val) => onEditField(proposal.tempId, 'suggestedPriority', val ?? null)}
                      allowClear
                      renderTrigger={({ value: v, onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            v
                              ? v === 'Haute'
                                ? 'bg-danger/15 text-danger'
                                : v === 'Moyenne'
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-success/15 text-success'
                              : 'bg-surface-alt text-on-surface-muted'
                          }`}
                        >
                          {v || '—'}
                        </button>
                      )}
                    />

                    {/* Effort badge */}
                    <InlineSelect
                      value={currentEffort as string | undefined}
                      options={EFFORT_OPTIONS}
                      onSelect={(val) => onEditField(proposal.tempId, 'suggestedEffort', val ?? null)}
                      allowClear
                      renderTrigger={({ value: v, onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-alt text-on-surface-muted"
                        >
                          {v || '—'}
                        </button>
                      )}
                    />

                    {/* Confidence badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        confidence !== undefined
                          ? confidence >= 60
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                          : 'bg-surface-alt text-on-surface-faint'
                      }`}
                      title={
                        confidence !== undefined && confidence < 60
                          ? t.bulkImport.lowConfidence
                          : t.bulkImport.confidenceLabel
                      }
                    >
                      {confidence !== undefined ? `${confidence}%` : '—'}
                    </span>
                  </div>

                  {/* Description (read-only, truncated) */}
                  {proposal.description && (
                    <p className="text-xs text-on-surface-muted line-clamp-2">
                      {proposal.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-outline">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-on-surface-secondary hover:bg-surface-alt rounded-lg font-medium transition-colors"
        >
          {t.bulkImport.back}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={selected.size === 0}
          className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.bulkImport.next}
        </button>
      </div>
    </div>
  );
}
