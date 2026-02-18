# TicketFlow Code Audit & Security Review

> **Audit Date:** 2026-02-18
> **Scope:** v2.1 + v2.2 changes (Phases 22-29)
> **Baseline:** Phase 18 security audit (v2.0)
> **Auditor:** Claude (automated analysis)
> **Source reports:** 31-01-dead-code-antipatterns.md · 31-02-security-dependencies.md

---

## Executive Summary

The TicketFlow codebase is in good overall health after two substantial milestones (v2.1 "AI Refresh" and v2.2 "Quality & Insights"). No critical security vulnerabilities exist. The OWASP Desktop Top 10 review confirms 8 of 10 categories pass cleanly; the two NEEDS ATTENTION items (IPC api_key surface and CI action tag-pinning) are low-risk for a local desktop/BYOK application with Tauri CSP enforced.

The most impactful findings are code quality issues rather than security issues. Three high-priority type safety problems (`as any` casts, Zod type bypass) allow runtime errors to bypass TypeScript's safety guarantees. One confirmed bug — `initTelemetry()` non-idempotency — causes duplicate `window.addEventListener` registrations that inflate PostHog error event counts on every app launch. Two god files (`ai.ts` at 2,229 lines and `ProjectWorkspace.tsx` at 1,569 lines) present the largest architectural risk for ongoing development, having already caused merge conflicts during parallel plan execution.

Recommended path: address the three type safety issues and the idempotency bug before v2.2.1 release (estimated 2-3 hours); batch the 11 dead code cleanups as a single low-risk PR (1-2 hours); defer god file extraction and performance optimizations to the next milestone planning cycle.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Total findings** | **44** |
| P1 (Critical) | 0 |
| P2 (High) | 7 |
| P3 (Medium) | 24 |
| P4 (Low) | 13 |
| OWASP categories reviewed | 10/10 |
| OWASP categories PASS | 8/10 |
| OWASP NEEDS ATTENTION | 2/10 |
| npm vulnerabilities | 2 (moderate, dev-only) |
| Cargo vulnerabilities | 4 (high/moderate, all transitive) |
| Outdated npm packages | 25 (10 patch, 10 minor, 5 major) |
| License issues | 0 |

---

## Findings by Priority

### P1 — Critical

No critical findings. No exploitable security vulnerabilities, data loss risks, or application-crashing bugs found in the v2.1/v2.2 codebase.

---

### P2 — High

#### [SMELL-010] Error Handling — `initTelemetry()` Not Idempotent for Event Listeners (Priority: P2)

- **File:** `src/lib/telemetry.ts:242-245`
- **Issue:** `initTelemetry()` calls `setupErrorTracking()` which adds `window.addEventListener('unhandledrejection', ...)` and `window.addEventListener('error', ...)` without first checking if these listeners already exist. The function claims to be idempotent ("safe to call multiple times") but it is not — each call stacks another listener. In `App.tsx`, `initTelemetry()` is called twice: once in the startup effect and once in `handleConsentAccept`. Every unhandled error therefore fires `track('error_unhandled', ...)` twice, inflating PostHog error counts.
- **Fix:** Add a module-level guard: `let errorTrackingSetUp = false;` and gate the `addEventListener` calls behind it. Alternatively, use a named function reference that can be de-duplicated via `removeEventListener` before re-adding.

#### [SMELL-001] Type Safety — `as any` Casts in AISettingsModal Provider Selection (Priority: P2)

- **File:** `src/components/settings/AISettingsModal.tsx:61-62`
- **Issue:** `setSelectedProvider(providerId as any)` and `setProvider(providerId as any)` bypass TypeScript's union type check. `providerId` is a `string` but `setProvider` expects `AIProvider = 'groq' | 'gemini' | 'openai'`. The cast suppresses the compiler error instead of adding a proper type guard.
- **Fix:** Narrow the type before calling `setProvider`: validate `BUILT_IN_PROVIDERS.some(p => p.id === providerId)` first, or type `handleProviderSelect`'s parameter as `BuiltInProviderId`.

#### [SMELL-002] Type Safety — `ticket: any` in Zod-Validated ai-bulk.ts Mapping (Priority: P2)

- **File:** `src/lib/ai-bulk.ts:670`
- **Issue:** `result.data.tickets.map((ticket: any, index: number) => ...)` casts each element to `any` despite `result.data` having been fully validated by `BulkGenerateResponseSchema`. This discards the inferred Zod type and allows property typos in the mapping object to go undetected at compile time.
- **Fix:** Use the Zod-inferred type: `z.infer<typeof BulkGenerateResponseSchema>['tickets'][number]` as the element type.

#### [SMELL-003] Type Safety — Non-Exhaustive Provider Handling in ProviderCard (Priority: P2)

- **File:** `src/components/settings/ProviderCard.tsx:53-57`
- **Issue:** `const colors = { groq: {...}, gemini: {...}, openai: {...} }[provider.id] || fallback` uses a string index lookup that silently falls back for unknown `provider.id` values. The type system does not enforce that `ProviderCard` is only called with built-in provider IDs.
- **Fix:** Use a type-safe Map keyed by `BuiltInProviderId`, or add an explicit type guard ensuring `provider.id` is a known key before the lookup.

