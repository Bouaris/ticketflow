/**
 * Serializer JSON → Markdown
 *
 * CRITIQUE: Ce serializer doit produire un Markdown IDENTIQUE à l'original.
 * Stratégie: Utiliser rawMarkdown stocké, sauf pour les modifications explicites.
 */

import type {
  Backlog,
  BacklogItem,
  Section,
  TableGroup,
  Criterion,
  Severity,
  Effort,
} from '../types/backlog';
import { isTableGroup, isRawSection } from '../types/guards';
import { SEVERITY_FULL_LABELS, EFFORT_SHORT_LABELS } from '../constants/labels';
import { getScreenshotMarkdownRef } from './screenshots';

// ============================================================
// UNIFIED ITEM MARKDOWN BUILDER
// ============================================================

/**
 * Input type for buildItemMarkdown - accepts both BacklogItem and form data
 */
export interface ItemMarkdownInput {
  id: string;
  title: string;
  emoji?: string | null;
  component?: string | null;
  module?: string | null;
  severity?: Severity | null;
  priority?: string | null;
  effort?: Effort | null;
  description?: string | null;
  userStory?: string | null;
  reproduction?: string[];
  specs?: string[];
  screens?: string[];
  criteria?: Criterion[];
  dependencies?: string[];
  constraints?: string[];
  screenshots?: { filename: string; alt?: string }[];
}

export interface BuildItemMarkdownOptions {
  /** Base path for absolute screenshot paths (for export) */
  screenshotBasePath?: string;
}

/**
 * Unified function to build item markdown.
 * Replaces generateRawMarkdown (App.tsx), rebuildItemMarkdown, and rebuildItemMarkdownForExport.
 */
