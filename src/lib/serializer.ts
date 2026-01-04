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

// ============================================================
// SECTION REMOVAL (for type deletion)
// ============================================================

/**
 * Mapping of type IDs to possible section labels in markdown
 */
const TYPE_TO_SECTION_LABELS: Record<string, string[]> = {
  'BUG': ['BUGS', 'BUG'],
  'CT': ['COURT TERME', 'COURT-TERME', 'CT'],
  'LT': ['LONG TERME', 'LONG-TERME', 'LT'],
  'AUTRE': ['AUTRES IDÉES', 'AUTRES IDEES', 'AUTRES', 'AUTRE'],
  'TEST': ['TESTS', 'TEST'],
};

/**
 * Remove a section from markdown content by type ID
 * - Removes the section header and all content until next section
 * - Updates the table of contents
 * - Renumbers remaining sections
 *
 * @param markdown - Original markdown content
 * @param typeId - Type ID to remove (e.g., "RARA", "CT", "BUG")
 * @returns Updated markdown content
 */
export function removeSectionFromMarkdown(markdown: string, typeId: string): string {
  const lines = markdown.split('\n');

  // Find possible section labels for this type
  const possibleLabels = TYPE_TO_SECTION_LABELS[typeId] || [typeId];

  // Patterns for section headers: "## 1. LABEL" or "## LABEL"
  const sectionPattern = /^##\s*(?:(\d+)\.\s*)?(.+)$/;

  // Find section boundaries
  let sectionStartIndex = -1;
  let sectionEndIndex = -1;
  let sectionNumber: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(sectionPattern);
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) : null;
      const label = match[2].trim().toUpperCase();

      // Check if this is the section to remove
      if (sectionStartIndex === -1) {
        const isMatch = possibleLabels.some(pl =>
          label === pl.toUpperCase() ||
          label.startsWith(pl.toUpperCase()) ||
          label.replace(/[_\s-]+/g, ' ') === typeId.replace(/[_\s-]+/g, ' ')
        );

        if (isMatch) {
          sectionStartIndex = i;
          sectionNumber = num;
        }
      } else {
        // Found next section - this is where the removed section ends
        sectionEndIndex = i;
        break;
      }
    }
  }

  // Section not found
  if (sectionStartIndex === -1) {
    return markdown;
  }

  // If no end found, section goes to end of file
  if (sectionEndIndex === -1) {
    sectionEndIndex = lines.length;
  }

  // Remove the section (including any trailing separators/blank lines)
  // Look backwards from end to trim trailing --- and blank lines
  let actualEnd = sectionEndIndex;
  while (actualEnd > sectionStartIndex) {
    const prevLine = lines[actualEnd - 1].trim();
    if (prevLine === '---' || prevLine === '') {
      actualEnd--;
    } else {
      break;
    }
  }

  // Build new lines array without the section
  const newLines: string[] = [
    ...lines.slice(0, sectionStartIndex),
    ...lines.slice(sectionEndIndex),
  ];

  // Renumber sections if needed
  if (sectionNumber !== null) {
    let currentNum = 1;
    for (let i = 0; i < newLines.length; i++) {
      const match = newLines[i].match(sectionPattern);
      if (match && match[1]) {
        const label = match[2].trim();
        newLines[i] = `## ${currentNum}. ${label}`;
        currentNum++;
      }
    }
  }

  // Update table of contents
  const result = updateTableOfContents(newLines.join('\n'));

  return result;
}

/**
 * Update the table of contents based on existing sections
 */
function updateTableOfContents(markdown: string): string {
  const lines = markdown.split('\n');

  // Find TOC boundaries
  let tocStart = -1;
  let tocEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // TOC starts with "## Table des matières" or similar
    if (tocStart === -1 && (
      line.toLowerCase().includes('table des matières') ||
      line.toLowerCase().includes('table des matieres') ||
      line.toLowerCase() === '## sommaire'
    )) {
      tocStart = i + 1; // Start after the header
      continue;
    }

    // TOC ends at first "---" or "##" after TOC start
    if (tocStart !== -1 && tocEnd === -1) {
      if (line === '---' || (line.startsWith('##') && !line.toLowerCase().includes('table'))) {
        tocEnd = i;
        break;
      }
    }
  }

  // No TOC found
  if (tocStart === -1 || tocEnd === -1) {
    return markdown;
  }

  // Find all numbered sections
  const sectionPattern = /^##\s*(\d+)\.\s*(.+)$/;
  const sections: { num: number; label: string; anchor: string }[] = [];

  for (const line of lines) {
    const match = line.match(sectionPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      const label = match[2].trim();
      // Generate anchor: lowercase, replace spaces with dashes, remove special chars
      const anchor = `${num}-${label.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}`;
      sections.push({ num, label, anchor });
    }
  }

  // Generate new TOC lines
  const newTocLines: string[] = [''];
  for (const section of sections) {
    newTocLines.push(`${section.num}. [${section.label}](#${section.anchor})`);
  }
  newTocLines.push('');

  // Replace old TOC with new one
  const resultLines = [
    ...lines.slice(0, tocStart),
    ...newTocLines,
    ...lines.slice(tocEnd),
  ];

  return resultLines.join('\n');
}
