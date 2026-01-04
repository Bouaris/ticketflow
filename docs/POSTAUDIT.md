# POST-AUDIT TICKETFLOW - Plan de Completion

> **Etat initial audit:** 73 issues
> **Corrigees:** 38 (52%) + Sprint A
> **Restantes:** 35 (48%)
> **Date:** 2026-01-04
> **Mise a jour:** 2026-01-04 (Sprint A complete)

---

## RESUME CRITIQUE

### Progression Reelle

| Metrique | Fait | Cible | Gap |
|----------|------|-------|-----|
| Issues corrigees | 38/73 (52%) | 73/73 (100%) | **35 issues** |
| God Objects LOC | 2826 | ~1500 | **-1326 LOC** encore |
| Tests hooks | 7/9 (78%) | 9/9 (100%) | **2 hooks** |
| Tests composants | 0/29 (0%) | 29/29 (100%) | **29 composants** |
| Tests total | 103 | 168 | **+65 tests** |
| Couverture tests | ~25% | 60% | **+35%** |

### Note Globale: **C+**

| Critere | Score |
|---------|-------|
| Stabilite | A (build OK, zero regression) |
| Tests | D (15% couverture, critique manquant) |
| Architecture | B- (amelioree mais incomplete) |
| Completude | C (52% des issues) |

---

## SPRINT A: Tests Critiques (Priorite: MAXIMALE) - COMPLETE

**Effort:** XL (4-6h) | **Impact:** Securisation du coeur | **Status:** DONE

### A.1 Tests useBacklog.ts (28 tests) - COMPLETE
Le hook central avec 30+ methodes, 829 LOC.

Tests implementes:
- [x] Initialisation et parsing backlog
- [x] addItem() - placement correct par type
- [x] updateItem() - mise a jour et _modified flag
- [x] deleteItem() - suppression et cleanup
- [x] moveItemToType() - changement de section
- [x] toggleCriterion() - sync rawMarkdown
- [x] Filtrage par type, severite, effort
- [x] Recherche textuelle
- [x] Undo/redo integration
- [x] Edge cases: selectItem, reset, existingIds

### A.2 Tests useFileAccess.ts (10 tests) - COMPLETE
- [x] Initial state (fileName, fileHandle, content)
- [x] Mode Web vs Tauri detection
- [x] isDirty management
- [x] closeFile cleanup
- [x] hasStoredHandle detection

### A.3 Tests useProjects.ts (10 tests) - COMPLETE
- [x] CRUD projets (add, update, remove)
- [x] Persistence localStorage et reload
- [x] touchProject ordering
- [x] scanForBacklog web mode

### A.4 Autres hooks (10 tests) - COMPLETE
- [x] useKeyboardShortcuts - 3 tests (Ctrl+Z, Ctrl+Y, input ignore)
- [x] useKanbanColumnWidths - 7 tests (multipliers, toggle, persist)

**Total Sprint A:** 58 tests implementes
**Hooks testes:** 7/9 (useBacklog, useBacklogHistory, useTypeConfig, useFileAccess, useProjects, useKeyboardShortcuts, useKanbanColumnWidths)

---

## SPRINT B: God Objects Complete (Priorite: HAUTE)

**Effort:** L (3-4h) | **Impact:** Maintenabilite

### B.1 App.tsx (786 -> ~400 LOC)

Fichiers a creer:
- [ ] `src/components/layout/ModalManager.tsx`
  - Centraliser les 8 modals (aiConfirm, archive, delete, etc.)
  - Pattern: discriminated union pour state

- [ ] `src/contexts/ItemOperationContext.tsx`
  - Resoudre prop drilling (11 props -> context)

### B.2 useBacklog.ts (829 -> ~400 LOC)

Fichiers a creer:
- [ ] `src/hooks/useBacklogFiltering.ts`
  - Filtres par type, severite, effort, recherche
  - ~100 LOC

- [ ] `src/hooks/useBacklogOrganization.ts`
  - Sections, reordering, drag & drop
  - ~150 LOC

### B.3 ItemEditorModal.tsx (885 -> ~400 LOC)

Fichiers a creer:
- [ ] `src/components/editor/FormEditorMode.tsx`
  - Mode formulaire traditionnel (tabs, champs)
  - ~250 LOC

- [ ] `src/components/editor/ScreenshotTab.tsx`
  - Gestion screenshots dans l'editeur
  - ~100 LOC

**Total Sprint B:** ~800 LOC extraits, 6 nouveaux fichiers

---

## SPRINT C: Tests Composants (Priorite: MOYENNE)

**Effort:** XL (6-8h) | **Impact:** Validation UI

### C.1 Composants Critiques (20 tests)
- [ ] ItemDetailPanel.test.tsx - 5 tests
- [ ] KanbanBoard.test.tsx - 5 tests (drag & drop)
- [ ] ItemEditorModal.test.tsx - 5 tests
- [ ] Modal.test.tsx - 5 tests

