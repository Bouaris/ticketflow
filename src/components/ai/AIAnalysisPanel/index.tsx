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
import { useTranslation } from '../../../i18n';

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
  const { t, locale } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.common.aiAnalysis}
      variant="panel"
    >
      <div className="flex flex-col h-full">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-on-surface-muted">
            {itemCount} item{itemCount !== 1 ? 's' : ''} {t.aiAnalysis.itemsToAnalyze}
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <button
                onClick={refreshAnalysis}
                disabled={isAnalyzing}
                className="p-1.5 text-on-surface-faint hover:text-on-surface-secondary hover:bg-surface-alt rounded
                         disabled:opacity-50 disabled:cursor-not-allowed"
                title={t.aiAnalysis.refreshAnalysis}
              >
                <RefreshIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Analysis button */}
        {!analysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-xl bg-accent-soft flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-accent-text" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-on-surface">
                {t.aiAnalysis.smartAnalysis}
              </h3>
              <p className="text-xs text-on-surface-muted mt-1 max-w-xs">
                {t.aiAnalysis.smartAnalysisDesc}
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
            <p className="text-xs text-on-surface-muted">
              {t.aiAnalysis.analyzingWait}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-danger-soft border border-danger rounded-lg mb-4">
            <div className="flex items-center gap-2 text-danger-text">
              <WarningIcon className="w-5 h-5" />
              <span className="font-medium">{t.error.analysisError}</span>
            </div>
            <p className="mt-2 text-sm text-danger-text">{error}</p>
            <button
              onClick={() => analyze()}
              className="mt-3 px-3 py-1.5 bg-danger-soft hover:bg-red-200 text-danger-text rounded text-sm"
            >
              {t.aiAnalysis.retry}
            </button>
          </div>
        )}

        {/* Analysis results */}
        {analysis && !isAnalyzing && (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Cache indicator */}
            {hasCache && (
              <p className="text-[10px] text-on-surface-faint">
                {t.aiAnalysis.cachedResults} - {t.aiAnalysis.analyzedAt}{' '}
                {new Date(analysis.analyzedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}

            {/* Blocking bugs alert */}
            {blockingBugs.length > 0 && (
              <div className="p-3 bg-danger-soft border border-danger rounded-lg space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <WarningIcon className="w-4 h-4" />
                  {t.aiAnalysis.blockingBugs} ({blockingBugs.length})
                </h4>
                <div className="space-y-2">
                  {blockingBugs.map((bug) => (
                    <div
                      key={bug.itemId}
                      className="flex items-start gap-2 p-2 bg-surface rounded border border-red-100"
                    >
                      <AIBlockingBadge blocksCount={bug.blocksCount} severity={bug.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-on-surface">{bug.itemId}</p>
                        <p className="text-[10px] text-on-surface-secondary mt-0.5">
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
                <h4 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wide">
                  {t.aiAnalysis.highPriority} ({highPriorityItems.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {highPriorityItems.slice(0, 10).map((item) => (
                    <span
                      key={item.id}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-danger-soft text-danger-text rounded"
                    >
                      {item.id}
                    </span>
                  ))}
                  {highPriorityItems.length > 10 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-on-surface-muted">
                      +{highPriorityItems.length - 10} {t.aiAnalysis.moreItems}
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
            <div className="pt-4 border-t border-outline">
              <button
                onClick={clearAnalysis}
                className="text-xs text-on-surface-muted hover:text-on-surface-secondary"
              >
                {t.aiAnalysis.clearAnalysis}
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