export function buildItemMarkdown(
  item: ItemMarkdownInput,
  options: BuildItemMarkdownOptions = {}
): string {
  const lines: string[] = [];

  // Header
  const emoji = item.emoji ? `${item.emoji} ` : '';
  lines.push(`### ${item.id} | ${emoji}${item.title}`);

  // Metadata
  if (item.component) {
    lines.push(`**Composant:** ${item.component}`);
  }
  if (item.module) {
    lines.push(`**Module:** ${item.module}`);
  }
  if (item.severity) {
    lines.push(`**Sévérité:** ${SEVERITY_FULL_LABELS[item.severity] || item.severity}`);
  }
  if (item.priority) {
    lines.push(`**Priorité:** ${item.priority}`);
  }
  if (item.effort) {
    lines.push(`**Effort:** ${EFFORT_SHORT_LABELS[item.effort] || item.effort}`);
  }

  // Description
  if (item.description) {
    lines.push(`**Description:** ${item.description}`);
  }

  // User Story
  if (item.userStory) {
    lines.push('');
    lines.push('**User Story:**');
    lines.push(`> ${item.userStory}`);
  }

  // Reproduction
  if (item.reproduction && item.reproduction.length > 0) {
    lines.push('');
    lines.push('**Reproduction:**');
    item.reproduction.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  }

  // Specs
  if (item.specs && item.specs.length > 0) {
    lines.push('');
    lines.push('**Spécifications:**');
    item.specs.forEach(spec => {
      lines.push(`- ${spec}`);
    });
  }

  // Screens
  if (item.screens && item.screens.length > 0) {
    lines.push('');
    lines.push('**Écrans:**');
    item.screens.forEach((screen, i) => {
      lines.push(`${i + 1}. ${screen}`);
    });
  }

  // Criteria
  if (item.criteria && item.criteria.length > 0) {
    lines.push('');
    lines.push(`**Critères d'acceptation:**`);
    item.criteria.forEach(criterion => {
      const check = criterion.checked ? 'x' : ' ';
      lines.push(`- [${check}] ${criterion.text}`);
    });
  }

  // Dependencies
  if (item.dependencies && item.dependencies.length > 0) {
    lines.push('');
    lines.push('**Dépendances:**');
    item.dependencies.forEach(dep => {
      lines.push(`- ${dep}`);
    });
  }

  // Constraints
  if (item.constraints && item.constraints.length > 0) {
    lines.push('');
    lines.push('**Contraintes:**');
    item.constraints.forEach(constraint => {
      lines.push(`- ${constraint}`);
    });
  }

  // Screenshots
  if (item.screenshots && item.screenshots.length > 0) {
    lines.push('');
    lines.push('**Screenshots:**');
    item.screenshots.forEach(screenshot => {
      if (options.screenshotBasePath) {
        // Absolute path for export
        const altText = screenshot.alt || screenshot.filename.replace('.png', '');
        const absolutePath = `${options.screenshotBasePath}\\${screenshot.filename}`;
        lines.push(`![${altText}](${absolutePath})`);
      } else {
        // Relative path (standard)
        lines.push(getScreenshotMarkdownRef(screenshot.filename, screenshot.alt));
      }
    });
  }

  // Separator
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// MAIN SERIALIZER
// ============================================================

/**
 * Serialize un Backlog complet en Markdown.
 * Utilise rawMarkdown par défaut pour garantir le round-trip.
 */
export function serializeBacklog(backlog: Backlog): string {
  const parts: string[] = [];

  // 1. Header - ensure it ends with newlines
  const header = backlog.header.trimEnd();
  parts.push(header);
  parts.push('\n\n');

  // 2. Table of Contents - ensure proper separation
  if (backlog.tableOfContents.trim()) {
    let toc = backlog.tableOfContents.trimEnd();
    // Remove trailing --- from TOC (we'll add proper separator ourselves)
    if (toc.endsWith('---')) {
      toc = toc.slice(0, -3).trimEnd();
    }
    parts.push(toc);
    // Always add proper separator after TOC
    parts.push('\n\n---\n\n');
  }

  // 3. Sections with proper separators
  for (let i = 0; i < backlog.sections.length; i++) {
    const serialized = serializeSection(backlog.sections[i]);
    parts.push(serialized);

    // Add separator between sections (not after the last one)
    if (i < backlog.sections.length - 1) {
      // Only add --- if the section doesn't already end with it
      const trimmed = serialized.trimEnd();
      if (!trimmed.endsWith('---')) {
        parts.push('---\n\n');
      } else {
        parts.push('\n');
      }
    }
  }

  // 4. Footer
  if (backlog.footer) {
    parts.push('\n');
    parts.push(backlog.footer);
  }

  // Ensure final newline
  let result = parts.join('');
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return result;
}

// ============================================================
// SECTION SERIALIZER
// ============================================================

function serializeSection(section: Section): string {
  const parts: string[] = [];

  // Header de section
  parts.push(section.rawHeader);
  parts.push('\n\n');

  // Items
  for (let i = 0; i < section.items.length; i++) {
    const item = section.items[i];

    if (isRawSection(item)) {
      // Section raw (Roadmap, etc.) - utiliser le rawMarkdown
      const content = item.rawMarkdown.trim();
      if (content) {
        parts.push(content);
        parts.push('\n');
      }
    } else if (isTableGroup(item)) {
      parts.push(serializeTableGroup(item));
    } else {
      parts.push(serializeItem(item as BacklogItem));
    }
  }

  return parts.join('');
}

// ============================================================
// ITEM SERIALIZER
// ============================================================

/**
 * Serialize un item.
 * Par défaut, utilise rawMarkdown pour round-trip parfait.
 * Si l'item a été modifié, reconstruit le Markdown.
 */
function serializeItem(item: BacklogItem): string {
  // Check if modified using type assertion
  const modifiedItem = item as ModifiedBacklogItem;
  if (!modifiedItem._modified) {
    return item.rawMarkdown;
  }

  // Sinon, reconstruire le Markdown
  return buildItemMarkdown(item);
}

// ============================================================
// TABLE GROUP SERIALIZER
// ============================================================

function serializeTableGroup(group: TableGroup): string {
  // Toujours utiliser rawMarkdown pour les tableaux groupés
  return group.rawMarkdown;
}


// ============================================================
// ITEM UPDATE HELPERS
// ============================================================

/**
 * Met à jour un item et marque comme modifié.
 * Utilisé par l'UI pour éditer les items.
 */
export function updateItem(
  item: BacklogItem,
  updates: Partial<Omit<BacklogItem, 'id' | 'type' | 'rawMarkdown' | 'sectionIndex'>>
): BacklogItem {
  return {
    ...item,
    ...updates,
    _modified: true,
  } as BacklogItem & { _modified: boolean };
}

/**
 * Toggle un critère d'acceptation.
 * IMPORTANT: Marque l'item comme modifié pour forcer la re-sérialisation.
 */
export function toggleCriterion(item: BacklogItem, criterionIndex: number): BacklogItem {
  if (!item.criteria || !item.criteria[criterionIndex]) {
    return item;
  }

  const newCriteria = [...item.criteria];
  newCriteria[criterionIndex] = {
    ...newCriteria[criterionIndex],
    checked: !newCriteria[criterionIndex].checked,
  };

  // Mettre à jour le rawMarkdown avec les nouvelles checkboxes
  const newRawMarkdown = updateCheckboxesInRaw(item.rawMarkdown, newCriteria);

  // Retourner un nouvel item avec le flag _modified
  return {
    ...item,
    criteria: newCriteria,
    rawMarkdown: newRawMarkdown,
    _modified: true,  // CRITICAL: Force re-serialization
  } as BacklogItem & { _modified: boolean };
}

/**
 * Met à jour les checkboxes dans le rawMarkdown.
 */
function updateCheckboxesInRaw(rawMarkdown: string, criteria: Criterion[]): string {
  const lines = rawMarkdown.split('\n');
  let criteriaIndex = 0;

  const updatedLines = lines.map(line => {
    const checkboxMatch = line.match(/^(- \[)[ xX](\] .+)$/);
    if (checkboxMatch && criteriaIndex < criteria.length) {
      const check = criteria[criteriaIndex].checked ? 'x' : ' ';
      criteriaIndex++;
      return `${checkboxMatch[1]}${check}${checkboxMatch[2]}`;
    }
    return line;
  });

  return updatedLines.join('\n');
}

// ============================================================
// EXPORT FOR CLIPBOARD
// ============================================================

/**
 * Génère le markdown d'un item pour export/copie vers le presse-papier.
 * Inclut le chemin source et utilise des chemins absolus pour les screenshots.
 *
 * @param item - L'item à exporter
 * @param sourcePath - Chemin absolu du fichier markdown source
 * @param screenshotBasePath - Chemin absolu du dossier screenshots (optionnel)
 */
export function exportItemForClipboard(
  item: BacklogItem,
  sourcePath: string,
  screenshotBasePath?: string
): string {
  const lines: string[] = [];

  // Header avec chemin source
  lines.push(`From ${sourcePath} :`);
  lines.push('');

  // Contenu de l'item avec chemins absolus
  lines.push(buildItemMarkdown(item, { screenshotBasePath }).trimEnd());

  return lines.join('\n');
}

// Type for internal modified tracking
interface ModifiedBacklogItem extends BacklogItem {
  _modified?: boolean;
}