#### [DEAD-008] Dead Code — Hardcoded localStorage Keys Not in STORAGE_KEYS (Priority: P2)

- **Files:** `src/components/settings/AISettingsModal.tsx:33,57` · `src/components/workspace/ProjectWorkspace.tsx:162` · `src/components/onboarding/OnboardingWizard.tsx:192` · `src/hooks/useAIQuestioning.ts:29`
- **Issue:** `'ticketflow-questioning-mode'` and `'ticketflow-locale'` are used via hardcoded string literals across multiple files. `STORAGE_KEYS` in `src/constants/storage.ts` is the declared single source of truth but is missing these two keys. Additionally, `useAIQuestioning.ts` defines a local `QUESTIONING_STORAGE_KEY` constant that conflicts with the hardcoded string in `AISettingsModal.tsx` — if one is updated, the other silently diverges.
- **Fix:** Add `QUESTIONING_MODE: 'ticketflow-questioning-mode'` and `LOCALE: 'ticketflow-locale'` to `STORAGE_KEYS`. Update all 4 files to import from constants. Remove the local `QUESTIONING_STORAGE_KEY` definition.

#### [DEP-001] Dependency — 4 Cargo Crate Vulnerabilities (Priority: P2)

- **Crates:** `bytes 1.11.0` (RUSTSEC-2026-0007, High) · `rkyv 0.7.45` (RUSTSEC-2026-0001, High) · `rsa 0.9.10` (RUSTSEC-2023-0071, High) · `time 0.3.44` (RUSTSEC-2026-0009, Moderate)
- **Issue:** Four advisories from `cargo-audit 0.22.1` affecting transitive dependencies pulled in via `tauri-plugin-log`, `reqwest`, and Tauri's TLS stack. All four are transitive — TicketFlow contains no direct code that exercises the vulnerable code paths (BytesMut large reserves, Arc/Rc OOM, RSA decryption timing, malformed time string parsing).
- **Fix:** Track for resolution in Tauri ecosystem upstream. Monitor Tauri plugin and reqwest releases. `bytes` and `time` have fixes available (>=1.11.1 and >=0.3.41 respectively) but require upstream Tauri to pull them. `rkyv` is unmaintained with no fix. `rsa` has no 0.9.x patch.

#### [SMELL-004] React — Missing `chatPanel` in useEffect Dependency Array (Priority: P2)

- **File:** `src/components/workspace/ProjectWorkspace.tsx:173-177`
- **Issue:** `chatPanel.loadHistory` is called inside a `useEffect` but excluded from its dependency array (suppressed via `// eslint-disable-line react-hooks/exhaustive-deps`). On project switch, the stale closure could call `loadHistory` on the wrong project's panel.
- **Fix:** Stabilize `chatPanel.loadHistory` with `useCallback` in `useChatPanel` hook, then add it to the dependency array to remove the eslint suppression.

---

### P3 — Medium

#### [SMELL-005] React — Missing Dependencies in TypeConfig Sync Effect (Priority: P3)

- **File:** `src/components/workspace/ProjectWorkspace.tsx:208-236`
- **Issue:** The TypeConfig sync effect uses `typeConfig.initializeWithTypes`, `projectPath`, `prevTypesRef`, `typesInitFromDbRef`, and `dbSnapshotRef` inside the callback but only declares `backlog.projectId` and `backlog.typeConfigs` as dependencies (`// eslint-disable-line react-hooks/exhaustive-deps`). The omitted deps are stable across the effect's lifetime, making this low-risk in practice but fragile to future refactoring.
- **Fix:** Document the rationale for each omitted dependency with an inline comment explaining stability guarantees, or extract to `useSyncTypeConfigFromDB` hook with explicit dependency management.

#### [SMELL-006] Architecture — God File: `src/lib/ai.ts` at 2,229 Lines (Priority: P3)

- **File:** `src/lib/ai.ts`
- **Issue:** Handles 8+ distinct concerns: client singleton management, API key CRUD, provider selection, model resolution, backlog format analysis, item generation, item refinement, bulk generation orchestration, dependency detection, and context-aware prompting. Caused merge conflicts during v2.1 parallel plan execution.
- **Fix:** Extract by responsibility: `ai-client.ts` (singletons, API key management, `resetClient`), `ai-config.ts` (`getProvider`, `setProvider`, `getEffectiveAIConfig`, `resolveModelForProvider`), `ai-maintenance.ts` (`analyzeBacklogFormat`, `correctBacklogFormat`). Keep `ai.ts` as a thin composition layer.

#### [SMELL-007] Architecture — God File: `src/components/workspace/ProjectWorkspace.tsx` at 1,569 Lines (Priority: P3)

- **File:** `src/components/workspace/ProjectWorkspace.tsx`
- **Issue:** Single component handles multi-select state, chat state, TypeConfig sync, keyboard shortcuts, command palette, AI analysis panel, bulk operations, archive, screenshot, export, feature tooltips, and view routing. 30+ `useState`/`useCallback` declarations. Persistent merge conflict hotspot across milestones v1.5 through v2.2.
- **Fix:** Extract sub-domains: `useWorkspaceBulkOps` (multi-select + bulk delete/archive), `useWorkspaceTypeSync` (TypeConfig ↔ SQLite sync), `useWorkspaceItemActions` (CRUD, archive, restore handlers), `useWorkspaceModals` (modal state routing).

