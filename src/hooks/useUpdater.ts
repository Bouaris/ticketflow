/**
 * useUpdater - Hook for automatic app updates via Tauri updater plugin.
 *
 * Features:
 * - Checks for updates at startup, periodically (every 4h), and on demand
 * - Downloads and installs updates with progress tracking
 * - Smart dismiss: remembers when user clicks "Plus tard" and shows badge instead of modal
 * - Persistence: dismiss state survives app restarts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri } from '../lib/tauri-bridge';
import { useTranslation } from '../i18n';

// Types for the updater plugin
interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

interface DownloadEvent {
  event: 'Started' | 'Progress' | 'Finished';
  data: {
    contentLength?: number;
    chunkLength?: number;
  };
}

interface UpdaterState {
  checking: boolean;
  available: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  dismissed: boolean;
  dismissedVersion: string | null;
}

const INITIAL_STATE: UpdaterState = {
  checking: false,
  available: null,
  downloading: false,
  progress: 0,
  error: null,
  dismissed: false,
  dismissedVersion: null,
};

// Check interval: 4 hours
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// localStorage key for dismiss persistence
const STORAGE_KEY = 'ticketflow-update-dismissed';

export function useUpdater() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdaterState>(() => {
    // Load dismiss state from localStorage on init
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { version } = JSON.parse(stored);
          return {
            ...INITIAL_STATE,
            dismissed: true,
            dismissedVersion: version,
          };
        }
      } catch {
        // Ignore parse errors
      }
    }
    return INITIAL_STATE;
  });
  const updateRef = useRef<unknown>(null);
  const totalBytesRef = useRef<number>(0);
  const downloadedBytesRef = useRef<number>(0);

  // Check for updates
  const checkForUpdates = useCallback(async (silent = false): Promise<UpdateInfo | null> => {
    if (!isTauri()) return null;

    if (!silent) {
      setState(prev => ({ ...prev, checking: true, error: null }));
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');

      const update = await check();

      if (update) {
        updateRef.current = update;
        const info: UpdateInfo = {
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body || undefined,
          date: update.date || undefined,
        };

        // Smart dismiss: check if this version was already dismissed
        setState(prev => {
          const isDismissedVersion = prev.dismissedVersion === info.version;
          return {
            ...prev,
            checking: false,
            available: info,
            // Keep dismissed state only if same version was dismissed
            dismissed: isDismissedVersion ? prev.dismissed : false,
            dismissedVersion: isDismissedVersion ? prev.dismissedVersion : null,
          };
        });

        return info;
      } else {
        setState(prev => ({ ...prev, checking: false, available: null }));
        return null;
      }
    } catch (err) {
      console.error('[Updater] Error during check:', err);
      const errorMsg = err instanceof Error ? err.message : t.error.updateCheckError;
      console.error('[Updater] Error message:', errorMsg);
      if (!silent) {
        setState(prev => ({ ...prev, checking: false, error: errorMsg }));
      }
      return null;
    }
  }, [t]);

  // Download and install update
  const installUpdate = useCallback(async () => {
    if (!updateRef.current) return;

    setState(prev => ({ ...prev, downloading: true, progress: 0, error: null }));
    totalBytesRef.current = 0;
    downloadedBytesRef.current = 0;

    try {
      const update = updateRef.current as {
        downloadAndInstall: (onEvent?: (event: DownloadEvent) => void) => Promise<void>;
      };

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started' && event.data.contentLength) {
          totalBytesRef.current = event.data.contentLength;
        } else if (event.event === 'Progress' && event.data.chunkLength) {
          downloadedBytesRef.current += event.data.chunkLength;
          if (totalBytesRef.current > 0) {
            const progress = Math.round((downloadedBytesRef.current / totalBytesRef.current) * 100);
            setState(prev => ({ ...prev, progress: Math.min(progress, 100) }));
          }
        } else if (event.event === 'Finished') {
          setState(prev => ({ ...prev, progress: 100 }));
        }
      });

      // Relaunch the app
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[Updater] Install error:', err);
      const errorMsg = err instanceof Error ? err.message : t.error.updateInstallError;
      setState(prev => ({ ...prev, downloading: false, error: errorMsg }));
    }
  }, [t]);

  // Dismiss update notification (smart dismiss: keep available, just hide modal)
  const dismissUpdate = useCallback(() => {
    setState(prev => {
      if (prev.available) {
        // Persist dismiss for this version
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: prev.available.version }));
        } catch {
          // Ignore storage errors
        }
        return {
          ...prev,
          dismissed: true,
          dismissedVersion: prev.available.version,
        };
      }
      return prev;
    });
  }, []);

  // Clear dismiss state (for manual "Vérifier" to force show modal)
  const clearDismiss = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setState(prev => ({
      ...prev,
      dismissed: false,
      dismissedVersion: null,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Check on mount and periodically
  useEffect(() => {
    if (!isTauri()) return;

    // Initial check (silent)
    const initialCheck = setTimeout(() => {
      checkForUpdates(true);
    }, 3000); // Wait 3s after app start

    // Periodic check
    const interval = setInterval(() => {
      checkForUpdates(true);
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  // Computed: show modal only if update available AND not dismissed
  const showModal = state.available !== null && !state.dismissed;

  return {
    ...state,
    showModal,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    clearDismiss,
    clearError,
  };
}
