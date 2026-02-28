/**
 * Provider Card - Reusable provider card component
 *
 * Shows provider icon, status badge, name, description, and API key configuration.
 * Used for built-in providers (Groq, Gemini, OpenAI).
 */

import { useState, useEffect } from 'react';
import type { ProviderConfig, BuiltInProviderId } from '../../types/aiProvider';
import { hasApiKey, getApiKey, setApiKey, clearApiKey, resetClient, getSelectedModel, setSelectedModel } from '../../lib/ai';
import { GroqIcon, GeminiIcon, OpenAIIcon, CheckIcon, InfoIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';
import { useTranslation } from '../../i18n';
import { isTauri, openExternalUrl } from '../../lib/tauri-bridge';
import { testProviderHealth, type HealthCheckResult } from '../../lib/ai-health';
import { QuotaGauge } from './QuotaGauge';

interface ProviderCardProps {
  provider: ProviderConfig;
  isActive: boolean;
  onSelect: () => void;
}

// Module-scope typed color map — avoids re-creating on every render
const PROVIDER_COLORS: Record<BuiltInProviderId, { border: string; bg: string; text: string; icon: string }> = {
  groq: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
  gemini: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
  openai: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
};

// Module-scope provider URLs — avoids re-creating on every render
const PROVIDER_URLS: Record<string, string> = {
  groq: 'https://console.groq.com/keys',
  gemini: 'https://makersuite.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
};

export function ProviderCard({ provider, isActive, onSelect }: ProviderCardProps) {
  const { t } = useTranslation();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [healthCheck, setHealthCheck] = useState<{
    loading: boolean;
    result: HealthCheckResult | null;
  }>({ loading: false, result: null });
  const [selectedModelId, setSelectedModelId] = useState<string>(provider.defaultModel);

  const isConfigured = hasApiKey(provider.id);

  // Load current API key when card becomes active
  useEffect(() => {
    if (isActive) {
      const currentKey = getApiKey(provider.id);
      setApiKeyInput(currentKey || '');
    }
  }, [isActive, provider.id]);

  // Load persisted model selection when card becomes active
  useEffect(() => {
    if (isActive) {
      const persisted = getSelectedModel(provider.id);
      setSelectedModelId(persisted || provider.defaultModel);
    }
  }, [isActive, provider.id, provider.defaultModel]);

  // Provider-specific colors — typed lookup with explicit fallback for custom providers
  const fallbackColors = { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' };
  const colors = (provider.id in PROVIDER_COLORS)
    ? PROVIDER_COLORS[provider.id as BuiltInProviderId]
    : fallbackColors;

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
    const providerUrl = PROVIDER_URLS[provider.id];
    if (providerUrl) {
      if (isTauri()) {
        openExternalUrl(providerUrl).catch(() => {});
      } else {
        window.open(providerUrl, '_blank');
      }
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    setSelectedModel(provider.id, modelId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setHealthCheck({ loading: true, result: null });
    const result = await testProviderHealth(provider.id);
    setHealthCheck({ loading: false, result });

    // Auto-clear success message after 3 seconds
    if (result.success) {
      setTimeout(() => {
        setHealthCheck({ loading: false, result: null });
      }, 3000);
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
        {provider.id === 'groq' && t.settings.groqDescription}
        {provider.id === 'gemini' && (
          <span>
            {t.settings.geminiDescription}
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {t.settings.geminiRecommended}
            </span>
            <span className="ml-1 relative group/tooltip inline-flex items-center">
              <InfoIcon className="w-3.5 h-3.5 text-blue-500 cursor-help" />
              <span className="hidden group-hover/tooltip:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs bg-surface-alt text-on-surface-secondary rounded-lg shadow-lg border border-outline z-50 whitespace-normal">
                {t.settings.geminiFreeTierTooltip}
              </span>
            </span>
          </span>
        )}
        {provider.id === 'openai' && t.settings.openaiDescription}
      </p>

      {/* API Key configuration (shown when active) */}
      {isActive && (
        <div className="mt-4 space-y-3 pt-3 border-t border-outline">
          <div>
            <label className="block text-sm font-medium text-on-surface-secondary mb-2">
              {t.settings.apiKey}
            </label>
            {PROVIDER_URLS[provider.id] && (
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

          {/* Model selection */}
          {provider.models && provider.models.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-on-surface-secondary mb-2">
                {t.settings.modelLabel}
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 border border-input-border rounded-lg bg-input-bg text-on-surface focus:ring-2 focus:ring-accent focus:border-accent outline-none text-sm"
              >
                {provider.models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {/* Health Check */}
          <div className="pt-3 border-t border-outline">
            <button
              onClick={handleTestConnection}
              disabled={!isConfigured || healthCheck.loading}
              className="text-sm text-accent-text hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {healthCheck.loading && <Spinner size="sm" />}
              {healthCheck.loading ? t.settings.testing : t.settings.testConnection}
            </button>

            {healthCheck.result && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                healthCheck.result.success
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {healthCheck.result.success ? (
                  <span>{t.settings.connectionSuccess} ({healthCheck.result.latencyMs}ms)</span>
                ) : (
                  <span>
                    {healthCheck.result.errorType === 'auth' && t.settings.healthErrorAuth}
                    {healthCheck.result.errorType === 'rate_limit' && t.settings.healthErrorRateLimit}
                    {healthCheck.result.errorType === 'timeout' && t.settings.healthErrorTimeout}
                    {healthCheck.result.errorType === 'network' && t.settings.healthErrorNetwork}
                    {healthCheck.result.errorType === 'unknown' && (healthCheck.result.error || t.settings.healthErrorUnknown)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quota Usage — only shown when provider has an API key configured */}
          {isConfigured && (
            <div className="pt-3 border-t border-outline">
              <QuotaGauge providerId={provider.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
