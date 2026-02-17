# Phase 24: Validation & Generation UX - Research

**Researched:** 2026-02-16
**Domain:** AI provider validation, async operation UX patterns, error handling
**Confidence:** HIGH

## Summary

Phase 24 focuses on improving the AI generation experience through three pillars: **provider health checks** (testing connection and latency), **loading state management** (progress feedback and cancellation), and **context-aware provider selection** (per-operation overrides). The research confirms existing codebase patterns are solid foundations: `AbortController` infrastructure already exists (`src/lib/abort.ts`), provider registry is centralized (`ai-provider-registry.ts`), and UI primitives (`Spinner`, `Modal`) are ready. Key technical challenges are (1) implementing provider-agnostic health checks without leaking API keys, (2) wiring `AbortSignal` through all AI operations for cancellation, and (3) designing error messages that distinguish network/auth/rate-limit failures with actionable retry guidance.

**Primary recommendation:** Build health check as a lightweight completion request with timeout, use existing `AbortController` patterns for cancellation, and create a unified `AIOperationFeedback` component to display loading/progress/error states across all AI features (generation, refinement, bulk import, maintenance).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AbortController | Native | Async cancellation | Web standard, already integrated in `src/lib/abort.ts` |
| React `useState` + `useEffect` | React 19 | Loading state management | Project standard, used in `AIGenerationMode.tsx` |
| Zod | 3.x | Response validation | Already used for all AI schemas (`src/types/ai.ts`) |
| Spinner component | Internal | Loading indicator | Existing at `src/components/ui/Spinner.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `isAbortError()` | Internal | Distinguish cancellation from errors | When handling async errors (prevents showing error toast for user cancellation) |
| `createTimeoutController()` | Internal | Auto-abort after timeout | For health checks (default 10s timeout) |
| `linkAbortSignals()` | Internal | Combine user + timeout abort | When operation needs both user cancellation and timeout protection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native AbortController | Promise.race | AbortController is standard, more composable, better error semantics |
| Custom timeout | setTimeout wrapper | Already implemented in `abort.ts`, no need to rebuild |
| Per-component loading states | Global loading manager | Too complex for this use case; components own their loading state |

**Installation:**
No new dependencies required. All patterns use existing infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ai-health.ts           # NEW - Provider health check logic
│   ├── ai.ts                  # UPDATE - Add signal param to all completion funcs
│   ├── ai-retry.ts            # UPDATE - Pass signal through retry wrapper
│   └── abort.ts               # EXISTS - Cancellation utilities
├── components/
│   ├── settings/
│   │   └── ProviderCard.tsx   # UPDATE - Add "Test Connection" button
│   ├── editor/
│   │   ├── ItemEditorModal.tsx    # UPDATE - Wire provider override + abort signal
│   │   └── AIGenerationMode.tsx   # UPDATE - Add cancel button + progress text
│   └── ui/
│       ├── Spinner.tsx        # EXISTS - Used for all loading states
│       └── AIOperationFeedback.tsx # NEW - Unified progress/error component
└── i18n/
    └── locales/
        ├── fr.ts              # UPDATE - Add health check + UX keys
        └── en.ts              # UPDATE - Add health check + UX keys
```

### Pattern 1: Provider Health Check
**What:** Validate provider connection + measure latency before user commits to using it
**When to use:** On "Test Connection" button click in ProviderCard (AISettingsModal)
**Example:**
```typescript
// src/lib/ai-health.ts
interface HealthCheckResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  errorType?: 'network' | 'auth' | 'rate_limit' | 'unknown';
}

export async function testProviderHealth(
  providerId: string,
  timeoutMs = 10000
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const controller = createTimeoutController(timeoutMs);

  try {
    // Minimal completion request to test connectivity
    const testPrompt = "Test"; // Single word to minimize tokens
    await generateCompletion(testPrompt, {
      provider: providerId,
      maxTokens: 5, // Minimal response
    });

    return {
      success: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    // Classify error type for actionable feedback
    if (isAbortError(error)) {
      return { success: false, latencyMs: latency, error: 'Timeout', errorType: 'network' };
    }

    const msg = error instanceof Error ? error.message : String(error);
    if (/\b(401|403)\b|unauthorized|forbidden|invalid.*api.*key/i.test(msg)) {
      return { success: false, latencyMs: latency, error: msg, errorType: 'auth' };
    }
    if (/\b429\b|rate.?limit|resource.?exhausted/i.test(msg)) {
      return { success: false, latencyMs: latency, error: msg, errorType: 'rate_limit' };
    }

    return { success: false, latencyMs: latency, error: msg, errorType: 'unknown' };
  } finally {
    clearControllerTimeout(controller);
  }
}
```

