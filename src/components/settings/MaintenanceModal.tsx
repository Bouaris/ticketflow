/**
 * MaintenanceModal - AI-powered backlog format validation and correction
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { SpinnerIcon, WarningIcon, CheckIcon } from '../ui/Icons';
import { analyzeBacklogFormat, correctBacklogFormat, type BacklogMaintenanceResult } from '../../lib/ai';
import type { MaintenanceIssue } from '../../types/ai';
import { useTranslation } from '../../i18n';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  onApplyCorrections: (correctedMarkdown: string) => Promise<void>;
}

const ISSUE_TYPE_LABELS: Record<MaintenanceIssue['type'], { label: string; color: string }> = {
  duplicate_id: { label: 'ID dupliqué', color: 'bg-danger-soft text-danger-text' },
  missing_separator: { label: 'Séparateur manquant', color: 'bg-yellow-100 text-yellow-700' },
  malformed_section: { label: 'Section malformée', color: 'bg-orange-100 text-orange-700' },
  fused_items: { label: 'Items fusionnés', color: 'bg-purple-100 text-purple-700' },
  invalid_format: { label: 'Format invalide', color: 'bg-surface-alt text-on-surface-secondary' },
};

export function MaintenanceModal({
  isOpen,
  onClose,
  markdownContent,
  onApplyCorrections,
}: MaintenanceModalProps) {
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<BacklogMaintenanceResult | null>(null);
  const [correctedMarkdown, setCorrectedMarkdown] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setResult(null);
    setCorrectedMarkdown(null);
    setCorrectionError(null);
    setApplied(false);

    try {
      const analysisResult = await analyzeBacklogFormat(markdownContent);
      setResult(analysisResult);
    } catch (error) {
      setResult({
        success: false,
        issues: [],
        error: error instanceof Error ? error.message : t.error.unknown,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCorrect = async () => {
    if (!result?.issues.length) return;

    setCorrecting(true);
    setCorrectionError(null);

    try {
      const correctionResult = await correctBacklogFormat(markdownContent, result.issues);
      if (correctionResult.success && correctionResult.correctedMarkdown) {
        setCorrectedMarkdown(correctionResult.correctedMarkdown);
      } else {
        setCorrectionError(correctionResult.error || t.maintenance.correctionError);
      }
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : t.error.unknown);
    } finally {
      setCorrecting(false);
    }
  };

  const handleApply = async () => {
    if (!correctedMarkdown) return;

    setApplying(true);
    try {
      await onApplyCorrections(correctedMarkdown);
      setApplied(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Failed to apply corrections:', error);
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setCorrectedMarkdown(null);
    setCorrectionError(null);
    setApplied(false);
    onClose();
  };

  // Footer with action buttons
  const footerContent = result?.success && result.issues.length > 0 ? (
    <div className="flex items-center justify-between w-full">
      <button
        onClick={handleClose}
        className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg"
      >
        {t.action.close}
      </button>
      <div className="flex items-center gap-3">
        {!correctedMarkdown && !correcting && (
          <button
            onClick={handleCorrect}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover flex items-center gap-2"
          >
            {t.maintenance.fix}
          </button>
        )}
        {correcting && (
          <button disabled className="px-4 py-2 text-sm bg-blue-400 text-white rounded-lg flex items-center gap-2">
            <SpinnerIcon className="w-4 h-4 animate-spin" />
            {t.maintenance.fixing}
          </button>
        )}
        {correctedMarkdown && !applied && (
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-2 text-sm bg-success text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Application...
              </>
            ) : (
              t.maintenance.fixApply
            )}
          </button>
        )}
        {applied && (
          <span className="px-4 py-2 text-sm bg-success-soft text-success-text rounded-lg flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            {t.maintenance.applied}
          </span>
        )}
      </div>
    </div>
  ) : (
    <div className="flex justify-end">
      <button
        onClick={handleClose}
        className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg"
      >
        {t.action.close}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.maintenance.title}
      size="lg"
      footer={footerContent}
      className="h-auto"
    >
      <div className="flex flex-col h-full min-h-[300px]">
        {/* Initial state - no analysis yet */}
        {!result && !analyzing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-accent-soft rounded-full flex items-center justify-center">
                <WarningIcon className="w-8 h-8 text-accent-text" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-on-surface mb-2">
              {t.maintenance.analyzeTitle}
            </h3>
            <p className="text-sm text-on-surface-muted mb-6 max-w-md mx-auto">
              {t.maintenance.analyzeDesc}
            </p>
            <button
              onClick={handleAnalyze}
              className="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium"
            >
              {t.maintenance.startAnalysis}
            </button>
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <SpinnerIcon className="w-10 h-10 mx-auto text-accent-text animate-spin mb-4" />
            <p className="text-on-surface-secondary">{t.maintenance.analyzing}</p>
            <p className="text-sm text-on-surface-faint mt-1">{t.maintenance.analyzingDesc}</p>
          </div>
        )}

        {/* Error state */}
        {result && !result.success && (
          <div className="flex-1 flex items-center">
            <div className="w-full bg-danger-soft border border-danger rounded-lg p-4">
              <div className="flex items-start gap-3">
                <WarningIcon className="w-5 h-5 text-danger-text flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">{t.maintenance.analysisError}</h4>
                  <p className="text-sm text-danger-text mt-1">{result.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success - no issues */}
        {result?.success && result.issues.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 mx-auto bg-success-soft rounded-full flex items-center justify-center mb-4">
              <CheckIcon className="w-8 h-8 text-success-text" />
            </div>
            <h3 className="text-lg font-medium text-green-800">{t.maintenance.noProblems}</h3>
            <p className="text-sm text-on-surface-muted mt-2">
              {t.maintenance.noProblemsDesc}
            </p>
          </div>
        )}

        {/* Success - issues found */}
        {result?.success && result.issues.length > 0 && (
          <div className="flex flex-col h-full gap-4">
            {/* Summary - fixed height */}
            <div className="flex-shrink-0 bg-warning-soft border border-warning-text/30 rounded-lg p-4">
              <h4 className="font-medium text-warning-text mb-1">
                {result.issues.length} {t.maintenance.problems}
              </h4>
              {result.summary && (
                <p className="text-sm text-amber-700">{result.summary}</p>
              )}
            </div>

            {/* Issues list - expands when no preview, limited when preview shown */}
            <div className={`space-y-2 overflow-y-auto ${correctedMarkdown ? 'flex-shrink-0 max-h-[35%]' : 'flex-1'}`}>
              {result.issues.map((issue, index) => {
                const typeInfo = ISSUE_TYPE_LABELS[issue.type];
                return (
                  <div
                    key={index}
                    className="border border-outline rounded-lg p-3 bg-surface"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface">{issue.description}</p>
                        {issue.location && (
                          <p className="text-xs text-on-surface-muted mt-1">
                            {t.maintenance.location} : {issue.location}
                          </p>
                        )}
                        <p className="text-xs text-success-text mt-1">
                          {t.maintenance.correction} : {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Correction error */}
            {correctionError && (
              <div className="flex-shrink-0 bg-danger-soft border border-danger rounded-lg p-3">
                <p className="text-sm text-danger-text">{t.maintenance.correctionError} : {correctionError}</p>
              </div>
            )}

            {/* Correction preview - takes remaining space */}
            {correctedMarkdown && (
              <div className="flex-1 min-h-0 flex flex-col bg-success-soft border border-green-200 rounded-lg p-4">
                <h4 className="flex-shrink-0 font-medium text-green-800 mb-2">{t.maintenance.fixReady}</h4>
                <p className="flex-shrink-0 text-sm text-success-text mb-3">
                  {t.maintenance.fixReadyDesc}
                </p>
                <div className="flex-1 min-h-0 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-auto">
                  <pre className="whitespace-pre-wrap">
                    {correctedMarkdown.slice(0, 2000)}
                    {correctedMarkdown.length > 2000 && '\n\n[...]'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
