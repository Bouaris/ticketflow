# Phase 25: Model Resolution & Selection - Research

**Researched:** 2026-02-17
**Domain:** AI provider configuration & model selection
**Confidence:** HIGH

## Summary

Phase 25 is a gap closure phase targeting 2 specific bugs identified in the v2.1 milestone re-audit:

1. **GENX-03 (P0):** Provider override sends wrong modelId — affects 8 functions in ai.ts/ai-dependencies.ts
2. **PROV-01 (P1):** No model selector in AI Settings — ProviderCard lacks model dropdown despite registry having models[] arrays

Both gaps have well-documented root causes and clear fix patterns. The provider registry infrastructure (Phase 22) and settings UI (Phase 23) are solid; these gaps are simply missing integrations between existing components.

**Primary recommendation:** Focus on surgical fixes to the existing architecture. No new libraries needed. All required infrastructure exists (registry models[], storage keys, provider resolution). This is a wiring phase, not an architectural phase.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zod | 3.24+ | Schema validation for AI types | Already used in ai-provider-registry.ts |
| localStorage | Native | Per-provider model persistence | Pattern established in STORAGE_KEYS |
| React hooks | 19 | State management in ProviderCard | Standard pattern in codebase |

### Supporting
N/A — All required infrastructure exists.

### Alternatives Considered
N/A — This is a gap closure phase using existing stack.

**Installation:**
None required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ai.ts                       # FIX: getEffectiveAIConfig model resolution
│   ├── ai-dependencies.ts          # FIX: detectDependencies model resolution
│   └── ai-provider-registry.ts     # EXTEND: Add model persistence helpers
├── components/
│   └── settings/
│       └── ProviderCard.tsx        # ADD: Model dropdown UI
└── constants/
    └── storage.ts                  # ADD: Per-provider model storage keys
```

### Pattern 1: Model Resolution for Provider Override

**What:** When a provider is overridden in generation functions, the model must be resolved from that provider's registry entry, not the global config.

**Current (broken) pattern:**
```typescript
// ai.ts ~line 1183 (generateItemFromDescription)
const { provider, modelId } = getEffectiveAIConfig(options?.projectPath);
const effectiveProvider = options?.provider || provider;
// BUG: modelId stays as global provider's model
```

**Fixed pattern:**
```typescript
// Step 1: Resolve effective provider first
const effectiveProvider = options?.provider || getProvider();

// Step 2: Resolve model from that provider's config
const providerConfig = getProviderById(effectiveProvider);
const effectiveModel = options?.modelId || providerConfig?.defaultModel || fallbackForProvider(effectiveProvider);

// Step 3: Use resolved values
const result = await generateCompletion(prompt, {
  provider: effectiveProvider,
  modelId: effectiveModel,
  signal: options?.signal,
});
```

**When to use:** In ALL 8 affected functions that call getEffectiveAIConfig and then override the provider.

**Affected locations:**
| Function | File | Lines |
|----------|------|-------|
| generateItemFromDescription | ai.ts | 1183-1184, usage ~1229 |
| refineItem | ai.ts | 811-812, usage ~880 |
| suggestImprovements | ai.ts | 1347-1348, usage ~1363 |
| analyzeBacklogFormat | ai.ts | 1646-1647, usage ~1657 |
| correctBacklogFormat | ai.ts | 1698-1699, usage ~1716 |
| analyzeBacklog | ai.ts | 2015-2016, usage ~2058 |
| analyzeBacklog telemetry | ai.ts | 2143-2144 |
| detectDependencies | ai-dependencies.ts | 194-195, usage ~204; 244-245 |

### Pattern 2: Per-Provider Model Selection Storage

**What:** Store the user's selected model per provider in localStorage, read it in getEffectiveAIConfig.

**Storage keys pattern:**
```typescript
// constants/storage.ts
export const STORAGE_KEYS = {
  // ... existing keys
  AI_MODEL_PREFIX: 'ai-model', // NEW
} as const;

