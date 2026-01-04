# TICKETFLOW System Audit Report

> **Audit Date:** 2026-01-03
> **Version Audited:** 1.0.0
> **Auditor:** Gemini Codex / ARIA

---

## Executive Summary

This comprehensive audit covers the TICKETFLOW codebase, a React/TypeScript/Tauri application for product backlog management with AI integration (Groq/Gemini). The audit examined logic consistency, imports, variable definitions, security boundaries, authentication safety, error handling, test coverage, UX patterns, and hardcoded/mock values.

**Overall Assessment:** The codebase is well-structured with good architectural patterns, but has critical gaps in security (API key storage), test coverage, and error handling that require attention before production deployment.

---

## 1. Findings by Severity

### 🔴 P0 - Critical (Immediate Action Required)

#### P0-001: API Keys Stored in localStorage (Plaintext)
- **File:** `src/lib/ai.ts` (lines 36-43)
- **Issue:** API keys for Groq and Gemini are stored in browser's `localStorage` without encryption. localStorage is accessible via JavaScript and vulnerable to XSS attacks.
- **Impact:** API key theft, unauthorized API usage, potential cost exposure.
- **Evidence:**
  ```typescript
  export function setApiKey(key: string, provider?: AIProvider): void {
    const p = provider || getProvider();
    localStorage.setItem(p === 'groq' ? STORAGE_KEYS.GROQ_API_KEY : STORAGE_KEYS.GEMINI_API_KEY, key);
  }
  ```

#### P0-002: No Input Sanitization on AI Prompts
- **File:** `src/lib/ai.ts` (lines 166-184, 308)
- **Issue:** User-provided descriptions are directly interpolated into AI prompts without sanitization, enabling potential prompt injection.
- **Impact:** Manipulated AI responses, potential data exfiltration via crafted prompts.
- **Evidence:**
  ```typescript
  const prompt = GENERATE_ITEM_PROMPT.replace('{user_description}', description);
  ```

#### P0-003: File Path Traversal Potential
- **File:** `src/lib/tauri-bridge.ts` (lines 72-82)
- **Issue:** File paths passed to `readTextFileContents` and `writeTextFileContents` are not validated or sanitized.
- **Impact:** Potential access to files outside intended directories.
- **Evidence:** No path validation before file operations.

---

### 🟠 P1 - High Priority (Address This Sprint)

#### P1-001: Missing Error Boundaries in React Components
- **File:** `src/App.tsx`
- **Issue:** No React Error Boundaries wrapping critical components. Unhandled errors can crash the entire app.
- **Impact:** Poor UX on unexpected errors, potential data loss.

#### P1-002: `window.confirm` Used for Critical Actions
- **File:** `src/App.tsx` (lines 283, 356)
- **Issue:** Native `window.confirm` used for AI suggestions and archive confirmation. Inconsistent with custom modal pattern used elsewhere.
- **Impact:** Inconsistent UX, potential blocking issues in some environments.
- **Evidence:**
  ```typescript
  if (window.confirm('Appliquer les suggestions de Gemini ?')) {
  ```

#### P1-003: Insufficient Test Coverage
- **File:** `src/__tests__/persistence.test.ts`
- **Issue:** Only 1 test file (20 tests) covering parser/serializer. No tests for:
  - AI integration (`ai.ts`)
  - File system operations (`fileSystem.ts`, `tauri-bridge.ts`)
  - React hooks (`useBacklog.ts`, `useFileAccess.ts`, etc.)
  - React components (0 coverage)
  - Error handling paths
- **Impact:** Regressions undetected, low confidence in changes.

#### P1-004: Race Condition in Type Config Initialization
- **File:** `src/App.tsx` (lines 196, 213, 298)
- **Issue:** `setTimeout(() => backlog.syncToc(), 0)` used to work around race condition. This is fragile and may fail under certain conditions.
- **Impact:** TOC desynchronization, inconsistent state.
- **Evidence:**
  ```typescript
  backlog.loadFromMarkdown(content);
  setTimeout(() => backlog.syncToc(), 0);
  ```

#### P1-005: Hardcoded AI Model Names
- **File:** `src/constants/config.ts` (lines 28-29)
- **Issue:** AI model names hardcoded. When models are deprecated, app will break.
- **Impact:** App breakage when Groq/Gemini deprecate model versions.
- **Evidence:**
  ```typescript
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  GEMINI_MODEL: 'gemini-2.0-flash',
  ```

#### P1-006: Missing Zod Runtime Validation on AI Responses
- **File:** `src/lib/ai.ts` (lines 193, 316, 381)
- **Issue:** AI JSON responses parsed with `JSON.parse()` without Zod schema validation. Malformed responses could cause runtime errors.
- **Impact:** Runtime crashes from unexpected AI output format.
- **Evidence:**
  ```typescript
  const parsed = JSON.parse(jsonMatch[0]);
  return { success: true, item: { title: parsed.title, ... } };
  ```

