/**
 * Command Registry for Command Palette
 *
 * Defines the typed command registry that powers the command palette.
 * Static commands (actions, views) and dynamic item commands are built
 * separately and merged at the hook level.
 *
 * @module lib/command-registry
 */

import type { BacklogItem } from '../types/backlog';
import type { Translations } from '../i18n/types';
import type { TypeDefinition } from '../types/typeConfig';
import type { ViewMode } from '../hooks/useBacklogDB';
import { formatKeyCombo } from '../constants/shortcuts';

// ============================================================
// TYPES
// ============================================================

/** Categories for grouping palette results */
export type CommandCategory = 'item' | 'command' | 'view' | 'ai' | 'recent';

/** A single searchable command in the palette */
export interface PaletteCommand {
  id: string;
  label: string;
  category: CommandCategory;
  keywords?: string;
  icon?: string;
  shortcut?: string;
  handler: () => void;
}

/** Callbacks the registry needs from the workspace */
export interface WorkspaceActions {
  createItem: () => void;
  setView: (mode: ViewMode) => void;
  openSettings: () => void;
  openTypeConfig: () => void;
  toggleAIPanel: () => void;
  showHelp: () => void;
  undo: () => void;
  redo: () => void;
  quickCapture?: () => void;
  openBulkImport?: () => void;
}

// ============================================================
// STATIC COMMANDS
// ============================================================

/**
 * Build the static command list from translations and workspace actions.
 * These commands are always available regardless of backlog content.
 */
export function getStaticCommands(t: Translations, actions: WorkspaceActions): PaletteCommand[] {
  return [
    // -- Command category --
    {
      id: 'cmd:new-item',
      label: t.editor.create,
      category: 'command',
      keywords: 'nouveau ticket create new item ajouter',
      icon: 'plus',
      shortcut: formatKeyCombo('ctrl+n'),
      handler: actions.createItem,
    },
    {
      id: 'cmd:undo',
      label: t.action.undo,
      category: 'command',
      keywords: 'annuler retour undo back',
      icon: 'undo',
      shortcut: formatKeyCombo('ctrl+z'),
      handler: actions.undo,
    },
    {
      id: 'cmd:redo',
      label: t.action.redo,
      category: 'command',
      keywords: 'refaire retablir redo forward',
      icon: 'redo',
      shortcut: formatKeyCombo('ctrl+y'),
      handler: actions.redo,
    },
    {
      id: 'cmd:settings',
      label: t.common.parameters,
      category: 'command',
      keywords: 'parametres configuration settings preferences options reglages',
      icon: 'settings',
      handler: actions.openSettings,
    },
    {
      id: 'cmd:type-config',
      label: t.editor.type,
      category: 'command',
      keywords: 'types configuration colonnes kanban columns categories',
      icon: 'type',
      handler: actions.openTypeConfig,
    },
    {
      id: 'cmd:ai-analysis',
      label: t.settings.analyze,
      category: 'ai',
      keywords: 'ia intelligence artificielle ai analyse maintenance',
      icon: 'ai',
      handler: actions.toggleAIPanel,
    },
    {
      id: 'cmd:help',
      label: t.nav.search,
      category: 'command',
      keywords: 'aide help raccourcis shortcuts clavier keyboard',
      icon: 'help',
      shortcut: formatKeyCombo('?'),
      handler: actions.showHelp,
    },
    {
      id: 'cmd:quick-capture',
      label: t.capture.title,
      category: 'command',
      keywords: 'capture rapide quick ticket create nouveau fast',
      icon: 'plus',
      shortcut: formatKeyCombo('ctrl+shift+t'),
      handler: actions.quickCapture || (() => {}),
    },
    {
      id: 'cmd:bulk-import',
      label: t.bulkImport.title,
      category: 'command',
      keywords: 'import bulk multiple tickets paste extract masse extraction ia ai',
      icon: 'sparkles',
      shortcut: formatKeyCombo('ctrl+shift+i'),
      handler: actions.openBulkImport || (() => {}),
    },

    // -- View category --
    {
      id: 'view:kanban',
      label: t.nav.kanban,
      category: 'view',
      keywords: 'vue board tableau colonnes columns kanban',
      icon: 'kanban',
      shortcut: formatKeyCombo('1'),
      handler: () => actions.setView('kanban'),
    },
    {
      id: 'view:list',
      label: t.nav.list,
      category: 'view',
      keywords: 'vue liste table rows lignes list',
      icon: 'list',
      shortcut: formatKeyCombo('2'),
      handler: () => actions.setView('list'),
    },
    {
      id: 'view:graph',
      label: t.nav.graph,
      category: 'view',
      keywords: 'vue graphe relations dependances graph dependencies',
      icon: 'graph',
      shortcut: formatKeyCombo('3'),
      handler: () => actions.setView('graph'),
    },
    {
      id: 'view:dashboard',
      label: t.nav.dashboard,
      category: 'view',
      keywords: 'vue tableau de bord statistiques stats analytics dashboard',
      icon: 'dashboard',
      shortcut: formatKeyCombo('4'),
      handler: () => actions.setView('dashboard'),
    },
  ];
}

