/**
 * Settings Modal - Configure AI provider and API key.
 */

import { useState, useEffect } from 'react';
import {
  getProvider,
  setProvider,
  getApiKey,
  setApiKey,
  clearApiKey,
  resetClient,
  type AIProvider,
} from '../../lib/ai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS: { id: AIProvider; name: string; description: string; url: string; placeholder: string }[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: '14,400 req/jour gratuit, ultra rapide (Llama 3.3 70B)',
    url: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: '15 req/min, 1M tokens/jour (Gemini 1.5 Flash)',
    url: 'https://makersuite.google.com/app/apikey',
    placeholder: 'AIza...',
  },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('groq');
  const [apiKey, setApiKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const provider = getProvider();
      setSelectedProvider(provider);
      setApiKeyState(getApiKey(provider) || '');
      setSaved(false);
    }
  }, [isOpen]);

  // Update API key when provider changes
  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setApiKeyState(getApiKey(provider) || '');
    setSaved(false);
  };

  const handleSave = () => {
    if (apiKey.trim()) {
      setProvider(selectedProvider);
      setApiKey(apiKey.trim(), selectedProvider);
      resetClient();
      setSaved(true);
      setTimeout(() => onClose(), 1000);
    }
  };

  const handleClear = () => {
    clearApiKey(selectedProvider);
    resetClient();
    setApiKeyState('');
    setSaved(false);
  };

  if (!isOpen) return null;

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)!;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Paramètres IA</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-5">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Fournisseur IA
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderChange(provider.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedProvider === provider.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {provider.id === 'groq' ? (
                        <GroqIcon className={selectedProvider === provider.id ? 'text-blue-600' : 'text-gray-500'} />
                      ) : (
                        <GeminiIcon className={selectedProvider === provider.id ? 'text-blue-600' : 'text-gray-500'} />
                      )}
                      <span className={`font-medium ${
                        selectedProvider === provider.id ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {provider.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-tight">
                      {provider.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clé API {currentProvider.name}
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Obtenez votre clé sur{' '}
                <a
                  href={currentProvider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {selectedProvider === 'groq' ? 'Groq Console' : 'Google AI Studio'}
                </a>
              </p>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKeyState(e.target.value)}
                  placeholder={currentProvider.placeholder}
                  className="w-full px-4 py-2.5 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showKey ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {/* Status */}
            {saved && (
              <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
                <CheckIcon />
                Configuration sauvegardée !
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Effacer la clé
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Icons
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function GroqIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className || ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className || ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}
