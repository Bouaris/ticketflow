/**
 * Parser Markdown → JSON
 *
 * CRITIQUE: Ce parser doit être 100% fidèle au format original.
 * Chaque élément conserve son rawMarkdown pour permettre un round-trip parfait.
 */

import type {
  Backlog,
  BacklogItem,
  Section,
  TableGroup,
  RawSection,
  ItemType,
  Severity,
  Screenshot,
} from '../types/backlog';
import {
  SeveritySchema,
  PrioritySchema,
  EffortSchema,
  getTypeFromId,
} from '../types/backlog';
import { parseScreenshotFilename } from './screenshots';

// ============================================================
// REGEX PATTERNS
// ============================================================

const SECTION_HEADER_REGEX = /^## (\d+)\. (.+)$/;
const ITEM_HEADER_REGEX = /^### ([A-Z]+-\d+(?:\s*à\s*\d+)?)\s*\|\s*(.+)$/;
const METADATA_REGEX = /^\*\*([^:*]+):\*\*\s*(.+)$/;
const BLOCKQUOTE_REGEX = /^>\s*(.+)$/;
const CHECKBOX_REGEX = /^- \[([ xX])\]\s*(.+)$/;
const LIST_ITEM_REGEX = /^- (.+)$/;
const NUMBERED_LIST_REGEX = /^\d+\.\s+(.+)$/;
const TABLE_ROW_REGEX = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/;
const CODE_BLOCK_START = /^```/;
// Screenshot markdown reference: ![alt](.backlog-assets/screenshots/filename.png)
const SCREENSHOT_REGEX = /!\[([^\]]*)\]\(\.?\.?backlog-assets\/screenshots\/([^)]+)\)/g;

// ============================================================
// MAIN PARSER
// ============================================================

export function parseBacklog(markdown: string): Backlog {
  // Normaliser les fins de lignes (CRLF → LF) pour Windows
  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedMarkdown.split('\n');

  // 1. Trouver les limites des sections
  const sectionBoundaries = findSectionBoundaries(lines);

  // 2. Extraire header (avant la première section ##)
  const firstSectionStart = sectionBoundaries[0]?.start ?? lines.length;
  const headerLines = lines.slice(0, firstSectionStart);
  const { header, tableOfContents } = parseHeader(headerLines);

  // 3. Parser chaque section
  const sections: Section[] = [];
  for (let i = 0; i < sectionBoundaries.length; i++) {
    const boundary = sectionBoundaries[i];
    const nextStart = sectionBoundaries[i + 1]?.start ?? lines.length;
    const sectionLines = lines.slice(boundary.start, nextStart);
    const section = parseSection(sectionLines, i);
    sections.push(section);
  }

  return {
    header,
    tableOfContents,
    sections,
  };
}

// ============================================================
// SECTION BOUNDARY DETECTION
// ============================================================

interface SectionBoundary {
  start: number;
  id: string;
  title: string;
}

function findSectionBoundaries(lines: string[]): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_HEADER_REGEX);
    if (match) {
      boundaries.push({
        start: i,
        id: match[1],
        title: match[2],
      });
    }
  }

  return boundaries;
}

// ============================================================
// HEADER PARSER
// ============================================================

function parseHeader(lines: string[]): { header: string; tableOfContents: string } {
  const content = lines.join('\n');

  // Trouver la table des matières
  const tocStart = content.indexOf('## Table des matières');
  if (tocStart === -1) {
    return { header: content, tableOfContents: '' };
  }

  // Trouver la fin de la TOC (prochain ## ou fin du header)
  const afterToc = content.slice(tocStart);
  const tocEndMatch = afterToc.match(/\n---\n/);
  const tocEnd = tocEndMatch ? tocStart + tocEndMatch.index! + tocEndMatch[0].length : content.length;

  const header = content.slice(0, tocStart);
  const tableOfContents = content.slice(tocStart, tocEnd);

  return { header, tableOfContents };
}

// ============================================================
// SECTION PARSER
// ============================================================

function parseSection(lines: string[], _sectionIndex: number): Section {
  const headerLine = lines[0];
  const match = headerLine.match(SECTION_HEADER_REGEX);

  if (!match) {
    throw new Error(`Invalid section header: ${headerLine}`);
  }

  const sectionId = match[1];
  const sectionTitle = match[2];

  // Sections spéciales (Roadmap, Légende) - ne pas parser
  if (isRawSection(sectionTitle)) {
    return {
      id: sectionId,
      title: sectionTitle,
      items: [{
        type: 'raw-section' as const,
        title: sectionTitle,
        rawMarkdown: lines.join('\n'),
        sectionIndex: 0,
      }],
      rawHeader: headerLine,
    };
  }

  // Trouver les items (### headers)
  const itemBoundaries = findItemBoundaries(lines);
  const items: (BacklogItem | TableGroup | RawSection)[] = [];

  for (let i = 0; i < itemBoundaries.length; i++) {
    const boundary = itemBoundaries[i];
    const nextStart = itemBoundaries[i + 1]?.start ?? lines.length;
    const itemLines = lines.slice(boundary.start, nextStart);
    const rawMarkdown = itemLines.join('\n');

    // Détecter si c'est un tableau groupé (ex: "BUG-005 à 007")
    if (boundary.id.includes(' à ') || boundary.id.includes('à')) {
      const tableGroup = parseTableGroup(itemLines, rawMarkdown, i);
      items.push(tableGroup);
    } else {
      const item = parseItem(itemLines, rawMarkdown, i);
      items.push(item);
    }
  }

  return {
    id: sectionId,
    title: sectionTitle,
    items,
    rawHeader: headerLine,
  };
}

function isRawSection(title: string): boolean {
  const rawSections = ['ROADMAP', 'Roadmap', 'Légende', 'Conventions'];
  return rawSections.some(s => title.toUpperCase().includes(s.toUpperCase()));
}

function findItemBoundaries(lines: string[]): { start: number; id: string; title: string }[] {
  const boundaries: { start: number; id: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(ITEM_HEADER_REGEX);
    if (match) {
      boundaries.push({
        start: i,
        id: match[1],
        title: match[2],
      });
    }
  }

  return boundaries;
}

// ============================================================
// ITEM PARSER
// ============================================================

function parseItem(lines: string[], rawMarkdown: string, sectionIndex: number): BacklogItem {
  const headerMatch = lines[0].match(ITEM_HEADER_REGEX);
  if (!headerMatch) {
    throw new Error(`Invalid item header: ${lines[0]}`);
  }

  const id = headerMatch[1];
  let title = headerMatch[2];
  let emoji: string | undefined;

  // Extraire emoji du titre (ex: "⚠️ CRITIQUE")
  const emojiMatch = title.match(/^([\u{1F300}-\u{1F9FF}]|⚠️|✅|❌|🔥|💡|🚀|📝|🐛|⚡)/u);
  if (emojiMatch) {
    emoji = emojiMatch[0];
    title = title.slice(emoji.length).trim();
  }

  const type = getTypeFromId(id);
  if (!type) {
    throw new Error(`Unknown item type for ID: ${id}`);
  }

  const item: BacklogItem = {
    id,
    type,
    title,
    emoji,
    rawMarkdown,
    sectionIndex,
  };

  // Parser le contenu ligne par ligne
  let i = 1;
  let currentListType: 'specs' | 'reproduction' | 'criteria' | 'dependencies' | 'constraints' | 'screens' | null = null;
  let inCodeBlock = false;

  while (i < lines.length) {
    const line = lines[i];

    // Gestion des code blocks
    if (CODE_BLOCK_START.test(line)) {
      inCodeBlock = !inCodeBlock;
      i++;
      continue;
    }

    if (inCodeBlock) {
      i++;
      continue;
    }

    // Metadata (ex: **Composant:** Extension Chrome)
    const metadataMatch = line.match(METADATA_REGEX);
    if (metadataMatch) {
      const key = metadataMatch[1].trim();
      const value = metadataMatch[2].trim();
      parseMetadata(item, key, value);
      currentListType = detectListType(key);
      i++;
      continue;
    }

    // User Story (blockquote)
    const blockquoteMatch = line.match(BLOCKQUOTE_REGEX);
    if (blockquoteMatch) {
      item.userStory = (item.userStory || '') + blockquoteMatch[1] + ' ';
      i++;
      continue;
    }

    // Checkbox (critères d'acceptation)
    const checkboxMatch = line.match(CHECKBOX_REGEX);
    if (checkboxMatch) {
      if (!item.criteria) item.criteria = [];
      item.criteria.push({
        checked: checkboxMatch[1].toLowerCase() === 'x',
        text: checkboxMatch[2],
      });
      i++;
      continue;
    }

    // Liste numérotée
    const numberedMatch = line.match(NUMBERED_LIST_REGEX);
    if (numberedMatch) {
      addToList(item, currentListType, numberedMatch[1]);
      i++;
      continue;
    }

    // Liste à puces
    const listMatch = line.match(LIST_ITEM_REGEX);
    if (listMatch) {
      addToList(item, currentListType, listMatch[1]);
      i++;
      continue;
    }

    i++;
  }

  // Nettoyer userStory
  if (item.userStory) {
    item.userStory = item.userStory.trim();
  }

  // Extraire les screenshots du rawMarkdown
  const screenshots = extractScreenshots(rawMarkdown);
  if (screenshots.length > 0) {
    item.screenshots = screenshots;
  }

  return item;
}

// ============================================================
// SCREENSHOT EXTRACTION
// ============================================================

function extractScreenshots(rawMarkdown: string): Screenshot[] {
  const screenshots: Screenshot[] = [];
  const regex = new RegExp(SCREENSHOT_REGEX.source, 'g');
  let match;

  while ((match = regex.exec(rawMarkdown)) !== null) {
    const alt = match[1] || undefined;
    const filename = match[2];

    // Parse filename to get timestamp
    const parsed = parseScreenshotFilename(filename);
    const addedAt = parsed?.timestamp || Date.now();

    screenshots.push({
      filename,
      alt,
      addedAt,
    });
  }

  return screenshots;
}

function parseMetadata(item: BacklogItem, key: string, value: string): void {
  const keyLower = key.toLowerCase();

  if (keyLower === 'composant') {
    item.component = value;
  } else if (keyLower === 'module') {
    item.module = value;
  } else if (keyLower === 'sévérité' || keyLower === 'severité') {
    const severityMatch = value.match(/^(P\d)/);
    if (severityMatch) {
      const parsed = SeveritySchema.safeParse(severityMatch[1]);
      if (parsed.success) item.severity = parsed.data;
    }
  } else if (keyLower === 'priorité') {
    const parsed = PrioritySchema.safeParse(value);
    if (parsed.success) item.priority = parsed.data;
  } else if (keyLower === 'effort') {
    const effortMatch = value.match(/^([A-Z]+)/);
    if (effortMatch) {
      const parsed = EffortSchema.safeParse(effortMatch[1]);
      if (parsed.success) item.effort = parsed.data;
    }
  } else if (keyLower === 'description') {
    item.description = value;
  }
}

function detectListType(key: string): 'specs' | 'reproduction' | 'criteria' | 'dependencies' | 'constraints' | 'screens' | null {
  const keyLower = key.toLowerCase();

  if (keyLower.includes('spécification') || keyLower.includes('specification')) return 'specs';
  if (keyLower.includes('reproduction')) return 'reproduction';
  if (keyLower.includes('critère') || keyLower.includes('acceptation')) return 'criteria';
  if (keyLower.includes('dépendance') || keyLower.includes('dependance')) return 'dependencies';
  if (keyLower.includes('contrainte')) return 'constraints';
  if (keyLower.includes('écran') || keyLower.includes('ecran')) return 'screens';

  return null;
}

function addToList(
  item: BacklogItem,
  listType: 'specs' | 'reproduction' | 'criteria' | 'dependencies' | 'constraints' | 'screens' | null,
  value: string
): void {
  if (!listType) {
    // Default to specs if no context
    if (!item.specs) item.specs = [];
    item.specs.push(value);
    return;
  }

  switch (listType) {
    case 'specs':
      if (!item.specs) item.specs = [];
      item.specs.push(value);
      break;
    case 'reproduction':
      if (!item.reproduction) item.reproduction = [];
      item.reproduction.push(value);
      break;
    case 'dependencies':
      if (!item.dependencies) item.dependencies = [];
      item.dependencies.push(value);
      break;
    case 'constraints':
      if (!item.constraints) item.constraints = [];
      item.constraints.push(value);
      break;
    case 'screens':
      if (!item.screens) item.screens = [];
      item.screens.push(value);
      break;
  }
}

// ============================================================
// TABLE GROUP PARSER
// ============================================================

function parseTableGroup(lines: string[], rawMarkdown: string, sectionIndex: number): TableGroup {
  const headerMatch = lines[0].match(ITEM_HEADER_REGEX);
  if (!headerMatch) {
    throw new Error(`Invalid table group header: ${lines[0]}`);
  }

  const title = `${headerMatch[1]} | ${headerMatch[2]}`;
  let severity: Severity | undefined;

  // Chercher la sévérité
  for (const line of lines) {
    const metadataMatch = line.match(METADATA_REGEX);
    if (metadataMatch && metadataMatch[1].toLowerCase().includes('sévérité')) {
      const severityMatch = metadataMatch[2].match(/^(P\d)/);
      if (severityMatch) {
        const parsed = SeveritySchema.safeParse(severityMatch[1]);
        if (parsed.success) severity = parsed.data;
      }
    }
  }

  // Parser les lignes du tableau
  const tableItems: { id: string; description: string; action: string }[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('|') && line.includes('ID')) {
      inTable = true;
      continue;
    }
    if (line.startsWith('|---') || line.startsWith('|-')) {
      continue;
    }

    if (inTable && line.startsWith('|')) {
      const rowMatch = line.match(TABLE_ROW_REGEX);
      if (rowMatch) {
        tableItems.push({
          id: rowMatch[1].trim(),
          description: rowMatch[2].trim(),
          action: rowMatch[3].trim(),
        });
      }
    }
  }

  return {
    type: 'table-group',
    title,
    severity,
    items: tableItems,
    rawMarkdown,
    sectionIndex,
  };
}

// ============================================================
// UTILITY: Get all items as flat array
// ============================================================

// Type guard to check if item is a BacklogItem (not TableGroup or RawSection)
function isBacklogItem(item: BacklogItem | TableGroup | RawSection): item is BacklogItem {
  // TableGroup has 'items' array, RawSection has type 'raw-section'
  // BacklogItem has 'id' but no 'items' array
  if (!('id' in item)) return false;
  if ('items' in item) return false; // TableGroup
  // Check if type is one of the BacklogItem types
  const validTypes = ['BUG', 'EXT', 'ADM', 'COS', 'LT'];
  return validTypes.includes(item.type as string);
}

export function getAllItems(backlog: Backlog): BacklogItem[] {
  const items: BacklogItem[] = [];

  for (const section of backlog.sections) {
    for (const item of section.items) {
      if (isBacklogItem(item)) {
        items.push(item);
      }
    }
  }

  return items;
}

export function getItemsByType(backlog: Backlog, type: ItemType): BacklogItem[] {
  return getAllItems(backlog).filter(item => item.type === type);
}
