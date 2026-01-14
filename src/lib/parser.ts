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
import { isBacklogItem } from '../types/guards';
import { PARSER_PATTERNS, isRawSectionTitle } from '../constants/patterns';
import { parseScreenshotFilename } from './screenshots';

// ============================================================
// MAIN PARSER
// ============================================================

export function parseBacklog(markdown: string): Backlog {
  // Normaliser les fins de lignes ET corriger les fusions courantes
  const normalizedMarkdown = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Fix separateur fusionné avec section: "---## 1. Title" → "---\n\n## 1. Title"
    .replace(/---(\s*## \d+\.)/g, '---\n\n$1')
    // Fix lignes fusionnées: "## Title### Item" → "## Title\n\n### Item"
    .replace(/(##[^#\n]+)(###)/g, '$1\n\n$2')
    // Fix separateur fusionné avec item: "---### Item" → "---\n\n### Item"
    .replace(/---(\s*###)/g, '---\n\n$1')
    // Fix titre fusionné: "# Title## Section" → "# Title\n\n## Section"
    .replace(/(#[^#\n]+)(##)/g, '$1\n\n$2');

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
  let autoId = 1;

  // Titles to skip as section boundaries (TOC, Sommaire)
  const SKIP_TITLES = [
    'table des matières',
    'table des matieres',
    'sommaire',
    'contents',
  ];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(PARSER_PATTERNS.SECTION_HEADER);
    if (match) {
      const title = match[2].trim();
      // Skip TOC-like sections
      if (SKIP_TITLES.some(skip => title.toLowerCase() === skip)) {
        continue;
      }
      boundaries.push({
        start: i,
        id: match[1] || String(autoId++), // Use auto-increment if no number
        title,
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

function parseSection(lines: string[], sectionIndex: number): Section {
  const headerLine = lines[0];
  const match = headerLine.match(PARSER_PATTERNS.SECTION_HEADER);

  if (!match) {
    throw new Error(`Invalid section header: ${headerLine}`);
  }

  const sectionId = match[1] || String(sectionIndex + 1); // Use index+1 if no number
  const sectionTitle = match[2];

  // Sections spéciales (Roadmap, Légende) - ne pas parser
  if (isRawSectionTitle(sectionTitle)) {
    // CRITICAL: Exclude header from rawMarkdown to prevent duplication in serializer
    // rawMarkdown = content only (lines after header)
    const contentLines = lines.slice(1);
    return {
      id: sectionId,
      title: sectionTitle,
      items: [{
        type: 'raw-section' as const,
        title: sectionTitle,
        rawMarkdown: contentLines.join('\n'),
        sectionIndex: 0,
      }],
      rawHeader: headerLine,
    };
  }

  // Trouver les items (### headers)
  const itemBoundaries = findItemBoundaries(lines);
  const items: (BacklogItem | TableGroup | RawSection)[] = [];

  // CRITICAL FIX: For empty sections, create a raw-section marker
  // This preserves empty custom sections like "## 6. BUG V5" (without items)
  // and allows type detection from section headers
  if (itemBoundaries.length === 0) {
    // Extract content after header (comments, blank lines, etc.)
    const contentLines = lines.slice(1);
    const rawContent = contentLines.join('\n').trim();

    // Detect type from section title for the marker
    const typeId = extractTypeFromSectionTitle(sectionTitle);
    const typeMarker = typeId ? `<!-- Type: ${typeId} -->` : '';

    // Only add marker if there's content or we detected a custom type
    if (rawContent || typeId) {
      const markerContent = rawContent.includes('<!-- Type:')
        ? rawContent
        : (typeMarker ? `${typeMarker}\n${rawContent}` : rawContent);

      items.push({
        type: 'raw-section' as const,
        title: sectionTitle,
        rawMarkdown: markerContent || `<!-- Empty section: ${sectionTitle} -->`,
        sectionIndex: 0,
      });
    }
  }

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

/**
 * Extract type ID from section title
 * Examples:
 *   "BUGS" → "BUG"
 *   "BUG V5" → "BUG_V5"
 *   "COURT TERME" → "CT"
 *   "Custom Type" → "CUSTOM_TYPE"
 */
function extractTypeFromSectionTitle(title: string): string | null {
  const titleUpper = title.trim().toUpperCase();

  // Skip legend/special sections
  if (titleUpper.includes('LÉGENDE') || titleUpper.includes('LEGENDE') ||
      titleUpper.includes('TABLE DES MATIÈRES') || titleUpper.includes('TABLE DES MATIERES')) {
    return null;
  }

  // Known mappings
  const sectionToType: Record<string, string> = {
    'BUGS': 'BUG',
    'BUG': 'BUG',
    'COURT TERME': 'CT',
    'COURT-TERME': 'CT',
    'CT': 'CT',
    'LONG TERME': 'LT',
    'LONG-TERME': 'LT',
    'LT': 'LT',
    'AUTRES IDÉES': 'AUTRE',
    'AUTRES IDEES': 'AUTRE',
    'AUTRES': 'AUTRE',
    'AUTRE': 'AUTRE',
  };

  if (sectionToType[titleUpper]) {
    return sectionToType[titleUpper];
  }

  // Check for exact word match followed by parenthesis/dash
  for (const [key, value] of Object.entries(sectionToType)) {
    const exactWordPattern = new RegExp(`^${key}(?:\\s*[\\(\\-\\:]|$)`);
    if (exactWordPattern.test(titleUpper)) {
      return value;
    }
  }

  // Custom type: convert to uppercase with underscores
  if (/^[A-ZÀ-ÿ0-9\s_-]+$/i.test(titleUpper)) {
    return titleUpper.replace(/\s+/g, '_').replace(/-/g, '_');
  }

  return null;
}

function findItemBoundaries(lines: string[]): { start: number; id: string; title: string }[] {
  const boundaries: { start: number; id: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(PARSER_PATTERNS.ITEM_HEADER);
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
  const headerMatch = lines[0].match(PARSER_PATTERNS.ITEM_HEADER);
  if (!headerMatch) {
    throw new Error(`Invalid item header: ${lines[0]}`);
  }

  const id = headerMatch[1];
  let title = headerMatch[2];
  let emoji: string | undefined;

  // Extraire emoji du titre (ex: "⚠️ CRITIQUE")
  const emojiMatch = title.match(PARSER_PATTERNS.EMOJI);
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
    if (PARSER_PATTERNS.CODE_BLOCK.test(line)) {
      inCodeBlock = !inCodeBlock;
      i++;
      continue;
    }

    if (inCodeBlock) {
      i++;
      continue;
    }

    // Metadata (ex: **Composant:** Extension Chrome)
    const metadataMatch = line.match(PARSER_PATTERNS.METADATA);
    if (metadataMatch) {
      const key = metadataMatch[1].trim();
      const value = metadataMatch[2].trim();
      parseMetadata(item, key, value);
      currentListType = detectListType(key);
      i++;
      continue;
    }

    // User Story (blockquote)
    const blockquoteMatch = line.match(PARSER_PATTERNS.BLOCKQUOTE);
    if (blockquoteMatch) {
      item.userStory = (item.userStory || '') + blockquoteMatch[1] + ' ';
      i++;
      continue;
    }

    // Checkbox (critères d'acceptation)
    const checkboxMatch = line.match(PARSER_PATTERNS.CHECKBOX);
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
    const numberedMatch = line.match(PARSER_PATTERNS.NUMBERED_LIST);
    if (numberedMatch) {
      addToList(item, currentListType, numberedMatch[1]);
      i++;
      continue;
    }

    // Liste à puces
    const listMatch = line.match(PARSER_PATTERNS.LIST_ITEM);
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
  const regex = new RegExp(PARSER_PATTERNS.SCREENSHOT.source, 'g');
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
  const headerMatch = lines[0].match(PARSER_PATTERNS.ITEM_HEADER);
  if (!headerMatch) {
    throw new Error(`Invalid table group header: ${lines[0]}`);
  }

  const title = `${headerMatch[1]} | ${headerMatch[2]}`;
  let severity: Severity | undefined;

  // Chercher la sévérité
  for (const line of lines) {
    const metadataMatch = line.match(PARSER_PATTERNS.METADATA);
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
      const rowMatch = line.match(PARSER_PATTERNS.TABLE_ROW);
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

/**
 * Déduplique les items par ID.
 * En cas de doublon, garde le premier item rencontré.
 */
function deduplicateItems(items: BacklogItem[]): BacklogItem[] {
  const seen = new Map<string, BacklogItem>();
  const duplicates: string[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.push(item.id);
    } else {
      seen.set(item.id, item);
    }
  }

  return Array.from(seen.values());
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

  // CRITICAL: Dédupliquer les items pour éviter les doublons
  return deduplicateItems(items);
}

export function getItemsByType(backlog: Backlog, type: ItemType): BacklogItem[] {
  return getAllItems(backlog).filter(item => item.type === type);
}
