/**
 * AISetupStep - AI provider configuration during onboarding
 *
 * Allows users to optionally configure an AI provider (Gemini, Groq, OpenAI)
 * with their API key during first-run wizard.
 *
 * Features:
 * - Provider selection with Gemini recommended
 * - API key input with show/hide toggle
 * - Free tier guidance for Gemini and Groq
 * - Equally prominent Skip/Save CTAs
 *
 * @module components/onboarding/AISetupStep
 */

import { useState } from 'react';
import { OnboardingStep } from './OnboardingStep';
import { useTranslation } from '../../i18n';
import { setProvider, setApiKey, resetClient } from '../../lib/ai';
import type { AIProvider } from '../../lib/ai';

interface AISetupStepProps {
  /** Skip button handler (advances wizard without saving) */
  onSkip: () => void;
  /** Save button handler (advances wizard after saving config) */
  onSave: () => void;
}

interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  url: string;
  placeholder: string;
  isFree: boolean;
  badge?: string;
}

export function AISetupStep({ onSkip, onSave }: AISetupStepProps) {
  const { t } = useTranslation();
  const [provider, setLocalProvider] = useState<AIProvider>('gemini');
  const [apiKey, setApiKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const PROVIDERS: ProviderConfig[] = [
    {
      id: 'gemini',
      name: 'Gemini',
      description: t.onboarding.aiSetup.geminiDesc,
      url: 'https://aistudio.google.com/app/apikey',
      placeholder: 'AIza...',
      isFree: true,
      badge: t.onboarding.aiSetup.recommended,
    },
    {
      id: 'groq',
      name: 'Groq',
      description: t.onboarding.aiSetup.groqDesc,
      url: 'https://console.groq.com/keys',
      placeholder: 'gsk_...',
      isFree: true,
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: t.onboarding.aiSetup.openaiDesc,
      url: 'https://platform.openai.com/api-keys',
      placeholder: 'sk-...',
      isFree: false,
    },
  ];

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;

    setProvider(provider);
    setApiKey(trimmedKey, provider);
    resetClient();

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 800);
  };

  const icon = (
    <svg
      className="w-16 h-16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );

  return (
    <OnboardingStep
      title={t.onboarding.aiSetup.title}
      description={t.onboarding.aiSetup.description}
      icon={icon}
    >
      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setLocalProvider(p.id)}
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-left ${
                provider === p.id
                  ? 'border-accent bg-accent/5'
                  : 'border-outline bg-surface hover:border-accent/50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    provider === p.id
                      ? 'border-accent bg-accent'
                      : 'border-outline'
                  }`}
                >
                  {provider === p.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-on-surface">
                      {p.name}
                    </span>
                    {p.badge && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        {p.badge}
                      </span>
                    )}
                    {p.isFree && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {t.onboarding.aiSetup.freeTier}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-secondary">
                    {p.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-on-surface">
            {t.onboarding.aiSetup.apiKeyLabel}
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={selectedProvider.placeholder}
              className="flex-1 px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface placeholder:text-on-surface-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface hover:bg-surface-hover transition-colors"
            >
              {showKey ? t.onboarding.aiSetup.hideKey : t.onboarding.aiSetup.showKey}
            </button>
          </div>
          <a
            href={selectedProvider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-accent hover:underline"
          >
            {t.onboarding.aiSetup.getApiKey} →
          </a>
        </div>

        {/* Free Tier Info */}
        {selectedProvider.isFree && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <svg
              className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-green-400">
              {t.onboarding.aiSetup.freeTierNote}
            </p>
          </div>
        )}

        {/* Dual CTAs */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2.5 rounded-lg border border-outline bg-surface text-on-surface hover:bg-surface-hover transition-colors font-medium"
          >
            {t.onboarding.aiSetup.skipForNow}
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saved}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t.onboarding.aiSetup.saved}
              </>
            ) : (
              t.onboarding.aiSetup.saveAndContinue
            )}
          </button>
        </div>

        {/* Settings hint */}
        <p className="text-xs text-center text-on-surface-secondary">
          {t.onboarding.aiSetup.configureInSettings}
        </p>
      </div>
    </OnboardingStep>
  );
}
