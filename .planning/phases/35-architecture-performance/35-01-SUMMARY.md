---
phase: 35-architecture-performance
plan: 01
subsystem: ai
tags: [refactor, architecture, typescript, ai, modules]

# Dependency graph
requires:
  - phase: 34-dead-code-sweep
    provides: Clean codebase, dead code removed, ai.ts at 2235 lines (SMELL-006 identified)
provides:
  - ai-client.ts: SDK singletons, API key CRUD, generateCompletion, generateChatCompletion, generateCompletionWithRetry, testProviderConnection
  - ai-config.ts: getProvider/setProvider, getEffectiveAIConfig, resolveModelForProvider, getProviderDisplayName, getSelectedModel/setSelectedModel
  - ai-maintenance.ts: suggestImprovements, analyzeBacklogFormat, correctBacklogFormat, BacklogMaintenanceResult, RefinementResult
  - ai-analysis.ts: analyzeBacklog, AnalyzeBacklogResult, AnalyzeBacklogOptions, ANALYZE_BACKLOG_PROMPT_FR/EN
  - ai-prompts.ts: REFINE_PROMPT_FR/EN, GENERATE_ITEM_PROMPT_FR/EN, getRefinePrompt, getGenerateItemPrompt
  - ai.ts: slimmed to 487 lines — refineItem, generateItemFromDescription, buildTypeClassificationSection, buildTypeEnum, re-exports
affects: [35-architecture-performance, future ai module consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf module pattern: ai-client.ts imports only from external packages + leaf config modules, preventing circular deps"
    - "Composition layer pattern: ai.ts as thin re-export hub preserving all existing import paths"
    - "Type-safe re-exports: explicit export type {} blocks for each sub-module's public types"

key-files:
  created:
    - src/lib/ai-client.ts
    - src/lib/ai-config.ts
    - src/lib/ai-maintenance.ts
    - src/lib/ai-analysis.ts
    - src/lib/ai-prompts.ts
  modified:
    - src/lib/ai.ts

key-decisions:
  - "generateCompletion exported from ai-client.ts (not private) — ai-maintenance and ai-analysis call it directly without retry, needed for format analysis/correction flows"
  - "RefinementResult defined in ai-maintenance.ts (suggestImprovements returns it), re-exported through ai.ts for backward compat"
  - "No changes to src/lib/index.ts barrel — it imports from ./ai which re-exports everything, no consumer changes needed"
  - "No circular deps: ai-maintenance.ts and ai-analysis.ts import from ./ai-client (leaf), never from ./ai"
  - "SMELL-006 (god file) resolved: ai.ts went from 2235 to 487 lines across 5 focused modules"

patterns-established:
  - "AI leaf module pattern: completion core in ai-client.ts prevents any downstream module from creating ai.ts -> X -> ai.ts cycles"
  - "Sub-module re-export pattern: ai.ts aggregates all sub-module exports under single import path"

requirements-completed: [FIX-09]

# Metrics
duration: 18min
completed: 2026-02-19
---

# Phase 35 Plan 01: AI god-file split into 6 focused modules Summary

**Split 2235-line ai.ts god file into 5 focused sub-modules (ai-client, ai-config, ai-maintenance, ai-analysis, ai-prompts) plus slimmed 487-line composition layer, resolving SMELL-006 with zero circular dependencies**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-19T14:40:13Z
- **Completed:** 2026-02-19T15:00:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created + 1 rewritten)

## Accomplishments

- Eliminated SMELL-006: ai.ts reduced from 2235 to 487 lines (78% reduction)
- Zero circular ES module dependencies — ai-client.ts is a leaf module with no back-imports to ai.ts
- All existing import paths preserved — no consumer file changes required
- 523/523 tests pass, TypeScript compilation clean, Vite build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract ai-client.ts and ai-config.ts** - `59c4c51` (feat)
2. **Task 2: Extract ai-prompts.ts** - `fe63617` (feat)
3. **Task 3: Extract ai-maintenance.ts and ai-analysis.ts** - `d5fd816` (feat)

