/**
 * Labels FR centralisés
 *
 * @deprecated This file is deprecated. Use useTranslation() hook from 'src/i18n' instead.
 * All strings in this file have been migrated to src/i18n/locales/fr.ts and src/i18n/locales/en.ts.
 * Components should progressively migrate to: const { t } = useTranslation();
 *
 * Migration tracking:
 * - [x] SEVERITY_LABELS -> t.severity
 * - [x] SEVERITY_FULL_LABELS -> t.severityFull
 * - [x] PRIORITY_LABELS -> t.priority
 * - [x] EFFORT_LABELS -> t.effort
 * - [x] EFFORT_SHORT_LABELS -> t.effortShort
 * - [x] TYPE_LABELS -> t.types
 * - [x] UI_MESSAGES.CONFIRM -> t.confirm
 * - [x] UI_MESSAGES.VALIDATION -> t.validation
 * - [x] UI_MESSAGES.PLACEHOLDERS -> t.placeholder
 * - [x] UI_MESSAGES.ERRORS -> t.error
 *
 * DO NOT add new strings here. Add them to src/i18n/types.ts and both locale files.
 */

import type { Severity, Priority, Effort } from '../types/backlog';

// ============================================================
// SEVERITY LABELS
// ============================================================

export const SEVERITY_LABELS: Record<Severity, string> = {
  P0: 'Bloquant',
  P1: 'Critique',
  P2: 'Moyenne',
  P3: 'Faible',
  P4: 'Mineure',
};

export const SEVERITY_FULL_LABELS: Record<Severity, string> = {
  P0: 'P0 - Bloquant',
  P1: 'P1 - Critique',
  P2: 'P2 - Moyenne',
  P3: 'P3 - Faible',
  P4: 'P4 - Mineure',
};

// ============================================================
// PRIORITY LABELS
// ============================================================

export const PRIORITY_LABELS: Record<Priority, string> = {
  Haute: 'Haute',
  Moyenne: 'Moyenne',
  Faible: 'Faible',
};

// ============================================================
// EFFORT LABELS
// ============================================================

export const EFFORT_LABELS: Record<Effort, string> = {
  XS: 'Extra Small (< 2h)',
  S: 'Small (2-4h)',
  M: 'Medium (1-2j)',
  L: 'Large (3-5j)',
  XL: 'Extra Large (1-2 sem)',
};

export const EFFORT_SHORT_LABELS: Record<Effort, string> = {
  XS: 'XS (Extra Small)',
  S: 'S (Small)',
  M: 'M (Medium)',
  L: 'L (Large)',
  XL: 'XL (Extra Large)',
};

// ============================================================
// TYPE LABELS (Legacy fallback)
// ============================================================

export const TYPE_LABELS: Record<string, string> = {
  BUG: 'Bugs',
  CT: 'Court Terme',
  LT: 'Long Terme',
  AUTRE: 'Autres Idées',
};

/**
 * Get label for a type (with fallback to type ID)
 */
export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

// ============================================================
// UI MESSAGES
// ============================================================

export const UI_MESSAGES = {
  CONFIRM: {
    UNSAVED_CHANGES: 'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?',
    DELETE_ITEM: (id: string) => `Supprimer l'item ${id} ?`,
    APPLY_SUGGESTIONS: 'Appliquer les suggestions de l\'IA ?',
    REMOVE_PROJECT: 'Retirer ce projet de la liste ?',
  },
  VALIDATION: {
    ID_REQUIRED: 'ID requis',
    ID_EXISTS: 'ID déjà existant',
    TITLE_REQUIRED: 'Titre requis',
    TYPE_EXISTS: 'Ce code existe déjà',
    MIN_ONE_TYPE: 'Vous devez garder au moins un type',
  },
  PLACEHOLDERS: {
    TITLE: "Titre de l'item...",
    DESCRIPTION: 'Description détaillée...',
    USER_STORY: "En tant qu'utilisateur, je veux...",
    SEARCH: 'Rechercher par ID, titre, description...',
  },
  ERRORS: {
    FILE_NOT_FOUND: 'Fichier introuvable',
    PERMISSION_DENIED: 'Permission refusée',
    PARSE_ERROR: 'Erreur lors de la lecture du fichier',
    SAVE_ERROR: 'Erreur lors de la sauvegarde',
    TAURI_REQUIRED: 'Cette fonctionnalité nécessite la version desktop.',
  },
} as const;
