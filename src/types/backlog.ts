import { z } from 'zod';

// ============================================================
// ENUMS - Types primitifs du backlog
// ============================================================

// ItemType is now dynamic - accepts uppercase letters, numbers, and underscores
// Examples: "BUG", "CT", "BUG_V5", "EXT_CHROME", "ADM"
export const ItemTypeSchema = z.string().refine(
  (val) => /^[A-Z][A-Z0-9_]*$/.test(val),
  { message: 'Item type must start with uppercase letter, can contain uppercase letters, numbers, and underscores' }
);
export type ItemType = string;

export const SeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3', 'P4']);
export type Severity = z.infer<typeof SeveritySchema>;

export const PrioritySchema = z.enum(['Haute', 'Moyenne', 'Faible']);
export type Priority = z.infer<typeof PrioritySchema>;

export const EffortSchema = z.enum(['XS', 'S', 'M', 'L', 'XL']);
export type Effort = z.infer<typeof EffortSchema>;

// ============================================================
// CRITERION - Checkbox dans les critères d'acceptation
// ============================================================

export const CriterionSchema = z.object({
  text: z.string(),
  checked: z.boolean().default(false),
});
export type Criterion = z.infer<typeof CriterionSchema>;

// ============================================================
// SCREENSHOT - Capture d'écran attachée à un item
// ============================================================

export const ScreenshotSchema = z.object({
  filename: z.string(),           // "BUG-001_1704153600000.png"
  alt: z.string().optional(),     // Texte alternatif
  addedAt: z.number(),            // Timestamp d'ajout
});
export type Screenshot = z.infer<typeof ScreenshotSchema>;

// ============================================================
// BACKLOG ITEM - Item individuel du backlog
// ============================================================

export const BacklogItemSchema = z.object({
  // Identifiants
  id: z.string(),                           // "BUG-001", "EXT-002", etc.
  type: ItemTypeSchema,
  title: z.string(),
  emoji: z.string().optional(),             // ⚠️ CRITIQUE, etc.

  // Metadata variable par type
  component: z.string().optional(),         // Composant ou module affecté
  module: z.string().optional(),            // Module ou domaine fonctionnel
  severity: SeveritySchema.optional(),      // Sévérité bug: P0-P4
  priority: PrioritySchema.optional(),      // Priorité business: Haute, Moyenne, Faible
  effort: EffortSchema.optional(),          // Tous sauf BUG: XS, S, M, L, XL

  // Contenu textuel
  description: z.string().optional(),       // Description principale
  userStory: z.string().optional(),         // Blockquote "En tant que..."

  // Listes
  specs: z.array(z.string()).optional(),              // Liste de spécifications
  reproduction: z.array(z.string()).optional(),       // BUG: étapes de reproduction
  criteria: z.array(CriterionSchema).optional(),      // Critères d'acceptation avec checkboxes
  dependencies: z.array(z.string()).optional(),       // Dépendances
  constraints: z.array(z.string()).optional(),        // Contraintes
  screens: z.array(z.string()).optional(),            // ADM: liste d'écrans
  screenshots: z.array(ScreenshotSchema).optional(),  // Captures d'écran

  // Metadata interne pour round-trip fidèle
  rawMarkdown: z.string(),                  // Markdown brut pour export fidèle
  sectionIndex: z.number(),                 // Position dans la section
});
export type BacklogItem = z.infer<typeof BacklogItemSchema>;

// ============================================================
// TABLE GROUP - Items groupés en tableau (ex: BUG-005 à 007)
// ============================================================

export const TableRowSchema = z.object({
  id: z.string(),           // "BUG-005"
  description: z.string(),  // "Changelog apparence désordonnée"
  action: z.string(),       // "Refonte layout avec dates groupées"
});
export type TableRow = z.infer<typeof TableRowSchema>;

export const TableGroupSchema = z.object({
  type: z.literal('table-group'),
  title: z.string(),                        // "BUG-005 à 007 | Cosmétiques Extension"
  severity: SeveritySchema.optional(),
  items: z.array(TableRowSchema),
  rawMarkdown: z.string(),
  sectionIndex: z.number(),
});
export type TableGroup = z.infer<typeof TableGroupSchema>;