**Why this approach:**
- Uses minimal tokens (1 input, 5 output) to avoid rate limit consumption
- Timeout protection prevents indefinite hangs
- Error classification enables actionable UI messages (e.g., "Invalid API key → Check settings" vs "Rate limit → Wait 1 minute")
- Latency measurement helps users compare provider responsiveness

### Pattern 2: Cancellable AI Operations
**What:** Pass `AbortSignal` through all AI calls to enable user cancellation
**When to use:** For all generation operations (item creation, refinement, bulk import, maintenance)
**Example:**
```typescript
// 1. Component creates abort controller
const [abortController, setAbortController] = useState<AbortController | null>(null);

const handleGenerate = async () => {
  const controller = new AbortController();
  setAbortController(controller);
  setIsGenerating(true);

  try {
    const result = await generateItemFromDescription(prompt, {
      ...options,
      signal: controller.signal, // Pass signal to AI function
    });
    // Handle success
  } catch (error) {
    if (!isAbortError(error)) {
      // Show error toast only if not cancelled by user
    }
  } finally {
    setIsGenerating(false);
    setAbortController(null);
  }
};

const handleCancel = () => {
  abortController?.abort();
};

// 2. AI lib propagates signal to fetch
async function generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
  // ... existing code ...

  if (providerType === 'groq') {
    const client = getGroqClient(config.apiKey);
    const response = await client.chat.completions.create({
      // ... existing params ...
      signal: options?.signal, // Pass through to SDK
    });
    return response.choices[0]?.message?.content || '';
  }
  // Repeat for gemini/openai
}
```

**Why this approach:**
- Standard `AbortController` API, no custom abstractions
- Signal propagates cleanly through call stack (component → lib → SDK → fetch)
- `isAbortError()` utility prevents treating intentional cancellation as failure
- Works with existing SDK clients (Groq SDK, OpenAI SDK, Google GenerativeAI SDK all support signal param)

### Pattern 3: Loading State with Progress Text
**What:** Show spinner + dynamic progress text during AI operations
**When to use:** All AI operations that take >1 second (generation, refinement, etc.)
**Example:**
```typescript
// Component state
const [isGenerating, setIsGenerating] = useState(false);
const [progressText, setProgressText] = useState<string | null>(null);

// Update progress text during operation
const handleGenerate = async () => {
  setIsGenerating(true);
  setProgressText(t.ai.analyzing); // "Analyzing your request..."

  setTimeout(() => {
    if (isGenerating) {
      setProgressText(t.ai.generatingStructure); // "Generating ticket structure..."
    }
  }, 2000);

  try {
    const result = await generateItemFromDescription(prompt, options);
    setProgressText(t.ai.finalizing); // "Finalizing..."
    // Process result
  } finally {
    setIsGenerating(false);
    setProgressText(null);
  }
};

// Render
{isGenerating && (
  <div className="flex items-center gap-2">
    <Spinner size="sm" />
    <span className="text-sm text-on-surface-muted">{progressText}</span>
  </div>
)}
```

**Why this approach:**
- Provides perceived progress even when operation is opaque
- Uses existing `Spinner` component
- Progress text is i18n-friendly (keys in translations)
- Simple state management (no complex state machine)

### Pattern 4: Provider Override in Context
**What:** Allow per-operation provider selection that overrides global default
**When to use:** ItemEditorModal generation (requirement GENX-03)
**Example:**
```typescript
// ItemEditorModal.tsx
const [selectedProvider, setSelectedProvider] = useState<AIProvider>(getProvider());

// When user changes provider toggle in modal
const handleProviderChange = (provider: AIProvider) => {
  setSelectedProvider(provider);
};

// Pass override to generation function
const result = await generateItemFromDescription(prompt, {
  provider: selectedProvider, // Override global default
  projectId: projectId,
  items: items,
  // ... other options
});
```

