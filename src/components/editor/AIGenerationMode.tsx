/**
 * AIGenerationMode - AI-powered item creation interface
 *
 * Allows users to describe their needs in natural language,
 * then generates a complete backlog item using Groq or Gemini.
 */

import { useState, useEffect } from 'react';
import type { Screenshot } from '../../types/backlog';
import { SparklesIcon, CameraIcon, CloseIcon } from '../ui/Icons';
import { ProviderToggle, getProviderLabel } from '../ui/ProviderToggle';
import { AIContextIndicator } from '../ui/AIContextIndicator';
import { Spinner } from '../ui/Spinner';
import type { AIProvider } from '../../lib/ai';

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
}

// ============================================================
// EXAMPLE PROMPTS
// ============================================================

const EXAMPLE_PROMPTS = [
  'Bug: Le bouton de sauvegarde ne fonctionne pas sur Safari',
  'Feature: Ajouter un mode sombre à l\'interface',
  'API: Intégrer l\'endpoint de synchronisation externe',
];

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
  onSwitchToManual,
  projectPath,
  screenshots,
  getScreenshotUrl,
  onRemoveScreenshot,
}: AIGenerationModeProps) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <SparklesIcon className="text-white w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Décrivez votre idée
        </h3>
        <p className="text-sm text-gray-500">
          L'IA va analyser votre description et générer un ticket complet avec titre, user story, specs et critères d'acceptation.
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
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          placeholder="Ex: Je voudrais ajouter un bouton pour exporter les données en PDF. L'utilisateur doit pouvoir choisir les colonnes à inclure et le format (portrait/paysage)..."
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-900 placeholder:text-gray-400"
          autoFocus
          aria-label="Description de votre idée"
        />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onSwitchToManual}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
            aria-label="Créer manuellement"
          >
            Créer manuellement
          </button>

          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt.trim()}
            aria-label={`Générer avec ${getProviderLabel(provider)}`}
            className={`px-6 py-3 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg ${
              provider === 'groq'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/25'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/25'
            }`}
          >
            {isGenerating ? (
              <>
                <Spinner size="sm" color="white" />
                Génération en cours...
              </>
            ) : (
              <>
                <SparklesIcon />
                Générer avec {getProviderLabel(provider)}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attached Screenshots */}
      {screenshots.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CameraIcon />
              Captures jointes
              <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">
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
      <p className="mt-4 text-xs text-center text-gray-400">
        Astuce: Collez une capture d'écran (CTRL+V) pour l'ajouter
      </p>

      {/* Example Prompts */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Exemples
        </p>
        <div className="grid gap-2">
          {EXAMPLE_PROMPTS.map((example, i) => (
            <button
              key={i}
              onClick={() => onPromptChange(example)}
              className="text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors"
              aria-label={`Utiliser l'exemple: ${example}`}
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
    <div className="relative group aspect-video bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={screenshot.alt || screenshot.filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onRemove}
        aria-label="Supprimer la capture"
        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
        title="Supprimer"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