### C.2 Composants Importants (20 tests)
- [ ] FilterBar.test.tsx - 5 tests
- [ ] Header.test.tsx - 3 tests
- [ ] TypeConfigEditor.test.tsx - 5 tests
- [ ] ExportModal.test.tsx - 4 tests
- [ ] SettingsModal.test.tsx - 3 tests

### C.3 Composants UI (20 tests)
- [ ] Badge components - 5 tests
- [ ] Progress components - 3 tests
- [ ] Icons rendering - 2 tests
- [ ] 10 autres composants

**Total Sprint C:** ~60 tests composants
**Couverture cible:** 80% composants critiques

---

## SPRINT D: Architecture (Priorite: MOYENNE)

**Effort:** M (2-3h) | **Impact:** Dette technique

### D.1 Parser/Serializer (1120 LOC)
- [ ] `src/lib/MarkdownContract.ts`
  - Interface d'abstraction pour round-trip
  - Tests de non-regression parsing

### D.2 Error Handling
- [ ] `src/components/ErrorBoundary.tsx`
  - Centraliser gestion erreurs
  - Logging unifie

### D.3 CSS Cleanup
- [ ] Supprimer variables @theme non utilisees
- [ ] Audit styles inline restants

---

## SPRINT E: Polish (Priorite: BASSE)

**Effort:** S (1-2h) | **Impact:** Finition

### E.1 i18n Preparation
- [ ] Extraire strings FR hardcodees
- [ ] Preparer structure i18n

### E.2 E2E Tests Expansion
- [ ] Workflow creation item complet
- [ ] Configuration types + persistence
- [ ] Export Markdown fidelite

### E.3 Documentation
- [ ] README mise a jour
- [ ] CONTRIBUTING.md
- [ ] Architecture decision records

---

## ESTIMATION EFFORT TOTAL

| Sprint | Effort | Tests | LOC |
|--------|--------|-------|-----|
| A | XL | +53 | - |
| B | L | - | -800 |
| C | XL | +60 | - |
| D | M | - | ~200 |
| E | S | +10 | - |
| **TOTAL** | | **+123** | **-600** |

---

## METRIQUES CIBLES

| Metrique | Actuel | Cible | Gap |
|----------|--------|-------|-----|
| Issues corrigees | 52% | 100% | 35 issues |
| Tests | 45 | 168 | +123 tests |
| Couverture | ~15% | 60% | +45% |
| God Objects LOC | 2826 | ~1500 | -1326 |
| Fichiers >500 LOC | 3 | 0 | -3 |

---

## CHECKLIST FINALE

- [ ] Sprint A complete (tests hooks)
- [ ] Sprint B complete (god objects)
- [ ] Sprint C complete (tests composants)
- [ ] Sprint D complete (architecture)
- [ ] Sprint E complete (polish)
- [ ] Couverture tests > 60%
- [ ] Zero fichier > 500 LOC
- [ ] Zero issue P0-P1 restante
- [ ] Build PASS
- [ ] E2E PASS

---

## CE QUI A ETE FAIT (Session 2026-01-04)

| Phase | Description | Impact |
|-------|-------------|--------|
| 1.1 | Consolidation Icons SVG | 10 fichiers |
| 1.2 | Suppression CriteriaProgress duplique | 3 fichiers |
| 1.3 | Corrections CSS | 3 fichiers |
| 4.1 | Utilitaires debounce/throttle | utils.ts |
| 3.1 | Split App.tsx | 922 -> 786 LOC (-15%) |
| 3.2 | Split useBacklog.ts | 1023 -> 829 LOC (-19%) |
| 3.3 | Split ItemEditorModal.tsx | 1048 -> 885 LOC (-16%) |
| 3.4 | ItemPlacementService | itemPlacement.ts |
| 4.2 | Accessibilite | 25+ aria-labels |
| 4.3 | ItemDetailPanel modal | uses Modal.tsx |
| 2.x | Tests hooks | 25 nouveaux tests |

### Nouveaux Fichiers Crees

```
src/hooks/useKeyboardShortcuts.ts        (45 LOC)
src/hooks/useBacklogHistory.ts           (95 LOC)
src/lib/itemPlacement.ts                 (127 LOC)
src/components/welcome/WelcomeScreen.tsx (60 LOC)
src/components/editor/AIGenerationMode.tsx (253 LOC)
src/__tests__/useBacklogHistory.test.ts  (10 tests)
src/__tests__/useTypeConfig.test.ts      (15 tests)
```

### Reduction God Objects

| Fichier | Avant | Apres | Delta |
|---------|-------|-------|-------|
| App.tsx | 922 | 786 | -136 (-15%) |
| useBacklog.ts | 1023 | 829 | -194 (-19%) |
| ItemEditorModal.tsx | 1048 | 885 | -163 (-16%) |
| ItemDetailPanel.tsx | 352 | 326 | -26 (-7%) |
| **Total** | 3345 | 2826 | **-519 LOC** |

---

*Post-Audit Plan - TICKETFLOW v1.1.x*
