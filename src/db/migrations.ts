/**
 * Schema migration runner using PRAGMA user_version.
 *
 * Tracks the current schema version in SQLite's built-in user_version PRAGMA.
 * Runs pending migrations sequentially on every app start (idempotent).
 *
 * Rules:
 * - NEVER remove or reorder existing migrations
 * - Only append new ones at the end
 * - Each migration must be safe to run on both fresh and existing databases
 *
 * @module db/migrations
 */

import type Database from '@tauri-apps/plugin-sql';

interface Migration {
  version: number;
  description: string;
  up: (db: Database) => Promise<void>;
}

/**
 * All schema migrations, ordered by version.
 * NEVER remove or reorder existing migrations.
 * Only append new ones at the end.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Baseline v1.0 schema (retroactive)',
    up: async () => {
      // No-op: v1.0 schema created by initializeSchema()
      // This entry exists so fresh installs start at version 1
    },
  },
  {
    version: 2,
    description: 'Add user_preferences table for i18n',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    },
  },
  {
    version: 3,
    description: 'Add delta_type column to history table',
    up: async (db) => {
      // Guard: check if column already exists before ALTERing
      // (handles edge case where initializeSchema may have created it)
      try {
        const cols = await db.select<{ name: string }[]>(
          `PRAGMA table_info(history)`
        );
        const hasColumn = cols.some(c => c.name === 'delta_type');
        if (!hasColumn) {
          await db.execute(
            `ALTER TABLE history ADD COLUMN delta_type TEXT DEFAULT 'full'`
          );
        }
      } catch {
        // If table doesn't exist yet (fresh DB), initializeSchema will handle it
        console.warn('[migrations] history table not found for v3 migration, will be created by initializeSchema');
      }
    },
  },
  {
    version: 4,
    description: 'Add chat_messages table for AI chat',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          citations TEXT,
          action TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id)'
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(project_id, created_at)'
      );
    },
  },
  {
    version: 5,
    description: 'Add saved_views table',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS saved_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          filters_json TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_saved_views_project ON saved_views(project_id, position)'
      );
    },
  },
  {
    version: 6,
    description: 'Add archived_items table',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS archived_items (
          id TEXT PRIMARY KEY,
          project_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          emoji TEXT,
          component TEXT,
          module TEXT,
          severity TEXT,
          priority TEXT,
          effort TEXT,
          description TEXT,
          user_story TEXT,
          specs TEXT,
          reproduction TEXT,
          criteria TEXT,
          dependencies TEXT,
          constraints TEXT,
          screens TEXT,
          screenshots TEXT,
          raw_markdown TEXT NOT NULL,
          archived_at TEXT DEFAULT (datetime('now')),
          original_created_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      await db.execute('CREATE INDEX IF NOT EXISTS idx_archived_project ON archived_items(project_id)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_archived_type ON archived_items(type)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_archived_date ON archived_items(archived_at DESC)');
    },
  },
  {
    version: 7,
    description: 'Add type_counters table for monotonic ID generation',
    up: async (db) => {
      // Create type_counters table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS type_counters (
          project_id INTEGER NOT NULL,
          type_prefix TEXT NOT NULL,
          last_number INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (project_id, type_prefix),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);

      // Seed counters from existing data (both backlog_items AND archived_items)
      // This ensures existing projects get correct initial values
      await db.execute(`
        INSERT OR REPLACE INTO type_counters (project_id, type_prefix, last_number)
        SELECT project_id, type, MAX(num) FROM (
          SELECT project_id, type,
            CAST(SUBSTR(id, INSTR(id, '-') + 1) AS INTEGER) as num
          FROM backlog_items
          UNION ALL
          SELECT project_id, type,
            CAST(SUBSTR(id, INSTR(id, '-') + 1) AS INTEGER) as num
          FROM archived_items
        ) GROUP BY project_id, type
      `);
    },
  },
];

/**
 * Run all pending migrations sequentially.
 * Uses PRAGMA user_version to track the current schema version.
 * Idempotent: safe to call on every app start.
 *
 * @param db - The database connection to migrate
 */
export async function runMigrations(db: Database): Promise<void> {
  const rows = await db.select<{ user_version: number }[]>('PRAGMA user_version');
  const currentVersion = rows[0]?.user_version ?? 0;
  const targetVersion = MIGRATIONS.length > 0
    ? MIGRATIONS[MIGRATIONS.length - 1].version
    : 0;

  if (currentVersion >= targetVersion) {
    return; // Already up to date
  }

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`[migrations] Running v${migration.version}: ${migration.description}`);
      await migration.up(db);
      await db.execute(`PRAGMA user_version = ${migration.version}`);
    }
  }

  console.log(`[migrations] Schema at version ${targetVersion}`);
}
