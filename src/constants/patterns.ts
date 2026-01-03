/**
 * Regex patterns centralisés pour le parser
 *
 * Single source of truth pour tous les patterns de parsing Markdown.
 */

// ============================================================
// PARSER PATTERNS
// ============================================================

export const PARSER_PATTERNS = {
  // Section headers: "## 1. Title" or "## Title"
  SECTION_HEADER: /^## (?:(\d+)\.\s+)?(.+)$/,

  // Item headers: "### BUG-001 | Title"
  ITEM_HEADER: /^### ([A-Z]+-\d+(?:\s*à\s*\d+)?)\s*\|\s*(.+)$/,

  // Metadata: "**Key:** Value"
  METADATA: /^\*\*([^:*]+):\*\*\s*(.+)$/,

  // Blockquote: "> Text"
  BLOCKQUOTE: /^>\s*(.+)$/,

  // Checkbox: "- [ ] Text" or "- [x] Text"
  CHECKBOX: /^- \[([ xX])\]\s*(.+)$/,

  // List item: "- Item"
  LIST_ITEM: /^- (.+)$/,

  // Numbered list: "1. Item"
  NUMBERED_LIST: /^\d+\.\s+(.+)$/,

  // Table row: "| Col1 | Col2 | Col3 |"
  TABLE_ROW: /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/,

  // Screenshot reference: "![alt](.backlog-assets/screenshots/file.png)"
  SCREENSHOT: /!\[([^\]]*)\]\(\.?\.?backlog-assets\/screenshots\/([^)]+)\)/g,

  // Code block start
  CODE_BLOCK: /^```/,

  // Type ID pattern (uppercase letters only)
  TYPE_ID: /^[A-Z]+$/,

  // Severity pattern
  SEVERITY: /^(P[0-4])/,

  // Emoji pattern (common emojis used in titles)
  EMOJI: /^([\u{1F300}-\u{1F9FF}]|⚠️|✅|❌|🔥|💡|🚀|📝|🐛|⚡)/u,
} as const;

// ============================================================
// RAW SECTION PATTERNS
// ============================================================

/**
 * Sections that should not be parsed (kept as raw markdown)
 */
export const RAW_SECTION_NAMES = [
  'ROADMAP',
  'Roadmap',
  'Légende',
  'Conventions',
  'Sévérité',
  'Priorité',
] as const;

/**
 * Check if a section title indicates a raw section
 */
export function isRawSectionTitle(title: string): boolean {
  return RAW_SECTION_NAMES.some(name =>
    title.toUpperCase().includes(name.toUpperCase())
  );
}
