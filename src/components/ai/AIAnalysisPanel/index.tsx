/**
 * AIAnalysisPanel - Slide-over panel for AI backlog analysis
 *
 * Displays:
 * - Analysis trigger button
 * - Blocking bugs alerts
 * - AI insights
 * - Item groupings with accept/reject
 * - High priority items summary
 */

import { Modal } from '../../ui/Modal';
import { AnalyzeButton } from './AnalyzeButton';
import { InsightsPanel } from './InsightsPanel';
import { GroupPanel } from './GroupPanel';
import { AIBlockingBadge } from '../AIBlockingIndicator';
import { RefreshIcon, WarningIcon, SparklesIcon } from '../../ui/Icons';
import type { UseAIBacklogSuggestionsReturn } from '../../../hooks/useAIBacklogSuggestions';

interface AIAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  aiSuggestions: UseAIBacklogSuggestionsReturn;
  itemCount: number;
}

export function AIAnalysisPanel({
  isOpen,
  onClose,
  aiSuggestions,
  itemCount,
}: AIAnalysisPanelProps) {
  const {
    analysis,
    isAnalyzing,
    error,
    progress,
    hasCache,
    analyze,
    refreshAnalysis,
    clearAnalysis,
    blockingBugs,
    insights,
    groups,
    decisions,
    acceptSuggestion,
    rejectSuggestion,
    highPriorityItems,
  } = aiSuggestions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Analyse IA du Backlog"
      variant="panel"
    >
      <div className="flex flex-col h-full">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            {itemCount} item{itemCount !== 1 ? 's' : ''} à analyser
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <button
                onClick={refreshAnalysis}
                disabled={isAnalyzing}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded
                         disabled:opacity-50 disabled:cursor-not-allowed"
                title="Rafraîchir l'analyse"
              >
                <RefreshIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Analysis button */}
        {!analysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-900">
                Analyse intelligente du backlog
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                L'IA analysera vos {itemCount} items pour suggérer des priorités,
                regroupements et identifier les bugs bloquants.
              </p>
            </div>
            <AnalyzeButton
              onClick={() => analyze()}
              isLoading={isAnalyzing}
              progress={progress}
              disabled={itemCount === 0}
            />
          </div>
        )}

        {/* Loading state */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AnalyzeButton
              onClick={() => {}}
              isLoading={true}
              progress={progress}
              variant="secondary"
            />
            <p className="text-xs text-gray-500">
              Analyse en cours... Veuillez patienter.
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-red-700">
              <WarningIcon className="w-5 h-5" />
              <span className="font-medium">Erreur d'analyse</span>
            </div>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <button
              onClick={() => analyze()}
              className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Analysis results */}
        {analysis && !isAnalyzing && (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Cache indicator */}
            {hasCache && (
              <p className="text-[10px] text-gray-400">
                Résultats en cache • Analysé{' '}
                {new Date(analysis.analyzedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}

            {/* Blocking bugs alert */}
            {blockingBugs.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <WarningIcon className="w-4 h-4" />
                  Bugs bloquants ({blockingBugs.length})
                </h4>
                <div className="space-y-2">
                  {blockingBugs.map((bug) => (
                    <div
                      key={bug.itemId}
                      className="flex items-start gap-2 p-2 bg-white rounded border border-red-100"
                    >
                      <AIBlockingBadge blocksCount={bug.blocksCount} severity={bug.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-900">{bug.itemId}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {bug.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High priority summary */}
            {highPriorityItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Haute priorité ({highPriorityItems.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {highPriorityItems.slice(0, 10).map((item) => (
                    <span
                      key={item.id}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-red-100 text-red-700 rounded"
                    >
                      {item.id}
                    </span>
                  ))}
                  {highPriorityItems.length > 10 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-gray-500">
                      +{highPriorityItems.length - 10} autres
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Insights */}
            <InsightsPanel insights={insights} />

            {/* Groups */}
            <GroupPanel
              groups={groups}
              decisions={decisions}
              onAccept={(groupId) => acceptSuggestion(groupId, 'group')}
              onReject={rejectSuggestion}
            />

            {/* Clear analysis button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={clearAnalysis}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Effacer l'analyse
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Re-export sub-components
export { AnalyzeButton } from './AnalyzeButton';
export { InsightsPanel, InsightsCompact } from './InsightsPanel';
export { GroupPanel } from './GroupPanel';