// ============================================================
// DYNAMIC ITEM COMMANDS
// ============================================================

/**
 * Build palette commands from backlog items.
 * Each item becomes a searchable command that navigates to that item.
 */
export function buildItemCommands(
  items: BacklogItem[],
  onSelect: (item: BacklogItem) => void,
): PaletteCommand[] {
  return items.map(item => ({
    id: `item:${item.id}`,
    label: `${item.id} ${item.emoji || ''} ${item.title}`.trim(),
    category: 'item' as const,
    keywords: [item.description, item.type, item.component, item.module]
      .filter(Boolean)
      .join(' '),
    handler: () => onSelect(item),
  }));
}

// ============================================================
// NL COMMAND PARSING
// ============================================================

/** Result of a parsed natural language command */
export interface NLCommandResult {
  label: string;
  handler: () => void;
}

/** Actions available for NL commands */
interface NLActions {
  createItemOfType: (typeId: string) => void;
  switchView: (view: ViewMode) => void;
}

/** NL pattern definition */
interface NLPattern {
  regex: RegExp;
  type: 'create' | 'view';
}

const NL_PATTERNS: NLPattern[] = [
  // FR create
  { regex: /^nouveau\s+(.+)$/i, type: 'create' },
  // EN create
  { regex: /^new\s+(.+)$/i, type: 'create' },
  // FR view
  { regex: /^vue\s+(.+)$/i, type: 'view' },
  // EN view
  { regex: /^view\s+(.+)$/i, type: 'view' },
];

/** Map of common FR/EN view terms to ViewMode values */
const VIEW_ALIASES: Record<string, ViewMode> = {
  kanban: 'kanban',
  liste: 'list',
  list: 'list',
  graphe: 'graph',
  graph: 'graph',
  dashboard: 'dashboard',
  tableau: 'dashboard',
};

/**
 * Attempt to parse a query string as a natural language command.
 *
 * Supports:
 * - "nouveau bug" / "new feature" -> create item of matched type
 * - "vue kanban" / "view list" -> switch view
 *
 * @returns NLCommandResult if matched, null otherwise
 */
export function parseNLCommand(
  query: string,
  typeConfigs: TypeDefinition[],
  actions: NLActions,
): NLCommandResult | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const pattern of NL_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    const captured = match[1].trim().toLowerCase();

    if (pattern.type === 'create') {
      // Match against type configs
      const matchedType = typeConfigs.find(
        tc => tc.id.toLowerCase() === captured || tc.label.toLowerCase() === captured
      );
      if (matchedType) {
        return {
          label: `${matchedType.label} (${matchedType.id})`,
          handler: () => actions.createItemOfType(matchedType.id),
        };
      }
    }

    if (pattern.type === 'view') {
      const viewMode = VIEW_ALIASES[captured];
      if (viewMode) {
        return {
          label: viewMode,
          handler: () => actions.switchView(viewMode),
        };
      }
    }
  }

  return null;
}

// ============================================================
// RECENT ITEMS
// ============================================================

interface RecentEntry {
  id: string;
  timestamp: number;
}

const MAX_RECENT = 8;

function getStorageKey(projectPath: string): string {
  return `ticketflow-recent-${projectPath}`;
}

/**
 * Add an item to the recent items list for the given project.
 * Maintains a max of 8 entries, ordered by most recent first.
 * Deduplicates by removing existing entry for the same id before prepending.
 */
export function addRecentItem(projectPath: string, itemId: string): void {
  try {
    const key = getStorageKey(projectPath);
    const raw = localStorage.getItem(key);
    let entries: RecentEntry[] = raw ? JSON.parse(raw) : [];

    // Remove existing entry for same id
    entries = entries.filter(e => e.id !== itemId);

    // Prepend new entry
    entries.unshift({ id: itemId, timestamp: Date.now() });

    // Trim to max
    if (entries.length > MAX_RECENT) {
      entries = entries.slice(0, MAX_RECENT);
    }

    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // localStorage not available or parse error - silent
  }
}

/**
 * Get recent item IDs for the given project, ordered by most recent first.
 */
export function getRecentItemIds(projectPath: string): string[] {
  try {
    const key = getStorageKey(projectPath);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const entries: RecentEntry[] = JSON.parse(raw);
    return entries.map(e => e.id);
  } catch {
    return [];
  }
}
