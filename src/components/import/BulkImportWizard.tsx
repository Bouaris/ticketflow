/**
 * BulkImportWizard - 4-step wizard orchestrator for bulk ticket import.
 *
 * Steps: Input -> Processing -> Review -> Confirm
 * Wraps Phase 14's service layer (generateBulkItems, bulkCreateItems)
 * in a user-friendly modal wizard.
 *
 * @module components/import/BulkImportWizard
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { track } from '../../lib/telemetry';
import { Modal } from '../ui/Modal';
import { InputStep } from './InputStep';
import { ProcessingStep } from './ProcessingStep';
import { ReviewStep } from './ReviewStep';
import { ConfirmStep } from './ConfirmStep';
import { getProvider } from '../../lib/ai';
import type { AIProvider, ImageData } from '../../lib/ai';
import { generateBulkItems, supportsVision } from '../../lib/ai-bulk';
import type { BulkProposal } from '../../lib/ai-bulk';
import { bulkCreateItems } from '../../db/queries/items';
import { useTranslation } from '../../i18n';
import { CloseIcon } from '../ui/Icons';
import type { BacklogItem } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';

// ============================================================
// TYPES
// ============================================================

type WizardStep = 'input' | 'processing' | 'review' | 'confirm';

interface BulkImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectId: number;
  items: BacklogItem[];
  typeConfigs: TypeDefinition[];
  onCreated: () => void;
}

// ============================================================
// HELPERS
// ============================================================

const STEP_ORDER: WizardStep[] = ['input', 'processing', 'review', 'confirm'];

/**
 * Convert a File to ImageData (base64 + mimeType) for AI consumption.
 */
