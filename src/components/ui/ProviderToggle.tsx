/**
 * ProviderToggle - Toggle button for AI provider selection
 *
 * Displays Groq/Gemini/OpenAI toggle with availability status.
 */

import { type AIProvider, hasApiKey } from '../../lib/ai';
import { useTranslation } from '../../i18n';

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
  const { t } = useTranslation();
  const groqAvailable = hasApiKey('groq');
  const geminiAvailable = hasApiKey('gemini');
  const openaiAvailable = hasApiKey('openai');

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-sm text-on-surface-muted">Provider:</span>
      )}
      <div className="inline-flex rounded-lg overflow-hidden border border-outline-strong">
        <button
          type="button"
          onClick={() => groqAvailable && onChange('groq')}
          disabled={!groqAvailable}
          className={`${sizeClasses} font-medium transition-colors ${
            value === 'groq'
              ? 'bg-orange-500 text-white'
              : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'
          } ${!groqAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={groqAvailable ? `${t.providerToggle.use} Groq` : `Groq ${t.providerToggle.notConfigured}`}
        >
          Groq
        </button>
        <button
          type="button"
          onClick={() => geminiAvailable && onChange('gemini')}
          disabled={!geminiAvailable}
          className={`${sizeClasses} font-medium transition-colors border-l border-outline-strong ${
            value === 'gemini'
              ? 'bg-blue-500 text-white'
              : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'
          } ${!geminiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={geminiAvailable ? `${t.providerToggle.use} Gemini` : `Gemini ${t.providerToggle.notConfigured}`}
        >
          Gemini
        </button>
        <button
          type="button"
          onClick={() => openaiAvailable && onChange('openai')}
          disabled={!openaiAvailable}
          className={`${sizeClasses} font-medium transition-colors border-l border-outline-strong ${
            value === 'openai'
              ? 'bg-emerald-500 text-white'
              : 'bg-surface text-on-surface-secondary hover:bg-surface-alt'
          } ${!openaiAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={openaiAvailable ? `${t.providerToggle.use} OpenAI` : `OpenAI ${t.providerToggle.notConfigured}`}
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
