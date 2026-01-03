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
  hasApiKey,
  resetClient,
  type AIProvider,
} from '../../lib/ai';
import { isTauri, openExternalUrl } from '../../lib/tauri-bridge';
import { CheckIcon, GroqIcon, GeminiIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';

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

  const footerContent = (
    <div className="flex items-center justify-between w-full">
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Paramètres IA"
      size="sm"
      footer={footerContent}
    >
      <div className="space-y-5">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Fournisseur IA par défaut
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map(provider => {
                  const isConfigured = hasApiKey(provider.id);
                  const isActive = selectedProvider === provider.id;

                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        isActive
                          ? provider.id === 'groq'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Status badge */}
                      <div className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                        isConfigured
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isConfigured ? 'Configuré' : 'Non configuré'}
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        {provider.id === 'groq' ? (
                          <GroqIcon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-gray-500'}`} />
                        ) : (
                          <GeminiIcon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                        )}
                        <span className={`font-medium ${
                          isActive
                            ? provider.id === 'groq' ? 'text-orange-700' : 'text-blue-700'
                            : 'text-gray-700'
                        }`}>
                          {provider.name}
                        </span>
                        {isActive && (
                          <span className="text-xs bg-white/80 px-1.5 py-0.5 rounded text-gray-600">
                            Par défaut
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-tight">
                        {provider.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clé API {currentProvider.name}
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Obtenez votre clé sur{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline cursor-pointer"
                  onClick={() => {
                    const url = currentProvider.url;
                    if (isTauri()) {
                      openExternalUrl(url).catch(() => {});
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  {selectedProvider === 'groq' ? 'Groq Console' : 'Google AI Studio'}
                </button>
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
              <CheckIcon className="w-4 h-4" />
              Configuration sauvegardée !
            </div>
          )}
      </div>
    </Modal>
  );
}
