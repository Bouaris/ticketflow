/**
 * AIGenerationMode - AI-powered item creation interface
 *
 * Allows users to describe their needs in natural language,
 * then generates a complete backlog item using Groq or Gemini.
 */

import { useState, useEffect, type ReactNode } from 'react';
import type { Screenshot } from '../../types/backlog';
import { SparklesIcon, CameraIcon, CloseIcon } from '../ui/Icons';
import { ProviderToggle, getProviderLabel } from '../ui/ProviderToggle';
import { AIContextIndicator } from '../ui/AIContextIndicator';
import { Spinner } from '../ui/Spinner';
import { useTextareaHeight } from '../../hooks/useTextareaHeight';
import type { AIProvider } from '../../lib/ai';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface AIGenerationModeProps {
  /** Current AI prompt text */
  prompt: string;
  /** Update prompt text */
  onPromptChange: (prompt: string) => void;
  /** Selected AI provider */
  provider: AIProvider;
  /** Update provider selection */
  onProviderChange: (provider: AIProvider) => void;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Trigger AI generation */
  onGenerate: () => void;
  /** Cancel AI generation */
  onCancel?: () => void;
  /** Switch to manual mode */
  onSwitchToManual: () => void;
  /** Project path for context indicator */
  projectPath?: string;
  /** Current screenshots attached */
  screenshots: Screenshot[];
  /** Get URL for a screenshot */
  getScreenshotUrl?: (filename: string) => Promise<string | null>;
  /** Remove a screenshot */
  onRemoveScreenshot: (filename: string) => void;
  /** Questioning flow component to render below prompt */
  questioningFlow?: ReactNode;
  /** Whether questioning is active (hides generate button) */
  isQuestioning?: boolean;
}

// ============================================================
// EXAMPLE PROMPTS
// ============================================================

// Example prompts are now locale-driven via t.ai.exampleBug/Feature/Api

// ============================================================
// COMPONENT
// ============================================================

export function AIGenerationMode({
  prompt,
  onPromptChange,
  provider,
  onProviderChange,
  isGenerating,
  onGenerate,
  onCancel,
  onSwitchToManual,
  projectPath,
  screenshots,
  getScreenshotUrl,
  onRemoveScreenshot,
  questioningFlow,
  isQuestioning,
}: AIGenerationModeProps) {
  const { t } = useTranslation();
  // Textarea resizable height (persisted globally)
  const aiPromptHeight = useTextareaHeight({ fieldId: 'aiPrompt' });

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent-soft flex items-center justify-center">
          <SparklesIcon className="text-accent-text w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-on-surface mb-2">
          {t.ai.describeIdea}
        </h3>
        <p className="text-sm text-on-surface-muted">
          {t.ai.describeIdeaDesc}
        </p>
      </div>

      {/* Main Form */}
      <div className="space-y-4">
        {/* Provider Toggle + Context Indicator */}
        <div className="flex items-center justify-center gap-3">
          <ProviderToggle
            value={provider}
            onChange={onProviderChange}
            size="md"
          />
          {projectPath && <AIContextIndicator projectPath={projectPath} />}
        </div>

        {/* Prompt Textarea */}
        <textarea
          ref={aiPromptHeight.ref}
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          onInput={aiPromptHeight.onInput}
          onMouseUp={aiPromptHeight.onMouseUp}
          style={aiPromptHeight.style}
          placeholder={t.ai.promptPlaceholder}
          className="w-full px-4 py-3 border border-outline-strong rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-y text-on-surface placeholder:text-on-surface-faint transition-colors"
          autoFocus
          aria-label={t.ai.describeIdea}
        />

        {/* Questioning Flow (renders below prompt when active) */}
        {questioningFlow}

        {/* Action Buttons (hidden when questioning is active) */}
        {!isQuestioning && (
          <div className="flex items-center justify-between">
            <button
              onClick={onSwitchToManual}
              className="px-4 py-2 text-on-surface-secondary hover:text-on-surface text-sm font-medium"
              aria-label={t.ai.createManually}
            >
              {t.ai.createManually}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
                aria-label={`${t.ai.generateWith} ${getProviderLabel(provider)}`}
                className="px-6 py-3 bg-accent text-white hover:bg-accent-hover font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Spinner size="sm" color="white" />
                    {t.ai.generating}
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    {t.ai.generateWith} {getProviderLabel(provider)}
                  </>
                )}
              </button>
              {isGenerating && onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-3 text-on-surface-secondary hover:text-on-surface text-sm font-medium rounded-xl border border-outline hover:bg-surface-alt transition-colors"
                  aria-label={t.editor.cancelGeneration}
                >
                  {t.action.cancel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attached Screenshots */}
      {screenshots.length > 0 && (
        <div className="mt-6 p-4 bg-surface-alt rounded-xl border border-outline">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-on-surface-secondary flex items-center gap-2">
              <CameraIcon />
              {t.ai.attachedCaptures}
              <span className="bg-accent-soft text-accent-text text-xs px-1.5 py-0.5 rounded">
                {screenshots.length}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {screenshots.map((screenshot) => (
              <ScreenshotThumbnail
                key={screenshot.filename}
                screenshot={screenshot}
                getUrl={getScreenshotUrl}
                onRemove={() => onRemoveScreenshot(screenshot.filename)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paste Hint */}
      <p className="mt-4 text-xs text-center text-on-surface-faint">
        {t.ai.pasteHint}
      </p>

      {/* Example Prompts */}
      <div className="mt-6 pt-6 border-t border-outline">
        <p className="text-xs font-medium text-on-surface-muted uppercase tracking-wider mb-3">
          {t.ai.examples}
        </p>
        <div className="grid gap-2">
          {[t.ai.exampleBug, t.ai.exampleFeature, t.ai.exampleApi].map((example, i) => (
            <button
              key={i}
              onClick={() => onPromptChange(example)}
              className="text-left px-4 py-2 bg-surface-alt hover:bg-surface-alt rounded-lg text-sm text-on-surface-secondary hover:text-on-surface transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SCREENSHOT THUMBNAIL (for AI mode)
// ============================================================

interface ScreenshotThumbnailProps {
  screenshot: Screenshot;
  getUrl?: (filename: string) => Promise<string | null>;
  onRemove: () => void;
}

function ScreenshotThumbnail({ screenshot, getUrl, onRemove }: ScreenshotThumbnailProps) {
  const { t } = useTranslation();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!getUrl) return;

    let mounted = true;
    getUrl(screenshot.filename).then(url => {
      if (mounted && url) {
        setThumbnailUrl(url);
      }
    });

    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [screenshot.filename, getUrl]);

  return (
    <div className="relative group aspect-video bg-surface rounded-lg overflow-hidden border border-outline shadow-sm">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={screenshot.alt || screenshot.filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-alt">
          <div className="w-4 h-4 border-2 border-outline-strong border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onRemove}
        aria-label={t.screenshot.deleteCapture}
        className="absolute top-1 right-1 p-1 bg-danger-soft0 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger shadow-lg"
        title={t.action.delete}
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
