/**
 * TemplateSelector - Grid picker for ticket templates.
 *
 * Shown when creating a new item. Displays built-in and custom templates
 * as clickable cards, with a "Creer vide" option to skip template selection.
 *
 * @module components/templates/TemplateSelector
 */

import type { TicketTemplate } from '../../db/queries/templates';
import { PlusIcon } from '../ui/Icons';
import { useTranslation, type Translations } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface TemplateSelectorProps {
  templates: TicketTemplate[];
  onSelect: (template: TicketTemplate) => void;
  onSkip: () => void;
}

// ============================================================
// ICON MAPPING
// ============================================================

/** Map icon identifiers to display characters */
const ICON_MAP: Record<string, string> = {
  bug: '\uD83D\uDC1B',       // bug emoji
  sparkles: '\u2728',         // sparkles emoji
  settings: '\uD83D\uDD27',  // wrench emoji
};

function getTemplateIcon(icon: string): string {
  return ICON_MAP[icon] ?? icon;
}

// ============================================================
// LOCALE-AWARE DESCRIPTION RESOLVER
// ============================================================

/** Map builtin template icons to i18n description keys */
const BUILTIN_DESC_MAP: Record<string, keyof Translations['templates']> = {
  bug: 'bugReportDesc',
  sparkles: 'featureRequestDesc',
  settings: 'technicalDebtDesc',
};

function getTemplateDescription(template: TicketTemplate, t: Translations): string {
  if (template.isBuiltin) {
    const key = BUILTIN_DESC_MAP[template.icon];
    if (key) return t.templates[key];
  }
  return template.description;
}

// ============================================================
// COMPONENT
// ============================================================

export function TemplateSelector({
  templates,
  onSelect,
  onSkip,
}: TemplateSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-on-surface">
          {t.templates.createFromTemplate}
        </h3>
        <p className="text-sm text-on-surface-muted mt-1">
          {t.templates.chooseOrCreate}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Skip option - create empty */}
        <button
          onClick={onSkip}
          className="p-4 border-2 border-dashed border-outline-strong rounded-xl hover:border-blue-400 hover:bg-accent-soft/30 transition-all text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-alt group-hover:bg-accent-soft flex items-center justify-center transition-colors">
              <PlusIcon className="w-5 h-5 text-on-surface-faint group-hover:text-accent-text" />
            </div>
            <div>
              <p className="font-medium text-on-surface-secondary group-hover:text-accent-text">
                {t.templates.createEmpty}
              </p>
              <p className="text-xs text-on-surface-faint">
                {t.templates.emptyFormDesc}
              </p>
            </div>
          </div>
        </button>

        {/* Template cards */}
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="p-4 border border-outline rounded-xl hover:border-blue-400 hover:bg-accent-soft/50 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-alt group-hover:bg-accent-soft flex items-center justify-center text-xl transition-colors">
                {getTemplateIcon(template.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-on-surface group-hover:text-accent-text truncate">
                  {template.name}
                </p>
                <p className="text-xs text-on-surface-faint truncate">
                  {getTemplateDescription(template, t)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-alt text-on-surface-muted">
                {template.type}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
