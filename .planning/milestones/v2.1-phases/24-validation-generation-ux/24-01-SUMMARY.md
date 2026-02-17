---
phase: 24-validation-generation-ux
plan: 01
subsystem: ai-core
tags: [provider-health, validation, gemini-recommendation, i18n]
dependency_graph:
  requires:
    - 24-02-PLAN.md (testProviderConnection from ai.ts)
  provides:
    - ai-health.ts (testProviderHealth + HealthCheckResult)
    - ProviderCard Test Connection UI
    - Gemini recommendation badge
    - Health check i18n keys (FR + EN)
  affects:
    - AI Settings modal (ProviderCard now has health check UI)
tech_stack:
  added:
    - ai-health.ts module
  patterns:
    - Error classification (5 types: auth, rate_limit, timeout, network, unknown)
    - Latency measurement with timeout controller
    - Auto-clearing success messages (3s)
    - Provider UX improvement with free tier recommendations
key_files:
  created:
    - src/lib/ai-health.ts
  modified:
    - src/components/settings/ProviderCard.tsx
    - src/i18n/types.ts
    - src/i18n/locales/en.ts
    - src/i18n/locales/fr.ts
decisions:
  - Error classification uses regex patterns on error messages (5 types)
  - Success messages auto-clear after 3s (errors persist until next test)
  - Gemini gets green recommendation badge (best free tier)
  - Health check disabled until provider configured (API key present)
  - Minimal token usage (5 max) + 10s timeout to avoid rate limit impact
metrics:
  duration: 3 min
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
  completed_at: 2026-02-16T19:25:36Z
---

# Phase 24 Plan 01: Provider Health Check & Gemini Badge Summary

**One-liner:** Test Connection button with 5-type error classification and latency display, plus Gemini free tier recommendation badge in AI Settings

## Overview

Implemented provider connectivity testing with error classification and latency measurement. Users can now validate API keys directly in ProviderCard via "Test Connection" button. Gemini card displays "Recommended free tier" badge to guide users toward the best free option.

**Milestone:** v2.1 "AI Refresh" Phase 24 "Validation & Generation UX"

## Tasks Completed

### Task 1: Create ai-health.ts with testProviderHealth function

**Files:** `src/lib/ai-health.ts` (new)

Created health check module with:
- **HealthCheckResult interface:** success, latencyMs, error, errorType (5 types)
- **testProviderHealth function:**
  - Imports `testProviderConnection` from ai.ts (added in Plan 24-02)
  - Uses timeout controller (10s default) from abort.ts
  - Measures round-trip latency (Date.now() delta)
  - Classifies errors via regex patterns:
    - `auth`: /401|403|unauthorized|invalid.*api.*key/i
    - `rate_limit`: /429|rate.?limit|resource.?exhausted/i
    - `network`: /network|fetch|ECONNREFUSED|ENOTFOUND/i
    - `timeout`: isAbortError() detection
    - `unknown`: fallback for unclassified errors
  - Cleans up timeout controller in finally block

**Verification:** `pnpm build` passes, module exports testProviderHealth + HealthCheckResult

**Commit:** `78169f8` feat(24-01): add ai-health module with testProviderHealth

---

### Task 2: Add Test Connection button and Gemini tooltip to ProviderCard

**Files:** `src/components/settings/ProviderCard.tsx`, `src/i18n/types.ts`, `src/i18n/locales/en.ts`, `src/i18n/locales/fr.ts`

**ProviderCard changes:**
1. **Imports:** Added `testProviderHealth`, `HealthCheckResult` from ai-health, `Spinner` from ui
2. **State:** Added `healthCheck` state with loading boolean + HealthCheckResult | null
3. **handleTestConnection:**
   - Sets loading state
   - Calls `testProviderHealth(provider.id)`
   - Auto-clears success result after 3 seconds (errors persist)
4. **Test Connection UI:**
   - Button with spinner during testing
   - Disabled if provider not configured or test in progress
   - Success: green box with latency in ms
   - Error: red box with classified error message (auth/rate_limit/timeout/network/unknown)
5. **Gemini description:**
   - Replaced hardcoded strings with i18n keys
   - Added green "Recommended free tier" badge after Gemini description
   - Badge uses bg-green-100/text-green-800 (light) and dark:bg-green-900/30/dark:text-green-400 (dark)
6. **Provider descriptions:** All 3 providers now use i18n keys (groqDescription, geminiDescription, openaiDescription)

**i18n changes (FR + EN):**
- testConnection: "Test Connection" / "Tester la connexion"
- testing: "Testing..." / "Test en cours..."
- connectionSuccess: "Connection successful" / "Connexion reussie"
- healthErrorAuth: Invalid API key message
- healthErrorRateLimit: Rate limit reached message
- healthErrorTimeout: Connection timeout message
- healthErrorNetwork: Network error message
- healthErrorUnknown: Generic connection failed message
- groqDescription: 14,400 req/day free, ultra fast (Llama 3.3 70B)
- geminiDescription: 15 req/min, 1M tokens/day free (Gemini 2.0 Flash)
- openaiDescription: GPT-4o and GPT-4o Mini, paid
- geminiRecommended: "Recommended free tier" / "Gratuit recommande"

**Verification:** `pnpm build` passes, all i18n keys added to types.ts and both locale files

**Commit:** `281ea3e` feat(24-01): add Test Connection button and Gemini recommendation badge

---

## Deviations from Plan

None - plan executed exactly as written.

Plan correctly identified that `testProviderConnection` was already exported from ai.ts (added in Plan 24-02), so Task 1 simply imported it rather than adding it again.

---

## Key Implementation Details

### Error Classification Logic

