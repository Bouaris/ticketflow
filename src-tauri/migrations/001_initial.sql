-- ============================================================
-- TICKETFLOW SQLite Schema
-- Version: 001_initial
-- Created: 2026-02-05
-- Purpose: Complete schema for backlog persistence
-- ============================================================

-- Projects table
-- Stores metadata about each project/backlog file
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sections table
-- Represents the ## headers in markdown backlog
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    raw_header TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Type configuration table
-- Dynamic type definitions (BUG, CT, LT, etc.)
CREATE TABLE IF NOT EXISTS type_configs (
    id TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    position INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (id, project_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Backlog items table
-- Main storage for all backlog items
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
    specs TEXT,  -- JSON array of strings
    reproduction TEXT,  -- JSON array of strings (for BUG type)
    criteria TEXT,  -- JSON array of {text: string, checked: boolean}
    dependencies TEXT,  -- JSON array of strings
    constraints TEXT,  -- JSON array of strings
    screens TEXT,  -- JSON array of strings (for ADM type)
    screenshots TEXT,  -- JSON array of {filename: string, alt?: string, addedAt: number}
    position INTEGER NOT NULL DEFAULT 0,
    raw_markdown TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- History table for undo/redo
-- Stores serialized backlog snapshots
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    backlog_snapshot TEXT NOT NULL,  -- Full JSON serialization of backlog state
    description TEXT,  -- Human-readable description of the change
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES for query performance
-- ============================================================

-- Items indexed by project for fast project loading
CREATE INDEX IF NOT EXISTS idx_items_project ON backlog_items(project_id);

-- Items indexed by section for section-based queries
CREATE INDEX IF NOT EXISTS idx_items_section ON backlog_items(section_id);

-- Items indexed by type for Kanban filtering
CREATE INDEX IF NOT EXISTS idx_items_type ON backlog_items(type);

-- Sections indexed by project
CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);

-- History indexed by project for undo/redo
CREATE INDEX IF NOT EXISTS idx_history_project ON history(project_id);

-- History indexed by creation time for ordered retrieval
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);