function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/xxx;base64, prefix
      const base64 = result.split(',')[1] || '';
      resolve({
        base64,
        mimeType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ============================================================
// COMPONENT
// ============================================================

export function BulkImportWizard({
  isOpen,
  onClose,
  projectPath,
  projectId,
  items,
  typeConfigs,
  onCreated,
}: BulkImportWizardProps) {
  const { t } = useTranslation();

  // -- State --
  const [step, setStep] = useState<WizardStep>('input');
  const [rawText, setRawText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [proposals, setProposals] = useState<BulkProposal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editedFields, setEditedFields] = useState<Map<string, Partial<BulkProposal>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => getProvider());
  const abortRef = useRef(false);
  const creatingRef = useRef(false);

  // -- Provider info (derived from selectedProvider) --
  const visionSupported = useMemo(() => supportsVision(selectedProvider), [selectedProvider]);

  // -- Reset on close --
  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setRawText('');
      setImages([]);
      setProposals([]);
      setSelected(new Set());
      setEditedFields(new Map());
      setError(null);
      setIsProcessing(false);
      setIsCreating(false);
      setCreatedCount(0);
      setBulkProgress(null);
      setIsFallbackMode(false);
      setSelectedProvider(getProvider());
      abortRef.current = false;
      creatingRef.current = false;
    }
  }, [isOpen]);

  // (Section routing is now automatic — each ticket goes to its type's section)

  // -- Handlers --

  const handleExtract = useCallback(async () => {
    if (isProcessing) return;
    if (!rawText.trim() && images.length === 0) {
      setError(t.bulkImport.errorNoText);
      return;
    }

    setStep('processing');
    setError(null);
    setIsProcessing(true);
    setBulkProgress(null);
    abortRef.current = false;

    try {
      // Convert images to ImageData[]
      const imageData: ImageData[] = await Promise.all(images.map(fileToImageData));

      const result = await generateBulkItems(
        rawText,
        {
          provider: selectedProvider,
          projectPath,
          images: imageData.length > 0 ? imageData : undefined,
          items,
          availableTypes: typeConfigs,
          projectId,
        },
        (current, total) => setBulkProgress({ current, total }),
      );

      // Check if user cancelled while awaiting
      if (abortRef.current) return;

      if (result.success && result.proposals) {
        setProposals(result.proposals);
        setSelected(new Set(result.proposals.map(p => p.tempId)));
        setStep('review');
      } else {
        setError(result.error || t.bulkImport.errorFailed.replace('{error}', 'unknown'));
        setStep('input');
      }
    } catch (err) {
      if (!abortRef.current) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(t.bulkImport.errorFailed.replace('{error}', errorMsg));
        setStep('input');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, rawText, images, selectedProvider, projectPath, items, typeConfigs, projectId, t]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    setIsProcessing(false);
    setStep('input');
  }, []);

  /**
   * Fallback: create basic proposals from raw text lines (no AI).
   * Each non-empty line becomes a ticket with just a title.
   * Uses the first available type as the default suggestedType.
   */
  const handleFallbackImport = useCallback(() => {
    if (!rawText.trim()) return;

    const defaultType = typeConfigs.length > 0 ? typeConfigs[0].id : 'CT';
    const lines = rawText
      .split('\n')
      .map(line => line.replace(/^[\s]*[-*\u2022]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    const basicProposals: BulkProposal[] = lines.map((line, index) => ({
      tempId: `TEMP-${String(index + 1).padStart(3, '0')}`,
      title: line,
      description: undefined,
      userStory: undefined,
      specs: [],
      criteria: [],
      suggestedType: defaultType,
      suggestedPriority: null,
      suggestedSeverity: null,
      suggestedEffort: null,
      suggestedModule: null,
      emoji: null,
      dependencies: [],
      constraints: [],
    }));

    setProposals(basicProposals);
    setSelected(new Set(basicProposals.map(p => p.tempId)));
    setIsFallbackMode(true);
    setError(null);
    setStep('review');
    track('bulk_import_fallback', { items_count: basicProposals.length });
  }, [rawText, typeConfigs]);

  const handleConfirm = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;

    setIsCreating(true);
    setError(null);

    try {
      // Build final proposals: merge editedFields, filter by selected
      const finalProposals = proposals
        .filter(p => selected.has(p.tempId))
        .map(p => {
          const edits = editedFields.get(p.tempId);
          return {
            title: edits?.title ?? p.title,
            description: edits?.description ?? p.description,
            userStory: edits?.userStory ?? p.userStory,
            specs: p.specs,
            criteria: p.criteria,
            suggestedType: edits?.suggestedType ?? p.suggestedType,
            suggestedPriority: edits?.suggestedPriority ?? p.suggestedPriority,
            suggestedSeverity: p.suggestedSeverity,
            suggestedEffort: edits?.suggestedEffort ?? p.suggestedEffort,
            suggestedModule: p.suggestedModule,
            emoji: p.emoji,
            dependencies: p.dependencies,
            constraints: p.constraints,
          };
        });

      // Auto-routes each ticket to its matching section by type
      const created = await bulkCreateItems(
        projectPath,
        projectId,
        finalProposals
      );

      setCreatedCount(created.length);
      setStep('confirm');
      track('bulk_import_completed', { items_imported: created.length });
      onCreated();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(t.bulkImport.errorFailed.replace('{error}', errorMsg));
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  }, [proposals, selected, editedFields, projectPath, projectId, onCreated, t]);

  const handleToggleSelect = useCallback((tempId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(proposals.map(p => p.tempId)));
  }, [proposals]);

  const handleDeselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleEditField = useCallback((tempId: string, field: string, value: unknown) => {
    setEditedFields(prev => {
      const next = new Map(prev);
      const existing = next.get(tempId) || {};
      next.set(tempId, { ...existing, [field]: value });
      return next;
    });
  }, []);

  // -- Computed --

  const selectedProposals = useMemo(() => {
    return proposals
      .filter(p => selected.has(p.tempId))
      .map(p => {
        const edits = editedFields.get(p.tempId);
        if (!edits) return p;
        return { ...p, ...edits };
      });
  }, [proposals, selected, editedFields]);

  const currentStepIndex = STEP_ORDER.indexOf(step);

  const stepLabels = useMemo(() => [
    t.bulkImport.stepInput,
    t.bulkImport.stepProcessing,
    t.bulkImport.stepReview,
    t.bulkImport.stepConfirm,
  ], [t]);

  // -- Render --

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={t.bulkImport.title}>
      {/* Wizard progress indicator */}
      <div className="flex items-center justify-center gap-1 mb-6">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i <= currentStepIndex
                    ? 'bg-accent text-white'
                    : 'bg-surface-alt text-on-surface-muted border border-outline'
                }`}
              >
                {i + 1}
              </div>
              <span className="text-[10px] text-on-surface-muted mt-1 whitespace-nowrap">
                {stepLabels[i]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 mb-4 transition-colors ${
                  i < currentStepIndex ? 'bg-accent' : 'bg-outline'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error banner with fallback option */}
      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm text-danger flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-0.5 text-danger/70 hover:text-danger flex-shrink-0"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          {step === 'input' && rawText.trim() && (
            <div className="flex items-center gap-3 pt-1 border-t border-danger/20">
              <button
                type="button"
                onClick={handleFallbackImport}
                className="px-3 py-1.5 bg-surface border border-outline rounded-lg text-sm font-medium text-on-surface hover:bg-surface-alt transition-colors"
              >
                {t.bulkImport.fallbackButton}
              </button>
              <span className="text-xs text-on-surface-muted">
                {t.bulkImport.fallbackHint}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step content */}
      {step === 'input' && (
        <InputStep
          rawText={rawText}
          onRawTextChange={setRawText}
          images={images}
          onImagesChange={setImages}
          supportsVision={visionSupported}
          provider={selectedProvider}
          onProviderChange={setSelectedProvider}
          onSubmit={handleExtract}
          isSubmitting={isProcessing}
        />
      )}

      {step === 'processing' && (
        <ProcessingStep onCancel={handleCancel} progress={bulkProgress ?? undefined} />
      )}

      {step === 'review' && (
        <ReviewStep
          proposals={proposals}
          selected={selected}
          editedFields={editedFields}
          typeConfigs={typeConfigs}
          isFallbackMode={isFallbackMode}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onEditField={handleEditField}
          onNext={() => setStep('confirm')}
          onBack={() => setStep('input')}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          selectedProposals={selectedProposals}
          onConfirm={handleConfirm}
          onBack={() => setStep('review')}
          isCreating={isCreating}
          createdCount={createdCount}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