```typescript
// Authentication errors (401, 403, invalid key)
if (/\b(401|403)\b|unauthorized|forbidden|invalid.*api.*key/i.test(errorMsg)) {
  return { success: false, error: 'Invalid API key', errorType: 'auth' };
}

// Rate limit errors (429, rate limit, quota)
if (/\b429\b|rate.?limit|resource.?exhausted/i.test(errorMsg)) {
  return { success: false, error: 'Rate limit reached', errorType: 'rate_limit' };
}

// ... (network, timeout, unknown)
```

Regex patterns cover common error formats across Groq, Gemini, and OpenAI SDKs. Each provider returns slightly different error messages, but patterns catch all variants.

### Auto-Clear Success Pattern

```typescript
if (result.success) {
  setTimeout(() => {
    setHealthCheck({ loading: false, result: null });
  }, 3000);
}
```

Success messages auto-clear to avoid cluttering UI after successful validation. Error messages persist so users can read them and take action (e.g., fix API key, wait for rate limit).

### Gemini Recommendation Badge

```tsx
{provider.id === 'gemini' && (
  <span>
    {t.settings.geminiDescription}
    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      {t.settings.geminiRecommended}
    </span>
  </span>
)}
```

Badge uses Tailwind's green color scale with dark mode variants. Positioned inline after description to draw attention without being intrusive.

---

## Testing Notes

**Manual testing checklist:**
1. Open AI Settings modal (Cmd+Shift+, or via command palette)
2. Select each provider (Groq, Gemini, OpenAI)
3. **Without API key:** Test Connection button should be disabled
4. **With valid key:** Click Test Connection → should show success with latency in ms → auto-clear after 3s
5. **With invalid key:** Should show red error box with "Invalid API key" message
6. **Gemini card:** Should display green "Recommended free tier" badge after description
7. **Language switch:** Verify all health check strings appear correctly in FR and EN

**Edge cases covered:**
- Timeout: 10s timeout via createTimeoutController
- Network offline: Network error detection
- Rate limit hit: Rate limit error classification
- Concurrent tests: healthCheck.loading state prevents double-clicks

---

## Requirements Fulfilled

**From 24-RESEARCH.md:**

- **PROV-04:** "Test provider connection" button with latency display and error classification ✓
- **GENX-04:** Gemini free tier recommendation info (15 req/min, 1M tokens/day) ✓
- **INTL-03:** FR + EN strings for health check and provider descriptions ✓

**Must-haves from PLAN.md:**
- [x] User can click 'Test Connection' on active ProviderCard and see latency or error details
- [x] Health check uses minimal tokens (maxTokens: 5) with 10s timeout
- [x] Error classification distinguishes auth, rate_limit, timeout, network, and unknown errors
- [x] Gemini ProviderCard shows free tier recommendation info (15 req/min, 1M tokens/day)
- [x] Health check result auto-clears after 3 seconds on success

---

## Integration Points

**Upstream (dependencies):**
- Plan 24-02: Provides `testProviderConnection(providerId?: string): Promise<string>` in ai.ts

**Downstream (consumers):**
- Plan 24-03: Can leverage health check patterns for generation cancellation UX

**Cross-cutting concerns:**
- ProviderCard now has two distinct sections: API key config + health check
- Health check section uses border-t to visually separate from save/clear buttons
- All provider descriptions now use i18n keys (consistency win)

---

## Architecture Notes

**Health check module design:**
- Single-purpose module: provider connectivity validation only
- No retry logic (vs generateCompletionWithRetry) — health checks should be fast and fail fast
- Timeout controller ensures no indefinitely hanging requests
- Error classification provides actionable user guidance (vs generic "failed" message)

**ProviderCard UX flow:**
1. User enters API key
2. User clicks Save (stores key, resets client)
3. User clicks Test Connection (validates key with minimal request)
4. Success → latency displayed → auto-clear after 3s
5. Error → classified message → persists until next test

**Why 5 error types?**
- `auth`: User action required (fix key)
- `rate_limit`: Temporal issue (wait and retry)
- `timeout`: Network/provider status issue (check connectivity)
- `network`: Local connectivity issue (check internet)
- `unknown`: Unclassified error (generic guidance)

Each type maps to a different user action, making error messages actionable.

---

## Self-Check: PASSED

**Files created:**
- [x] src/lib/ai-health.ts EXISTS (117 lines)

**Files modified:**
- [x] src/components/settings/ProviderCard.tsx EXISTS (modified)
- [x] src/i18n/types.ts EXISTS (13 new keys in settings section)
- [x] src/i18n/locales/en.ts EXISTS (13 new translations)
- [x] src/i18n/locales/fr.ts EXISTS (13 new translations)

**Commits exist:**
- [x] 78169f8 EXISTS (git log shows commit)
- [x] 281ea3e EXISTS (git log shows commit)

**Build verification:**
- [x] `pnpm build` passes (no TypeScript errors, no runtime errors)

All files and commits verified. Plan execution complete.

---

## Next Steps

**For Plan 24-03 (Cancel Button + Progress UI):**
- Leverage `isAbortError()` from abort.ts (already imported in ai-health.ts)
- Use similar loading state pattern for generation progress
- Consider adding progress stages (analyzing, generating, finalizing) to ItemEditorModal
- Add Cancel Generation button that calls controller.abort()

**For Phase 25 (Custom Provider Validation):**
- Extend health check to support custom providers (baseURL + apiKey validation)
- Add adapter layer for OpenAI-compatible error format differences
- Test health check against Ollama, LM Studio, and other local endpoints

**Tech debt / improvements:**
- Consider adding retry count to health check (currently fails on first error)
- Add telemetry tracking for health check success/failure rates
- Consider exposing latency stats in AI Settings (avg latency per provider)

---

*Summary created: 2026-02-16 | Duration: 3 min | Commits: 78169f8, 281ea3e*
