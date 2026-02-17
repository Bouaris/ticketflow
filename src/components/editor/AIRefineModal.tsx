/**
 * AIRefineModal - Modal for AI-powered item refinement with preview
 *
 * Provides a controlled workflow:
 * 1. User can add custom instructions before refinement
 * 2. Preview changes before accepting
 * 3. Accept or reject refinement results
 */

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { ProviderToggle, getProviderLabel } from '../ui/ProviderToggle';
import { hasApiKey, refineItem, getProvider, type RefinementResult, type AIProvider } from '../../lib/ai';
import { AIContextIndicator } from '../ui/AIContextIndicator';
import { Spinner } from '../ui/Spinner';
import { SparklesIcon, CheckCircleIcon } from '../ui/Icons';
import type { BacklogItem, Criterion } from '../../types/backlog';
import type { TypeDefinition } from '../../types/typeConfig';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface AIRefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BacklogItem;
  onAccept: (refinedItem: Partial<BacklogItem>, suggestions: string[]) => void;
  projectPath?: string;
  items?: BacklogItem[];
  projectId?: number | null;
  typeConfigs?: TypeDefinition[];
}

type Phase = 'input' | 'loading' | 'result';

// ============================================================
// DIFF PREVIEW COMPONENTS
// ============================================================

interface TextDiffProps {
  label: string;
  before?: string;
  after?: string;
}

function TextDiff({ label, before, after }: TextDiffProps) {
  if (before === after || (!before && !after)) return null;

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-on-surface-secondary mb-2">{label}</div>
      <div className="space-y-1 text-sm">
        {before && (
          <div className="text-danger-text bg-danger-soft px-3 py-1.5 rounded-lg line-through">
            {before}
          </div>
        )}
        {after && (
          <div className="text-success-text bg-success-soft px-3 py-1.5 rounded-lg">
            {after}
          </div>
        )}
      </div>
    </div>
  );
}

interface ListDiffProps {
  label: string;
  before?: string[];
  after?: string[];
}

function ListDiff({ label, before = [], after = [] }: ListDiffProps) {
  const { t } = useTranslation();
  // Find added and removed items
  const removed = before.filter(item => !after.includes(item));
  const added = after.filter(item => !before.includes(item));
  const unchanged = before.filter(item => after.includes(item));

  if (removed.length === 0 && added.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-on-surface-secondary mb-2">{label}</div>
      <ul className="space-y-1 text-sm">
        {removed.map((item, i) => (
          <li key={`removed-${i}`} className="text-danger-text bg-danger-soft px-3 py-1.5 rounded-lg line-through">
            - {item}
          </li>
        ))}
        {added.map((item, i) => (
          <li key={`added-${i}`} className="text-success-text bg-success-soft px-3 py-1.5 rounded-lg">
            + {item}
          </li>
        ))}
        {unchanged.length > 0 && added.length === 0 && removed.length === 0 && (
          <li className="text-on-surface-muted text-xs italic">{t.ai.noSignificantChanges}</li>
        )}
      </ul>
    </div>
  );
}

interface CriteriaDiffProps {
  label: string;
  before?: Criterion[];
  after?: Criterion[];
}