#### [SMELL-008] Architecture — Business Logic in UI Component (Priority: P3)

- **File:** `src/components/settings/AISettingsModal.tsx:36-45`
- **Issue:** The modal directly calls `getOrCreateProject(projectPath, projectName)` and `getFeedbackStats(projectId)` — database query functions — inside a `useEffect`. This embeds data fetching and a side-effectful `getOrCreateProject` (creates DB row if absent) directly in a UI component. The modal cannot be unit tested without a real SQLite database.
- **Fix:** Extract into `useAIFeedbackStats(projectPath)` hook, following the existing `useAIFeedback` pattern.

#### [SMELL-009] Architecture — Duplicated Storage Key for Questioning Mode (Priority: P3)

- **File:** `src/hooks/useAIQuestioning.ts:29` · `src/components/settings/AISettingsModal.tsx:33,57`
- **Issue:** `const QUESTIONING_STORAGE_KEY = 'ticketflow-questioning-mode'` is defined locally in `useAIQuestioning.ts` while `AISettingsModal.tsx` hardcodes the same string. DRY violation — updating one will silently break the other.
- **Fix:** Centralize in `STORAGE_KEYS` constant (see DEAD-008). Remove local `QUESTIONING_STORAGE_KEY` definition from `useAIQuestioning.ts`. This finding overlaps with DEAD-008 and should be resolved together.

#### [SMELL-011] Error Handling — Swallowed Errors Without User Feedback (Priority: P3)

- **Files:** `src/lib/telemetry.ts:148,155,266,272` · `src/lib/ai-health.ts:63`
- **Issue:** Network errors in `scheduleFlush()` and `shutdownTelemetry()` are caught with only `.catch(console.warn)`. While silent failure for telemetry is acceptable, the project lacks a documented error severity policy — some catches use `console.error` (screenshots, fileSystem), implying an undocumented hierarchy.
- **Fix:** Document the intentional silent-failure policy for telemetry in a code comment. Standardize: `console.error` for user-visible failures, `console.warn` for best-effort background operations.

#### [SMELL-012] Performance — KanbanCard and ListView Render Without React.memo (Priority: P3)

- **Files:** `src/components/kanban/KanbanCard.tsx` · `src/components/list/ListView.tsx`
- **Issue:** `KanbanCard` is a pure display component that receives stable props but is not wrapped in `React.memo`. All cards re-render on any item change (parent `KanbanBoard` passes an updated `items` array reference). On boards with 100+ items, every drag-drop triggers full re-renders of all cards.
- **Fix:** Wrap `KanbanCard` in `React.memo`. Ensure `onUpdate` callbacks in `ProjectWorkspace` are stabilized with `useCallback` (most already are). Apply the same to `ListView` row components.

#### [SMELL-013] Performance — Missing Virtualization for Large Lists (Priority: P3)

- **Files:** `src/components/list/ListView.tsx` · `src/components/kanban/KanbanBoard.tsx`
- **Issue:** Both views render all items into the DOM without windowing. A backlog with 500+ items renders 500 DOM nodes simultaneously, causing initial render lag, scroll degradation, and memory pressure.
- **Fix:** Integrate `@tanstack/react-virtual` (already installed as a dependency) for `ListView`. KanbanBoard columns are secondary priority.

#### [DEAD-001] Dead Code — Duplicate tauri-bridge Imports in ConsentDialog (Priority: P3)

- **File:** `src/components/consent/ConsentDialog.tsx:12-13`
- **Issue:** Two separate import statements from the same `'../../lib/tauri-bridge'` module: one for `isTauri`, one for `openExternalUrl`. Stale split import from a refactor.
- **Fix:** Merge into single import: `import { isTauri, openExternalUrl } from '../../lib/tauri-bridge';`

#### [DEAD-002] Dead Code — Unused Exports in ai-telemetry.ts (Priority: P3)

- **File:** `src/lib/ai-telemetry.ts:209,227`
- **Symbols:** `clearTelemetry`, `getRecentTelemetry`
- **Issue:** Both functions are exported but never imported by any file in the codebase. Likely added for debugging and never wired to production code or tests.
- **Fix:** Remove both functions, or keep unexported with `@internal` JSDoc annotation if test use is planned.

#### [DEAD-003] Dead Code — Unused Exports in ai-provider-registry.ts (Priority: P3)

- **File:** `src/lib/ai-provider-registry.ts:144,163`
- **Symbols:** `getBuiltInProvider`, `getDefaultModelForProvider`
- **Issue:** Both are exported but never imported by any file. `getDefaultModelForProvider` is superseded by `resolveModelForProvider` in `ai.ts`. `getBuiltInProvider` throws on invalid IDs — potentially dangerous if called externally.
- **Fix:** Delete both. `resolveModelForProvider` provides the same capability with a 3-tier fallback.

#### [DEAD-004] Dead Code — Unused `shutdownTelemetry` Export (Priority: P3)

