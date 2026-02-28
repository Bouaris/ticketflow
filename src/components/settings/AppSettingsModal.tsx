/**
 * App Settings Modal - Non-AI settings
 *
 * Handles app-level configuration: language, theme, updates, changelog, export, backups.
 * Extracted from monolithic SettingsModal.tsx (Phase 23).
 */

import { useState, useEffect, useCallback } from 'react';
import { isTauri, writeTextFileContents } from '../../lib/tauri-bridge';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { exportDbToMarkdown } from '../../lib/markdown-export';
import { getOrCreateProject } from '../../db/queries/projects';
import { listBackups, restoreFromBackup, createBackup, type BackupInfo } from '../../db/backup';
import type { useUpdater } from '../../hooks/useUpdater';
import { RefreshIcon, SparklesIcon, DownloadIcon, SpinnerIcon, WrenchIcon } from '../ui/Icons';
import { repairDatabase } from '../../lib/db-repair';
import { Modal } from '../ui/Modal';
import { WhatsNewModal } from '../ui/WhatsNewModal';
import { useTranslation, SUPPORTED_LOCALES } from '../../i18n';
import { useTheme, type Theme } from '../../theme';
import { getConsentState, setConsentState, initTelemetry, track } from '../../lib/telemetry';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updater: ReturnType<typeof useUpdater>;
  projectPath?: string;
}

export function AppSettingsModal({ isOpen, onClose, updater, projectPath }: AppSettingsModalProps) {
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);

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

  // Repair state
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{ success: boolean; message: string } | null>(null);

  // i18n
  const { t, locale, setLocale } = useTranslation();

  // Theme
  const { theme, setTheme } = useTheme();

  // Telemetry / Privacy
  const [telemetryEnabled, setTelemetryEnabled] = useState(getConsentState() === 'granted');
  const [telemetryMessage, setTelemetryMessage] = useState<string | null>(null);

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

  // Sync telemetry toggle with localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      setTelemetryEnabled(getConsentState() === 'granted');
      setTelemetryMessage(null);
    }
  }, [isOpen]);

  const handleTelemetryToggle = useCallback(() => {
    const newEnabled = !telemetryEnabled;
    setTelemetryEnabled(newEnabled);

    if (newEnabled) {
      setConsentState('granted');
      initTelemetry();
      track('consent_granted');
      setTelemetryMessage(null);
    } else {
      // Fire consent_revoked BEFORE changing state (last event)
      track('consent_revoked');
      setConsentState('declined');
      setTelemetryMessage('Telemetry disabled. No data will be sent.');
      setTimeout(() => setTelemetryMessage(null), 4000);
    }
  }, [telemetryEnabled]);

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
  }, [projectPath, t.settings.exportSuccess, t.settings.exportFailed]);

  const handleRepair = useCallback(async () => {
    if (!projectPath) return;
    setIsRepairing(true);
    setRepairResult(null);
    try {
      const result = await repairDatabase(projectPath);
      const totalFixes = result.sectionsCreated + result.orphanedSectionsCleaned;
      if (totalFixes === 0) {
        setRepairResult({ success: true, message: t.settings.repairNoIssues });
      } else {
        const details = result.issues.join(', ');
        setRepairResult({
          success: true,
          message: t.settings.repairSuccess.replace('{details}', details),
        });
      }
      setTimeout(() => setRepairResult(null), 5000);
    } catch (error) {
      setRepairResult({
        success: false,
        message: error instanceof Error ? error.message : t.settings.repairFailed,
      });
    } finally {
      setIsRepairing(false);
    }
  }, [projectPath, t.settings]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t.settings.appSettings}
        size="md"
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
                  onClick={() => {
                    setTheme(opt.value);
                    track('dark_mode_toggled', { theme: opt.value });
                  }}
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

          {/* Privacy / Telemetry Section */}
          <div className="pt-4 border-t border-outline">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-on-surface-secondary">Privacy</h4>
                <p className="text-xs text-on-surface-muted">
                  Anonymous usage data helps improve Ticketflow.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={handleTelemetryToggle}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-alt rounded-full peer peer-checked:bg-accent peer-focus:ring-2 peer-focus:ring-accent/50 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>
            {telemetryMessage && (
              <p className="mt-2 text-xs text-on-surface-muted px-3 py-1.5 rounded bg-surface-alt">
                {telemetryMessage}
              </p>
            )}
          </div>

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

          {/* Repair section */}
          {projectPath && (
            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.repair}</h4>
                  <p className="text-xs text-on-surface-muted">{t.settings.repairDesc}</p>
                </div>
                <button
                  onClick={handleRepair}
                  disabled={isRepairing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface-alt hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
                >
                  {isRepairing ? (
                    <>
                      <SpinnerIcon className="w-4 h-4" />
                      {t.settings.repairing}
                    </>
                  ) : (
                    <>
                      <WrenchIcon className="w-4 h-4" />
                      {t.settings.repairButton}
                    </>
                  )}
                </button>
              </div>
              {repairResult && (
                <p className={`mt-2 text-xs px-3 py-1.5 rounded ${
                  repairResult.success
                    ? 'text-success-text bg-success-soft'
                    : 'text-danger-text bg-danger-soft'
                }`}>
                  {repairResult.message}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Changelog Modal */}
      <WhatsNewModal
        isOpen={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
        sinceVersion={null}
      />
    </>
  );
}