// ============================================================
// RAW SECTION - Sections non-parsées (Roadmap, Légende, etc.)
// ============================================================

export const RawSectionSchema = z.object({
  type: z.literal('raw-section'),
  title: z.string(),                        // "Roadmap", "Légende Effort", etc.
  rawMarkdown: z.string(),
  sectionIndex: z.number(),
});
export type RawSection = z.infer<typeof RawSectionSchema>;

// ============================================================
// SECTION - Une section du backlog (## header)
// ============================================================

export const SectionSchema = z.object({
  id: z.string(),                           // "1", "2", etc.
  title: z.string(),                        // "BUGS (Hotfix)", etc.
  items: z.array(z.union([BacklogItemSchema, TableGroupSchema, RawSectionSchema])),
  rawHeader: z.string(),                    // "## 1. BUGS (Hotfix)"
});
export type Section = z.infer<typeof SectionSchema>;

// ============================================================
// BACKLOG - Document complet parsé
// ============================================================

export const BacklogSchema = z.object({
  header: z.string(),                       // Titre + metadata avant les sections
  tableOfContents: z.string(),              // Table des matières raw
  sections: z.array(SectionSchema),
  footer: z.string().optional(),            // Contenu après les sections
});
export type Backlog = z.infer<typeof BacklogSchema>;

// ============================================================
// HELPERS - Fonctions utilitaires
// ============================================================

/** Extrait le type depuis un ID (ex: "BUG-001" → "BUG") */
export function getTypeFromId(id: string): ItemType | null {
  const prefix = id.split('-')[0];
  const result = ItemTypeSchema.safeParse(prefix);
  return result.success ? result.data : null;
}

/** Récupère la couleur CSS pour un type (fallback pour types courants) */
export function getTypeColor(type: ItemType): string {
  const defaultColors: Record<string, string> = {
    BUG: '#ef4444',
    CT: '#3b82f6',
    LT: '#8b5cf6',
    AUTRE: '#6b7280',
  };
  return defaultColors[type] || '#6b7280';
}

/** Récupère la couleur CSS pour une sévérité */
export function getSeverityColor(severity: Severity): string {
  const colors: Record<Severity, string> = {
    P0: 'var(--color-severity-p0)',
    P1: 'var(--color-severity-p1)',
    P2: 'var(--color-severity-p2)',
    P3: 'var(--color-severity-p3)',
    P4: 'var(--color-severity-p4)',
  };
  return colors[severity];
}

/** Récupère la couleur CSS pour un effort */
export function getEffortColor(effort: Effort): string {
  const colors: Record<Effort, string> = {
    XS: 'var(--color-effort-xs)',
    S: 'var(--color-effort-s)',
    M: 'var(--color-effort-m)',
    L: 'var(--color-effort-l)',
    XL: 'var(--color-effort-xl)',
  };
  return colors[effort];
}

/** Labels lisibles pour les types courants */
export const TYPE_LABELS: Record<string, string> = {
  BUG: 'Bugs',
  CT: 'Court Terme',
  LT: 'Long Terme',
  AUTRE: 'Autres Idées',
};

/** Get label for a type (with fallback) */
export function getTypeLabel(type: ItemType): string {
  return TYPE_LABELS[type] || type;
}

/** Labels lisibles pour les sévérités */
export const SEVERITY_LABELS: Record<Severity, string> = {
  P0: 'Bloquant',
  P1: 'Critique',
  P2: 'Moyenne',
  P3: 'Faible',
  P4: 'Mineure',
};

/** Labels lisibles pour les priorités */
export const PRIORITY_LABELS: Record<Priority, string> = {
  Haute: 'Haute',
  Moyenne: 'Moyenne',
  Faible: 'Faible',
};

/** Labels lisibles pour les efforts */
export const EFFORT_LABELS: Record<Effort, string> = {
  XS: 'Extra Small (< 2h)',
  S: 'Small (2-4h)',
  M: 'Medium (1-2j)',
  L: 'Large (3-5j)',
  XL: 'Extra Large (1-2 sem)',
};