- **File:** `src/lib/telemetry.ts:252`
- **Symbol:** `shutdownTelemetry`
- **Issue:** Exported but never called. STATE.md documents it as a known pending item: "shutdownTelemetry() not wired to app-quit event handler." Until wired to `tauri:quit-requested` or `window.beforeunload`, it is dead code that cannot deliver its semantics.
- **Fix:** Wire to app-quit event in `App.tsx` (preferred), or remove and rely on Rust WAL persistence for event durability.

#### [DEAD-005] Dead Code — Unused `DynamicBadge` Export (Priority: P3)

- **Files:** `src/components/ui/Badge.tsx:124` · `src/components/ui/index.ts:52`
- **Symbol:** `DynamicBadge`
- **Issue:** Exported from `Badge.tsx` and re-exported from the UI barrel, but never used in production code. Production code uses `ItemBadge` from `shared/ItemBadge.tsx` for dynamic type-colored badges. `DynamicBadge` only appears in a test file.
- **Fix:** Remove from `ui/index.ts` barrel export. If needed for tests, import directly from `Badge.tsx` in the test file.

#### [DEAD-006] Dead Code — Orphaned `MaintenanceModal` Component (Priority: P3)

- **File:** `src/components/settings/MaintenanceModal.tsx:27`
- **Symbol:** `MaintenanceModal`
- **Issue:** Exported but never imported. `AppSettingsModal.tsx` (the logical parent) does not reference it. STATE.md notes: "SettingsModal maintenance feature temporarily disabled (needs redesign for ProjectWorkspace architecture)." Keeps `analyzeBacklogFormat` + `correctBacklogFormat` in the bundle unnecessarily.
- **Fix:** Product decision required: either re-integrate into `AppSettingsModal` or move to a feature branch and remove from master. Removing eliminates two AI functions from the production bundle.

#### [DEAD-007] Dead Code — Unused `getProjectAIConfigKey` in constants/storage.ts (Priority: P3)

- **File:** `src/constants/storage.ts:103`
- **Symbol:** `getProjectAIConfigKey`
- **Issue:** Defined and exported but not imported by any module. Project-level AI config was removed in v2.1 (decision: global settings only). The function's callers were deleted but the function itself was retained.
- **Fix:** Delete the function. `getContextFilesKey` (used by `ai-context.ts`) is distinct and should be retained.

#### [DEAD-009] Dead Code — Local Icon Re-Definitions in WelcomePage.tsx (Priority: P3)

- **File:** `src/components/welcome/WelcomePage.tsx:366-393`
- **Symbols:** Local `LogoIcon`, `FolderOpenIcon`, `SpinnerIcon` function definitions
- **Issue:** Three private icon functions are defined locally, duplicating icons already exported from `src/components/ui/Icons.tsx`. Violates CLAUDE.md "JAMAIS inline" icon rule. If the canonical icons in `Icons.tsx` are updated, `WelcomePage.tsx` will silently diverge.
- **Fix:** Remove local definitions and import from `'../ui/Icons'`.

#### [DEAD-010] Dead Code — Unused `_projectPath` Parameter at 16+ Call Sites (Priority: P3)

- **File:** `src/lib/ai.ts:263` (definition) + 16 call sites across `ai-bulk.ts`, `ai-chat.ts`, `ai-dependencies.ts`, `ai-questioning.ts`, `useAIFeedback.ts`, `BulkImportWizard.tsx`
- **Symbol:** `_projectPath?: string` parameter of `getEffectiveAIConfig`
- **Issue:** Parameter is explicitly documented as "Ignored — kept for backward compatibility." All 16+ callers pass a `projectPath` value that is silently discarded. Misleads readers into thinking path-based config is supported.
- **Fix:** Remove the parameter from `getEffectiveAIConfig`. Update all 16+ call sites to remove the argument. Coordinated refactor across 7 files.

#### [DEAD-011] Dead Code — Unguarded `console.log` in Production ai-context.ts (Priority: P3)

- **File:** `src/lib/ai-context.ts:387,491`
- **Issue:** Two `console.log` statements in the context loading code path fire on every AI operation, polluting the console in production builds. Not guarded by `import.meta.env.DEV`.
- **Fix:** Remove or guard with `if (import.meta.env.DEV)`.

#### [SEC-D2] Security — ph_send_batch IPC Accepts Arbitrary api_key from Webview (Priority: P3)

- **File:** `src-tauri/src/telemetry.rs:96-99`
- **Issue:** The `ph_send_batch` Tauri command accepts `api_key: String` from the frontend without validating it against the compiled-in `POSTHOG_API_KEY` constant. A malicious script in the webview could invoke the command with an arbitrary PostHog key to exfiltrate telemetry data to a third-party project. Risk is low because Tauri CSP prevents external script injection from loading third-party code.
- **Fix:** Document as accepted risk in `SECURITY.md`. Optional hardening: validate `api_key == env!("VITE_POSTHOG_KEY")` in Rust before forwarding events.

#### [SEC-D8] Security — CI Actions Tag-Pinned, Not SHA-Pinned (Priority: P3)

