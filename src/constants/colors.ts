/**
 * Couleurs centralisées pour l'application
 *
 * Single source of truth pour toutes les couleurs de types, présets, etc.
 */

// ============================================================
// COULEURS PAR DÉFAUT DES TYPES
// ============================================================

export const TYPE_COLORS = {
  BUG: '#ef4444',
  CT: '#3b82f6',
  LT: '#8b5cf6',
  AUTRE: '#6b7280',
} as const;

// ============================================================
// COULEURS AUTO-GÉNÉRÉES POUR NOUVEAUX TYPES
// ============================================================

export const AUTO_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const;

/**
 * Génère une couleur basée sur l'index
 */
export function getAutoColor(index: number): string {
  return AUTO_COLORS[index % AUTO_COLORS.length];
}

// ============================================================
// PRÉSETS POUR LE COLOR PICKER
// ============================================================

export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#6b7280', // gray
] as const;

// ============================================================
// COULEURS DE SÉVÉRITÉ
// ============================================================

export const SEVERITY_COLORS = {
  P0: '#dc2626', // red-600
  P1: '#ea580c', // orange-600
  P2: '#f59e0b', // amber-500
  P3: '#84cc16', // lime-500
  P4: '#6b7280', // gray-500
} as const;

// ============================================================
// COULEURS D'EFFORT
// ============================================================

export const EFFORT_COLORS = {
  XS: '#22c55e', // green-500
  S: '#84cc16',  // lime-500
  M: '#f59e0b',  // amber-500
  L: '#f97316',  // orange-500
  XL: '#ef4444', // red-500
} as const;
