/**
 * Settings Modal - Configure AI provider and API key.
 */

import { useState, useEffect, useCallback } from 'react';
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
import { isTauri, openExternalUrl, writeTextFileContents } from '../../lib/tauri-bridge';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { exportDbToMarkdown } from '../../lib/markdown-export';
import { getOrCreateProject } from '../../db/queries/projects';
import { listBackups, restoreFromBackup, createBackup, type BackupInfo } from '../../db/backup';
import type { useUpdater } from '../../hooks/useUpdater';
import { getFeedbackStats, type FeedbackStats } from '../../lib/ai-feedback';
import { CheckIcon, GroqIcon, GeminiIcon, OpenAIIcon, RefreshIcon, WrenchIcon, SparklesIcon, DownloadIcon, SpinnerIcon, StarIcon, TrendUpIcon, TrendDownIcon, MinusIcon, InfoIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { MaintenanceModal } from './MaintenanceModal';
import { WhatsNewModal } from '../ui/WhatsNewModal';
import { useTranslation, SUPPORTED_LOCALES } from '../../i18n';
import { useTheme, type Theme } from '../../theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updater: ReturnType<typeof useUpdater>;
  projectPath?: string;
  /** Async function to get markdown content for maintenance */
  getMarkdownContent?: () => Promise<string>;
  onApplyCorrections?: (correctedMarkdown: string) => Promise<void>;
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
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o et GPT-3.5 Turbo, payant',
    url: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
];

