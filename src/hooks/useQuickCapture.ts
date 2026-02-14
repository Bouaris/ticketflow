/**
 * Quick Capture Hook
 *
 * Registers a global keyboard shortcut (Ctrl+Alt+T) in Tauri mode
 * to open a secondary capture window. In web mode, the shortcut is
 * handled by useGlobalShortcuts (in-app shortcut).
 *
 * @module hooks/useQuickCapture
 */

import { useEffect } from 'react';
import { isTauri } from '../lib/tauri-bridge';

/**
 * Hook to register Tauri global shortcut for Quick Capture.
 *
 * In Tauri mode: registers Ctrl+Alt+T as a system-wide shortcut
 * that opens a secondary borderless window with the capture form.
 *
 * In web mode: does nothing (shortcut handled by useGlobalShortcuts).
 *
 * @param projectPath - Current project path (passed to capture window)
 * @param onWebCapture - Callback for web mode capture (unused in Tauri)
 */
export function useQuickCapture(projectPath: string, _onWebCapture: () => void): void {
  useEffect(() => {
    if (!isTauri()) return;

    let registered = false;

    async function registerShortcut() {
      try {
        const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        // Unregister first in case it's still registered from a previous mount
        try {
          await unregister('Control+Alt+T');
        } catch {
          // Not registered yet - that's fine
        }

        await register('Control+Alt+T', async () => {
          try {
            // Check if capture window already exists
            const existing = await WebviewWindow.getByLabel('quick-capture');
            if (existing) {
              await existing.setFocus();
              return;
            }

            const encodedPath = encodeURIComponent(projectPath);
            new WebviewWindow('quick-capture', {
              url: `index.html?window=quick-capture&project=${encodedPath}`,
              title: 'Quick Capture',
              width: 480,
              height: 340,
              resizable: false,
              alwaysOnTop: true,
              center: true,
              decorations: false,
              skipTaskbar: true,
            });
          } catch (err) {
            console.warn('[useQuickCapture] Failed to open capture window:', err);
          }
        });

        registered = true;
      } catch (err) {
        console.warn('[useQuickCapture] Failed to register global shortcut:', err);
      }
    }

    registerShortcut();

    return () => {
      if (!registered) return;
      // Unregister on unmount
      import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) => {
        unregister('Control+Alt+T').catch(() => {
          // Silent - may already be unregistered
        });
      });
    };
  }, [projectPath]);
}
