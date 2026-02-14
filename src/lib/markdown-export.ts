/**
 * Markdown Export Module
 *
 * Generates Markdown output from SQLite database.
 * Supports full backlog export and selective export by section or type.
 *
 * Preserves original formatting via rawMarkdown when available.
 *
 * @module lib/markdown-export
 */

import { getAllItems, getItemsByType } from '../db/queries/items';
import { getAllSections } from '../db/queries/sections';
import type { DbSection } from '../db/schema';
import type { BacklogItem } from '../types/backlog';
import { getScreenshotMarkdownRef } from './screenshots';

/**
 * Generate Markdown for a single item.
 * Prefers rawMarkdown if available for round-trip fidelity.
 *
 * @param item - The BacklogItem to convert
 * @returns Markdown string representation
 */
function generateItemMarkdown(item: BacklogItem): string {
  // Prefer raw markdown if available for round-trip fidelity
  if (item.rawMarkdown && item.rawMarkdown.trim()) {
    return item.rawMarkdown;
  }

  // Generate from fields when rawMarkdown is not available
  const lines: string[] = [];

  // Header
  const emoji = item.emoji ? `${item.emoji} ` : '';
  lines.push(`### ${item.id} | ${emoji}${item.title}`);
  lines.push('');

  // Metadata line
  const meta: string[] = [];
  if (item.severity) meta.push(`**Severite:** ${item.severity}`);
  if (item.priority) meta.push(`**Priorite:** ${item.priority}`);
  if (item.effort) meta.push(`**Effort:** ${item.effort}`);
  if (item.component) meta.push(`**Composant:** ${item.component}`);
  if (item.module) meta.push(`**Module:** ${item.module}`);

  if (meta.length > 0) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  // User story
  if (item.userStory) {
    lines.push(`> ${item.userStory}`);
    lines.push('');
  }

  // Description
  if (item.description) {
    lines.push(item.description);
    lines.push('');
  }

  // Specs
  if (item.specs && item.specs.length > 0) {
    lines.push('**Specifications:**');
    for (const spec of item.specs) {
      lines.push(`- ${spec}`);
    }
    lines.push('');
  }

  // Reproduction (for bugs)
  if (item.reproduction && item.reproduction.length > 0) {
    lines.push('**Etapes de reproduction:**');
    for (let i = 0; i < item.reproduction.length; i++) {
      lines.push(`${i + 1}. ${item.reproduction[i]}`);
    }
    lines.push('');
  }

  // Acceptance criteria
  if (item.criteria && item.criteria.length > 0) {
    lines.push("**Criteres d'acceptation:**");
    for (const c of item.criteria) {
      const checkbox = c.checked ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${c.text}`);
    }
    lines.push('');
  }

  // Dependencies
  if (item.dependencies && item.dependencies.length > 0) {
    lines.push('**Dependances:**');
    for (const dep of item.dependencies) {
      lines.push(`- ${dep}`);
    }
    lines.push('');
  }

  // Constraints
  if (item.constraints && item.constraints.length > 0) {
    lines.push('**Contraintes:**');
    for (const constraint of item.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push('');
  }

  // Screens
  if (item.screens && item.screens.length > 0) {
    lines.push('**Ecrans:**');
    for (const screen of item.screens) {
      lines.push(`- ${screen}`);
    }
    lines.push('');
  }

  // Screenshots
  if (item.screenshots && item.screenshots.length > 0) {
    lines.push('**Screenshots:**');
    for (const screenshot of item.screenshots) {
      lines.push(getScreenshotMarkdownRef(screenshot.filename, screenshot.alt));
    }
    lines.push('');
  }

  // Separator
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate table of contents from sections.
 *
 * @param sections - Array of section records
 * @returns Markdown table of contents string
 */
function generateToc(sections: DbSection[]): string {
  const lines = ['## Table des matieres', ''];

  sections.forEach((section, idx) => {
    const num = idx + 1;
    // Generate anchor: lowercase, replace spaces with dashes, remove accents
    const anchor = `${num}-${section.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')}`;
    lines.push(`${num}. [${section.title}](#${anchor})`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Export entire backlog as Markdown.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param includeHeader - Whether to include a header and TOC
 * @returns Complete Markdown representation of the backlog
 */
export async function exportDbToMarkdown(
  projectPath: string,
  projectId: number,
  includeHeader: boolean = true
): Promise<string> {
  const sections = await getAllSections(projectPath, projectId);
  const items = await getAllItems(projectPath, projectId);

  const lines: string[] = [];

  // Header
  if (includeHeader) {
    lines.push('# Product Backlog');
    lines.push('');

    // Table of contents
    lines.push(generateToc(sections));
  }

  // Track item index across sections
  // Items are ordered by section_id, position from the query
  let currentItemIndex = 0;

  // Each section
  for (const section of sections) {
    // Section header - prefer raw_header if available
    lines.push(section.raw_header || `## ${section.position + 1}. ${section.title}`);
    lines.push('');

    // Get items for this section by counting consecutive items with matching sectionIndex
    // Since items are ordered by section_id, we can iterate through them
    const sectionItems: BacklogItem[] = [];

    while (currentItemIndex < items.length) {
      const item = items[currentItemIndex];
      // Items from the same section will be consecutive due to ORDER BY section_id, position
      // We can check by verifying the item position resets for new sections
      if (sectionItems.length === 0 || item.sectionIndex === sectionItems.length) {
        sectionItems.push(item);
        currentItemIndex++;
      } else if (item.sectionIndex === 0 && sectionItems.length > 0) {
        // New section started (position reset to 0)
        break;
      } else {
        sectionItems.push(item);
        currentItemIndex++;
      }
    }

    // Generate markdown for each item
    for (const item of sectionItems) {
      lines.push(generateItemMarkdown(item));
    }

    // Section separator
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export selected sections only.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param sectionIds - Array of section IDs to export
 * @returns Markdown representation of the selected sections
 */
export async function exportSectionsToMarkdown(
  projectPath: string,
  projectId: number,
  sectionIds: number[]
): Promise<string> {
  const allSections = await getAllSections(projectPath, projectId);
  const allItems = await getAllItems(projectPath, projectId);

  // Filter sections
  const selectedSections = allSections.filter(s => sectionIds.includes(s.id));

  const lines: string[] = [];

  // Header
  lines.push('# Product Backlog (Partial Export)');
  lines.push('');
  lines.push(generateToc(selectedSections));

  // Track item index across sections
  let currentItemIndex = 0;

  // Process sections in order
  for (const section of allSections) {
    // Count items for this section
    const sectionItems: BacklogItem[] = [];
    while (currentItemIndex < allItems.length) {
      const item = allItems[currentItemIndex];
      if (sectionItems.length === 0 || item.sectionIndex === sectionItems.length) {
        sectionItems.push(item);
        currentItemIndex++;
      } else if (item.sectionIndex === 0 && sectionItems.length > 0) {
        break;
      } else {
        sectionItems.push(item);
        currentItemIndex++;
      }
    }

    // Only include if this section is selected
    if (sectionIds.includes(section.id)) {
      lines.push(section.raw_header || `## ${section.position + 1}. ${section.title}`);
      lines.push('');

      for (const item of sectionItems) {
        lines.push(generateItemMarkdown(item));
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Export items of selected types only.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param types - Array of type IDs to export (e.g., ["BUG", "CT"])
 * @returns Markdown representation of items matching the types
 */
export async function exportTypeToMarkdown(
  projectPath: string,
  projectId: number,
  types: string[]
): Promise<string> {
  const lines: string[] = [];

  // Header
  lines.push('# Product Backlog (Type Export)');
  lines.push('');
  lines.push(`Exported types: ${types.join(', ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Get items for each type
  for (const type of types) {
    const items = await getItemsByType(projectPath, projectId, type);

    if (items.length > 0) {
      lines.push(`## ${type}`);
      lines.push('');

      for (const item of items) {
        lines.push(generateItemMarkdown(item));
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Export a single item as Markdown.
 *
 * @param item - The BacklogItem to export
 * @returns Markdown string representation
 */
export function exportSingleItem(item: BacklogItem): string {
  return generateItemMarkdown(item);
}