**Current bug:** The provider toggle exists in `AIGenerationMode` but the selected value isn't passed to `generateItemFromDescription`. Fix is straightforward state wiring.

### Anti-Patterns to Avoid
- **Don't create custom cancellation mechanisms:** Use native `AbortController`, not custom promise wrappers
- **Don't retry auth errors:** 401/403 should fail immediately, not retry (wastes time + API quota)
- **Don't show technical error messages:** Translate SDK errors into user-friendly i18n strings
- **Don't test health on every operation:** Only on explicit "Test Connection" click (avoid unnecessary API calls)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request cancellation | Custom promise race | `AbortController` (native) | Standard API, works with fetch/SDK, better error semantics |
| Timeout management | setTimeout + manual cleanup | `createTimeoutController()` (exists) | Auto-cleanup, composable with user abort |
| Loading spinners | Custom CSS animations | `Spinner` component (exists) | Consistent UX, theme-aware, accessible |
| Error classification | String matching everywhere | Centralized `classifyAIError()` helper | Single source of truth, easier to maintain |

**Key insight:** Request cancellation is deceptively complex (cleanup, error handling, race conditions). Native `AbortController` solves all edge cases. Project already has `abort.ts` utilities—use them.

## Common Pitfalls

### Pitfall 1: Forgetting to Clear Timeout on Success
**What goes wrong:** Health check succeeds quickly but timeout fires later, calling abort on completed request (causes console errors)
**Why it happens:** `createTimeoutController()` auto-aborts after N seconds, must clear on success
**How to avoid:** Always call `clearControllerTimeout(controller)` in finally block
**Warning signs:** Console errors "AbortError" after successful operations
```typescript
// BAD
const controller = createTimeoutController(10000);
await testConnection(); // succeeds in 200ms
// Timeout still fires at 10s → abort called on dead controller

// GOOD
const controller = createTimeoutController(10000);
try {
  await testConnection();
} finally {
  clearControllerTimeout(controller); // Cancel pending timeout
}
```

### Pitfall 2: Showing Error Toast for User Cancellation
**What goes wrong:** User clicks "Cancel" button, sees error toast "Operation failed"
**Why it happens:** catch block doesn't distinguish AbortError from real errors
**How to avoid:** Use `isAbortError(error)` before showing error UI
**Warning signs:** Users report "error" messages when they intentionally cancel
```typescript
// BAD
try {
  await generate();
} catch (error) {
  toast.error(error.message); // Shows "AbortError" toast when user cancels
}

// GOOD
try {
  await generate();
} catch (error) {
  if (!isAbortError(error)) {
    toast.error(error.message); // Only show for real errors
  }
}
```

### Pitfall 3: Not Propagating Signal Through Call Stack
**What goes wrong:** Cancel button doesn't actually cancel AI request (keeps running in background)
**Why it happens:** Signal passed to wrapper function but not forwarded to underlying SDK call
**How to avoid:** Audit all async functions—signal must propagate from component → lib → SDK
**Warning signs:** "Cancel" button seems to work (UI updates) but network requests continue
```typescript
// BAD
async function generateItem(prompt: string, options?: { signal?: AbortSignal }) {
  // Signal received but not used
  const result = await client.chat.completions.create({ prompt }); // No signal passed
  return result;
}

// GOOD
async function generateItem(prompt: string, options?: { signal?: AbortSignal }) {
  const result = await client.chat.completions.create({
    prompt,
    signal: options?.signal, // Propagate to SDK
  });
  return result;
}
```

### Pitfall 4: Testing Health Check with Large Prompts
**What goes wrong:** Health check itself gets rate-limited or times out
**Why it happens:** Using full generation prompt for health check (100+ tokens)
**How to avoid:** Use minimal prompt ("Test") and maxTokens: 5 for health checks
**Warning signs:** Health checks fail on free tiers that work fine for real operations
```typescript
// BAD - Health check consumes 200+ tokens
await testHealth("Generate a detailed user story for authentication feature...");

// GOOD - Health check consumes ~10 tokens total
await generateCompletion("Test", { maxTokens: 5 });
```

