/**
 * useUpdater - Hook for automatic app updates via Tauri updater plugin.
 *
 * Checks for updates at startup, periodically (every 4h), and on demand.
 * Downloads and installs updates with progress tracking.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri } from '../lib/tauri-bridge';

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
}

const INITIAL_STATE: UpdaterState = {
  checking: false,
  available: null,
  downloading: false,
  progress: 0,
  error: null,
};

// Check interval: 4 hours
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>(INITIAL_STATE);
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
        setState(prev => ({ ...prev, checking: false, available: info }));
        return info;
      } else {
        setState(prev => ({ ...prev, checking: false, available: null }));
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la vérification';
      if (!silent) {
        setState(prev => ({ ...prev, checking: false, error: errorMsg }));
      }
      return null;
    }
  }, []);

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
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors de l\'installation';
      setState(prev => ({ ...prev, downloading: false, error: errorMsg }));
    }
  }, []);

  // Dismiss update notification
  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, available: null }));
    updateRef.current = null;
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

  return {
    ...state,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
    clearError,
  };
}