- **File:** `.github/workflows/ci.yml:14-28`
- **Issue:** `actions/checkout@v4`, `pnpm/action-setup@v2`, `actions/setup-node@v4` use mutable tag references. A compromised tag could execute malicious code in CI. Minor supply chain risk; relevant for SLSA Level 3+ compliance.
- **Fix:** Pin to commit SHAs, e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af68 # v4`. Low urgency for a personal OSS project.

#### [SMELL-014] Performance — Static Object Recreation on Every Render in ProviderCard (Priority: P3)

- **File:** `src/components/settings/ProviderCard.tsx:53-57`
- **Issue:** `colors` object and `providerUrls` record are defined inline in the component function body, recreated on every render. Both are static constants (not derived from props).
- **Fix:** Move both outside the component function as module-level constants, or use `useMemo` if the values must be computed from props.

#### [SMELL-015] Architecture — Inline SVG in ProviderCard Tooltip Icon (Priority: P3)

- **File:** `src/components/settings/ProviderCard.tsx:158-163`
- **Issue:** Info icon rendered as inline SVG `<svg>...<text>i</text>...</svg>`, violating the CLAUDE.md "JAMAIS inline" icon rule. The `InfoIcon` is already available in `Icons.tsx` and imported by `AISettingsModal.tsx` in the same feature area. The inline `<text>` element has inconsistent font rendering across browsers.
- **Fix:** Replace with `<InfoIcon className="w-3.5 h-3.5 text-blue-500 cursor-help" />`.

---

### P4 — Low

#### [SMELL-016] Maintainability — Magic Number `200` in Telemetry Error Capture (Priority: P4)

- **File:** `src/lib/telemetry.ts:214,216`
- **Issue:** The literal `200` appears three times as a character truncation limit for error messages. This is a product decision (privacy/PII limit per PRIVACY.md) but is expressed as an unnamed constant. If the limit needs adjustment, three sites must be updated.
- **Fix:** Extract: `const MAX_ERROR_MESSAGE_CHARS = 200; // Privacy: limit message capture per PRIVACY.md`

#### [SMELL-017] Maintainability — Complex Boolean in Consent Logic (Priority: P4)

- **File:** `src/lib/telemetry.ts:103-105`
- **Issue:** `shouldPromptConsent()` returns `getDismissCount() <= 1` — the `<= 1` threshold (show after 0 or 1 dismissals, hide after 2+) is not immediately obvious to a new reader. Off-by-one risk during future maintenance.
- **Fix:** Extract named intermediate: `const hasBeenDismissedTooManyTimes = getDismissCount() > 1; return !hasBeenDismissedTooManyTimes;`

#### [SMELL-018] Maintainability — 16 Call Sites Pass Silently-Ignored Argument (Priority: P4)

- **Files:** All callers of `getEffectiveAIConfig` across `ai.ts`, `ai-bulk.ts`, `ai-chat.ts`, `ai-dependencies.ts`, `ai-questioning.ts`, `useAIFeedback.ts`, `BulkImportWizard.tsx`
- **Issue:** The function signature `getEffectiveAIConfig(_projectPath?: string)` marks the parameter as intentionally ignored, yet all 16+ call sites still pass `options?.projectPath`. Misleads readers into thinking path-based config is active.
- **Fix:** Aligned with DEAD-010 — remove the parameter and clean up all call sites in a single coordinated PR.

#### [SEC-D10] Security — `devtools: true` Always Enabled (Priority: P4)

- **File:** `src-tauri/tauri.conf.json:24`
- **Issue:** DevTools are enabled unconditionally in all build modes, allowing any user to inspect localStorage where XOR-obfuscated API keys are stored. Pre-existing from v2.0, not a new regression. Acceptable for a local BYOK desktop app where the user controls their own machine.
- **Fix:** Consider disabling in production via `#[cfg(not(dev))]` conditional or a Tauri build-time flag. Document as accepted risk in `SECURITY.md` if left enabled.

#### [DEP-002] Dependency — 2 Moderate npm Vulnerabilities (Dev-Only) (Priority: P4)

- **Packages:** `esbuild 0.21.5` (GHSA-67mh-4wv8-2f99, known exception, documented in SECURITY.md) · `ajv <8.18.0` (GHSA-2g4f-4pwh-qvx6, ReDoS, NEW — transitive via `eslint`)
- **Issue:** Both are moderate-severity vulnerabilities in development-only dependencies (`devDependencies`). Neither affects production builds or end users. The new `ajv` ReDoS only triggers via the `$data` option which eslint does not use.
- **Fix:** No immediate action required. `ajv` will auto-resolve when eslint upgrades its internal dependency. Monitor `pnpm audit` in future maintenance sprints.

#### [DEP-003] Dependency — 25 Outdated npm Packages (Priority: P4)

- **Packages:** 10 patch updates (safe), 10 minor updates (review recommended), 5 major updates (breaking — eslint v10, jsdom v28, react-dropzone v15, @types/node v25, globals v17)
- **Issue:** All patch updates are safe to apply. Minor updates require brief review. Major updates for eslint v10 and react-dropzone v15 likely include breaking changes requiring code changes.
- **Fix:** Apply all patch updates in a maintenance window (1 hr). Review and apply minor updates (2 hrs). Defer major updates to next milestone sprint (4+ hrs for eslint config migration + react-dropzone API changes).

