# Phase 22: Provider Registry & Core Refactor - Research

**Researched:** 2026-02-16
**Domain:** Provider registry pattern, OpenAI SDK configuration, CSP security, client singleton management
**Confidence:** HIGH

## Summary

Phase 22 refactors TicketFlow's AI provider architecture from scattered hardcoded logic to a centralized registry pattern. The core challenge is enabling custom OpenAI-compatible endpoints (Ollama, LM Studio) while maintaining security through CSP and preventing state leaks in client singletons.

**Current state:** Three hardcoded providers (Groq, Gemini, OpenAI) with singleton clients keyed only by apiKey. Custom endpoints not supported. CSP whitelists specific domains.

**Target state:** Registry-driven provider system supporting built-in + custom providers, with singletons keyed by provider+apiKey+baseURL, and CSP strategy for HTTPS custom endpoints.

**Primary recommendation:** Implement provider registry with OpenAI SDK baseURL support. Expand singleton cache keys to include baseURL. Use HTTPS-only CSP enforcement (not wildcard) with user-provided endpoint validation. Remove project-level AI config (global only per Phase 21 decisions).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^6.15.0 | OpenAI SDK (already installed) | OpenAI SDK's baseURL parameter enables custom OpenAI-compatible endpoints ([LM Studio docs](https://lmstudio.ai/docs/developer/openai-compat), [Ollama blog](https://ollama.com/blog/openai-compatibility)) |
| groq-sdk | ^0.37.0 | Groq API client (already installed) | Current provider, maintained |
| @google/generative-ai | ^0.24.1 | Gemini API client (already installed) | Current provider, maintained |
| zod | ^4.3.4 | Runtime validation (already installed) | Validate custom provider configs, URL formats |

### Supporting
No new libraries required. Registry pattern uses existing TypeScript/Zod infrastructure.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| baseURL param | Separate custom SDK | More work, duplication — baseURL is standard OpenAI SDK feature |
| Registry pattern | Keep scattered logic | Registry centralizes config, easier to extend with custom providers |

**Installation:**
No new packages required. All dependencies already in package.json.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ai-provider-registry.ts  # NEW: Single source of truth for all providers
│   ├── ai.ts                    # UPDATE: Use registry, expand singleton keys
│   └── ai-*.ts                  # Existing AI utilities (unchanged)
├── types/
│   ├── aiProvider.ts            # NEW: Provider registry types (ProviderConfig, ProviderDefinition)
│   └── projectAIConfig.ts       # REMOVE: Project-level AI config (Phase 21 decision)
└── components/
    └── settings/                # Phase 23 will consume registry
```

### Pattern 1: Provider Registry (Single Source of Truth)

**What:** Centralized registry mapping provider IDs to their configuration (name, baseURL, models, capabilities).

**When to use:** When you need to manage multiple providers (built-in + user-defined) with consistent structure.

**Example:**
```typescript
// src/lib/ai-provider-registry.ts
import { z } from 'zod';

/** Provider configuration schema */
export const ProviderConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), // e.g. "groq", "ollama-local"
  name: z.string(), // Display name
  type: z.enum(['groq', 'gemini', 'openai-compatible']),
  baseURL: z.string().url().optional(), // For openai-compatible only
  defaultModel: z.string(),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
  capabilities: z.object({
    structuredOutput: z.boolean(),
    multimodal: z.boolean(),
  }),
  isCustom: z.boolean().default(false),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Built-in providers (immutable) */
export const BUILT_IN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'groq',
    name: 'Groq',
    type: 'groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
    ],
    capabilities: { structuredOutput: true, multimodal: false },
    isCustom: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    capabilities: { structuredOutput: true, multimodal: true },
    isCustom: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    capabilities: { structuredOutput: true, multimodal: true },
    isCustom: false,
  },
];

/** Load custom providers from localStorage */
export function loadCustomProviders(): ProviderConfig[] {
  try {
    const stored = localStorage.getItem('custom-ai-providers');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return z.array(ProviderConfigSchema).parse(parsed);
  } catch {
    return [];
  }
}

