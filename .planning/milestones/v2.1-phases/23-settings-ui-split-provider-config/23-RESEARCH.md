# Phase 23: Settings UI Split & Provider Config - Research

**Researched:** 2026-02-16
**Domain:** Settings UI architecture, modal routing patterns, provider configuration forms, React state management
**Confidence:** HIGH

## Summary

Phase 23 splits the monolithic SettingsModal into two focused panels: **App Settings** (language, theme, updates) and **AI Settings** (provider config, custom endpoints). The core challenge is maintaining keyboard shortcut compatibility (Cmd+,) while providing clear navigation between settings contexts and implementing CRUD UI for custom AI providers from Phase 22's registry.

**Current state:** Single SettingsModal (774 lines) combines app settings, AI config, backups, maintenance, and changelog. Project-level AI selector exists in ProjectSettingsModal but is deprecated (useProjectAIConfig warns on use). No UI for managing custom providers from Phase 22 registry.

**Target state:** Two separate modals with distinct entry points. App Settings accessible via gear icon (general settings). AI Settings accessible via header button (top-right). Custom provider management UI (add, edit, delete) integrated into AI Settings. Project-level AI selector removed completely.

**Primary recommendation:** Extract App Settings modal (language, theme, updates) from existing SettingsModal. Refactor remaining content into AI Settings panel with tabbed navigation (Providers, Custom Providers, Advanced). Add provider CRUD forms with inline validation (Zod schema from registry). Route keyboard shortcut (Cmd+,) to App Settings for consistency. Update Header to include AI Settings button with provider status indicator.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | Component state & hooks | Already installed, project standard |
| framer-motion | (installed) | Modal animations & transitions | Already used for Modal component ([Modal.tsx:9](src/components/ui/Modal.tsx)) |
| zod | 4.3.4 | Form validation for custom providers | Already used in registry ([aiProvider.ts:57-75](src/types/aiProvider.ts)) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | All dependencies satisfied | State management via React hooks, validation via Zod |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useState routing | React Router modal routes | Router adds complexity for 2 modals ([React Router modal discussion](https://github.com/remix-run/react-router/discussions/9864)) |
| Two separate modals | Tabs within single modal | Separate modals give clearer UX separation, better deep-linking |
| Custom validation | Zod schemas (CHOSEN) | Zod already used in registry, consistent pattern |

**Installation:**
No new packages required. All dependencies already in package.json.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── settings/
│   │   ├── AppSettingsModal.tsx          # NEW: Language, theme, updates
│   │   ├── AISettingsModal.tsx           # NEW: Provider config, custom providers
│   │   ├── ProviderConfigForm.tsx        # NEW: Built-in provider config UI
│   │   ├── CustomProviderForm.tsx        # NEW: Add/edit custom provider form
│   │   ├── CustomProviderList.tsx        # NEW: List custom providers with edit/delete
│   │   ├── SettingsModal.tsx             # REMOVE: Deprecated monolithic modal
│   │   ├── ProjectSettingsModal.tsx      # UPDATE: Remove AI provider selector
│   │   └── MaintenanceModal.tsx          # KEEP: Unchanged
│   └── layout/
│       └── Header.tsx                    # UPDATE: Add AI settings button
├── hooks/
│   ├── useProjectAIConfig.ts             # REMOVE: Fully deprecated, no longer needed
│   └── useAppSettings.ts                 # NEW: App-level settings hook
└── types/
    └── projectAIConfig.ts                # REMOVE: Project-level AI config types (deprecated)
```

### Pattern 1: Settings Modal Split (Separation of Concerns)

**What:** Split monolithic settings into domain-focused modals (app vs. AI).

**When to use:** When a single modal handles multiple unrelated domains and grows beyond 500 lines.

**Example:**
```typescript
// src/components/settings/AppSettingsModal.tsx
interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updater: ReturnType<typeof useUpdater>; // Only app-level concerns
}

export function AppSettingsModal({ isOpen, onClose, updater }: AppSettingsModalProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.settings.appSettings} size="md">
      <div className="space-y-5">
        {/* Language selector */}
        {/* Theme toggle */}
        {/* Update checker (Tauri only) */}
        {/* Changelog link */}
      </div>
    </Modal>
  );
}