export function SettingsModal({ isOpen, onClose, updater, projectPath, getMarkdownContent, onApplyCorrections }: SettingsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('groq');
  const [apiKey, setApiKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Backup state
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<BackupInfo | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ success: boolean; message: string } | null>(null);

  // AI Feedback stats
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  // AI Questioning mode toggle
  const [questioningEnabled, setQuestioningEnabled] = useState(
    localStorage.getItem('ticketflow-questioning-mode') !== 'false'
  );

  // i18n
  const { t, locale, setLocale } = useTranslation();

  // Theme
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      const provider = getProvider();
      setSelectedProvider(provider);
      setApiKeyState(getApiKey(provider) || '');
      setSaved(false);
    }
  }, [isOpen]);

  // Load backups when modal opens and projectPath exists
  useEffect(() => {
    if (isOpen && projectPath) {
      setIsLoadingBackups(true);
      listBackups(projectPath)
        .then(setBackups)
        .catch(console.error)
        .finally(() => setIsLoadingBackups(false));
    }
  }, [isOpen, projectPath]);

  // Load feedback stats when modal opens and projectPath exists
  useEffect(() => {
    if (isOpen && projectPath) {
      const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
      getOrCreateProject(projectPath, projectName)
        .then(projectId => getFeedbackStats(projectId))
        .then(setFeedbackStats)
        .catch(() => setFeedbackStats(null));
    }
  }, [isOpen, projectPath]);

  const handleQuestioningToggle = () => {
    const newValue = !questioningEnabled;
    setQuestioningEnabled(newValue);
    localStorage.setItem('ticketflow-questioning-mode', String(newValue));
  };

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

  const handleCheckUpdates = async () => {
    setUpdateCheckMessage(null);
    const result = await updater.checkForUpdates(false);
    if (result) {
      // Update found - clear dismiss to force show modal, then close settings
      updater.clearDismiss();
      onClose();
    } else if (!updater.error) {
      // Only show "up to date" if there was no error
      setUpdateCheckMessage(t.settings.upToDate);
      setTimeout(() => setUpdateCheckMessage(null), 3000);
    }
    // If error, updater.error will be displayed instead
  };

  /**
   * Handle exporting backlog to Markdown file
   */
  const handleExportMarkdown = useCallback(async () => {
    if (!projectPath) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      // Get projectId via getOrCreateProject (same pattern used elsewhere)
      const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
      const projectId = await getOrCreateProject(projectPath, projectName);

      // Generate markdown
      const markdown = await exportDbToMarkdown(projectPath, projectId, true);

      // Open save dialog
      const savePath = await saveFileDialog({
        defaultPath: `${projectPath}/TICKETFLOW_Backlog_Export.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        title: 'Exporter le Backlog en Markdown'
      });

      if (!savePath) {
        setIsExporting(false);
        return;
      }

      // Write file
      await writeTextFileContents(savePath, markdown);

      setExportResult({
        success: true,
        message: t.settings.exportSuccess
      });

      // Clear success message after 3 seconds
      setTimeout(() => setExportResult(null), 3000);
    } catch (error) {
      setExportResult({
        success: false,
        message: error instanceof Error ? error.message : t.settings.exportFailed
      });
    } finally {
      setIsExporting(false);
    }
  }, [projectPath]);

  if (!isOpen) return null;

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)!;

  const footerContent = (
    <div className="flex items-center justify-between w-full">
      <button
        onClick={handleClear}
        className="text-sm text-danger-text hover:text-danger-text"
      >
        {t.settings.clearKey}
      </button>
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg"
        >
          {t.action.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.settings.save}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.title}
      size="md"
      footer={footerContent}
    >
      <div className="space-y-5">
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-on-surface-secondary mb-2">
              {t.settings.language}
            </label>
            <div className="flex gap-2">
              {SUPPORTED_LOCALES.map(loc => (
                <button
                  key={loc.code}
                  onClick={() => setLocale(loc.code)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    locale === loc.code
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-alt text-on-surface-secondary hover:bg-surface-alt'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Toggle */}
          <div>
            <label className="block text-sm font-medium text-on-surface-secondary mb-2">
              {t.settings.theme}
            </label>
            <p className="text-xs text-on-surface-muted mb-2">{t.settings.themeDesc}</p>
            <div className="flex gap-2">
              {([
                { value: 'light' as Theme, label: t.settings.themeLight },
                { value: 'dark' as Theme, label: t.settings.themeDark },
                { value: 'system' as Theme, label: t.settings.themeSystem },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    theme === opt.value
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-alt text-on-surface-secondary hover:bg-surface-alt'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-on-surface-secondary mb-3">
                {t.settings.aiProviderDefault}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {PROVIDERS.map(provider => {
                  const isConfigured = hasApiKey(provider.id);
                  const isActive = selectedProvider === provider.id;

                  // Provider-specific colors
                  const colors = {
                    groq: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
                    gemini: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
                    openai: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
                  }[provider.id];

                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        isActive
                          ? `${colors.border} ${colors.bg}`
                          : 'border-outline hover:border-outline-strong'
                      }`}
                    >
                      {/* Status badge */}
                      <div className={`absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                        isConfigured
                          ? 'bg-success-soft text-success-text'
                          : 'bg-surface-alt text-on-surface-muted'
                      }`}>
                        {isConfigured ? 'OK' : '...'}
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        {provider.id === 'groq' && (
                          <GroqIcon className={`w-5 h-5 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
                        )}
                        {provider.id === 'gemini' && (
                          <GeminiIcon className={`w-5 h-5 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
                        )}
                        {provider.id === 'openai' && (
                          <OpenAIIcon className={`w-5 h-5 ${isActive ? colors.icon : 'text-on-surface-muted'}`} />
                        )}
                        <span className={`font-medium ${isActive ? colors.text : 'text-on-surface-secondary'}`}>
                          {provider.name}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-muted leading-tight line-clamp-2">
                        {provider.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-on-surface-secondary mb-2">
                {t.settings.apiKey} {currentProvider.name}
              </label>
              <p className="text-xs text-on-surface-muted mb-3">
                {t.settings.getKeyAt}{' '}
                <button
                  type="button"
                  className="text-accent-text hover:underline cursor-pointer"
                  onClick={() => {
                    const url = currentProvider.url;
                    if (isTauri()) {
                      openExternalUrl(url).catch(() => {});
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  {selectedProvider === 'groq' ? 'Groq Console' : selectedProvider === 'gemini' ? 'Google AI Studio' : 'OpenAI Platform'}
                </button>
              </p>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKeyState(e.target.value)}
                  placeholder={currentProvider.placeholder}
                  className="w-full px-4 py-2.5 pr-20 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent outline-none font-mono text-sm"
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

            {/* Status */}
          {saved && (
            <div className="flex items-center gap-2 text-success-text text-sm bg-success-soft px-3 py-2 rounded-lg">
              <CheckIcon className="w-4 h-4" />
              {t.settings.saved}
            </div>
          )}

          {/* AI Questioning Mode Toggle */}
          <div className="pt-4 border-t border-outline">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.questioningMode}</h4>
                <p className="text-xs text-on-surface-muted">
                  {t.settings.questioningModeDesc}
                </p>
              </div>
              <button
                onClick={handleQuestioningToggle}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                  questioningEnabled ? 'bg-accent' : 'bg-outline-strong'
                }`}
                role="switch"
                aria-checked={questioningEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    questioningEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* AI Feedback Stats */}
          {projectPath && (
            <div className="pt-4 border-t border-outline">
              <div className="mb-3">
                <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.aiLearning}</h4>
                <p className="text-xs text-on-surface-muted">
                  {t.settings.aiLearningDesc}
                </p>
              </div>

              {feedbackStats && feedbackStats.totalFeedback > 0 ? (
                <div className="space-y-3">
                  {/* Average rating and count */}
                  <div className="flex items-center gap-3 bg-surface-alt px-3 py-2.5 rounded-lg">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <StarIcon
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(feedbackStats.averageRating)
                              ? 'text-amber-400'
                              : 'text-on-surface-faint'
                          }`}
                          filled={star <= Math.round(feedbackStats.averageRating)}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-on-surface-secondary">
                      {feedbackStats.averageRating.toFixed(1)} / 5
                    </span>
                    <span className="text-xs text-on-surface-muted">
                      ({feedbackStats.totalFeedback} {t.settings.evaluations})
                    </span>
                  </div>

                  {/* Trend indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-alt">
                    {feedbackStats.trend === 'improving' && (
                      <>
                        <TrendUpIcon className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700">{t.settings.improving}</span>
                      </>
                    )}
                    {feedbackStats.trend === 'stable' && (
                      <>
                        <MinusIcon className="w-4 h-4 text-on-surface-muted" />
                        <span className="text-sm text-on-surface-secondary">{t.settings.stable}</span>
                      </>
                    )}
                    {feedbackStats.trend === 'declining' && (
                      <>
                        <TrendDownIcon className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">{t.settings.declining}</span>
                      </>
                    )}
                    {feedbackStats.trend === 'insufficient' && (
                      <>
                        <InfoIcon className="w-4 h-4 text-on-surface-faint" />
                        <span className="text-sm text-on-surface-muted">
                          {t.settings.needMoreFeedback}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-on-surface-faint italic">
                  {t.settings.noFeedback}
                </p>
              )}
            </div>
          )}

          {/* Maintenance section */}
          {getMarkdownContent && onApplyCorrections && (
            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.maintenance}</h4>
                  <p className="text-xs text-on-surface-muted">{t.settings.maintenanceDesc}</p>
                </div>
                <button
                  onClick={async () => {
                    setLoadingMarkdown(true);
                    try {
                      const content = await getMarkdownContent();
                      setMarkdownContent(content);
                      setShowMaintenanceModal(true);
                    } finally {
                      setLoadingMarkdown(false);
                    }
                  }}
                  disabled={loadingMarkdown}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface-alt hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
                >
                  <WrenchIcon className={`w-4 h-4 ${loadingMarkdown ? 'animate-spin' : ''}`} />
                  {loadingMarkdown ? t.settings.loading : t.settings.analyze}
                </button>
              </div>
            </div>
          )}

          {/* Export section (Tauri only) */}
          {isTauri() && projectPath && (
            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.data}</h4>
                  <p className="text-xs text-on-surface-muted">{t.settings.exportDesc}</p>
                </div>
                <button
                  onClick={handleExportMarkdown}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface-alt hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <SpinnerIcon className="w-4 h-4" />
                      {t.settings.exporting}
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4" />
                      {t.settings.export}
                    </>
                  )}
                </button>
              </div>
              {exportResult && (
                <p className={`mt-2 text-xs px-3 py-1.5 rounded ${
                  exportResult.success
                    ? 'text-success-text bg-success-soft'
                    : 'text-danger-text bg-danger-soft'
                }`}>
                  {exportResult.message}
                </p>
              )}
            </div>
          )}

          {/* Backup & Restore Section */}
          {isTauri() && projectPath && (
            <div className="pt-4 border-t border-outline">
              <div className="mb-3">
                <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.backups}</h4>
                <p className="text-xs text-on-surface-muted">
                  {t.settings.backupsDesc}
                </p>
              </div>

              {/* Create backup button */}
              <button
                onClick={async () => {
                  try {
                    await createBackup(projectPath, 'manual');
                    const updated = await listBackups(projectPath);
                    setBackups(updated);
                    setBackupMessage({ success: true, message: t.settings.backupCreated });
                    setTimeout(() => setBackupMessage(null), 3000);
                  } catch (error) {
                    setBackupMessage({
                      success: false,
                      message: error instanceof Error ? error.message : t.settings.backupFailed
                    });
                  }
                }}
                className="mb-3 px-3 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover"
              >
                {t.settings.createBackup}
              </button>

              {/* Backup message */}
              {backupMessage && (
                <p className={`mb-3 text-xs px-3 py-1.5 rounded ${
                  backupMessage.success
                    ? 'text-success-text bg-success-soft'
                    : 'text-danger-text bg-danger-soft'
                }`}>
                  {backupMessage.message}
                </p>
              )}

              {/* Backup list */}
              {isLoadingBackups ? (
                <p className="text-sm text-on-surface-muted">{t.settings.loading}</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-on-surface-muted">{t.settings.noBackups}</p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {backups.map((backup) => (
                    <li key={backup.filename} className="flex items-center justify-between text-sm bg-surface-alt px-3 py-2 rounded">
                      <span className="text-on-surface-secondary">
                        {backup.createdAt.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        <span className="ml-2 text-on-surface-faint">({backup.trigger})</span>
                      </span>
                      <button
                        onClick={() => setRestoreConfirm(backup)}
                        className="px-2 py-1 text-xs text-accent-text hover:bg-accent-soft rounded"
                        disabled={isRestoring}
                      >
                        {t.settings.restoreBackup}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Restore confirmation */}
              {restoreConfirm && (
                <div className="mt-3 p-3 bg-warning-soft border border-warning-text/30 rounded-lg">
                  <p className="text-sm text-warning-text mb-2">
                    {t.settings.restoreBackup} {restoreConfirm.createdAt.toLocaleDateString(locale)} ?
                    {t.settings.restoreConfirm}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsRestoring(true);
                        try {
                          await restoreFromBackup(projectPath, restoreConfirm.filename);
                          setBackupMessage({ success: true, message: t.settings.restoreSuccess });
                          setRestoreConfirm(null);
                          // Reload the page to reinitialize database connection
                          setTimeout(() => window.location.reload(), 1000);
                        } catch (error) {
                          setBackupMessage({
                            success: false,
                            message: error instanceof Error ? error.message : t.settings.restoreFailed
                          });
                        } finally {
                          setIsRestoring(false);
                        }
                      }}
                      disabled={isRestoring}
                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                    >
                      {isRestoring ? t.common.restoring : t.settings.confirm}
                    </button>
                    <button
                      onClick={() => setRestoreConfirm(null)}
                      className="px-3 py-1.5 text-sm text-on-surface-secondary hover:bg-surface-alt rounded"
                      disabled={isRestoring}
                    >
                      {t.action.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Update section (Tauri only) */}
          {isTauri() && (
            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.updates}</h4>
                  <p className="text-xs text-on-surface-muted">{t.settings.updatesDesc}</p>
                </div>
                <button
                  onClick={handleCheckUpdates}
                  disabled={updater.checking}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface-alt hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshIcon className={`w-4 h-4 ${updater.checking ? 'animate-spin' : ''}`} />
                  {updater.checking ? t.settings.checking : t.settings.checkUpdates}
                </button>
              </div>
              {updateCheckMessage && (
                <p className="mt-2 text-xs text-success-text bg-success-soft px-3 py-1.5 rounded">
                  {updateCheckMessage}
                </p>
              )}
              {updater.error && (
                <p className="mt-2 text-xs text-danger-text bg-danger-soft px-3 py-1.5 rounded">
                  {updater.error}
                </p>
              )}
            </div>
          )}

          {/* Changelog section */}
          <div className="pt-4 border-t border-outline">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-on-surface-secondary">{t.common.news}</h4>
                <p className="text-xs text-on-surface-muted">{t.settings.changelogDesc}</p>
              </div>
              <button
                onClick={() => setShowChangelogModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface-alt hover:bg-surface-alt rounded-lg transition-colors"
              >
                <SparklesIcon className="w-4 h-4" />
                {t.settings.changelog}
              </button>
            </div>
          </div>
      </div>

      {/* Maintenance Modal */}
      {markdownContent && onApplyCorrections && (
        <MaintenanceModal
          isOpen={showMaintenanceModal}
          onClose={() => {
            setShowMaintenanceModal(false);
            setMarkdownContent(null); // Clear cached content
          }}
          markdownContent={markdownContent}
          onApplyCorrections={onApplyCorrections}
        />
      )}

      {/* Changelog Modal */}
      <WhatsNewModal
        isOpen={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
        sinceVersion={null}
      />
    </Modal>
  );
}
