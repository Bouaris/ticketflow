/**
 * MaintenanceModal - AI-powered backlog format validation and correction
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { SpinnerIcon, WarningIcon, CheckIcon } from '../ui/Icons';
import { analyzeBacklogFormat, correctBacklogFormat, type BacklogMaintenanceResult } from '../../lib/ai';
import type { MaintenanceIssue } from '../../types/ai';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  onApplyCorrections: (correctedMarkdown: string) => Promise<void>;
}

const ISSUE_TYPE_LABELS: Record<MaintenanceIssue['type'], { label: string; color: string }> = {
  duplicate_id: { label: 'ID dupliqué', color: 'bg-red-100 text-red-700' },
  missing_separator: { label: 'Séparateur manquant', color: 'bg-yellow-100 text-yellow-700' },
  malformed_section: { label: 'Section malformée', color: 'bg-orange-100 text-orange-700' },
  fused_items: { label: 'Items fusionnés', color: 'bg-purple-100 text-purple-700' },
  invalid_format: { label: 'Format invalide', color: 'bg-gray-100 text-gray-700' },
};

export function MaintenanceModal({
  isOpen,
  onClose,
  markdownContent,
  onApplyCorrections,
}: MaintenanceModalProps) {
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
        error: error instanceof Error ? error.message : 'Erreur inconnue',
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
        setCorrectionError(correctionResult.error || 'Erreur de correction');
      }
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : 'Erreur inconnue');
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
        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        Fermer
      </button>
      <div className="flex items-center gap-3">
        {!correctedMarkdown && !correcting && (
          <button
            onClick={handleCorrect}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            Corriger automatiquement
          </button>
        )}
        {correcting && (
          <button disabled className="px-4 py-2 text-sm bg-blue-400 text-white rounded-lg flex items-center gap-2">
            <SpinnerIcon className="w-4 h-4 animate-spin" />
            Correction en cours...
          </button>
        )}
        {correctedMarkdown && !applied && (
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Application...
              </>
            ) : (
              'Appliquer les corrections'
            )}
          </button>
        )}
        {applied && (
          <span className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            Appliqué !
          </span>
        )}
      </div>
    </div>
  ) : (
    <div className="flex justify-end">
      <button
        onClick={handleClose}
        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        Fermer
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Maintenance Backlog.md"
      size="lg"
      footer={footerContent}
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Initial state - no analysis yet */}
        {!result && !analyzing && (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <WarningIcon className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Analyser le fichier Backlog
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              L'IA va scanner votre fichier Markdown pour détecter les problèmes de formatage :
              doublons d'ID, items fusionnés, sections malformées, etc.
            </p>
            <button
              onClick={handleAnalyze}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Lancer l'analyse
            </button>
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="text-center py-12">
            <SpinnerIcon className="w-10 h-10 mx-auto text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Analyse en cours...</p>
            <p className="text-sm text-gray-400 mt-1">L'IA vérifie le format de votre backlog</p>
          </div>
        )}

        {/* Error state */}
        {result && !result.success && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <WarningIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Erreur d'analyse</h4>
                <p className="text-sm text-red-600 mt-1">{result.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success - no issues */}
        {result?.success && result.issues.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckIcon className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-green-800">Aucun problème détecté</h3>
            <p className="text-sm text-gray-500 mt-2">
              Votre fichier Backlog.md est conforme au format Ticketflow.
            </p>
          </div>
        )}

        {/* Success - issues found */}
        {result?.success && result.issues.length > 0 && (
          <>
            {/* Summary */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-1">
                {result.issues.length} problème{result.issues.length > 1 ? 's' : ''} détecté{result.issues.length > 1 ? 's' : ''}
              </h4>
              {result.summary && (
                <p className="text-sm text-amber-700">{result.summary}</p>
              )}
            </div>

            {/* Issues list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {result.issues.map((issue, index) => {
                const typeInfo = ISSUE_TYPE_LABELS[issue.type];
                return (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{issue.description}</p>
                        {issue.location && (
                          <p className="text-xs text-gray-500 mt-1">
                            Localisation : {issue.location}
                          </p>
                        )}
                        <p className="text-xs text-green-600 mt-1">
                          Correction : {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Correction error */}
            {correctionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">Erreur de correction : {correctionError}</p>
              </div>
            )}

            {/* Correction preview */}
            {correctedMarkdown && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Corrections prêtes</h4>
                <p className="text-sm text-green-700 mb-3">
                  Le fichier a été corrigé. Cliquez sur "Appliquer les corrections" pour sauvegarder.
                </p>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono max-h-32 overflow-auto">
                  <pre className="whitespace-pre-wrap">
                    {correctedMarkdown.slice(0, 1000)}
                    {correctedMarkdown.length > 1000 && '\n\n[...]'}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
