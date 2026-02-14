/**
 * Keyboard Shortcuts Registry
 *
 * Single source of truth for all keyboard shortcuts in TicketFlow.
 * Each shortcut defines its key combo, label, category, and context conditions.
 *
 * @module constants/shortcuts
 */

// ============================================================
// TYPES
// ============================================================

export interface ShortcutDefinition {
  /** Key combo string, e.g. "ctrl+n", "arrowup", "p", "?" */
  keys: string;
  /** i18n key that maps to t.shortcuts[label] */
  label: string;
  /** Category for grouping in help modal */
  category: 'navigation' | 'editing' | 'quick-action' | 'view';
  /** If true, shortcut fires even when focus is in input/textarea (default: false) */
  allowInInput?: boolean;
  /** If true, shortcut is disabled when a modal is open (default: false) */
  requiresNoModal?: boolean;
  /** If true, shortcut requires a selected item (default: false) */
  requiresSelection?: boolean;
}

// ============================================================
// SHORTCUT REGISTRY
// ============================================================

export const SHORTCUTS = {
  // -- Navigation --
  NEW_ITEM: {
    keys: 'ctrl+n',
    label: 'newItem',
    category: 'navigation',
    requiresNoModal: true,
  },
  SEARCH_FOCUS: {
    keys: 'ctrl+f',
    label: 'search',
    category: 'navigation',
    requiresNoModal: true,
  },
  CLOSE_PANEL: {
    keys: 'escape',
    label: 'closePanel',
    category: 'navigation',
  },
  NAVIGATE_UP: {
    keys: 'arrowup',
    label: 'navigateUp',
    category: 'navigation',
    requiresNoModal: true,
  },
  NAVIGATE_DOWN: {
    keys: 'arrowdown',
    label: 'navigateDown',
    category: 'navigation',
    requiresNoModal: true,
  },
  COMMAND_PALETTE: {
    keys: 'ctrl+k',
    label: 'commandPalette',
    category: 'navigation' as const,
    requiresNoModal: false,
    allowInInput: true,
  },
  CHAT_PANEL: {
    keys: 'ctrl+j',
    label: 'chatPanel',
    category: 'navigation' as const,
    requiresNoModal: false,
    allowInInput: true,
  },
  QUICK_CAPTURE: {
    keys: 'ctrl+alt+t',
    label: 'quickCapture',
    category: 'navigation' as const,
    requiresNoModal: true,
    allowInInput: false,
  },
  BULK_IMPORT: {
    keys: 'ctrl+shift+i',
    label: 'bulkImport',
    category: 'navigation' as const,
    requiresNoModal: true,
    allowInInput: false,
  },
  SHOW_HELP: {
    keys: '?',
    label: 'showHelp',
    category: 'navigation',
    requiresNoModal: true,
  },

  // -- Editing --
  EDIT_ITEM: {
    keys: 'e',
    label: 'editItem',
    category: 'editing',
    requiresSelection: true,
    requiresNoModal: true,
  },
  DELETE_ITEM: {
    keys: 'delete',
    label: 'deleteItem',
    category: 'editing',
    requiresSelection: true,
    requiresNoModal: true,
  },
  ARCHIVE_ITEM: {
    keys: 'a',
    label: 'archiveItem',
    category: 'editing',
    requiresSelection: true,
    requiresNoModal: true,
  },
  UNDO: {
    keys: 'ctrl+z',
    label: 'undo',
    category: 'editing',
  },
  REDO: {
    keys: 'ctrl+y',
    label: 'redo',
    category: 'editing',
  },
  SELECT_ALL: {
    keys: 'ctrl+a',
    label: 'selectAll',
    category: 'editing' as const,
    requiresNoModal: true,
  },

  // -- Quick Actions --
  CYCLE_PRIORITY: {
    keys: 'p',
    label: 'cyclePriority',
    category: 'quick-action',
    requiresSelection: true,
    requiresNoModal: true,
  },
  CYCLE_EFFORT: {
    keys: 'f',
    label: 'cycleEffort',
    category: 'quick-action',
    requiresSelection: true,
    requiresNoModal: true,
  },

  // -- View --
  VIEW_KANBAN: {
    keys: '1',
    label: 'viewKanban',
    category: 'view',
    requiresNoModal: true,
  },
  VIEW_LIST: {
    keys: '2',
    label: 'viewList',
    category: 'view',
    requiresNoModal: true,
  },
  VIEW_GRAPH: {
    keys: '3',
    label: 'viewGraph',
    category: 'view',
    requiresNoModal: true,
  },
  VIEW_DASHBOARD: {
    keys: '4',
    label: 'viewDashboard',
    category: 'view',
    requiresNoModal: true,
  },
} as const satisfies Record<string, ShortcutDefinition>;

// ============================================================
// CATEGORIES
// ============================================================

/** Maps category IDs to i18n key names in t.shortcuts.categories */
export const SHORTCUT_CATEGORY_KEYS: Record<ShortcutDefinition['category'], string> = {
  navigation: 'navigation',
  editing: 'editing',
  'quick-action': 'quickActions',
  view: 'display',
};

// ============================================================
// KEY FORMATTING
// ============================================================

/** Base key display map (non-translatable keys) */
const KEY_DISPLAY_BASE: Record<string, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Cmd',
  arrowup: '\u2191',
  arrowdown: '\u2193',
  arrowleft: '\u2190',
  arrowright: '\u2192',
  escape: 'Esc',
  tab: 'Tab',
};

/** Keys whose display labels are translatable via t.shortcuts */
interface TranslatableKeyLabels {
  deleteKey: string;
  backspaceKey: string;
  enterKey: string;
  spaceKey: string;
}

/**
 * Format a key combo string for display.
 * "ctrl+n" -> "Ctrl+N", "arrowup" -> "Up Arrow", "?" -> "?"
 *
 * @param keys - Key combo string (e.g. "ctrl+n")
 * @param keyLabels - Optional translatable key labels from t.shortcuts
 */
export function formatKeyCombo(keys: string, keyLabels?: TranslatableKeyLabels): string {
  const parts = keys.toLowerCase().split('+');
  return parts
    .map(part => {
      // Check base (non-translatable) keys first
      const base = KEY_DISPLAY_BASE[part];
      if (base) return base;
      // Translatable special keys
      if (keyLabels) {
        if (part === 'delete') return keyLabels.deleteKey;
        if (part === 'backspace') return keyLabels.backspaceKey;
        if (part === 'enter') return keyLabels.enterKey;
        if (part === 'space') return keyLabels.spaceKey;
      } else {
        // Fallback (no translations available)
        if (part === 'delete') return 'Del';
        if (part === 'backspace') return 'Backspace';
        if (part === 'enter') return 'Enter';
        if (part === 'space') return 'Space';
      }
      // Single character keys display as uppercase
      if (part.length === 1) return part.toUpperCase();
      // Fallback: capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
}
