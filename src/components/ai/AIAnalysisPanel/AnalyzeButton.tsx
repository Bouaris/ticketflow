/**
 * AnalyzeButton - Trigger AI backlog analysis
 *
 * Shows progress during analysis
 */

import { SparklesIcon } from '../../ui/Icons';
import { Spinner } from '../../ui/Spinner';
import type { AnalysisProgress } from '../../../hooks/useAIBacklogSuggestions';
import { useTranslation } from '../../../i18n';

interface AnalyzeButtonProps {
  onClick: () => void;
  isLoading: boolean;
  progress?: AnalysisProgress | null;
  lastAnalyzed?: number | null;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'icon';
  className?: string;
}

export function AnalyzeButton({
  onClick,
  isLoading,
  progress,
  lastAnalyzed,
  disabled = false,
  variant = 'primary',
  className = '',
}: AnalyzeButtonProps) {
  const { t, locale } = useTranslation();

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t.aiAnalysis.justNow;
    if (minutes < 60) return locale === 'en' ? `${minutes}m ago` : `il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return locale === 'en' ? `${hours}h ago` : `il y a ${hours}h`;
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`
          p-2 rounded-lg transition-colors
          ${isLoading
            ? 'bg-surface-alt text-on-surface-secondary'
            : 'hover:bg-surface-alt text-on-surface-secondary hover:text-on-surface'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={t.aiAnalysis.analyzeWithAI}
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <SparklesIcon className="w-5 h-5" />
        )}
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`
          flex items-center gap-2 px-3 py-1.5
          text-sm font-medium rounded-lg transition-colors
          border border-outline
          ${isLoading
            ? 'bg-surface-alt text-on-surface-secondary'
            : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isLoading ? (
          <>
            <Spinner size="sm" />
            <span>
              {progress
                ? `${progress.current}/${progress.total}`
                : t.aiAnalysis.analyzing}
            </span>
          </>
        ) : (
          <>
            <SparklesIcon className="w-4 h-4" />
            <span>{t.settings.analyze}</span>
          </>
        )}
      </button>
    );
  }

  // Primary variant
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center justify-center gap-2 px-4 py-2
        text-sm font-medium rounded-lg transition-colors
        bg-accent hover:bg-accent-hover
        text-white shadow-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" className="text-white" />
          <span>
            {progress
              ? `${t.aiAnalysis.analyzingProgress} ${progress.current}/${progress.total}...`
              : t.aiAnalysis.analyzing}
          </span>
        </>
      ) : (
        <>
          <SparklesIcon className="w-4 h-4" />
          <span>{t.aiAnalysis.analyzeWithAI}</span>
        </>
      )}
      {!isLoading && lastAnalyzed && (
        <span className="text-xs opacity-75 ml-1">
          ({formatTime(lastAnalyzed)})
        </span>
      )}
    </button>
  );
}