#### [DEP-004] Dependency — Tauri Ecosystem Minor Updates Available (Priority: P4)

- **Packages:** `tauri 2.9.5→2.10.x` · `tauri-plugin-updater 2.9.0→2.10.0` · `tauri-plugin-dialog 2.4.2→2.6.0` · `tauri-plugin-fs 2.4.4→2.4.5`
- **Issue:** Minor updates available for core Tauri packages. Tauri ecosystem updates should be coordinated (Rust Cargo.toml + npm package.json together) to avoid version mismatches.
- **Fix:** Coordinate Tauri ecosystem update in a dedicated maintenance PR: update both Cargo.toml and package.json simultaneously, run `pnpm tauri build` to verify binary builds cleanly.

---

## Findings by Category

### Security (OWASP Delta Review)

Delta review of all v2.1 and v2.2 changes against the v2.0 Phase 18 baseline. Full methodology: OWASP Desktop Top 10 (2021).

| Category | Status | Key New Surface | Finding |
|----------|--------|-----------------|---------|
| D1 Injection | PASS | telemetry.rs SQLite (parameterized `?`) | None |
| D2 Authentication | NEEDS ATTENTION | ph_send_batch accepts arbitrary api_key | [SEC-D2] P3 — document/optional Rust validation |
| D3 Data Storage | PASS | telemetry.db (no PII), crypto.randomUUID device ID | None |
| D4 Communication | PASS | PostHog HTTPS endpoints added to CSP | None |
| D5 Cryptography | PASS | crypto.randomUUID() for device ID | None |
| D6 Authorization | PASS | ph_send_batch IPC (standard Tauri model) | None |
| D7 Code Quality | PASS | Zod validation on all v2.1/v2.2 user inputs | None |
| D8 Code Tampering | NEEDS ATTENTION | CI actions tag-pinned, not SHA-pinned | [SEC-D8] P3 — SHA-pin ci.yml actions |
| D9 Reverse Engineering | PASS | PostHog key in bundle (by design, write-only key) | None |
| D10 Extraneous | PASS | devtools: true always enabled (pre-existing v2.0) | [SEC-D10] P4 — accepted risk or conditionally disable |

**Result:** No new FAIL categories. v2.1 and v2.2 maintained the v2.0 security baseline.

---

### Dead Code

11 findings across unused exports, stale imports, and unreachable code.

| ID | Description | File | Priority |
|----|-------------|------|----------|
| DEAD-001 | Duplicate tauri-bridge imports | ConsentDialog.tsx:12-13 | P3 |
| DEAD-002 | `clearTelemetry`, `getRecentTelemetry` unused | ai-telemetry.ts:209,227 | P3 |
| DEAD-003 | `getBuiltInProvider`, `getDefaultModelForProvider` unused | ai-provider-registry.ts:144,163 | P3 |
| DEAD-004 | `shutdownTelemetry` not wired to app-quit | telemetry.ts:252 | P3 |
| DEAD-005 | `DynamicBadge` not used in production | Badge.tsx:124, ui/index.ts:52 | P3 |
| DEAD-006 | `MaintenanceModal` orphaned — unreachable from UI | settings/MaintenanceModal.tsx:27 | P3 |
| DEAD-007 | `getProjectAIConfigKey` not imported by any file | constants/storage.ts:103 | P3 |
| DEAD-008 | `ticketflow-questioning-mode` and `ticketflow-locale` missing from STORAGE_KEYS | AISettingsModal, ProjectWorkspace, OnboardingWizard | P2 |
| DEAD-009 | Local icon re-definitions duplicate Icons.tsx | WelcomePage.tsx:366-393 | P3 |
| DEAD-010 | `_projectPath` unused parameter at 16+ call sites | ai.ts:263 + 6 callers | P3 |
| DEAD-011 | Unguarded `console.log` in production ai-context.ts | ai-context.ts:387,491 | P3 |

**Highest density files:** `src/lib/ai.ts` (DEAD-010, DEAD-011 adjacent), `src/lib/telemetry.ts` (DEAD-004, DEAD-011 pattern), `src/constants/storage.ts` (DEAD-007, DEAD-008).

---

### Anti-Patterns & Code Smells

18 findings across type safety, React patterns, architecture, performance, error handling, and maintainability.

**Type Safety (3 findings — P2):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-001 | `as any` casts in provider selection | AISettingsModal.tsx:61-62 | P2 |
| SMELL-002 | `ticket: any` defeats Zod validation | ai-bulk.ts:670 | P2 |
| SMELL-003 | Non-exhaustive provider color lookup | ProviderCard.tsx:53-57 | P2 |

**React Patterns (2 findings — P2/P3):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-004 | Missing `chatPanel` in useEffect deps | ProjectWorkspace.tsx:173-177 | P2 |
| SMELL-005 | Missing deps in TypeConfig sync effect | ProjectWorkspace.tsx:208-236 | P3 |