// src/components/settings/AISettingsModal.tsx
interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'custom' | 'advanced'>('providers');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.settings.aiSettings} size="lg">
      {/* Tab navigation */}
      <div className="border-b border-outline mb-4">
        <nav className="flex gap-4">
          <button onClick={() => setActiveTab('providers')}>Providers</button>
          <button onClick={() => setActiveTab('custom')}>Custom</button>
          <button onClick={() => setActiveTab('advanced')}>Advanced</button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'providers' && <ProviderConfigForm />}
      {activeTab === 'custom' && <CustomProviderList />}
      {activeTab === 'advanced' && <AIAdvancedSettings />}
    </Modal>
  );
}
```

**Rationale:** [Separation of Concerns](https://mui.com/material-ui/react-tabs/) improves maintainability. [Material UI Tabs](https://mui.com/material-ui/react-tabs/) and [Headless UI Tabs](https://headlessui.com/react/tabs) demonstrate standard tabbed navigation for settings panels.

### Pattern 2: Keyboard Shortcut Router (State-Based Delegation)

**What:** Single keyboard shortcut opens different modals based on context.

**When to use:** When multiple settings modals exist but users expect one shortcut.

**Example:**
```typescript
// src/hooks/useGlobalShortcuts.ts (UPDATE)
import { useState } from 'react';

export function useSettingsShortcut() {
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  const handleSettingsShortcut = useCallback(() => {
    // Default: open App Settings on Cmd+,
    setShowAppSettings(true);
  }, []);

  return {
    showAppSettings,
    setShowAppSettings,
    showAISettings,
    setShowAISettings,
    handleSettingsShortcut,
  };
}

// src/App.tsx (UPDATE)
const settings = useSettingsShortcut();

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      settings.handleSettingsShortcut();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [settings]);

return (
  <>
    <AppSettingsModal
      isOpen={settings.showAppSettings}
      onClose={() => settings.setShowAppSettings(false)}
    />
    <AISettingsModal
      isOpen={settings.showAISettings}
      onClose={() => settings.setShowAISettings(false)}
    />
  </>
);
```

**Rationale:** Avoids React Router complexity for simple modal routing ([React Router modal patterns](https://www.codedaily.io/tutorials/Create-a-Modal-Route-with-React-Router)). State-based approach is simpler for 2 modals.

### Pattern 3: Custom Provider CRUD Form

**What:** Inline form validation with Zod schema, immediate feedback on errors.

**When to use:** When user configures complex structured data (provider config with multiple fields).

**Example:**
```typescript
// src/components/settings/CustomProviderForm.tsx
import { useState } from 'react';
import { validateCustomProvider, addCustomProvider } from '../../lib/ai-provider-registry';
import type { CustomProviderInput } from '../../types/aiProvider';