export function getModelKey(providerId: string): string {
  return `${STORAGE_KEYS.AI_MODEL_PREFIX}-${providerId}`;
}
```

**Persistence helpers:**
```typescript
// ai-provider-registry.ts or ai.ts
export function getSelectedModel(providerId: string): string | null {
  return localStorage.getItem(getModelKey(providerId));
}

export function setSelectedModel(providerId: string, modelId: string): void {
  localStorage.setItem(getModelKey(providerId), modelId);
}
```

**Updated getEffectiveAIConfig:**
```typescript
export function getEffectiveAIConfig(_projectPath?: string): {
  provider: AIProvider;
  modelId: string;
} {
  const globalProvider = getProvider();
  const providerConfig = getProviderById(globalProvider);

  // NEW: Read persisted model choice, fallback to defaultModel
  const selectedModel = getSelectedModel(globalProvider);
  const defaultModel = providerConfig?.defaultModel
    ?? fallbackModelForProvider(globalProvider);

  return {
    provider: globalProvider,
    modelId: selectedModel || defaultModel,
  };
}
```

### Pattern 3: Model Dropdown in ProviderCard

**What:** Add a `<select>` dropdown for model selection below the API key input.

**UI structure:**
```tsx
// ProviderCard.tsx ~line 190 (after API key input, before action buttons)
<div>
  <label className="block text-sm font-medium text-on-surface-secondary mb-2">
    {t.settings.model}
  </label>
  <select
    value={selectedModel}
    onChange={(e) => setSelectedModel(e.target.value)}
    className="w-full px-3 py-2 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent focus:border-accent outline-none"
  >
    {provider.models.map(model => (
      <option key={model.id} value={model.id}>
        {model.name}
      </option>
    ))}
  </select>
</div>
```

**State management:**
```typescript
// ProviderCard.tsx component state
const [selectedModel, setSelectedModelState] = useState<string>('');

// Load persisted model on mount/provider change
useEffect(() => {
  if (isActive) {
    const persisted = getSelectedModel(provider.id);
    setSelectedModelState(persisted || provider.defaultModel);
  }
}, [isActive, provider.id, provider.defaultModel]);