**Architecture (5 findings — P3):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-006 | God file: ai.ts at 2,229 lines | src/lib/ai.ts | P3 |
| SMELL-007 | God file: ProjectWorkspace.tsx at 1,569 lines | ProjectWorkspace.tsx | P3 |
| SMELL-008 | Business logic (DB query) in UI component | AISettingsModal.tsx:36-45 | P3 |
| SMELL-009 | Duplicated storage key constant | useAIQuestioning.ts + AISettingsModal.tsx | P3 |
| SMELL-015 | Inline SVG violates icon centralization rule | ProviderCard.tsx:158-163 | P3 |

**Error Handling (2 findings — P2/P3):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-010 | `initTelemetry()` not idempotent → duplicate PostHog events | telemetry.ts:242-245 | P2 |
| SMELL-011 | Swallowed errors, undocumented severity policy | telemetry.ts, ai-health.ts | P3 |

**Performance (3 findings — P3):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-012 | KanbanCard/ListView without React.memo | KanbanCard.tsx, ListView.tsx | P3 |
| SMELL-013 | No list virtualization for large backlogs | ListView.tsx, KanbanBoard.tsx | P3 |
| SMELL-014 | Static objects recreated on every render | ProviderCard.tsx:53-57 | P3 |

**Maintainability (3 findings — P4):**

| ID | Issue | File | Priority |
|----|-------|------|----------|
| SMELL-016 | Magic number `200` for error message truncation | telemetry.ts:214,216 | P4 |
| SMELL-017 | Complex boolean in consent logic | telemetry.ts:103-105 | P4 |
| SMELL-018 | 16 call sites pass silently-ignored argument | Multiple callers of getEffectiveAIConfig | P4 |

---

### Dependencies

| Subcategory | Count | Status |
|-------------|-------|--------|
| npm vulnerabilities | 2 (moderate) | Both dev-only, zero production impact |
| Cargo vulnerabilities | 4 (3 high, 1 moderate) | All transitive, low desktop risk |
| Cargo unmaintained warnings | 18 | All Linux-only or build-time |
| Outdated npm packages | 25 | 10 patch (safe), 10 minor (review), 5 major (breaking) |
| Outdated Cargo packages | ~3 minor | Tauri ecosystem — coordinate update |
| License issues | 0 | 100% MIT-compatible (MIT + Apache-2.0) |

Full details: see `.planning/phases/31-code-audit-security-review/31-02-security-dependencies.md`

---

## Recommended Actions

### Immediate (Before v2.2.1 Release)

These items carry actual correctness or security risk and should be resolved before tagging v2.2.1:

1. **[SMELL-010] Fix `initTelemetry()` idempotency bug** — P2 High
   - Add `let errorTrackingSetUp = false` module-level guard in `telemetry.ts`
   - Prevents duplicate `window.addEventListener` → duplicate PostHog error event tracking
   - Estimated effort: 15 minutes

2. **[SMELL-001] Fix `as any` casts in AISettingsModal provider selection** — P2 High
   - Add proper type guard before `setProvider()` call
   - Prevents runtime crash if custom provider ID reaches the built-in state setter
   - Estimated effort: 20 minutes

3. **[SMELL-002] Fix `ticket: any` in ai-bulk.ts Zod mapping** — P2 High
   - Replace `(ticket: any)` with proper Zod-inferred type
   - Restores type safety for AI-generated backlog item mapping
   - Estimated effort: 10 minutes

4. **[DEAD-008] + [SMELL-009] Centralize storage keys in STORAGE_KEYS** — P2 High
   - Add `QUESTIONING_MODE` and `LOCALE` to `src/constants/storage.ts`
   - Update 4 files; remove duplicate `QUESTIONING_STORAGE_KEY` local definition
   - Prevents storage key drift between `useAIQuestioning` and `AISettingsModal`
   - Estimated effort: 30 minutes

**Total immediate effort:** ~75 minutes

### Next Sprint

Address these in a focused quality PR after v2.2.1 release:

5. **[DEAD-001, DEAD-009, DEAD-011] Easy dead code cleanup** — P3 Medium
   - Merge duplicate import in ConsentDialog (5 min)
   - Replace local icons in WelcomePage with imports from Icons.tsx (15 min)
   - Remove/guard console.log in ai-context.ts (5 min)

6. **[DEAD-002, DEAD-003, DEAD-005, DEAD-007] Remove unused exports** — P3 Medium
   - Delete `clearTelemetry`, `getRecentTelemetry` from ai-telemetry.ts
   - Delete `getBuiltInProvider`, `getDefaultModelForProvider` from ai-provider-registry.ts
   - Remove `DynamicBadge` from ui/index.ts barrel
   - Delete `getProjectAIConfigKey` from constants/storage.ts
   - Estimated combined effort: 30 minutes (with build verification)

7. **[DEAD-010] + [SMELL-018] Remove `_projectPath` parameter from `getEffectiveAIConfig`** — P3 Medium
   - Coordinated refactor across 7 files, 16+ call sites
   - Estimated effort: 45 minutes (bulk sed + build verification)

8. **[SMELL-015] Replace inline SVG with InfoIcon** — P3 Medium
   - One-line fix in ProviderCard.tsx
   - Estimated effort: 5 minutes

9. **[SMELL-004] Fix missing chatPanel dependency in useEffect** — P2 High
   - Add `useCallback` to `useChatPanel.loadHistory`, update dependency array
   - Estimated effort: 20 minutes

