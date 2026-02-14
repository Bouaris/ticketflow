/**
 * Transaction wrapper for atomic bulk operations.
 *
 * Uses BEGIN IMMEDIATE / COMMIT / ROLLBACK for atomicity.
 * Includes a mutex to prevent "cannot start a transaction within a
 * transaction" errors from concurrent callers on the singleton connection.
 * Retries on SQLITE_BUSY (code 5) with exponential backoff.
 *
 * IMPORTANT: This relies on the tauri-plugin-sql connection pool
 * reusing the same connection for sequential awaited operations.
 * Do NOT use Promise.all() inside the callback -- all DB operations
 * must be sequential (await each one before the next).
 *
 * For this single-user desktop app, sequential awaits on the same
 * pool connection provide sufficient transaction guarantees.
 *
 * @module db/transaction
 */

import { getDatabase } from './database';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

// ============================================================
// TRANSACTION MUTEX
// ============================================================

/** Whether a transaction is currently active on the singleton connection. */
let txActive = false;

/** Queue of callers waiting for the current transaction to finish. */
const txQueue: Array<() => void> = [];

/**
 * Acquire the transaction mutex. If a transaction is already active,
 * the caller awaits until it finishes.
 */
function acquireTxLock(): Promise<void> {
  if (!txActive) {
    txActive = true;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    txQueue.push(resolve);
  });
}

/**
 * Release the transaction mutex, waking the next queued caller if any.
 */
function releaseTxLock(): void {
  if (txQueue.length > 0) {
    const next = txQueue.shift()!;
    // txActive stays true — ownership transfers to next caller
    next();
  } else {
    txActive = false;
  }
}

// ============================================================
// ERROR HELPERS
// ============================================================

/**
 * Check if an error is a SQLite BUSY error (code 5).
 */
function isBusyError(err: unknown): boolean {
  if (err instanceof Error) return err.message.includes('database is locked');
  if (typeof err === 'string') return err.includes('database is locked');
  return false;
}

/**
 * Execute a function within a SQLite transaction.
 *
 * Serialized via mutex: concurrent callers queue instead of colliding.
 * Retries up to 3 times on SQLITE_BUSY with exponential backoff.
 *
 * @param projectPath - Absolute path to the project directory
 * @param fn - Async function containing sequential DB operations
 * @returns The return value of fn
 * @throws Re-throws the original error after ROLLBACK
 *
 * @example
 * ```typescript
 * await withTransaction(projectPath, async () => {
 *   await clearProjectData(projectPath, projectId);
 *   await batchInsertSections(projectPath, projectId, sections);
 *   await batchInsertItems(projectPath, items);
 * });
 * ```
 */
export async function withTransaction<T>(
  projectPath: string,
  fn: () => Promise<T>
): Promise<T> {
  await acquireTxLock();

  try {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const db = await getDatabase(projectPath);

      try {
        await db.execute('BEGIN IMMEDIATE');
      } catch (beginErr) {
        if (isBusyError(beginErr) && attempt < MAX_RETRIES) {
          lastError = beginErr;
          continue;
        }
        throw beginErr;
      }

      try {
        const result = await fn();
        await db.execute('COMMIT');
        return result;
      } catch (error) {
        try {
          await db.execute('ROLLBACK');
        } catch {
          // Rollback best-effort; connection may not have an active transaction
        }
        if (isBusyError(error) && attempt < MAX_RETRIES) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  } finally {
    releaseTxLock();
  }
}
