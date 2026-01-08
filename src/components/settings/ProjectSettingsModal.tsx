/**
 * ProjectSettingsModal - Per-project AI and context configuration
 *
 * Allows users to configure project-specific AI provider and model settings,
 * with a fallback to global settings when set to 'global'.
 */

import { useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { useProjectAIConfig } from '../../hooks/useProjectAIConfig';
import { useContextFiles } from '../../hooks/useContextFiles';
import { hasApiKey, getProvider, type AIProvider } from '../../lib/ai';
import { AVAILABLE_MODELS, DEFAULT_MODELS, type ProjectAIProvider } from '../../types/projectAIConfig';
import { GroqIcon, GeminiIcon, OpenAIIcon, FileIcon, CloseIcon, TagIcon, ChevronDownIcon } from '../ui/Icons';
import { isTauri } from '../../lib/tauri-bridge';

// ============================================================
// TYPES
// ============================================================

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
  onOpenTypeConfig: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const PROVIDERS: { id: ProjectAIProvider; label: string; color: string; iconColor: string }[] = [
  { id: 'global', label: 'Global', color: 'border-gray-500 bg-gray-50', iconColor: 'text-gray-600' },
  { id: 'groq', label: 'Groq', color: 'border-orange-500 bg-orange-50', iconColor: 'text-orange-600' },
  { id: 'gemini', label: 'Gemini', color: 'border-blue-500 bg-blue-50', iconColor: 'text-blue-600' },
  { id: 'openai', label: 'OpenAI', color: 'border-emerald-500 bg-emerald-50', iconColor: 'text-emerald-600' },
];

// ============================================================
// COMPONENT
// ============================================================

export function ProjectSettingsModal({
  isOpen,
  onClose,
  projectPath,
  projectName,
  onOpenTypeConfig,
}: ProjectSettingsModalProps) {
  const {
    config,
    setProvider,
    setModelId,
    isGlobal,
    effectiveProvider,
    effectiveModelId,
  } = useProjectAIConfig(projectPath);

  const {
    contextFiles,
    availableFiles,
    addFile,
    removeFile,
  } = useContextFiles(projectPath);

  // Get global provider for display
  const globalProvider = getProvider();

  // Filter providers to only show Global + configured ones
  const availableProviders = useMemo(() => {
    return PROVIDERS.filter(p =>
      p.id === 'global' || hasApiKey(p.id as AIProvider)
    );
  }, []);

  // Get available models for current provider
  const availableModels = config.provider !== 'global'
    ? AVAILABLE_MODELS[config.provider as 'groq' | 'gemini' | 'openai']
    : [];

  const handleProviderChange = (providerId: ProjectAIProvider) => {
    setProvider(providerId);
  };

  // Render provider icon
  const renderProviderIcon = (providerId: string, className: string) => {
    switch (providerId) {
      case 'groq': return <GroqIcon className={className} />;
      case 'gemini': return <GeminiIcon className={className} />;
      case 'openai': return <OpenAIIcon className={className} />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Paramètres du Projet"
      size="md"
    >
      <div className="space-y-6">
        {/* Project Name */}
        <div className="pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-600">
            <FileIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{projectName}</span>
          </div>
        </div>

        {/* AI Provider Selection */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Fournisseur IA
          </h4>
          <div className={`grid gap-2 ${availableProviders.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {availableProviders.map(provider => {
              const isActive = config.provider === provider.id;
              const isGlobalProvider = provider.id === 'global';

              return (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    isActive
                      ? provider.color
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!isGlobalProvider && renderProviderIcon(provider.id, `w-4 h-4 ${isActive ? provider.iconColor : 'text-gray-400'}`)}
                    <span className={`font-medium text-sm ${
                      isActive ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {provider.label}
                      {isGlobalProvider && (
                        <span className="text-gray-500 font-normal"> ({globalProvider})</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isGlobal
              ? `"Global" utilise la configuration des paramètres généraux.`
              : `Ce projet utilise ${effectiveProvider} indépendamment des paramètres globaux.`
            }
          </p>
        </div>

        {/* Model Selection (only when not global) */}
        {config.provider !== 'global' && availableModels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Modèle
            </h4>
            <div className="relative">
              <select
                value={config.modelId || DEFAULT_MODELS[config.provider as 'groq' | 'gemini' | 'openai']}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white text-sm"
              >
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Effective Configuration Summary */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Configuration active:</span>{' '}
            {effectiveProvider} / {effectiveModelId}
          </p>
        </div>

        {/* Context Files (Tauri only) */}
        {isTauri() && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Fichiers de Contexte IA
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Ces fichiers sont injectés dans les prompts IA
            </p>

            {/* Selected files */}
            <div className="space-y-2 mb-3">
              {contextFiles.map(file => (
                <div
                  key={file}
                  className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-800">{file}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file)}
                    className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
                    title="Retirer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contextFiles.length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucun fichier sélectionné</p>
              )}
            </div>

            {/* Available files to add */}
            {availableFiles.filter(f => !contextFiles.includes(f)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableFiles
                  .filter(f => !contextFiles.includes(f))
                  .map(file => (
                    <button
                      key={file}
                      onClick={() => addFile(file)}
                      className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      + {file}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Link to Type Config */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              onClose();
              onOpenTypeConfig();
            }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <TagIcon className="w-4 h-4" />
            Configurer les types de tickets
          </button>
        </div>
      </div>
    </Modal>
  );
}
