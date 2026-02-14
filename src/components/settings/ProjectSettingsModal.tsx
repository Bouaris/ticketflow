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
import { useGsdConfig } from '../../hooks/useGsdConfig';
import { useTranslation } from '../../i18n';
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
  { id: 'global', label: 'Global', color: 'border-gray-500 bg-surface-alt', iconColor: 'text-on-surface-secondary' },
  { id: 'groq', label: 'Groq', color: 'border-orange-500 bg-orange-50', iconColor: 'text-orange-600' },
  { id: 'gemini', label: 'Gemini', color: 'border-accent bg-accent-soft', iconColor: 'text-accent-text' },
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

  const gsd = useGsdConfig(projectPath);
  const { t } = useTranslation();

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
      title={`${t.common.parameters} - ${t.common.project}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Project Name */}
        <div className="pb-4 border-b border-outline">
          <div className="flex items-center gap-2 text-on-surface-secondary">
            <FileIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{projectName}</span>
          </div>
        </div>

        {/* AI Provider Selection */}
        <div>
          <h4 className="text-sm font-medium text-on-surface-secondary mb-3">
            {t.settings.aiProvider}
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
                      : 'border-outline hover:border-outline-strong'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!isGlobalProvider && renderProviderIcon(provider.id, `w-4 h-4 ${isActive ? provider.iconColor : 'text-on-surface-faint'}`)}
                    <span className={`font-medium text-sm ${
                      isActive ? 'text-on-surface' : 'text-on-surface-secondary'
                    }`}>
                      {provider.label}
                      {isGlobalProvider && (
                        <span className="text-on-surface-muted font-normal"> ({globalProvider})</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-on-surface-muted mt-2">
            {isGlobal
              ? `"Global" utilise la configuration des paramètres généraux.`
              : `Ce projet utilise ${effectiveProvider} indépendamment des paramètres globaux.`
            }
          </p>
        </div>

        {/* Model Selection (only when not global) */}
        {config.provider !== 'global' && availableModels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-on-surface-secondary mb-2">
              Modèle
            </h4>
            <div className="relative">
              <select
                value={config.modelId || DEFAULT_MODELS[config.provider as 'groq' | 'gemini' | 'openai']}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent appearance-none bg-input-bg text-on-surface text-sm"
              >
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-faint pointer-events-none" />
            </div>
          </div>
        )}

        {/* Effective Configuration Summary */}
        <div className="p-3 bg-surface-alt rounded-lg">
          <p className="text-xs text-on-surface-secondary">
            <span className="font-medium">{t.settings.aiProvider}:</span>{' '}
            {effectiveProvider} / {effectiveModelId}
          </p>
        </div>

        {/* Context Files (Tauri only) */}
        {isTauri() && (
          <div className="pt-4 border-t border-outline">
            <h4 className="text-sm font-medium text-on-surface-secondary mb-2">
              {t.settings.contextFiles}
            </h4>
            <p className="text-xs text-on-surface-muted mb-3">
              {t.settings.contextFilesDesc}
            </p>

            {/* Selected files */}
            <div className="space-y-2 mb-3">
              {contextFiles.map(file => (
                <div
                  key={file}
                  className="flex items-center justify-between px-3 py-2 bg-accent-soft border border-accent/30 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="w-4 h-4 text-accent-text" />
                    <span className="text-sm text-blue-800">{file}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file)}
                    className="p-1 text-blue-400 hover:text-accent-text transition-colors"
                    title="Retirer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contextFiles.length === 0 && (
                <p className="text-sm text-on-surface-faint italic">{t.settings.noContextFiles}</p>
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
                      className="px-2 py-1 text-xs text-on-surface-secondary bg-surface-alt hover:bg-outline rounded-lg transition-colors"
                    >
                      + {file}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* GSD Integration (Tauri only) */}
        {isTauri() && (
          <div className="pt-4 border-t border-outline">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-medium text-on-surface-secondary">
                  {t.gsd.title}
                </h4>
                <p className="text-xs text-on-surface-muted">
                  {t.gsd.description}
                </p>
              </div>
              <button
                onClick={() => gsd.setEnabled(!gsd.config.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  gsd.config.enabled ? 'bg-accent' : 'bg-outline-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    gsd.config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {gsd.config.enabled && (
              <div className="mt-3 space-y-3">
                {gsd.planningDirExists ? (
                  <>
                    {/* Level selector */}
                    <div>
                      <label className="text-xs font-medium text-on-surface-secondary mb-1 block">
                        {t.gsd.level}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['essential', 'complete'] as const).map(level => {
                          const isActive = gsd.config.level === level;
                          const labels = {
                            essential: { name: t.gsd.levelEssential, desc: t.gsd.levelEssentialDesc },
                            complete: { name: t.gsd.levelComplete, desc: t.gsd.levelCompleteDesc },
                          };
                          return (
                            <button
                              key={level}
                              onClick={() => gsd.setLevel(level)}
                              className={`px-3 py-2 rounded-lg border text-left transition-all ${
                                isActive
                                  ? 'border-accent bg-accent-soft'
                                  : 'border-outline hover:border-outline-strong'
                              }`}
                            >
                              <div className={`text-xs font-medium ${isActive ? 'text-accent-text' : 'text-on-surface-secondary'}`}>
                                {labels[level].name}
                              </div>
                              <div className="text-[10px] text-on-surface-muted mt-0.5">
                                {labels[level].desc}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detected files preview */}
                    <div>
                      <label className="text-xs font-medium text-on-surface-secondary mb-1 block">
                        {t.gsd.detectedFiles} ({gsd.detectedFiles.length})
                      </label>
                      {gsd.isDetecting ? (
                        <p className="text-xs text-on-surface-muted italic">{t.settings.loading}</p>
                      ) : gsd.detectedFiles.length > 0 ? (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {gsd.detectedFiles.map(file => (
                            <div
                              key={file}
                              className="flex items-center gap-2 px-2 py-1 bg-surface-alt rounded text-xs text-on-surface-secondary"
                            >
                              <FileIcon className="w-3 h-3 text-on-surface-faint flex-shrink-0" />
                              <span className="truncate">.planning/{file}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-muted italic">{t.gsd.noFilesDetected}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-on-surface-muted italic py-2">
                    {t.gsd.noPlanningDir}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Link to Type Config */}
        <div className="pt-4 border-t border-outline">
          <button
            onClick={() => {
              onClose();
              onOpenTypeConfig();
            }}
            className="flex items-center gap-2 text-sm text-accent-text hover:text-accent-text transition-colors"
          >
            <TagIcon className="w-4 h-4" />
            {t.typeConfig.configureTicketTypes}
          </button>
        </div>
      </div>
    </Modal>
  );
}
