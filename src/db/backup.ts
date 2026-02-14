/**
 * Database backup utilities for corruption recovery.
 *
 * Backups are stored in a `.backlog-backups` subdirectory within each project.
 * WAL mode requires copying .db, .db-wal, and .db-shm files together.
 *
 * @module db/backup
 */

import {
  copyFile,
  exists,
  readDir,
  remove,
  mkdir,
} from '@tauri-apps/plugin-fs';
import { closeDatabase } from './database';
import { joinPath } from '../lib/tauri-bridge';
import { getTranslations } from '../i18n';

const BACKUP_DIR = '.backlog-backups';
const MAX_BACKUPS = 5;

export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  trigger: 'manual' | 'auto' | 'pre-import' | 'pre-migration';
}

/**
 * Create a backup of the project database.
 *
 * @param projectPath - Path to the project directory
 * @param trigger - What triggered this backup
 * @returns Path to the created backup
 */
export async function createBackup(
  projectPath: string,
  trigger: BackupInfo['trigger'] = 'manual'
): Promise<string> {
  const dbPath = joinPath(projectPath, 'backlog.db');
  const backupDir = joinPath(projectPath, BACKUP_DIR);

  // Ensure backup directory exists
  if (!(await exists(backupDir))) {
    await mkdir(backupDir, { recursive: true });
  }

  // Generate timestamped backup name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backlog-${trigger}-${timestamp}.db`;
  const backupPath = joinPath(backupDir, backupName);

  // Copy database file (must exist)
  if (!(await exists(dbPath))) {
    throw new Error(getTranslations().aiErrors.noDbToBackup);
  }
  await copyFile(dbPath, backupPath);

  // Copy WAL and SHM files if they exist (CRITICAL for WAL mode)
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  const backupWalPath = backupPath + '-wal';
  const backupShmPath = backupPath + '-shm';

  if (await exists(walPath)) {
    await copyFile(walPath, backupWalPath);
  }
  if (await exists(shmPath)) {
    await copyFile(shmPath, backupShmPath);
  }

  // Prune old backups
  await pruneOldBackups(projectPath);

  return backupPath;
}

/**
 * Restore database from a backup.
 *
 * IMPORTANT: This closes the current database connection before restoring.
 *
 * @param projectPath - Path to the project directory
 * @param backupFilename - Name of the backup file to restore
 */
export async function restoreFromBackup(
  projectPath: string,
  backupFilename: string
): Promise<void> {
  const dbPath = joinPath(projectPath, 'backlog.db');
  const backupPath = joinPath(projectPath, BACKUP_DIR, backupFilename);

  // CRITICAL: Close current connection before overwriting
  await closeDatabase();

  // Copy backup to main database location
  await copyFile(backupPath, dbPath);

  // Copy associated WAL/SHM files if they exist
  const walBackup = backupPath + '-wal';
  const shmBackup = backupPath + '-shm';
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  if (await exists(walBackup)) {
    await copyFile(walBackup, walPath);
  } else {
    // Remove existing WAL if backup doesn't have one
    if (await exists(walPath)) {
      await remove(walPath);
    }
  }

  if (await exists(shmBackup)) {
    await copyFile(shmBackup, shmPath);
  } else {
    // Remove existing SHM if backup doesn't have one
    if (await exists(shmPath)) {
      await remove(shmPath);
    }
  }
}

/**
 * List available backups for a project.
 *
 * @param projectPath - Path to the project directory
 * @returns List of backup info, newest first
 */
export async function listBackups(projectPath: string): Promise<BackupInfo[]> {
  const backupDir = joinPath(projectPath, BACKUP_DIR);

  if (!(await exists(backupDir))) {
    return [];
  }

  const entries = await readDir(backupDir);

  const backups: BackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.name?.endsWith('.db') || entry.name.includes('-wal') || entry.name.includes('-shm')) {
      continue;
    }

    // Parse filename: backlog-{trigger}-{timestamp}.db
    const match = entry.name.match(/^backlog-(manual|auto|pre-import|pre-migration)-(.+)\.db$/);
    if (!match) continue;

    const trigger = match[1] as BackupInfo['trigger'];
    const timestampStr = match[2].replace(/-/g, (m, i) => {
      // Convert back to ISO format: 2026-02-05T10-30-00-000Z -> 2026-02-05T10:30:00.000Z
      if (i === 10) return 'T';
      if (i === 13 || i === 16) return ':';
      if (i === 19) return '.';
      return m;
    });

    let createdAt: Date;
    try {
      createdAt = new Date(timestampStr);
      if (isNaN(createdAt.getTime())) {
        // Fallback: use current time
        createdAt = new Date();
      }
    } catch {
      createdAt = new Date();
    }

    backups.push({
      filename: entry.name,
      path: joinPath(backupDir, entry.name),
      createdAt,
      trigger,
    });
  }

  // Sort by date, newest first
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Remove old backups beyond MAX_BACKUPS limit.
 *
 * @param projectPath - Path to the project directory
 */
export async function pruneOldBackups(projectPath: string): Promise<void> {
  const backups = await listBackups(projectPath);

  // Keep only MAX_BACKUPS
  const toDelete = backups.slice(MAX_BACKUPS);

  for (const backup of toDelete) {
    // Remove .db file
    await remove(backup.path).catch(() => {});
    // Remove associated files
    await remove(`${backup.path}-wal`).catch(() => {});
    await remove(`${backup.path}-shm`).catch(() => {});
  }
}

/**
 * Create backup before import operation.
 * Call this before importing markdown to protect existing data.
 */
export async function backupBeforeImport(projectPath: string): Promise<string | null> {
  try {
    return await createBackup(projectPath, 'pre-import');
  } catch (error) {
    console.warn('Failed to create pre-import backup:', error);
    return null;
  }
}