## Files Created/Modified

- `src/lib/ai-client.ts` (created, 642 lines) - SDK singletons (Groq/Gemini/OpenAI), API key CRUD, generateCompletion, generateChatCompletion, generateCompletionWithRetry, testProviderConnection
- `src/lib/ai-config.ts` (created, 112 lines) - getProvider/setProvider, getEffectiveAIConfig, resolveModelForProvider, getProviderDisplayName, getSelectedModel/setSelectedModel
- `src/lib/ai-maintenance.ts` (created, 497 lines) - suggestImprovements, analyzeBacklogFormat, correctBacklogFormat, BacklogMaintenanceResult, all maintenance + correction prompts
- `src/lib/ai-analysis.ts` (created, 488 lines) - analyzeBacklog with batch processing, mergeAnalysisResults, ANALYZE_BACKLOG_PROMPT_FR/EN
- `src/lib/ai-prompts.ts` (created, 259 lines) - REFINE_PROMPT_FR/EN, GENERATE_ITEM_PROMPT_FR/EN, getRefinePrompt, getGenerateItemPrompt
- `src/lib/ai.ts` (rewritten, 487 lines) - thin composition layer: refineItem, generateItemFromDescription, buildTypeClassificationSection, buildTypeEnum, all re-exports

## Decisions Made

- `generateCompletion` exported from `ai-client.ts` (not private as originally planned): `analyzeBacklogFormat`, `correctBacklogFormat`, and `analyzeBacklog` call it directly without retry overhead — keeping it accessible avoids unnecessary retry wrapping on maintenance/analysis flows
- `RefinementResult` interface defined in `ai-maintenance.ts` (canonical home since `suggestImprovements` returns it) and re-exported through `ai.ts` — used by `refineItem` in ai.ts via explicit import + type export
- No changes to `src/lib/index.ts` barrel — it re-exports from `./ai`, and ai.ts now re-exports from sub-modules; consumers don't need updates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused SDK client getter imports in ai.ts**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** ai.ts imported `getGroqClient`, `getGeminiClient`, `getOpenAIClient` from ai-client.ts but none were used in ai.ts (they're internal to ai-client.ts)
- **Fix:** Removed the 3 unused imports from ai-client import statement in ai.ts
- **Files modified:** src/lib/ai.ts
- **Verification:** TypeScript compilation passed with zero errors
- **Committed in:** 59c4c51 (Task 1 commit)

**2. [Rule 1 - Bug] RefinementResult import needed before usage in refineItem signature**
- **Found during:** Task 3 (TypeScript compilation)
- **Issue:** `RefinementResult` was re-exported from `./ai-maintenance` but used as return type in `refineItem` function within same file before export statement resolved
- **Fix:** Added explicit `import type { RefinementResult } from './ai-maintenance'` before usage, then separately `export type { RefinementResult }`
- **Files modified:** src/lib/ai.ts
- **Verification:** TypeScript compilation passed with zero errors
- **Committed in:** d5fd816 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 - Bug)
**Impact on plan:** Both auto-fixes required for TypeScript correctness. No scope creep.

## Issues Encountered

None - plan executed cleanly after TypeScript compilation errors revealed the 2 minor fixes above.

## Self-Check

**Checking files exist:**
- src/lib/ai-client.ts: FOUND
- src/lib/ai-config.ts: FOUND
- src/lib/ai-maintenance.ts: FOUND
- src/lib/ai-analysis.ts: FOUND
- src/lib/ai-prompts.ts: FOUND
- src/lib/ai.ts: FOUND (487 lines)

**Checking commits:**
- 59c4c51: Task 1 FOUND
- fe63617: Task 2 FOUND
- d5fd816: Task 3 FOUND

## Self-Check: PASSED

## Next Phase Readiness

- Phase 35 plan 02 (ProjectWorkspace decomposition) is independent and can proceed
- All AI module consumers unaffected — import paths unchanged
- No remaining blockers

---
*Phase: 35-architecture-performance*
*Completed: 2026-02-19*
