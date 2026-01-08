/**
 * ProviderToggle - Toggle button for AI provider selection
 *
 * Displays Groq/Gemini/OpenAI toggle with availability status.
 */

import { type AIProvider, hasApiKey } from '../../lib/ai';

// ============================================================
// TYPES
// ============================================================

interface ProviderToggleProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export function ProviderToggle({
  value,
  onChange,
  size = 'md',
  showLabel = true,
}: ProviderToggleProps) {
  const groqAvailable = hasApiKey('groq');
  const geminiAvailable = hasApiKey('gemini');
  const openaiAvailable = hasApiKey('openai');

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-sm text-gray-500">Provider:</span>
      )}
      <div className="inline-flex rounded-lg overflow-hidden border border-gray-300">
        <button
          type="button"
          onClick={() => groqAvailable && onChange('groq')}
          disabled={!groqAvailable}
          className={`${sizeClasses} font-medium transition-colors ${
            value === 'groq'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${!groqAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={groqAvailable ? 'Utiliser Groq' : 'Clé API Groq non configurée'}
        >
          Groq
        </button>
        <button
          type="button"
          onClick={() => geminiAvailable && onChange('gemini')}
          disabled={!geminiAvailable}
          className={`${sizeClasses} font-medium transition-colors border-l border-gray-300 ${
            value === 'gemini'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${!geminiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={geminiAvailable ? 'Utiliser Gemini' : 'Clé API Gemini non configurée'}
        >
          Gemini
        </button>
        <button
          type="button"
          onClick={() => openaiAvailable && onChange('openai')}
          disabled={!openaiAvailable}
          className={`${sizeClasses} font-medium transition-colors border-l border-gray-300 ${
            value === 'openai'
              ? 'bg-emerald-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${!openaiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={openaiAvailable ? 'Utiliser OpenAI' : 'Clé API OpenAI non configurée'}
        >
          OpenAI
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PROVIDER LABEL HELPER
// ============================================================

export function getProviderLabel(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return 'Groq';
    case 'gemini': return 'Gemini';
    case 'openai': return 'OpenAI';
  }
}
