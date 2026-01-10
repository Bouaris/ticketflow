/**
 * AnalyzeButton - Trigger AI backlog analysis
 *
 * Shows progress during analysis
 */

import { SparklesIcon } from '../../ui/Icons';
import { Spinner } from '../../ui/Spinner';
import type { AnalysisProgress } from '../../../hooks/useAIBacklogSuggestions';

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
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `il y a ${hours}h`;
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`
          p-2 rounded-lg transition-all
          ${isLoading
            ? 'bg-purple-100 text-purple-600'
            : 'hover:bg-purple-100 text-purple-600 hover:text-purple-700'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title="Analyser avec IA"
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
          text-sm font-medium rounded-lg transition-all
          border border-purple-300
          ${isLoading
            ? 'bg-purple-50 text-purple-600'
            : 'bg-white text-purple-600 hover:bg-purple-50'
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
                : 'Analyse...'}
            </span>
          </>
        ) : (
          <>
            <SparklesIcon className="w-4 h-4" />
            <span>Analyser</span>
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
        text-sm font-medium rounded-lg transition-all
        bg-gradient-to-r from-purple-600 to-blue-600
        hover:from-purple-700 hover:to-blue-700
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
              ? `Analyse ${progress.current}/${progress.total}...`
              : 'Analyse en cours...'}
          </span>
        </>
      ) : (
        <>
          <SparklesIcon className="w-4 h-4" />
          <span>Analyser avec IA</span>
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
