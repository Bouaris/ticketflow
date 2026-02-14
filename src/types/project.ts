/**
 * Project types for multi-project management
 */

import { STORAGE_KEYS, APP_CONFIG } from '../constants';

export interface Project {
  /** Unique identifier (UUID) */
  id: string;
  /** Project name (folder name) */
  name: string;
  /** Absolute path to project directory */
  path: string;
  /** Name of the backlog file found */
  backlogFile: string;
  /** Timestamp of last access */
  lastOpened: number;
  /** Whether this project is marked as favorite */
  isFavorite?: boolean;
  /** Number of items in backlog (optional, for display) */
  itemCount?: number;
}

/** Storage key for projects list (legacy re-export) */
export const PROJECTS_STORAGE_KEY = STORAGE_KEYS.PROJECTS;

/** Maximum number of recent projects to store (legacy re-export) */
export const MAX_RECENT_PROJECTS = APP_CONFIG.MAX_RECENT_PROJECTS;

/** Number of projects to show before "Show more" (legacy re-export) */
export const VISIBLE_PROJECTS_COUNT = APP_CONFIG.VISIBLE_PROJECTS_COUNT;

/** The only backlog file name supported (legacy re-export) */
export const BACKLOG_FILE_NAME = APP_CONFIG.BACKLOG_FILE_NAME;

/** Template for new backlog file with default sections (reference only, actual template generated dynamically) */
export const NEW_BACKLOG_TEMPLATE = `# Project - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : YYYY-MM-DD

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)
3. [Long Terme](#3-long-terme)
4. [Autres Idées](#4-autres-idées)
5. [Légende](#5-legende)

---

## 1. BUGS

---

## 2. COURT TERME

---

## 3. LONG TERME

---

## 4. AUTRES IDÉES

---

## 5. Légende

### Légende Effort

| Code | Signification | Estimation |
|------|---------------|------------|
| XS | Extra Small | < 2h |
| S | Small | 2-4h |
| M | Medium | 1-2 jours |
| L | Large | 3-5 jours |
| XL | Extra Large | 1-2 semaines |

---

### Conventions

- **BUG-XXX** : Bugs
- **CT-XXX** : Court Terme
- **LT-XXX** : Long Terme
- **AUTRE-XXX** : Autres Idées

---

### Sévérité (Bugs)

| Code | Signification |
|------|---------------|
| P0 | Bloquant - Production down |
| P1 | Critique - Impact majeur |
| P2 | Moyenne - Contournable |
| P3 | Faible - Mineur |
| P4 | Cosmétique |

---

### Priorité (Features)

| Niveau | Signification |
|--------|---------------|
| Haute | Sprint actuel |
| Moyenne | Prochain sprint |
| Faible | Backlog |
`;