// Save on change
const handleModelChange = (modelId: string) => {
  setSelectedModelState(modelId);
  setSelectedModel(provider.id, modelId); // persist to localStorage
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};
```

**When to use:** In ProviderCard for built-in providers only (custom providers already have editable models in CustomProviderForm).

### Anti-Patterns to Avoid

- **Don't cache modelId in getEffectiveAIConfig result:** Always resolve fresh from localStorage to respect user changes
- **Don't add modelId to CompletionOptions type:** It already exists (line 282 in ai.ts)
- **Don't modify ProviderToggle:** It's for provider selection only, not model selection
- **Don't change generateCompletion signature:** It already accepts modelId in CompletionOptions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model persistence | Custom IndexedDB or file storage | localStorage with STORAGE_KEYS pattern | Existing pattern, simple key-value, no async overhead |
| Provider lookup | Linear search through providers | getProviderById() (already exists) | Centralized, handles built-in + custom |
| Model dropdown | Custom select with search | Native `<select>` | 3-4 models per provider, no search needed |
| Model validation | Runtime string checks | Zod schema in registry | Already validated at registration time |

**Key insight:** All infrastructure exists. This is a wiring phase — connecting existing pieces, not building new ones.

## Common Pitfalls

### Pitfall 1: Forgetting to Reset Client Cache After Model Change
**What goes wrong:** User changes model in settings, but old client singleton still uses cached model from previous request.

**Why it happens:** Client singletons (groqClient, geminiClient, openaiClientCache) track API keys but not models. Model changes don't invalidate the cache.

**How to avoid:** Models are request-level parameters, not client-level. No cache invalidation needed — model is passed in each `generateCompletion` call.

**Warning signs:** None expected. Model is passed per-request, not cached in client.

### Pitfall 2: Circular Import Between ai.ts and ai-provider-registry.ts
**What goes wrong:** If we add `getSelectedModel` to ai-provider-registry.ts and it needs STORAGE_KEYS from storage.ts, but ai.ts already imports from registry, we could hit circular imports.

**Why it happens:** ai.ts imports getProviderById from registry; registry would import from storage.ts (safe); ai.ts already imports from storage.ts (safe).

**How to avoid:** Put model persistence helpers in ai.ts (next to getEffectiveAIConfig) or in storage.ts (next to getModelKey). Don't add to registry unless necessary.

**Warning signs:** TypeScript error "Cannot access 'X' before initialization". If this happens, move helpers to storage.ts.

### Pitfall 3: Not Handling Missing Provider in getProviderById
**What goes wrong:** User has a custom provider selected, then deletes it, but their localStorage still references it. getProviderById returns null, causing crash.

**Why it happens:** Custom provider deletion doesn't clear related localStorage keys (selected model, provider ID).

**How to avoid:**
```typescript
const providerConfig = getProviderById(effectiveProvider);
if (!providerConfig) {
  // Fallback to first built-in provider
  console.warn(`[AI] Provider ${effectiveProvider} not found, falling back to Groq`);
  effectiveProvider = 'groq';
  providerConfig = getBuiltInProvider('groq');
}
```

**Warning signs:** Console error "Cannot read property 'defaultModel' of null".

### Pitfall 4: Not Updating i18n Keys
**What goes wrong:** Model dropdown shows "undefined" as label.

**Why it happens:** New UI element needs localization keys for label and placeholder.

**How to avoid:** Add to `src/i18n/locales/fr.ts` and `en.ts`:
```typescript
settings: {
  // ... existing keys
  model: 'Modèle', // FR
  model: 'Model',  // EN
}
```

**Warning signs:** Hardcoded English strings in component, or `t.settings.model` returning undefined.

## Code Examples

Verified patterns from the codebase:

### Example 1: Current getEffectiveAIConfig (to be fixed)
```typescript
// Source: src/lib/ai.ts line 247-262
export function getEffectiveAIConfig(_projectPath?: string): {
  provider: AIProvider;
  modelId: string;
} {
  const globalProvider = getProvider();
  const providerConfig = getProviderById(globalProvider);
  const defaultModel = providerConfig?.defaultModel
    ?? (globalProvider === 'groq' ? AI_CONFIG.GROQ_MODEL
      : globalProvider === 'gemini' ? AI_CONFIG.GEMINI_MODEL
      : AI_CONFIG.OPENAI_MODEL);

  return {
    provider: globalProvider,
    modelId: defaultModel,
  };
}
```

### Example 2: Provider Resolution Pattern (from ai.ts line 310-327)
```typescript
// Source: src/lib/ai.ts generateCompletion function
async function generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
  const providerId = options?.provider || getProvider();
  const config = getClientConfig(providerId);
  if (!config) {
    const t = getTranslations();
    throw new Error(`${getProviderDisplayName(providerId)} ${t.aiErrors.apiKeyNotConfigured}`);
  }

  // Resolve provider type from registry
  const providerDef: ProviderConfig | null = getProviderById(providerId);
  const providerType = providerDef?.type ?? providerId; // fallback to ID as type for built-ins

  const modelId = options?.modelId || (
    providerDef?.defaultModel
    ?? (providerId === 'groq' ? AI_CONFIG.GROQ_MODEL
      : providerId === 'gemini' ? AI_CONFIG.GEMINI_MODEL
      : AI_CONFIG.OPENAI_MODEL)
  );

  // ... rest of function uses providerType and modelId
}
```

**Key insight:** generateCompletion ALREADY has the correct model resolution logic (line 322-327). The bug is that caller functions don't pass the right modelId in options.

### Example 3: ProviderCard State Management
```typescript
// Source: src/components/settings/ProviderCard.tsx line 25-41
const [apiKeyInput, setApiKeyInput] = useState('');
const [showKey, setShowKey] = useState(false);
const [saved, setSaved] = useState(false);