### Pitfall 5: Rate Limit Error Handling Differences
**What goes wrong:** Same 429 error handled differently across providers
**Why it happens:** Groq returns `x-ratelimit-*` headers, Gemini returns `retry-after`, OpenAI returns `x-ratelimit-reset-requests`
**How to avoid:** Unified error classifier that handles all provider formats
**Warning signs:** Retry-after logic works for Groq but not Gemini
```typescript
// Provider-agnostic rate limit detection
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  // Works for all: Groq (429), Gemini (RESOURCE_EXHAUSTED), OpenAI (429)
  return /\b429\b|rate.?limit|resource.?exhausted/i.test(msg);
}
```

## Code Examples

Verified patterns from official sources:

### Health Check Implementation (Complete)
```typescript
// src/lib/ai-health.ts
import { createTimeoutController, clearControllerTimeout, isAbortError } from './abort';
import { generateCompletion } from './ai';
import type { ProviderConfig } from '../types/aiProvider';

export interface HealthCheckResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  errorType?: 'network' | 'auth' | 'rate_limit' | 'timeout' | 'unknown';
}

export async function testProviderHealth(
  providerId: string,
  timeoutMs = 10000
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const controller = createTimeoutController(timeoutMs);

  try {
    await generateCompletion("Test", {
      provider: providerId,
      maxTokens: 5,
    });

    return {
      success: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    if (isAbortError(error)) {
      return {
        success: false,
        latencyMs: latency,
        error: 'Connection timeout',
        errorType: 'timeout',
      };
    }

    const msg = error instanceof Error ? error.message : String(error);

    // Auth errors (401/403)
    if (/\b(401|403)\b|unauthorized|forbidden|invalid.*api.*key/i.test(msg)) {
      return { success: false, latencyMs: latency, error: msg, errorType: 'auth' };
    }

    // Rate limit errors (429)
    if (/\b429\b|rate.?limit|resource.?exhausted/i.test(msg)) {
      return { success: false, latencyMs: latency, error: msg, errorType: 'rate_limit' };
    }

    // Network errors
    if (/network|fetch|ECONNREFUSED/i.test(msg)) {
      return { success: false, latencyMs: latency, error: msg, errorType: 'network' };
    }

    return { success: false, latencyMs: latency, error: msg, errorType: 'unknown' };
  } finally {
    clearControllerTimeout(controller);
  }
}
```

### Cancellable Generation (ItemEditorModal)
```typescript
// Component state
const [isGenerating, setIsGenerating] = useState(false);
const [abortController, setAbortController] = useState<AbortController | null>(null);
const [progressText, setProgressText] = useState<string | null>(null);

// Generate with cancellation support
const handleAIGenerate = async () => {
  const controller = new AbortController();
  setAbortController(controller);
  setIsGenerating(true);
  setProgressText(t.ai.analyzing);

  // Update progress text every 2s
  const progressInterval = setInterval(() => {
    setProgressText(prev => {
      if (prev === t.ai.analyzing) return t.ai.generatingStructure;
      if (prev === t.ai.generatingStructure) return t.ai.finalizing;
      return prev;
    });
  }, 2000);

  try {
    const result = await generateItemFromDescription(aiPrompt, {
      provider: selectedProvider, // Override from toggle
      projectId: projectId,
      items: items,
      typeConfigs: types,
      signal: controller.signal, // Enable cancellation
    });

    if (result.success && result.item) {
      // Populate form with generated data
      setFormData({ ...emptyForm, ...result.item });
    } else {
      toast.error(result.error || t.aiErrors.unknownError);
    }
  } catch (error) {
    if (!isAbortError(error)) {
      toast.error(error instanceof Error ? error.message : t.aiErrors.unknownError);
    }
  } finally {
    clearInterval(progressInterval);
    setIsGenerating(false);
    setAbortController(null);
    setProgressText(null);
  }
};

// Cancel generation
const handleCancel = () => {
  abortController?.abort();
};
```