interface CustomProviderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CustomProviderForm({ onSuccess, onCancel }: CustomProviderFormProps) {
  const [formData, setFormData] = useState<Partial<CustomProviderInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);

    // Validate input
    const validation = validateCustomProvider(formData);
    if (!validation.success) {
      setErrors({ _form: validation.error });
      setIsSaving(false);
      return;
    }

    // Add provider to registry
    const result = addCustomProvider(validation.data);
    if (!result.success) {
      setErrors({ _form: result.error });
      setIsSaving(false);
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div className="space-y-4">
        {/* Name input */}
        <div>
          <label className="block text-sm font-medium mb-2">Provider Name</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ollama Local"
            className="w-full px-4 py-2 border rounded-lg"
          />
          {errors.name && <p className="text-xs text-danger-text mt-1">{errors.name}</p>}
        </div>

        {/* Base URL input with inline validation hint */}
        <div>
          <label className="block text-sm font-medium mb-2">Endpoint URL</label>
          <input
            type="url"
            value={formData.baseURL || ''}
            onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
            placeholder="http://localhost:11434/v1"
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-xs text-on-surface-muted mt-1">
            Must be HTTPS or localhost (http://localhost or http://127.0.0.1)
          </p>
          {errors.baseURL && <p className="text-xs text-danger-text mt-1">{errors.baseURL}</p>}
        </div>

        {/* Default model input */}
        <div>
          <label className="block text-sm font-medium mb-2">Default Model</label>
          <input
            type="text"
            value={formData.defaultModel || ''}
            onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
            placeholder="llama3.2"
            className="w-full px-4 py-2 border rounded-lg"
          />
          {errors.defaultModel && <p className="text-xs text-danger-text mt-1">{errors.defaultModel}</p>}
        </div>

        {/* API Key (optional for localhost) */}
        <div>
          <label className="block text-sm font-medium mb-2">API Key (optional)</label>
          <input
            type="password"
            value={formData.apiKey || ''}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="Leave empty for localhost providers"
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        {/* Form-level error */}
        {errors._form && (
          <p className="text-sm text-danger-text bg-danger-soft px-3 py-2 rounded">{errors._form}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-on-surface-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="px-4 py-2 bg-accent text-white rounded-lg">
          {isSaving ? 'Saving...' : 'Add Provider'}
        </button>
      </div>
    </form>
  );
}
```

**Rationale:** [Inline validation best practices](https://www.designstudiouiux.com/blog/form-ux-design-best-practices/) recommend immediate feedback on field blur. [Error message clarity](https://medium.com/@olamishina/building-ux-for-error-validation-strategy-36142991017a) improves UX by showing specific errors, not generic "Invalid data".

### Pattern 4: Provider Status Indicator

**What:** Visual badge showing provider configuration state (configured/not configured).

**When to use:** When user needs quick overview of which providers are ready to use.

**Example:**
```typescript
// src/components/settings/ProviderStatusBadge.tsx
import { hasApiKey } from '../../lib/ai';
import { CheckIcon, AlertIcon } from '../ui/Icons';

interface ProviderStatusBadgeProps {
  providerId: string;
}

export function ProviderStatusBadge({ providerId }: ProviderStatusBadgeProps) {
  const isConfigured = hasApiKey(providerId);

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
        isConfigured
          ? 'bg-success-soft text-success-text'
          : 'bg-surface-alt text-on-surface-muted'
      }`}
    >
      {isConfigured ? (
        <>
          <CheckIcon className="w-3 h-3" />
          Configured
        </>
      ) : (
        <>
          <AlertIcon className="w-3 h-3" />
          Not configured
        </>
      )}
    </div>
  );
}
```

**Rationale:** Current SettingsModal already shows "OK" vs "..." badges ([SettingsModal.tsx:343-350](src/components/settings/SettingsModal.tsx)). Consistent pattern across UI.

### Anti-Patterns to Avoid

- **Single monolithic settings modal:** Current 774-line SettingsModal mixes unrelated concerns (language, AI, backups, updates). Split improves maintainability.
- **React Router for 2 modals:** Adds routing dependency for simple state toggle. Use useState instead ([React Router modal discussion](https://github.com/remix-run/react-router/discussions/9864)).
- **Validation after submit only:** Frustrating UX. Use inline validation with Zod ([Form validation best practices](https://www.designstudiouiux.com/blog/form-ux-design-best-practices/)).
- **Generic error messages:** "Invalid data" doesn't help. Show specific errors: "Must use HTTPS or localhost" ([Error UX strategy](https://medium.com/@olamishina/building-ux-for-error-validation-strategy-36142991017a)).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab navigation | Custom tab state manager | useState + conditional render | Simple 3-tab case, no routing needed ([Headless UI Tabs](https://headlessui.com/react/tabs)) |
| URL validation | Regex patterns | Zod .url() + .refine() | Already in registry schema ([aiProvider.ts:62-68](src/types/aiProvider.ts)) |
| Provider config storage | Custom localStorage wrapper | Existing registry functions | loadCustomProviders/saveCustomProviders already implemented |
| Form validation | Manual checks | Zod schemas from registry | CustomProviderInputSchema already exists ([aiProvider.ts:58-75](src/types/aiProvider.ts)) |

**Key insight:** Phase 22 registry provides all validation logic. UI layer only needs to call registry functions and display results.

## Common Pitfalls

### Pitfall 1: Breaking Existing Keyboard Shortcuts

**What goes wrong:** Users expect Cmd+, to open settings, but after split, it opens wrong modal or nothing.

**Why it happens:** Refactoring removes old SettingsModal handler without wiring new modals.

**How to avoid:**
- Keep Cmd+, shortcut working (route to App Settings as default)
- Add clear navigation from App Settings → AI Settings link
- Update shortcuts help modal to show new structure
- Test shortcut after refactor

**Warning signs:** Cmd+, does nothing, or console errors about missing modal state.

### Pitfall 2: Losing Settings Data on Modal Switch

**What goes wrong:** User edits custom provider, switches tab, loses unsaved changes.

**Why it happens:** Form state stored in tab component, destroyed on unmount.

**How to avoid:**
- Lift form state to parent AISettingsModal
- Show "Unsaved changes" warning on tab switch
- Auto-save to localStorage draft on input change
- Add "Discard changes?" confirmation

**Warning signs:** Users report lost data after tab navigation.

### Pitfall 3: Provider ID Collisions

**What goes wrong:** User adds "Ollama" custom provider, collides with future built-in "ollama" provider.

**Why it happens:** ID generation from name without collision check.

**How to avoid:**
- Registry validateCustomProvider already checks duplicates ([ai-provider-registry.ts:186-189](src/lib/ai-provider-registry.ts))
- UI shows error message: "Provider 'Ollama' already exists"
- Suggest alternative names: "Ollama Local", "Ollama 2", etc.

**Warning signs:** Add provider fails silently or overwrites existing provider.

### Pitfall 4: Custom Provider API Keys Not Persisted

**What goes wrong:** User adds custom provider with API key, key not saved, requests fail.

**Why it happens:** Existing setApiKey only works for built-in providers (groq, gemini, openai).

**How to avoid:**
- Extend setApiKey to support custom provider IDs: `setApiKey(key, providerId)`
- Storage key pattern: `${providerId}-api-key` (e.g. `custom-ollama-local-api-key`)
- Show API key input in custom provider form
- Test key retrieval with getApiKey(providerId)

**Warning signs:** API calls fail with "No API key configured" for custom providers.

### Pitfall 5: Removing Project-Level Selector Breaks Existing Saves

**What goes wrong:** Users have project-level AI config saved (projectPath/.ticketflow/ai-config.json), removal causes errors.

**Why it happens:** Old code tries to load project config, file not found or format changed.

**How to avoid:**
- useProjectAIConfig already warns and returns global config ([useProjectAIConfig.ts:44-65](src/hooks/useProjectAIConfig.ts))
- Remove file operations: loadProjectAIConfig, saveProjectAIConfig (already deprecated stubs in Phase 22)
- ProjectSettingsModal removes AI provider selector UI completely
- Migration: No action needed (hook already falls back to global)

**Warning signs:** Console warnings about deprecated project AI config, but no crashes (graceful degradation).

## Code Examples

### Example 1: Header AI Settings Button

```typescript
// src/components/layout/Header.tsx (UPDATE)
interface HeaderProps {
  // ... existing props
  onOpenAISettings: () => void; // NEW
  showAISettingsBadge?: boolean; // NEW: Show badge if no provider configured
}

export function Header({ onOpenAISettings, showAISettingsBadge, ...props }: HeaderProps) {
  return (
    <header className="bg-surface border-b border-outline px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        {/* ... existing left/center content */}

        {/* Right: Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* NEW: AI Settings button */}
          <button
            onClick={onOpenAISettings}
            className="relative px-3 py-2 text-sm font-medium text-on-surface-secondary bg-surface-alt border border-outline rounded-lg hover:bg-outline transition-colors"
            aria-label="AI Settings"
          >
            <span className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4" />
              <span className="hidden lg:inline">AI Settings</span>
            </span>
            {showAISettingsBadge && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>

          {/* Existing project settings button */}
          {hasProject && (
            <button onClick={onOpenProjectSettings}>
              {/* ... existing code */}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
```

### Example 2: Custom Provider List with Edit/Delete

```typescript
// src/components/settings/CustomProviderList.tsx
import { useState } from 'react';
import { loadCustomProviders, removeCustomProvider } from '../../lib/ai-provider-registry';
import { EditIcon, TrashIcon, PlusIcon } from '../ui/Icons';

export function CustomProviderList() {
  const [providers, setProviders] = useState(loadCustomProviders());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDelete = (id: string) => {
    if (confirm('Delete this custom provider?')) {
      removeCustomProvider(id);
      setProviders(loadCustomProviders()); // Reload
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Custom Providers</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover"
        >
          <PlusIcon className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {providers.length === 0 ? (
        <p className="text-sm text-on-surface-muted italic">
          No custom providers. Add Ollama, LM Studio, or other OpenAI-compatible endpoints.
        </p>
      ) : (
        <div className="space-y-2">
          {providers.map(provider => (
            <div key={provider.id} className="flex items-center justify-between p-3 bg-surface-alt rounded-lg">
              <div>
                <p className="text-sm font-medium">{provider.name}</p>
                <p className="text-xs text-on-surface-muted">{provider.baseURL}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(provider.id)}
                  className="p-2 text-on-surface-secondary hover:bg-outline rounded"
                  title="Edit"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(provider.id)}
                  className="p-2 text-danger-text hover:bg-danger-soft rounded"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <CustomProviderForm
          onSuccess={() => {
            setShowAddForm(false);
            setProviders(loadCustomProviders()); // Reload
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
```

### Example 3: i18n Keys for New UI Strings

```typescript
// src/i18n/locales/fr.ts (UPDATE)
export const fr: Translations = {
  // ... existing translations
  settings: {
    // ... existing settings keys
    appSettings: 'Paramètres Généraux',
    aiSettings: 'Paramètres IA',
    customProviders: 'Fournisseurs Personnalisés',
    addProvider: 'Ajouter un Fournisseur',
    editProvider: 'Modifier le Fournisseur',
    deleteProvider: 'Supprimer le Fournisseur',
    providerName: 'Nom du Fournisseur',
    endpointURL: 'URL de l\'Endpoint',
    endpointHint: 'Doit être HTTPS ou localhost (http://localhost ou http://127.0.0.1)',
    defaultModel: 'Modèle par Défaut',
    apiKeyOptional: 'Clé API (optionnelle)',
    apiKeyHint: 'Laisser vide pour les fournisseurs localhost',
    providerConfigured: 'Configuré',
    providerNotConfigured: 'Non configuré',
    noCustomProviders: 'Aucun fournisseur personnalisé. Ajoutez Ollama, LM Studio, ou d\'autres endpoints compatibles OpenAI.',
    unsavedChanges: 'Modifications non sauvegardées',
    discardChanges: 'Abandonner les modifications ?',
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single settings modal | Domain-split modals | Phase 23 (v2.1) | Better UX, clearer separation |
| Project-level AI config | Global AI config only | Phase 22 (v2.1) | Simplified architecture |
| Hardcoded providers | Registry + custom providers | Phase 22 (v2.1) | User extensibility |
| Manual form validation | Zod schema validation | Phase 22 (v2.1) | Type-safe, consistent validation |

**Deprecated/outdated:**
- `src/components/settings/SettingsModal.tsx` — Monolithic modal replaced by AppSettingsModal + AISettingsModal
- `src/hooks/useProjectAIConfig.ts` — Returns global config with deprecation warnings (Phase 22), full removal in Phase 23
- `src/types/projectAIConfig.ts` — Project-level types no longer needed (global only)
- Project AI selector in ProjectSettingsModal — Removed per Phase 23 requirements

## Open Questions

### Question 1: Default Tab on AI Settings Open

**What we know:**
- AI Settings will have 3 tabs: Providers, Custom Providers, Advanced
- Users may open from header button (general access) or from error state (missing config)

**What's unclear:**
- Should default tab be "Providers" (most common) or context-aware (if no provider configured, show Providers; if adding custom, show Custom)?

**Recommendation:** Default to "Providers" tab. Simple, predictable. Context-aware routing can be added in Phase 24 if user feedback demands it.

### Question 2: Custom Provider Editing UX

**What we know:**
- Custom providers can be edited (change baseURL, model, API key)
- Editing requires form validation (same as add)

**What's unclear:**
- Should edit be inline (in list row) or modal popup?
- Inline saves space but limits field size
- Modal gives more room but adds click overhead

**Recommendation:** Modal popup for edit (consistent with add flow). Inline edit adds complexity for marginal UX gain.

### Question 3: Migration Strategy for Existing Users

**What we know:**
- Current users have Cmd+, mapped to SettingsModal
- After split, two modals exist
- useProjectAIConfig already warns but returns global config (no data loss)

**What's unclear:**
- Should Phase 23 show one-time migration notice? ("Settings split into App and AI")
- Or silent migration (users discover new structure organically)?

**Recommendation:** Silent migration. App Settings keeps language/theme (familiar). AI Settings is new entry point (header button). No breaking changes to data or core workflows.

### Question 4: Provider Status Indicator Placement

**What we know:**
- Header will have AI Settings button
- Indicator could show: configured (green), not configured (amber), error (red)

**What's unclear:**
- Should indicator be on AI Settings button (header) or only in modal?
- Header badge increases visibility but adds visual noise

**Recommendation:** Badge on header button (amber dot if no provider configured). Increases discoverability for new users. Hide badge once any provider is configured.

## Sources

### Primary (HIGH confidence)
- Current codebase:
  - `src/components/settings/SettingsModal.tsx` - Existing monolithic modal (774 lines)
  - `src/lib/ai-provider-registry.ts` - Registry with CRUD functions (Phase 22)
  - `src/types/aiProvider.ts` - Zod schemas for validation (Phase 22)
  - `src/hooks/useProjectAIConfig.ts` - Deprecated hook with global fallback (Phase 22)
  - `src/components/ui/Modal.tsx` - Modal component with animation support
- [Phase 22 Research](D:\PROJET CODING\ticketflow\.planning\phases\22-provider-registry-core-refactor\22-RESEARCH.md) - Registry patterns, validation schemas

### Secondary (MEDIUM confidence)
- [Material UI Tabs](https://mui.com/material-ui/react-tabs/) - Tab navigation best practices
- [Headless UI Tabs](https://headlessui.com/react/tabs) - Accessible tab component patterns
- [Form UX Best Practices 2026](https://www.designstudiouiux.com/blog/form-ux-design-best-practices/) - Inline validation, error messaging
- [Error Validation UX Strategy](https://medium.com/@olamishina/building-ux-for-error-validation-strategy-36142991017a) - Specific error messages
- [React Router Modal Patterns](https://www.codedaily.io/tutorials/Create-a-Modal-Route-with-React-Router) - Modal routing (not used, but researched for comparison)

### Tertiary (LOW confidence)
- None — all recommendations based on HIGH/MEDIUM sources and existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - No new dependencies, all patterns exist in codebase
- Architecture: **HIGH** - Modal split is straightforward extraction, registry already implemented
- Pitfalls: **HIGH** - Known issues from Phase 22 (API key storage, validation), common React patterns
- UI patterns: **MEDIUM** - Tab navigation and form validation are standard, but UX decisions (edit modal vs inline) require user testing

**Research date:** 2026-02-16
**Valid until:** 60 days (UI patterns stable, registry API locked from Phase 22)
**Dependencies:** Phase 22 must be complete (registry + validation schemas)
