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
import { hasApiKey } from '../../lib/ai';
import { AIContextIndicator } from '../ui/AIContextIndicator';
import { Spinner } from '../ui/Spinner';
import { SparklesIcon, CheckCircleIcon } from '../ui/Icons';
import { refineItem, type RefinementResult, type AIProvider } from '../../lib/ai';
import type { BacklogItem, Criterion } from '../../types/backlog';

// ============================================================
// TYPES
// ============================================================

interface AIRefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BacklogItem;
  onAccept: (refinedItem: Partial<BacklogItem>, suggestions: string[]) => void;
  projectPath?: string;
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
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
      <div className="space-y-1 text-sm">
        {before && (
          <div className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg line-through">
            {before}
          </div>
        )}
        {after && (
          <div className="text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
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
  // Find added and removed items
  const removed = before.filter(item => !after.includes(item));
  const added = after.filter(item => !before.includes(item));
  const unchanged = before.filter(item => after.includes(item));

  if (removed.length === 0 && added.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
      <ul className="space-y-1 text-sm">
        {removed.map((item, i) => (
          <li key={`removed-${i}`} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg line-through">
            - {item}
          </li>
        ))}
        {added.map((item, i) => (
          <li key={`added-${i}`} className="text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            + {item}
          </li>
        ))}
        {unchanged.length > 0 && added.length === 0 && removed.length === 0 && (
          <li className="text-gray-500 text-xs italic">Aucun changement</li>
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
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
      <ul className="space-y-1 text-sm">
        {removed.map((text, i) => (
          <li key={`removed-${i}`} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg line-through flex items-center gap-2">
            <span className="w-4 h-4 border border-red-400 rounded" />
            {text}
          </li>
        ))}
        {added.map((text, i) => (
          <li key={`added-${i}`} className="text-green-600 bg-green-50 px-3 py-1.5 rounded-lg flex items-center gap-2">
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
}: AIRefineModalProps) {
  // State
  const [phase, setPhase] = useState<Phase>('input');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => {
    const saved = localStorage.getItem('ai-provider');
    return (saved === 'groq' || saved === 'gemini') ? saved : 'groq';
  });
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
      setError(`Configurez votre clé API ${getProviderLabel(selectedProvider)} dans les paramètres`);
      return;
    }

    setPhase('loading');
    setError(null);

    try {
      const refinementResult = await refineItem(item, {
        provider: selectedProvider,
        projectPath,
        additionalPrompt: additionalPrompt.trim() || undefined,
      });

      if (refinementResult.success) {
        setResult(refinementResult);
        setPhase('result');
      } else {
        setError(refinementResult.error || 'Erreur lors de l\'affinage');
        setPhase('input');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
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
      title="Affiner avec IA"
      size="lg"
      closeOnBackdrop={phase !== 'loading'}
      closeOnEscape={phase !== 'loading'}
      header={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <SparklesIcon className="text-white w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Affiner avec IA</h2>
            <p className="text-xs text-gray-500">{item.id} - {item.title}</p>
          </div>
        </div>
      }
      footer={
        phase === 'result' ? (
          <ModalFooter>
            <button
              onClick={() => setPhase('input')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Recommencer
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAccept}
              disabled={!hasChanges}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Accepter les changements
            </button>
          </ModalFooter>
        ) : phase === 'input' ? (
          <ModalFooter>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleRefine}
              className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${
                selectedProvider === 'groq'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              Affiner avec {getProviderLabel(selectedProvider)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructions supplémentaires (optionnel)
            </label>
            <textarea
              value={additionalPrompt}
              onChange={e => setAdditionalPrompt(e.target.value)}
              placeholder="Ex: Focus sur la sécurité, ajoute des critères de performance, simplifie la user story..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-900 placeholder:text-gray-400"
              autoFocus
            />
          </div>

          {/* Current Item Summary */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Item actuel</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Titre:</span> {item.title}</p>
              {item.userStory && <p><span className="font-medium">User Story:</span> {item.userStory.substring(0, 100)}...</p>}
              <p><span className="font-medium">Specs:</span> {item.specs?.length || 0} | <span className="font-medium">Critères:</span> {item.criteria?.length || 0}</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Examples */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Exemples d'instructions
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
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 hover:text-gray-900 transition-colors"
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
          <p className="mt-4 text-gray-600">Affinage en cours avec {getProviderLabel(selectedProvider)}...</p>
          <p className="mt-2 text-sm text-gray-400">Analyse et amélioration de votre item</p>
        </div>
      )}

      {/* Phase: Result */}
      {phase === 'result' && result?.refinedItem && (
        <div className="space-y-6">
          {/* Changes Preview */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Changements proposés
            </h3>

            {!hasChanges ? (
              <div className="p-4 bg-gray-50 rounded-xl text-gray-600 text-sm text-center">
                L'IA n'a pas proposé de modifications significatives.
              </div>
            ) : (
              <div className="space-y-2">
                <TextDiff
                  label="Titre"
                  before={item.title}
                  after={result.refinedItem.title}
                />
                <TextDiff
                  label="User Story"
                  before={item.userStory}
                  after={result.refinedItem.userStory || undefined}
                />
                <ListDiff
                  label="Spécifications"
                  before={item.specs}
                  after={result.refinedItem.specs}
                />
                <CriteriaDiff
                  label="Critères d'acceptation"
                  before={item.criteria}
                  after={result.refinedItem.criteria}
                />
                <ListDiff
                  label="Dépendances"
                  before={item.dependencies}
                  after={result.refinedItem.dependencies}
                />
                <ListDiff
                  label="Contraintes"
                  before={item.constraints}
                  after={result.refinedItem.constraints}
                />
              </div>
            )}
          </div>

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                Suggestions de l'IA
              </h4>
              <ul className="space-y-1">
                {result.suggestions.map((suggestion, i) => (
                  <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
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
