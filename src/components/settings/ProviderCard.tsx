/**
 * Provider Card - Reusable provider card component
 *
 * Shows provider icon, status badge, name, description, and API key configuration.
 * Used for built-in providers (Groq, Gemini, OpenAI).
 */

import { useState } from 'react';
import type { ProviderConfig } from '../../types/aiProvider';
import { hasApiKey, getApiKey, setApiKey, clearApiKey, resetClient } from '../../lib/ai';
import { GroqIcon, GeminiIcon, OpenAIIcon, CheckIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';
import { isTauri, openExternalUrl } from '../../lib/tauri-bridge';

interface ProviderCardProps {
  provider: ProviderConfig;
  isActive: boolean;
  onSelect: () => void;
}

export function ProviderCard({ provider, isActive, onSelect }: ProviderCardProps) {
  const { t, locale } = useTranslation();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const isConfigured = hasApiKey(provider.id);

  // Load current API key when card becomes active
  useState(() => {
    if (isActive) {
      const currentKey = getApiKey(provider.id);
      setApiKeyInput(currentKey || '');
    }
  });

  // Provider-specific colors
  const colors = {
    groq: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
    gemini: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
    openai: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
  }[provider.id] || { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' };

  // Provider-specific URLs (for built-in providers)
  const providerUrls: Record<string, string> = {
    groq: 'https://console.groq.com/keys',
    gemini: 'https://makersuite.google.com/app/apikey',
    openai: 'https://platform.openai.com/api-keys',
  };

  const providerUrl = providerUrls[provider.id] || '';

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim(), provider.id);
      resetClient(provider.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClear = () => {
    clearApiKey(provider.id);
    resetClient(provider.id);
    setApiKeyInput('');
    setSaved(false);
  };

  const handleGetKey = () => {
    if (providerUrl) {
      if (isTauri()) {
        openExternalUrl(providerUrl).catch(() => {});
      } else {
        window.open(providerUrl, '_blank');
      }
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all relative ${
        isActive
          ? `${colors.border} ${colors.bg}`
          : 'border-outline hover:border-outline-strong cursor-pointer'
      }`}
      onClick={!isActive ? onSelect : undefined}
    >
      {/* Status badge */}
      <div className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium rounded-full ${
        isConfigured
          ? 'bg-success-soft text-success-text'
          : 'bg-surface-alt text-on-surface-muted'
      }`}>
        {isConfigured ? t.settings.providerConfigured : t.settings.providerNotConfigured}
      </div>

      {/* Provider header */}
      <div className="flex items-center gap-3 mb-2">
        {provider.id === 'groq' && (
          <GroqIcon className={`w-6 h-6 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
        )}
        {provider.id === 'gemini' && (
          <GeminiIcon className={`w-6 h-6 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
        )}
        {provider.id === 'openai' && (
          <OpenAIIcon className={`w-6 h-6 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
        )}
        <span className={`font-semibold text-base ${isActive ? colors.text : 'text-on-surface-secondary'}`}>
          {provider.name}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-on-surface-muted mb-3">
        {provider.id === 'groq' && (locale === 'fr' ? '14,400 req/jour gratuit, ultra rapide (Llama 3.3 70B)' : '14,400 req/day free, ultra fast (Llama 3.3 70B)')}
        {provider.id === 'gemini' && (locale === 'fr' ? '15 req/min, 1M tokens/jour (Gemini 2.0 Flash)' : '15 req/min, 1M tokens/day (Gemini 2.0 Flash)')}
        {provider.id === 'openai' && (locale === 'fr' ? 'GPT-4o et GPT-4o Mini, payant' : 'GPT-4o and GPT-4o Mini, paid')}
      </p>

      {/* API Key configuration (shown when active) */}
      {isActive && (
        <div className="mt-4 space-y-3 pt-3 border-t border-outline">
          <div>
            <label className="block text-sm font-medium text-on-surface-secondary mb-2">
              {t.settings.apiKey}
            </label>
            {providerUrl && (
              <p className="text-xs text-on-surface-muted mb-2">
                {t.settings.getKeyAt}{' '}
                <button
                  type="button"
                  className="text-accent-text hover:underline cursor-pointer"
                  onClick={handleGetKey}
                >
                  {provider.id === 'groq' ? 'Groq Console' : provider.id === 'gemini' ? 'Google AI Studio' : 'OpenAI Platform'}
                </button>
              </p>
            )}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={
                  provider.id === 'groq' ? 'gsk_...' :
                  provider.id === 'gemini' ? 'AIza...' :
                  provider.id === 'openai' ? 'sk-...' : 'API Key...'
                }
                className="w-full px-3 py-2 pr-20 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyInput.trim()) {
                    handleSave();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-on-surface-muted hover:text-on-surface-secondary"
              >
                {showKey ? t.settings.hideKey : t.settings.showKey}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleClear}
              className="text-sm text-danger-text hover:text-danger-text"
            >
              {t.settings.clearKey}
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKeyInput.trim()}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saved && <CheckIcon className="w-4 h-4" />}
              {saved ? t.settings.saved : t.settings.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