#### P1-007: Console.warn Left in Production Code
- **File:** `src/lib/parser.ts` (line 519)
- **Issue:** `console.warn` for duplicate ID detection left in codebase.
- **Impact:** Console pollution in production, potential information leak.
- **Evidence:**
  ```typescript
  console.warn(`[Parser] Duplicate IDs detected and removed: ${duplicates.join(', ')}`);
  ```

---

### 🟡 P2 - Medium Priority (Address Next Sprint)

#### P2-001: Inconsistent Error Handling Patterns
- **Files:** Various
- **Issue:** Mix of `try/catch`, `alert()`, `console.error()`, and state-based error handling.
- **Impact:** Inconsistent user feedback, debugging difficulty.

#### P2-002: Missing Loading States in Some Operations
- **File:** `src/hooks/useBacklog.ts`
- **Issue:** `addItem`, `deleteItem`, `updateItemById` don't show loading states during modifications.
- **Impact:** User may click multiple times, causing duplicate operations.

#### P2-003: TypeScript `@ts-expect-error` Suppressions
- **File:** `src/lib/fileSystem.ts` (lines 101-103, 242-248)
- **Issue:** Multiple `@ts-expect-error` comments for File System Access API permissions.
- **Impact:** Loss of type safety, potential runtime errors if API changes.
- **Evidence:**
  ```typescript
  // @ts-expect-error - queryPermission is not in types yet
  if ((await handle.queryPermission(options)) !== 'granted') {
  ```

#### P2-004: Browser Compatibility Check Only at App Load
- **File:** `src/App.tsx` (lines 484-505)
- **Issue:** Browser compatibility check (`isFileSystemAccessSupported`) shows static error. Users may not understand the issue.
- **Impact:** Confusion for Safari/Firefox users.

#### P2-005: Magic Numbers in UI Code
- **File:** `src/constants/config.ts`
- **Issue:** UI timing values without descriptive context (e.g., `AUTOSAVE_DEBOUNCE: 2000`).
- **Impact:** Maintenance difficulty, confusion about appropriate values.

#### P2-006: Empty Catch Blocks Swallowing Errors
- **File:** `src/lib/fileSystem.ts` (lines 210, 231)
- **Issue:** Empty catch blocks in `getStoredHandle` and `clearStoredHandle`.
- **Impact:** Silent failures, difficult debugging.
- **Evidence:**
  ```typescript
  } catch {
    return null;
  }
  ```

#### P2-007: Unused Import Pattern
- **File:** `src/types/backlog.ts` (line 1)
- **Issue:** `z` import from 'zod' imports entire library. Could use tree-shaking friendly imports.
- **Impact:** Slightly larger bundle size.

#### P2-008: Accessibility (a11y) Gaps
- **File:** `src/App.tsx` (WelcomeScreen component)
- **Issue:** SVG icons lack `aria-label` and `role` attributes. Interactive elements may not be keyboard accessible.
- **Impact:** Poor screen reader support, accessibility compliance issues.

#### P2-009: Potential Memory Leak in Event Listener
- **File:** `src/lib/tauri-bridge.ts` (setupExternalLinkHandler)
- **Issue:** Click event listener added without cleanup mechanism.
- **Impact:** Memory leak if function called multiple times.
- **Evidence:**
  ```typescript
  document.addEventListener('click', (e) => { ... });
  ```

#### P2-010: Duplicate Code in rawMarkdown Generation
- **Files:** `src/App.tsx` (`generateRawMarkdown`), `src/lib/serializer.ts` (`rebuildItemMarkdown`)
- **Issue:** Nearly identical code for generating item markdown in two places.
- **Impact:** Maintenance burden, potential divergence.

---

## 2. Root Causes

| Root Cause | Affected Areas | Findings |
|------------|----------------|----------|
| **Security not prioritized** | API key storage, input validation | P0-001, P0-002, P0-003 |
| **Insufficient testing culture** | All modules | P1-003 |
| **Rapid prototyping** | Error handling, workarounds | P1-001, P1-004, P2-001, P2-006 |
| **Browser API immaturity** | File System Access API | P2-003 |
| **UI/code duplication** | Markdown generation | P2-010 |
| **Missing accessibility review** | UI components | P2-008 |

---

## 3. Fix Plan (Prioritized Order)

### Phase 1: Critical Security (Week 1)

| Priority | Task | Effort | Owner |
|----------|------|--------|-------|
| 1 | **Encrypt API keys** - Use `@tauri-apps/plugin-keychain` for secure storage in Tauri, or session-only storage for web | M | Backend |
| 2 | **Add input sanitization** - Create utility to sanitize user inputs before AI prompt interpolation | S | Backend |
| 3 | **Add path validation** - Whitelist allowed directories for file operations | S | Backend |

### Phase 2: Error Handling & Stability (Week 2)

| Priority | Task | Effort | Owner |
|----------|------|--------|-------|
| 4 | **Add React Error Boundaries** - Wrap major UI sections with error boundaries | S | Frontend |
| 5 | **Replace window.confirm** - Use custom ConfirmModal consistently | XS | Frontend |
| 6 | **Fix race condition** - Replace setTimeout with proper async/await or state synchronization | M | Frontend |
| 7 | **Add Zod validation for AI responses** - Create schemas for AI response parsing | S | Backend |

