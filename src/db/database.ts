/**
 * Database singleton module for SQLite access via tauri-plugin-sql.
 *
 * Provides lazy-loaded database connections with support for project switching.
 * The singleton pattern prevents connection leaks and ensures consistency.
 *
 * @module db/database
 */

import Database from '@tauri-apps/plugin-sql';
import { runMigrations } from './migrations';

/** The current database instance (singleton) */
let db: Database | null = null;

/** Path of the currently connected project */
let currentPath: string | null = null;

/** Promise-based lock to prevent race conditions during project switching */
let connectionLock: Promise<void> | null = null;

/** Set of paths where schema has been initialized */
const initializedPaths = new Set<string>();

/**
 * Initialize database schema if not already present.
 * Runs CREATE TABLE IF NOT EXISTS for all tables.
 */
async function initializeSchema(database: Database): Promise<void> {
  // Projects table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sections table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      raw_header TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Type configs table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS type_configs (
      id TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      position INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (id, project_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Backlog items table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS backlog_items (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      emoji TEXT,
      component TEXT,
      module TEXT,
      severity TEXT CHECK (severity IS NULL OR severity IN ('P0', 'P1', 'P2', 'P3', 'P4')),
      priority TEXT CHECK (priority IS NULL OR priority IN ('Haute', 'Moyenne', 'Faible')),
      effort TEXT CHECK (effort IS NULL OR effort IN ('XS', 'S', 'M', 'L', 'XL')),
      description TEXT,
      user_story TEXT,
      specs TEXT,
      reproduction TEXT,
      criteria TEXT,
      dependencies TEXT,
      constraints TEXT,
      screens TEXT,
      screenshots TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      raw_markdown TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    )
  `);

  // History table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      backlog_snapshot TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // AI telemetry table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS ai_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_type TEXT,
      retry_count INTEGER DEFAULT 0,
      latency_ms INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // AI feedback table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      feedback_text TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  await database.execute('CREATE INDEX IF NOT EXISTS idx_items_project ON backlog_items(project_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_items_section ON backlog_items(section_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_items_type ON backlog_items(type)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_history_project ON history(project_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_project_date ON ai_telemetry(project_id, created_at)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_feedback_project ON ai_feedback(project_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_feedback_item ON ai_feedback(item_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_feedback_rating ON ai_feedback(rating)');

  // FTS5 full-text search virtual table (external content, synced via triggers)
  await database.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS backlog_items_fts USING fts5(
      id,
      title,
      description,
      user_story,
      specs,
      criteria,
      dependencies,
      component,
      module,
      content='backlog_items',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    )
  `);

  // FTS5 sync triggers - keep index up-to-date with backlog_items
  try {
    await database.execute(`
      CREATE TRIGGER IF NOT EXISTS backlog_items_ai AFTER INSERT ON backlog_items BEGIN
        INSERT INTO backlog_items_fts(rowid, id, title, description, user_story, specs, criteria, dependencies, component, module)
        VALUES (new.rowid, new.id, new.title, new.description, new.user_story, new.specs, new.criteria, new.dependencies, new.component, new.module);
      END
    `);

    await database.execute(`
      CREATE TRIGGER IF NOT EXISTS backlog_items_ad AFTER DELETE ON backlog_items BEGIN
        INSERT INTO backlog_items_fts(backlog_items_fts, rowid, id, title, description, user_story, specs, criteria, dependencies, component, module)
        VALUES ('delete', old.rowid, old.id, old.title, old.description, old.user_story, old.specs, old.criteria, old.dependencies, old.component, old.module);
      END
    `);

    await database.execute(`
      CREATE TRIGGER IF NOT EXISTS backlog_items_au AFTER UPDATE ON backlog_items BEGIN
        INSERT INTO backlog_items_fts(backlog_items_fts, rowid, id, title, description, user_story, specs, criteria, dependencies, component, module)
        VALUES ('delete', old.rowid, old.id, old.title, old.description, old.user_story, old.specs, old.criteria, old.dependencies, old.component, old.module);
        INSERT INTO backlog_items_fts(rowid, id, title, description, user_story, specs, criteria, dependencies, component, module)
        VALUES (new.rowid, new.id, new.title, new.description, new.user_story, new.specs, new.criteria, new.dependencies, new.component, new.module);
      END
    `);
  } catch (triggerError) {
    console.warn('[database] FTS5 trigger creation failed, falling back to application-level sync:', triggerError);
  }

  // Populate FTS5 index from existing data (idempotent rebuild)
  await database.execute("INSERT INTO backlog_items_fts(backlog_items_fts) VALUES('rebuild')");

  // Item relations table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS item_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL CHECK (relation_type IN ('blocks', 'blocked-by', 'related-to')),
      confidence REAL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(source_id, target_id, relation_type)
    )
  `);

  // Item relations indexes
  await database.execute('CREATE INDEX IF NOT EXISTS idx_relations_source ON item_relations(source_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_relations_target ON item_relations(target_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_relations_project ON item_relations(project_id)');

  // Item templates table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS item_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      template_data TEXT NOT NULL DEFAULT '{}',
      icon TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Item templates index
  await database.execute('CREATE INDEX IF NOT EXISTS idx_templates_project ON item_templates(project_id)');
}

/**
 * Get a database connection for the specified project.
 *
 * If switching projects, closes the existing connection first.
 * Uses lazy loading - only creates connection on first access.
 * Automatically initializes schema on first connection to a new database.
 *
 * @param projectPath - Absolute path to the project directory
 * @returns Promise resolving to the Database instance
 *
 * @example
 * ```typescript
 * const db = await getDatabase('/path/to/project');
 * const items = await db.select<DbBacklogItem[]>('SELECT * FROM backlog_items');
 * ```
 */
export async function getDatabase(projectPath: string): Promise<Database> {
  // Wait for any pending connection operation to complete
  while (connectionLock) {
    await connectionLock;
  }

  // Close existing connection if switching projects
  if (db && currentPath !== projectPath) {
    connectionLock = (async () => {
      await db!.close();
      db = null;
      currentPath = null;
    })();
    await connectionLock;
    connectionLock = null;
  }

  if (!db) {
    const dbPath = `sqlite:${projectPath}/backlog.db`;
    db = await Database.load(dbPath);
    currentPath = projectPath;

    // Enforce PRAGMAs on every new connection
    // foreign_keys is a no-result PRAGMA, safe with execute()
    await db.execute('PRAGMA foreign_keys = ON');
    // journal_mode returns a result set, use select() to avoid
    // execute() failures in tauri-plugin-sql
    await db.select('PRAGMA journal_mode = WAL');
    // busy_timeout: wait up to 5s for locks to release instead of
    // failing immediately with SQLITE_BUSY (code 5)
    await db.execute('PRAGMA busy_timeout = 5000');

    // Initialize schema FIRST (creates all tables via CREATE IF NOT EXISTS),
    // then run migrations (which may ALTER existing tables).
    // This order ensures migration ALTERs always target existing tables,
    // whether on a fresh DB or an upgrade.
    if (!initializedPaths.has(projectPath)) {
      await initializeSchema(db);
      await runMigrations(db);
      initializedPaths.add(projectPath);
    }
  }

  return db;
}

/**
 * Close the current database connection.
 *
 * Should be called when the app closes or when explicitly
 * disconnecting from a project.
 *
 * @example
 * ```typescript
 * await closeDatabase();
 * ```
 */
export async function closeDatabase(): Promise<void> {
  // Wait for any pending connection operation to complete
  while (connectionLock) {
    await connectionLock;
  }

  if (db) {
    connectionLock = (async () => {
      await db!.close();
      db = null;
      currentPath = null;
    })();
    await connectionLock;
    connectionLock = null;
  }
}

/**
 * Get the path of the currently connected project.
 *
 * @returns The current project path, or null if no database is connected
 *
 * @example
 * ```typescript
 * const path = getCurrentProjectPath();
 * if (path) {
 *   console.log(`Connected to: ${path}`);
 * }
 * ```
 */
export function getCurrentProjectPath(): string | null {
  return currentPath;
}

/**
 * Check if a database connection is currently active.
 *
 * @returns true if connected to a database
 */
export function isDatabaseConnected(): boolean {
  return db !== null;
}