10. **[DEAD-004] Wire or remove `shutdownTelemetry`** — P3 Medium
    - Wire to `tauri:quit-requested` event in App.tsx or lib.rs, or remove with comment explaining Rust WAL persistence
    - Estimated effort: 20 minutes

11. **[SEC-D8] SHA-pin CI actions** — P3 Medium
    - Update `.github/workflows/ci.yml` to use commit SHA refs
    - Estimated effort: 20 minutes

12. **[DEP-003] Apply 10 npm patch updates** — P4 Low
    - `pnpm update` for patch-level packages, verify build passes
    - Estimated effort: 30 minutes

### Backlog (Next Milestone Planning)

Items requiring architectural planning or significant development time:

13. **[SMELL-006] Split `ai.ts` god file** — P3 Medium
    - Extract `ai-client.ts`, `ai-config.ts`, `ai-maintenance.ts`
    - Requires coordinated update of all import sites
    - Estimated effort: 3-4 hours

14. **[SMELL-007] Extract custom hooks from `ProjectWorkspace.tsx`** — P3 Medium
    - `useWorkspaceBulkOps`, `useWorkspaceTypeSync`, `useWorkspaceItemActions`, `useWorkspaceModals`
    - Risk: high-traffic file — requires careful testing
    - Estimated effort: 4-6 hours

15. **[DEAD-006] Decide fate of `MaintenanceModal`** — P3 Medium
    - Product decision: re-enable feature or remove component + AI functions from bundle
    - If removed: eliminates `analyzeBacklogFormat` + `correctBacklogFormat` from ai.ts

16. **[SMELL-012] Add React.memo to KanbanCard and ListView** — P3 Medium
    - Verify `useCallback` stability of all passed handlers first
    - Estimated effort: 1-2 hours with testing

17. **[SMELL-013] Add virtualization to ListView** — P3 Medium
    - Integrate `@tanstack/react-virtual` (already installed)
    - Estimated effort: 2-3 hours

18. **[SMELL-003] Type-safe ProviderCard provider lookup** — P2 High
    - Low urgency (built-in only context), but correct fix is type-safe Map
    - Estimated effort: 30 minutes

19. **[DEP-003] Major npm updates** — P4 Low
    - eslint v10, jsdom v28, react-dropzone v15, @types/node v25, globals v17
    - Estimated effort: 4+ hours for migration and testing

20. **[DEP-004] Tauri ecosystem update** — P4 Low
    - Coordinate Cargo.toml + package.json update to Tauri 2.10.x
    - Estimated effort: 1-2 hours with build verification

---

## Methodology

- **Dead code:** Manual grep-based export/import analysis using Grep/Glob tools across all src/ files. Verified each exported symbol has no corresponding import in other files.
- **Anti-patterns:** Manual code review of all TypeScript/TSX files modified or added in v2.1 (Phases 22-25) and v2.2 (Phases 26-29), checked against React/TypeScript best practices and project CLAUDE.md conventions.
- **Security:** OWASP Desktop Top 10 (2021) delta review — compared new code surfaces in v2.1/v2.2 against the clean v2.0 baseline established in Phase 18. Documented evidence for each category.
- **Dependencies:** `pnpm audit` output (2026-02-18), `cargo-audit 0.22.1` against 922 advisories and 635 crate dependencies, `npx license-checker --production --summary` for 29 production packages, manual comparison of Cargo.toml against crates.io for direct Tauri dependencies.
- **Scope:** All `.ts`/`.tsx` files added or modified in Phases 22-29. Rust files: `telemetry.rs`, `lib.rs`. Configuration files: `tauri.conf.json`, `ci.yml`.
- **Limitations:** Static analysis only — no dynamic analysis, fuzzing, or penetration testing performed. God file metrics are line count approximations from file read boundaries. Cargo outdated check was manual (cargo-outdated not installed).

---

## Files with Highest Finding Density

| File | Findings | IDs |
|------|----------|-----|
| `src/lib/ai.ts` | 3 | DEAD-010, SMELL-006, SMELL-018 |
| `src/components/workspace/ProjectWorkspace.tsx` | 4 | DEAD-008, SMELL-004, SMELL-005, SMELL-007 |
| `src/lib/telemetry.ts` | 5 | DEAD-004, SMELL-010, SMELL-011, SMELL-016, SMELL-017 |
| `src/components/settings/AISettingsModal.tsx` | 4 | DEAD-008, SMELL-001, SMELL-008, SMELL-009 |
| `src/components/settings/ProviderCard.tsx` | 3 | SMELL-003, SMELL-014, SMELL-015 |
| `src/lib/ai-telemetry.ts` | 1 | DEAD-002 |
| `src/lib/ai-provider-registry.ts` | 1 | DEAD-003 |

---

*Report generated: 2026-02-18*
*Covers: v2.1 (Phases 22-25) + v2.2 (Phases 26-29)*
*Source reports: 31-01-dead-code-antipatterns.md · 31-02-security-dependencies.md*
*All 29 source findings (11 DEAD + 18 SMELL) consolidated. 6 security/dependency findings added from 31-02. Total: 44 findings.*