### Provider Card with Health Check
```typescript
// ProviderCard.tsx
const [healthCheck, setHealthCheck] = useState<{ loading: boolean; result: HealthCheckResult | null }>({
  loading: false,
  result: null,
});

const handleTestConnection = async () => {
  setHealthCheck({ loading: true, result: null });
  const result = await testProviderHealth(provider.id);
  setHealthCheck({ loading: false, result });

  // Auto-clear success after 3s
  if (result.success) {
    setTimeout(() => setHealthCheck({ loading: false, result: null }), 3000);
  }
};

// Render health check UI
{isActive && (
  <div className="mt-3 pt-3 border-t border-outline">
    <button
      onClick={handleTestConnection}
      disabled={!isConfigured || healthCheck.loading}
      className="text-sm text-accent-text hover:underline disabled:opacity-50"
    >
      {healthCheck.loading ? t.settings.testing : t.settings.testConnection}
    </button>

    {healthCheck.result && (
      <div className={`mt-2 p-2 rounded text-xs ${
        healthCheck.result.success
          ? 'bg-success-soft text-success-text'
          : 'bg-danger-soft text-danger-text'
      }`}>
        {healthCheck.result.success ? (
          <>{t.settings.connectionSuccess} ({healthCheck.result.latencyMs}ms)</>
        ) : (
          <>{healthCheck.result.error}</>
        )}
      </div>
    )}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent AI operations | Progress text + spinner | Phase 24 | Users know operation is happening, can estimate completion time |
| No cancellation | AbortController support | Phase 24 | Users can cancel long-running operations instead of waiting or closing modal |
| Global provider only | Per-operation override | Phase 24 | Users can test different providers for same operation without changing global config |
| Manual error classification | Unified error classifier | Phase 24 | Consistent error messages, easier to add new providers |

**Deprecated/outdated:**
- **Project-level AI config**: Removed in Phase 22, now global only
- **Hardcoded provider labels**: Now use `ai-provider-registry.ts` for all provider metadata

## Open Questions

1. **Should health check cache results?**
   - What we know: Current design tests on every button click
   - What's unclear: Would caching (5min TTL) improve UX without hiding transient issues?
   - Recommendation: Start without cache, add if users report excessive API consumption

2. **Should progress text be time-based or operation-based?**
   - What we know: Time-based (every 2s) is simple but may not align with actual progress
   - What's unclear: Could we emit progress events from AI lib (e.g., "prompt built", "API call sent", "response received")?
   - Recommendation: Start time-based (simpler), refactor to event-based in Phase 25 if users want more accurate progress

3. **Should Gemini free tier recommendation be in tooltip or modal?**
   - What we know: Requirement GENX-04 says "tooltip" but ProviderCard has more space
   - What's unclear: Would modal onboarding flow be better UX?
   - Recommendation: Inline info box in ProviderCard (visible without hover), tooltip for icon explanation

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/lib/abort.ts`, `src/lib/ai.ts`, `src/components/ui/Spinner.tsx` (existing patterns verified)
- React documentation: [AbortController in React](https://react.dev/reference/react/useEffect#fetching-data-with-cleanup) (official guidance on cleanup)
- OpenAI API docs: [Error codes](https://platform.openai.com/docs/guides/error-codes), [Rate limits](https://platform.openai.com/docs/guides/rate-limits)
- Gemini API docs: [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- Groq API docs: [Rate limits](https://console.groq.com/docs/rate-limits), [Error codes](https://console.groq.com/docs/errors)

### Secondary (MEDIUM confidence)
- MDN Web Docs: [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) (web standard reference)
- React patterns blog: [Cancelling Fetch Requests](https://blog.openreplay.com/cancelling-in-flight-fetch-abortcontroller/) (common patterns)

### Tertiary (LOW confidence)
- None—all findings verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All patterns exist in codebase or are web standards
- Architecture: HIGH - Verified against official React/API docs + existing project patterns
- Pitfalls: HIGH - Derived from codebase audit (found bugs in ItemEditorModal provider wiring) + API docs

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days—stable domain, rate limit structures change infrequently)

**Key findings:**
1. No new dependencies needed—all infrastructure exists
2. Provider health check should use minimal tokens (5 output) to avoid rate limits
3. AbortController support requires signal propagation through 3 layers (component → lib → SDK)
4. Error classification must handle 3 different rate-limit formats (Groq headers, Gemini RESOURCE_EXHAUSTED, OpenAI 429)
5. Progress text improves perceived performance even for opaque operations