/** Get all providers (built-in + custom) */
export function getAllProviders(): ProviderConfig[] {
  return [...BUILT_IN_PROVIDERS, ...loadCustomProviders()];
}

/** Get provider by ID */
export function getProviderById(id: string): ProviderConfig | null {
  return getAllProviders().find(p => p.id === id) || null;
}

/** Save custom providers to localStorage */
export function saveCustomProviders(providers: ProviderConfig[]): void {
  localStorage.setItem('custom-ai-providers', JSON.stringify(providers));
}
```

**Rationale:** [Registry Pattern](https://www.geeksforgeeks.org/system-design/registry-pattern/) centralizes object management and provides single point of access. Used for [configuration management](https://softwarepatternslexicon.com/patterns-java/6/10/3/) in modular systems.

### Pattern 2: Expanded Singleton Cache Keys

**What:** Client singletons keyed by `provider+apiKey+baseURL` instead of just `provider+apiKey`.

**When to use:** When multiple custom providers can use the same SDK (OpenAI-compatible) but different baseURLs.

**Example:**
```typescript
// src/lib/ai.ts
interface ClientCacheKey {
  provider: string; // 'groq', 'gemini', 'openai', 'ollama-local', etc.
  apiKey: string;
  baseURL?: string; // For openai-compatible providers
}

function getCacheKey(key: ClientCacheKey): string {
  const parts = [key.provider, key.apiKey];
  if (key.baseURL) parts.push(key.baseURL);
  return parts.join('::');
}

const openaiClientCache = new Map<string, OpenAI>();

function getOpenAIClient(apiKey: string, baseURL?: string): OpenAI {
  const cacheKey = getCacheKey({ provider: 'openai', apiKey, baseURL });

  if (!openaiClientCache.has(cacheKey)) {
    openaiClientCache.set(cacheKey, new OpenAI({
      apiKey,
      baseURL, // undefined falls back to default https://api.openai.com/v1
      dangerouslyAllowBrowser: true, // Tauri secure context
    }));
  }

  return openaiClientCache.get(cacheKey)!;
}

export function resetClient(provider?: string): void {
  if (!provider) {
    // Clear all caches
    groqClient = null;
    geminiClient = null;
    openaiClientCache.clear();
    return;
  }

  // Clear specific provider cache
  if (provider === 'groq') groqClient = null;
  else if (provider === 'gemini') geminiClient = null;
  else {
    // Clear openai-compatible provider(s)
    for (const [key] of openaiClientCache) {
      if (key.startsWith(provider + '::')) {
        openaiClientCache.delete(key);
      }
    }
  }
}
```

**Rationale:** Prevents state leaks when switching between providers with same SDK but different endpoints ([singleton pattern with configuration](https://blog.noveogroup.com/2024/07/common-design-patterns-typescript), [cache key strategies](https://www.ceos3c.com/javascript/typescript-singleton-pattern-the-complete-implementation/)).

### Pattern 3: OpenAI SDK baseURL for Custom Endpoints

**What:** OpenAI SDK's baseURL parameter redirects requests to custom endpoints (Ollama, LM Studio).

**When to use:** When user provides OpenAI-compatible endpoint (local or remote).

**Example:**
```typescript
// Custom provider: LM Studio running locally
const lmStudioClient = new OpenAI({
  apiKey: 'not-needed', // LM Studio doesn't require API key
  baseURL: 'http://localhost:1234/v1',
  dangerouslyAllowBrowser: true,
});

// Custom provider: Ollama running locally
const ollamaClient = new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
  dangerouslyAllowBrowser: true,
});

