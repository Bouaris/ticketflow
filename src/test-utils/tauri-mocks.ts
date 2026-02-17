/**
 * Tauri IPC-Level Mocks
 *
 * Uses @tauri-apps/api/mocks to intercept Tauri IPC commands at the transport layer.
 * This prevents __TAURI_INTERNALS__ errors from @tauri-apps/plugin-sql and other plugins.
 *
 * Called in setup.ts (Vitest setupFiles) to run BEFORE any test module imports.
 */

import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import type { InvokeArgs } from '@tauri-apps/api/core';
import { beforeAll, afterEach } from 'vitest';

export interface TauriMockOptions {
  /** Custom handler for plugin:sql|select — return rows array per query */
  selectHandler?: (query: string, bindValues: unknown[]) => unknown[];
  /** Custom result for plugin:sql|execute */
  executeResult?: { lastInsertId: number; rowsAffected: number };
}

/**
 * Set up IPC-level mocks for Tauri commands.
 * Must be called at module level in setup.ts (not inside describe blocks)
 * so mocks are in place BEFORE any test module side effects run.
 */
export function setupTauriMocks(options: TauriMockOptions = {}): void {
  beforeAll(() => {
    // Step 1: Create fake window context — establishes __TAURI_INTERNALS__
    mockWindows('main');

    // Step 2: Intercept all IPC commands at the transport layer
    mockIPC((cmd: string, payload?: InvokeArgs) => {
      // Cast to record for convenient property access (sql payloads are always objects)
      const p = payload as Record<string, unknown> | undefined;
      // plugin:sql|load — return a fake database handle
      if (cmd === 'plugin:sql|load') {
        return 'sqlite:mock';
      }
      // plugin:sql|execute — INSERT/UPDATE/DELETE success
      if (cmd === 'plugin:sql|execute') {
        return options.executeResult ?? { lastInsertId: 1, rowsAffected: 1 };
      }
      // plugin:sql|select — empty rows by default, or custom handler
      if (cmd === 'plugin:sql|select') {
        if (options.selectHandler) {
          const query = p?.query as string;
          const bindValues = (p?.values ?? []) as unknown[];
          return options.selectHandler(query, bindValues);
        }
        return [];
      }
      // plugin:sql|close — no-op
      if (cmd === 'plugin:sql|close') {
        return null;
      }
      // ph_send_batch — stub for telemetry relay (Phase 26)
      if (cmd === 'ph_send_batch') {
        const events = p?.events as unknown[] | undefined;
        return { queued: 0, sent: events?.length ?? 0 };
      }
      // Default: return null for unknown commands
      return null;
    });
  });

  afterEach(() => {
    clearMocks();
  });
}