const isConfigured = hasApiKey(provider.id);

// Load current API key when card becomes active
useState(() => {
  if (isActive) {
    const currentKey = getApiKey(provider.id);
    setApiKeyInput(currentKey || '');
  }
});

// ... save handler
const handleSave = () => {
  if (apiKeyInput.trim()) {
    setApiKey(apiKeyInput.trim(), provider.id);
    resetClient(provider.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
};
```

**Pattern to replicate:** Use same state structure for selectedModel, load on isActive, save with visual feedback.

### Example 4: Provider Override in Generation (ItemEditorModal.tsx line 470-479)
```typescript
// Source: src/components/editor/ItemEditorModal.tsx executeGeneration
const result = await generateItemFromDescription(promptText, {
  provider: selectedProvider, // ← Provider override passed here
  projectPath,
  availableTypes: types,
  items,
  projectId: projectId ?? undefined,
  typeConfigs: types,
  images: imageData.length > 0 ? imageData : undefined,
  signal: controller.signal,
});
```

**Key insight:** The override is passed correctly from UI. The bug is in how generateItemFromDescription resolves the model for that overridden provider.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded models in AI_CONFIG | Provider registry with models[] arrays | Phase 22 (v2.1) | Registry-driven model lists |
| Global AI config only | Per-provider config with registry | Phase 22 (v2.1) | Custom providers supported |
| Project-level AI settings | App-level AI settings | Phase 23 (v2.1) | Single config surface |
| No provider override | ProviderToggle in ticket creation | Phase 24 (v2.1) | Per-ticket provider choice |

**Deprecated/outdated:**
- `useProjectAIConfig` hook: Removed in Phase 23 (project-level config deprecated)
- `PROJECT_AI_CONFIG_PREFIX` storage key: Unused after Phase 23
- Hardcoded model constants in AI_CONFIG: Still exist for fallback, but registry is source of truth

## Open Questions

1. **Should model selection affect ProviderToggle UI?**
   - What we know: ProviderToggle is in generation UI, ProviderCard is in settings
   - What's unclear: Should toggle show selected model (e.g., "Groq (Llama 3.3)")?
   - Recommendation: Keep toggle simple (provider name only). Model is an advanced setting.

2. **What happens to model selection for custom providers?**
   - What we know: CustomProviderForm already has model input (text field for single defaultModel)
   - What's unclear: Should custom providers have multi-model support like built-ins?
   - Recommendation: Defer multi-model for custom providers. They already have editable defaultModel.

3. **Should modelId be added to CompletionOptions explicitly?**
   - What we know: CompletionOptions type already has modelId field (line 282 in ai.ts)
   - What's unclear: None — it's already there
   - Recommendation: No change needed to type signature

## Sources

### Primary (HIGH confidence)
- `src/lib/ai.ts` — Verified getEffectiveAIConfig implementation (line 247-262)
- `src/lib/ai-provider-registry.ts` — Verified BUILT_IN_PROVIDERS with models[] (line 29-72)
- `src/components/settings/ProviderCard.tsx` — Verified missing model dropdown
- `src/constants/storage.ts` — Verified STORAGE_KEYS pattern
- `.planning/v2.1-MILESTONE-AUDIT.md` — Gap definitions and root causes (lines 56-106)
- `src/lib/ai-dependencies.ts` — Verified affected detectDependencies function (line 194-195)
- `src/components/editor/ItemEditorModal.tsx` — Verified provider override call site (line 470-479)

### Secondary (MEDIUM confidence)
- Phase 22 context (provider registry design decisions)
- Phase 23 context (settings UI split)
- Phase 24 context (generation UX with provider override)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists, no new libraries needed
- Architecture: HIGH - Clear fix patterns documented in audit, verified in codebase
- Pitfalls: MEDIUM - Derived from TypeScript/React patterns and localStorage usage

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days — stable domain, localStorage API and React patterns unlikely to change)
