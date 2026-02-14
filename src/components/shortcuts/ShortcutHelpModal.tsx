/**
 * ShortcutHelpModal - Display all keyboard shortcuts grouped by category
 *
 * Shows a categorized list of all available keyboard shortcuts when the
 * user presses '?'. Uses the centralized SHORTCUTS registry as its source
 * of truth.
 *
 * @module components/shortcuts/ShortcutHelpModal
 */

import { Modal } from '../ui/Modal';
import {
  SHORTCUTS,
  SHORTCUT_CATEGORY_KEYS,
  formatKeyCombo,
  type ShortcutDefinition,
} from '../../constants/shortcuts';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================
// HELPERS
// ============================================================

/** Group shortcuts by category */
function getShortcutsByCategory(): Record<ShortcutDefinition['category'], Array<{ id: string; def: ShortcutDefinition }>> {
  const groups: Record<string, Array<{ id: string; def: ShortcutDefinition }>> = {
    navigation: [],
    editing: [],
    'quick-action': [],
    view: [],
  };

  for (const [id, def] of Object.entries(SHORTCUTS)) {
    groups[def.category].push({ id, def });
  }

  return groups as Record<ShortcutDefinition['category'], Array<{ id: string; def: ShortcutDefinition }>>;
}

// ============================================================
// COMPONENT
// ============================================================

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  const { t } = useTranslation();
  const grouped = getShortcutsByCategory();
  const categoryOrder: ShortcutDefinition['category'][] = [
    'navigation',
    'editing',
    'quick-action',
    'view',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raccourcis clavier"
      size="md"
    >
      <div className="space-y-6">
        {categoryOrder.map(category => {
          const shortcuts = grouped[category];
          if (shortcuts.length === 0) return null;

          return (
            <div key={category}>
              {/* Category header */}
              <h3 className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                {t.shortcuts.categories[SHORTCUT_CATEGORY_KEYS[category] as keyof typeof t.shortcuts.categories]}
              </h3>

              {/* Shortcut rows */}
              <div className="space-y-1">
                {shortcuts.map(({ id, def }) => (
                  <div
                    key={id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-alt"
                  >
                    <span className="text-sm text-on-surface-secondary">{t.shortcuts[def.label as keyof typeof t.shortcuts] as string}</span>
                    <kbd className="px-2 py-0.5 bg-surface-alt border border-outline-strong rounded text-xs font-mono text-on-surface-secondary min-w-[2rem] text-center">
                      {formatKeyCombo(def.keys, t.shortcuts)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer hint */}
        <p className="text-xs text-on-surface-faint text-center pt-2 border-t border-outline">
          Les raccourcis sont desactives dans les champs de saisie et les modales
        </p>
      </div>
    </Modal>
  );
}