### Phase 3: Test Coverage (Week 3-4)

| Priority | Task | Effort | Owner |
|----------|------|--------|-------|
| 8 | **Add AI module tests** - Mock API calls, test error paths | M | Testing |
| 9 | **Add hook tests** - Test useBacklog, useFileAccess with vitest | L | Testing |
| 10 | **Add component tests** - Test critical UI components | L | Testing |
| 11 | **Add E2E tests** - Critical user flows with Playwright | L | Testing |

### Phase 4: Polish (Sprint 2)

| Priority | Task | Effort | Owner |
|----------|------|--------|-------|
| 12 | Remove console.warn from parser.ts | XS | Backend |
| 13 | Standardize error handling pattern | M | All |
| 14 | Add loading states to mutations | S | Frontend |
| 15 | Replace @ts-expect-error with proper types | M | Types |
| 16 | Add TypeScript path to File System Access types | S | Types |
| 17 | Add accessibility attributes | S | Frontend |
| 18 | Extract shared markdown generation | S | Backend |
| 19 | Make AI models configurable | S | Config |

---

## 4. Regression Tests to Add

### Unit Tests

| Test File | Description | Priority |
|-----------|-------------|----------|
| `src/__tests__/ai.test.ts` | AI completion, refineItem, generateItem with mocked responses | P1 |
| `src/__tests__/ai-error.test.ts` | AI error handling: invalid API key, network errors, malformed JSON | P1 |
| `src/__tests__/fileSystem.test.ts` | IndexedDB handle storage, permission flows | P1 |
| `src/__tests__/tauri-bridge.test.ts` | Path manipulation, file operations (mocked) | P2 |
| `src/__tests__/guards.test.ts` | Type guards for BacklogItem, TableGroup, RawSection | P2 |

### Integration Tests

| Test File | Description | Priority |
|-----------|-------------|----------|
| `src/__tests__/useBacklog.integration.test.ts` | Full CRUD cycle with parser/serializer | P1 |
| `src/__tests__/useTypeConfig.integration.test.ts` | Type detection, persistence | P2 |

### E2E Tests (Playwright recommended)

| Test File | Description | Priority |
|-----------|-------------|----------|
| `e2e/file-operations.spec.ts` | Open file, edit, save, reload | P1 |
| `e2e/kanban-dnd.spec.ts` | Drag-and-drop in Kanban view | P2 |
| `e2e/ai-generation.spec.ts` | AI item generation (with mock API) | P2 |
| `e2e/welcome-page.spec.ts` | Project creation and selection | P2 |

### Existing Test Commands

```bash
# Run existing tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

---

## 5. Acceptance Checklist

### Before Production Release

- [ ] **P0-001 Fixed:** API keys not stored in plaintext localStorage
- [ ] **P0-002 Fixed:** User inputs sanitized before AI prompts
- [ ] **P0-003 Fixed:** File paths validated and sandboxed
- [ ] **P1-001 Fixed:** Error boundaries prevent full app crashes
- [ ] **P1-002 Fixed:** No native `window.confirm` dialogs
- [ ] **P1-003 Fixed:** Test coverage > 50% for critical paths
- [ ] **P1-006 Fixed:** AI responses validated with Zod schemas
- [ ] **P1-007 Fixed:** No console.log/warn in production build

### Quality Gates

- [ ] `pnpm build` passes without errors
- [ ] `pnpm test` passes all tests (100% pass rate)
- [ ] `pnpm lint` passes without warnings
- [ ] No TypeScript `any` types in new code
- [ ] All new functions have JSDoc comments
- [ ] Manual testing of file save/load round-trip
- [ ] Manual testing of AI generation (both providers)

### Security Review

- [ ] Penetration testing for XSS via AI prompts
- [ ] Review of localStorage usage (should be empty in production build)
- [ ] Verify Tauri file system scope restrictions

### Accessibility Review

- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader testing (NVDA/VoiceOver)
- [ ] Color contrast meets WCAG 2.1 AA standards

---

## Appendix: Files Audited

| Category | Files | Lines |
|----------|-------|-------|
| **Core Logic** | parser.ts, serializer.ts, ai.ts | ~1,400 |
| **Hooks** | useBacklog.ts, useFileAccess.ts, useTypeConfig.ts, useScreenshotFolder.ts, useProjects.ts | ~1,100 |
| **Types** | backlog.ts, guards.ts, typeConfig.ts, project.ts | ~400 |
| **Bridge** | fileSystem.ts, tauri-bridge.ts, screenshots.ts | ~700 |
| **Components** | App.tsx (main application) | ~833 |
| **Constants** | storage.ts, config.ts, patterns.ts, labels.ts, colors.ts | ~200 |
| **Tests** | persistence.test.ts | ~480 |
| **Total** | 25+ files | ~5,100+ lines |

---

*Report generated by automated audit system. Manual review recommended for security-critical findings.*
