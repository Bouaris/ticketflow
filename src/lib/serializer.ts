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
  RawSection,
  Criterion,
} from '../types/backlog';
import { getScreenshotMarkdownRef } from './screenshots';

// ============================================================
// MAIN SERIALIZER
// ============================================================

/**
 * Serialize un Backlog complet en Markdown.
 * Utilise rawMarkdown par défaut pour garantir le round-trip.
 */
export function serializeBacklog(backlog: Backlog): string {
  const parts: string[] = [];

  // 1. Header
  parts.push(backlog.header);

  // 2. Table of Contents
  parts.push(backlog.tableOfContents);

  // 3. Sections
  for (const section of backlog.sections) {
    parts.push(serializeSection(section));
  }

  // 4. Footer
  if (backlog.footer) {
    parts.push(backlog.footer);
  }

  return parts.join('');
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
      parts.push(item.rawMarkdown);
    } else if (isTableGroup(item)) {
      parts.push(serializeTableGroup(item));
    } else {
      parts.push(serializeItem(item as BacklogItem));
    }

    // Séparateur entre items (sauf le dernier)
    if (i < section.items.length - 1) {
      // Le séparateur est déjà dans rawMarkdown normalement
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
  return rebuildItemMarkdown(item);
}

/**
 * Reconstruit le Markdown d'un item modifié.
 * Utilisé uniquement quand on édite un item.
 */
function rebuildItemMarkdown(item: BacklogItem): string {
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
    const severityLabels: Record<string, string> = {
      P0: 'P0 - Bloquant',
      P1: 'P1 - Critique',
      P2: 'P2 - Moyenne',
      P3: 'P3 - Faible',
      P4: 'P4 - Mineure',
    };
    lines.push(`**Sévérité:** ${severityLabels[item.severity] || item.severity}`);
  }
  if (item.priority) {
    lines.push(`**Priorité:** ${item.priority}`);
  }
  if (item.effort) {
    const effortLabels: Record<string, string> = {
      XS: 'XS (Extra Small)',
      S: 'S (Small)',
      M: 'M (Medium)',
      L: 'L (Large)',
      XL: 'XL (Extra Large)',
    };
    lines.push(`**Effort:** ${effortLabels[item.effort] || item.effort}`);
  }

  // Description
  if (item.description) {
    lines.push(`**Description:** ${item.description}`);
  }

  // User Story
  if (item.userStory) {
    lines.push('');
    lines.push(`**User Story:**`);
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
    lines.push('**Critères d\'acceptation:**');
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
      lines.push(getScreenshotMarkdownRef(screenshot.filename, screenshot.alt));
    });
  }

  // Séparateur
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// TABLE GROUP SERIALIZER
// ============================================================

function serializeTableGroup(group: TableGroup): string {
  // Toujours utiliser rawMarkdown pour les tableaux groupés
  return group.rawMarkdown;
}

// ============================================================
// TYPE GUARDS
// ============================================================

function isRawSection(item: BacklogItem | TableGroup | RawSection): item is RawSection {
  return 'type' in item && item.type === 'raw-section';
}

function isTableGroup(item: BacklogItem | TableGroup | RawSection): item is TableGroup {
  return 'type' in item && item.type === 'table-group';
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

  // Mettre à jour rawMarkdown pour le toggle
  const updatedItem = {
    ...item,
    criteria: newCriteria,
  };

  // Mettre à jour le rawMarkdown avec les nouvelles checkboxes
  updatedItem.rawMarkdown = updateCheckboxesInRaw(item.rawMarkdown, newCriteria);

  return updatedItem;
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

// Type for internal modified tracking
interface ModifiedBacklogItem extends BacklogItem {
  _modified?: boolean;
}