// Custom provider: Remote OpenAI-compatible endpoint
const customClient = new OpenAI({
  apiKey: 'user-provided-key',
  baseURL: 'https://my-custom-ai-provider.com/v1',
  dangerouslyAllowBrowser: true,
});
```

**Rationale:** [LM Studio](https://lmstudio.ai/docs/developer/openai-compat) and [Ollama](https://ollama.com/blog/openai-compatibility) implement OpenAI-compatible APIs. OpenAI SDK's baseURL parameter is the standard way to support them ([OpenCode docs](https://opencode.ai/docs/providers/), [Roo Code docs](https://docs.roocode.com/providers/openai-compatible)).

### Anti-Patterns to Avoid

- **Wildcard CSP (`https://*`):** Security risk — allows connections to any HTTPS domain. [Tauri docs](https://v2.tauri.app/security/csp/) recommend restrictive CSP. Use HTTPS-only validation + user awareness instead.
- **Project-level AI config:** Phase 21 decision removed this. Single global AI config only.
- **Modifying OpenAI client baseURL after creation:** OpenAI SDK doesn't support this ([Issue #282](https://github.com/openai/openai-node/issues/282), [Issue #913](https://github.com/openai/openai-python/issues/913)). Create new client instance instead.
- **Exposing API keys in web context without Tauri:** `dangerouslyAllowBrowser` is [only acceptable in Tauri's secure desktop context](https://backmesh.com/blog/openai-api-mistakes/), not public web apps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom endpoint HTTP client | Custom fetch wrapper | OpenAI SDK baseURL | OpenAI SDK handles auth, retries, streaming — battle-tested |
| Provider capability detection | Runtime introspection | Registry metadata | Capabilities are static per provider type |
| API key storage | Custom encryption | Tauri secure storage (Phase 18) | Already implemented with OS keychain |
| URL validation | Regex patterns | Zod .url() + custom HTTPS check | Zod handles edge cases (punycode, IPv6, etc.) |

**Key insight:** OpenAI SDK's baseURL parameter exists specifically for custom OpenAI-compatible endpoints. Don't reinvent client logic.

## Common Pitfalls

### Pitfall 1: CSP Violations with Custom HTTPS Endpoints

**What goes wrong:** User adds `https://my-llm.example.com/v1` but Tauri CSP blocks it (current CSP whitelists specific domains only).

**Why it happens:** Tauri CSP `connect-src` only allows listed domains: `https://api.groq.com https://generativelanguage.googleapis.com https://api.openai.com` (see `src-tauri/tauri.conf.json:35`).

**How to avoid:**
Two options (requires decision):

**Option A: HTTPS-only enforcement (RECOMMENDED)**
- Validate custom endpoint is HTTPS (not HTTP)
- Keep restrictive CSP (current whitelist)
- Show user warning: "Custom HTTPS endpoints require relaxed security. Use localhost for local models."
- Add Tauri permission prompt when user adds custom provider
- Rationale: [Tauri security best practices](https://v2.tauri.app/security/csp/) recommend restrictive CSP. HTTPS-only is safer than wildcard.

**Option B: Wildcard HTTPS CSP**
- Change CSP to: `"connect-src": "ipc: http://ipc.localhost https://*"`
- Works immediately with any HTTPS endpoint
- Security tradeoff: Allows connections to ANY HTTPS domain ([CSP discussion](https://github.com/tauri-apps/tauri/discussions/5723))
- Rationale: Simpler UX, but weakens security boundary

**Warning signs:** Network errors with status 0 or CSP violation warnings in Tauri console when custom provider is used.

### Pitfall 2: Singleton State Leaks on Provider Switch

**What goes wrong:** User switches from "Ollama Local" (localhost:11434) to "OpenAI Official" but client still sends to localhost.

**Why it happens:** Current singleton cache keys don't include baseURL — only provider type + apiKey (lines 155-157 in `src/lib/ai.ts`).

**How to avoid:**
- Expand cache key to include baseURL: `provider::apiKey::baseURL`
- Clear cache on provider switch: `resetClient(oldProvider)`
- Use Map-based cache instead of single variable for openai-compatible providers (see Pattern 2 above)

**Warning signs:** AI requests succeed but return unexpected responses (e.g. LM Studio response when OpenAI selected).

### Pitfall 3: Hardcoded Provider Assumptions

**What goes wrong:** Code assumes `provider === 'openai'` means official OpenAI API, but user configures custom OpenAI-compatible provider with same ID.

**Why it happens:** Current code uses provider type directly as identifier without distinguishing custom vs. built-in.

**How to avoid:**
- Registry stores unique `id` per provider (e.g. `"openai"`, `"ollama-local"`, `"lmstudio-local"`)
- Registry stores `type` separately (e.g. `"openai-compatible"`)
- Use `getProviderById(id)` to look up config, not hardcoded switches

**Warning signs:** Custom provider config ignored, always falls back to built-in OpenAI.

### Pitfall 4: localStorage Corruption from Manual Edits

**What goes wrong:** User manually edits `localStorage` custom providers, breaks JSON schema, app crashes on load.

**Why it happens:** No validation on load, no recovery mechanism.

**How to avoid:**
- Wrap `loadCustomProviders()` in try-catch
- Log error and return `[]` on parse failure
- Add "Reset Custom Providers" button in settings (Phase 23)
- Validate with Zod schema on load (not just save)

**Warning signs:** App fails to load settings modal, console shows JSON parse errors.

## Code Examples

Verified patterns from current codebase and research:

### Example 1: Current Singleton Pattern (for reference)

```typescript
// src/lib/ai.ts:150-181 (CURRENT)
let groqClient: Groq | null = null;
let groqClientKey: string | null = null;

function getGroqClient(apiKey: string): Groq {
  if (!groqClient || groqClientKey !== apiKey) {
    groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    groqClientKey = apiKey;
  }
  return groqClient;
}
```

**Issue:** No baseURL in cache key. Custom Groq-compatible endpoints not supported.

### Example 2: Registry-Based Provider Lookup

```typescript
// NEW: src/lib/ai-provider-registry.ts
export function getProviderConfig(providerId: string): ProviderConfig | null {
  const provider = getAllProviders().find(p => p.id === providerId);
  if (!provider) {
    console.warn(`[AI] Unknown provider: ${providerId}`);
    return null;
  }
  return provider;
}

// Usage in ai.ts
async function generateCompletion(prompt: string, providerId: string): Promise<string> {
  const config = getProviderConfig(providerId);
  if (!config) throw new Error(`Provider not found: ${providerId}`);

  const apiKey = getApiKey(providerId);
  if (!apiKey) throw new Error(`API key not configured for ${config.name}`);

  if (config.type === 'groq') {
    const client = getGroqClient(apiKey);
    // ...
  } else if (config.type === 'openai-compatible') {
    const client = getOpenAIClient(apiKey, config.baseURL);
    // ...
  }
  // ...
}
```

### Example 3: Custom Provider Validation

```typescript
// NEW: Validate custom provider config before saving
import { z } from 'zod';

const CustomProviderInputSchema = z.object({
  name: z.string().min(1).max(50),
  baseURL: z.string().url().refine(
    (url) => url.startsWith('https://') || url.startsWith('http://localhost'),
    { message: 'Custom endpoints must use HTTPS or localhost' }
  ),
  apiKey: z.string().optional(), // Optional for localhost providers
  defaultModel: z.string().min(1),
});

export function validateCustomProvider(input: unknown): { success: boolean; error?: string; data?: ProviderConfig } {
  const result = CustomProviderInputSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0].message };
  }

  // Generate unique ID from name
  const id = `custom-${result.data.name.toLowerCase().replace(/\s+/g, '-')}`;

  // Check for duplicate ID
  if (getProviderById(id)) {
    return { success: false, error: `Provider "${result.data.name}" already exists` };
  }

  return {
    success: true,
    data: {
      id,
      name: result.data.name,
      type: 'openai-compatible',
      baseURL: result.data.baseURL,
      defaultModel: result.data.defaultModel,
      models: [{ id: result.data.defaultModel, name: result.data.defaultModel }],
      capabilities: { structuredOutput: false, multimodal: false }, // Conservative defaults
      isCustom: true,
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Project-level AI config | Global AI config only | Phase 21 (v2.0) | Simplifies architecture, removes redundancy |
| Hardcoded provider list | Registry pattern | Phase 22 (v2.1) | Enables custom providers, centralized config |
| Single provider type | Multiple custom providers of same type | Phase 22 (v2.1) | Users can add multiple Ollama/LM Studio instances |
| SDK version locked | SDK baseURL standard | 2024+ | All major LLM platforms adopted OpenAI-compatible APIs |

**Deprecated/outdated:**
- `src/types/projectAIConfig.ts` — Project-level AI config removed per Phase 21 decision
- Provider type as identifier — Use registry `id` instead (custom providers can share type)

## Open Questions

### Question 1: CSP Strategy for Custom HTTPS Endpoints

**What we know:**
- Current CSP whitelists specific domains only
- Tauri docs recommend restrictive CSP (security best practice)
- Wildcard `https://*` works but widens attack surface
- HTTPS-only enforcement + user warning is safer but requires UX trade-off

**What's unclear:**
- Does user base prioritize convenience (wildcard) or security (restrictive)?
- Should custom provider feature be Tauri-only (relaxed) or web-compatible (restrictive)?

**Recommendation:** **HTTPS-only enforcement (Option A)** for v2.1, gather feedback, consider wildcard in v2.2 if users demand it. Rationale: Security-first approach, reversible decision.

### Question 2: Custom Provider Model Discovery

**What we know:**
- LM Studio and Ollama expose `/v1/models` endpoint (OpenAI-compatible)
- Could auto-fetch available models when user adds custom provider

**What's unclear:**
- Should Phase 22 implement auto-discovery or manual model input?
- Adds complexity (network calls, error handling, loading states)

**Recommendation:** Manual model input for Phase 22 (user specifies model ID). Add auto-discovery in Phase 24 (validation & UX improvements). Keeps Phase 22 focused on core registry.

### Question 3: API Key Storage for Custom Providers

**What we know:**
- Phase 18 implemented secure storage (Tauri keychain) for built-in providers
- localStorage keys are: `groq-api-key`, `gemini-api-key`, `openai-api-key`
- Custom providers need similar secure storage

**What's unclear:**
- Should custom provider API keys use same secure storage mechanism?
- Storage key format: `custom-<provider-id>-api-key`?

**Recommendation:** Reuse secure storage with namespaced keys: `custom-${providerId}-api-key`. Consistent with existing pattern, secure by default.

## Sources

### Primary (HIGH confidence)
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) - Official CSP configuration guide
- [LM Studio OpenAI Compatibility](https://lmstudio.ai/docs/developer/openai-compat) - Official baseURL usage
- [Ollama OpenAI Compatibility](https://ollama.com/blog/openai-compatibility) - Official API compatibility
- [OpenAI SDK GitHub](https://github.com/openai/openai-node) - baseURL parameter documentation
- Current codebase: `src/lib/ai.ts`, `src-tauri/tauri.conf.json`, `package.json`

### Secondary (MEDIUM confidence)
- [Registry Pattern - GeeksforGeeks](https://www.geeksforgeeks.org/system-design/registry-pattern/) - Design pattern overview
- [TypeScript Singleton Pattern](https://blog.noveogroup.com/2024/07/common-design-patterns-typescript) - Implementation guide
- [OpenAI SDK baseURL Issue #282](https://github.com/openai/openai-node/issues/282) - Known limitation
- [OpenCode Providers Documentation](https://opencode.ai/docs/providers/) - Custom provider patterns

### Tertiary (LOW confidence)
- [OpenAI SDK dangerouslyAllowBrowser security implications](https://backmesh.com/blog/openai-api-mistakes/) - Security analysis (not Tauri-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already installed, baseURL is documented OpenAI SDK feature
- Architecture: **HIGH** - Registry pattern is well-established, OpenAI-compatible APIs are industry standard
- Pitfalls: **HIGH** - CSP issues documented in Tauri docs, singleton state leaks are common pattern bug
- Open questions: **MEDIUM** - CSP strategy requires user feedback, model discovery is enhancement not blocker

**Research date:** 2026-02-16
**Valid until:** 60 days (stack stable, patterns mature)
**Blockers:** CSP decision required (HTTPS-only vs. wildcard) — impacts success criteria #3