function CriteriaDiff({ label, before = [], after = [] }: CriteriaDiffProps) {
  const beforeTexts = before.map(c => c.text);
  const afterTexts = after.map(c => c.text);

  const removed = beforeTexts.filter(text => !afterTexts.includes(text));
  const added = afterTexts.filter(text => !beforeTexts.includes(text));

  if (removed.length === 0 && added.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-on-surface-secondary mb-2">{label}</div>
      <ul className="space-y-1 text-sm">
        {removed.map((text, i) => (
          <li key={`removed-${i}`} className="text-danger-text bg-danger-soft px-3 py-1.5 rounded-lg line-through flex items-center gap-2">
            <span className="w-4 h-4 border border-red-400 rounded" />
            {text}
          </li>
        ))}
        {added.map((text, i) => (
          <li key={`added-${i}`} className="text-success-text bg-success-soft px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="w-4 h-4 border border-green-400 rounded" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function AIRefineModal({
  isOpen,
  onClose,
  item,
  onAccept,
  projectPath,
  items,
  projectId,
  typeConfigs,
}: AIRefineModalProps) {
  const { t } = useTranslation();
  // State
  const [phase, setPhase] = useState<Phase>('input');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => getProvider());
  const [result, setResult] = useState<RefinementResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('input');
      setAdditionalPrompt('');
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle refinement
  const handleRefine = async () => {
    if (!hasApiKey(selectedProvider)) {
      setError(`${t.error.apiConfigMissing} (${getProviderLabel(selectedProvider)})`);
      return;
    }

    setPhase('loading');
    setError(null);

    try {
      const refinementResult = await refineItem(item, {
        provider: selectedProvider,
        projectPath,
        additionalPrompt: additionalPrompt.trim() || undefined,
        items,
        projectId: projectId ?? undefined,
        typeConfigs,
      });

      if (refinementResult.success) {
        setResult(refinementResult);
        setPhase('result');
      } else {
        setError(refinementResult.error || t.error.refinementError);
        setPhase('input');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error.unknown);
      setPhase('input');
    }
  };

  // Handle accept
  const handleAccept = () => {
    if (result?.refinedItem) {
      onAccept(result.refinedItem, result.suggestions || []);
      onClose();
    }
  };

  // Handle close
  const handleClose = () => {
    if (phase !== 'loading') {
      onClose();
    }
  };

  // Check if there are any changes
  const hasChanges = result?.refinedItem && (
    result.refinedItem.title !== item.title ||
    result.refinedItem.userStory !== item.userStory ||
    JSON.stringify(result.refinedItem.specs) !== JSON.stringify(item.specs) ||
    JSON.stringify(result.refinedItem.criteria) !== JSON.stringify(item.criteria) ||
    JSON.stringify(result.refinedItem.dependencies) !== JSON.stringify(item.dependencies) ||
    JSON.stringify(result.refinedItem.constraints) !== JSON.stringify(item.constraints)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.ai.refineTitle}
      size="lg"
      closeOnBackdrop={phase !== 'loading'}
      closeOnEscape={phase !== 'loading'}
      header={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center">
            <SparklesIcon className="text-accent-text w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">{t.ai.refineTitle}</h2>
            <p className="text-xs text-on-surface-muted">{item.id} - {item.title}</p>
          </div>
        </div>
      }
      footer={
        phase === 'result' ? (
          <ModalFooter>
            <button
              onClick={() => setPhase('input')}
              className="px-4 py-2 text-on-surface-secondary hover:bg-outline rounded-lg font-medium transition-colors"
            >
              {t.ai.retry}
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-on-surface-secondary hover:bg-outline rounded-lg font-medium transition-colors"
            >
              {t.action.cancel}
            </button>
            <button
              onClick={handleAccept}
              disabled={!hasChanges}
              className="px-4 py-2 bg-success hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              {t.ai.acceptChanges}
            </button>
          </ModalFooter>
        ) : phase === 'input' ? (
          <ModalFooter>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-on-surface-secondary hover:bg-outline rounded-lg font-medium transition-colors"
            >
              {t.action.cancel}
            </button>
            <button
              onClick={handleRefine}
              className="px-4 py-2 bg-accent text-white hover:bg-accent-hover rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <SparklesIcon className="w-4 h-4" />
              {t.ai.refineWith} {getProviderLabel(selectedProvider)}
            </button>
          </ModalFooter>
        ) : undefined
      }
    >
      {/* Phase: Input */}
      {phase === 'input' && (
        <div className="space-y-4">
          {/* Provider + Context */}
          <div className="flex items-center justify-between">
            <ProviderToggle
              value={selectedProvider}
              onChange={setSelectedProvider}
              size="md"
            />
            {projectPath && <AIContextIndicator projectPath={projectPath} />}
          </div>

          {/* Additional Prompt */}
          <div>
            <label className="block text-sm font-medium text-on-surface-secondary mb-2">
              {t.ai.additionalInstructions}
            </label>
            <textarea
              value={additionalPrompt}
              onChange={e => setAdditionalPrompt(e.target.value)}
              placeholder="Ex: Focus sur la sécurité, ajoute des critères de performance, simplifie la user story..."
              rows={4}
              className="w-full px-4 py-3 border border-outline-strong rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-none text-on-surface placeholder:text-on-surface-faint"
              autoFocus
            />
          </div>

          {/* Current Item Summary */}
          <div className="p-4 bg-surface-alt rounded-xl border border-outline">
            <h4 className="text-sm font-medium text-on-surface-secondary mb-2">{t.ai.currentItem}</h4>
            <div className="text-sm text-on-surface-secondary space-y-1">
              <p><span className="font-medium">Titre:</span> {item.title}</p>
              {item.userStory && <p><span className="font-medium">User Story:</span> {item.userStory.substring(0, 100)}...</p>}
              <p><span className="font-medium">Specs:</span> {item.specs?.length || 0} | <span className="font-medium">Critères:</span> {item.criteria?.length || 0}</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-danger-soft border border-danger text-danger-text rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Examples */}
          <div className="pt-4 border-t border-outline">
            <p className="text-xs font-medium text-on-surface-muted uppercase tracking-wider mb-2">
              {t.ai.instructionExamples}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'Ajoute des critères de performance',
                'Focus sur la sécurité',
                'Simplifie les specs',
                'Plus de détails techniques',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setAdditionalPrompt(example)}
                  className="px-3 py-1.5 bg-surface-alt hover:bg-outline rounded-lg text-xs text-on-surface-secondary hover:text-on-surface transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase: Loading */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-on-surface-secondary">{t.ai.refining} {getProviderLabel(selectedProvider)}...</p>
          <p className="mt-2 text-sm text-on-surface-faint">{t.ai.refineAnalyzing}</p>
        </div>
      )}

      {/* Phase: Result */}
      {phase === 'result' && result?.refinedItem && (
        <div className="space-y-6">
          {/* Changes Preview */}
          <div>
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-success-soft0 rounded-full" />
              {t.ai.proposedChanges}
            </h3>

            {!hasChanges ? (
              <div className="p-4 bg-surface-alt rounded-xl text-on-surface-secondary text-sm text-center">
                {t.ai.noSignificantChanges}
              </div>
            ) : (
              <div className="space-y-2">
                <TextDiff
                  label={t.editor.title}
                  before={item.title}
                  after={result.refinedItem.title}
                />
                <TextDiff
                  label={t.editor.userStory}
                  before={item.userStory}
                  after={result.refinedItem.userStory || undefined}
                />
                <ListDiff
                  label={t.editor.specs}
                  before={item.specs}
                  after={result.refinedItem.specs}
                />
                <CriteriaDiff
                  label={t.editor.criteria}
                  before={item.criteria}
                  after={result.refinedItem.criteria}
                />
                <ListDiff
                  label={t.editor.dependencies}
                  before={item.dependencies}
                  after={result.refinedItem.dependencies}
                />
                <ListDiff
                  label={t.editor.constraints}
                  before={item.constraints}
                  after={result.refinedItem.constraints}
                />
              </div>
            )}
          </div>

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="p-4 bg-accent-soft rounded-xl border border-accent/30">
              <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                {t.ai.suggestions}
              </h4>
              <ul className="space-y-1">
                {result.suggestions.map((suggestion, i) => (
                  <li key={i} className="text-sm text-accent-text flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
