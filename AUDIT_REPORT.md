# AUDIT TICKETFLOW - 2026-01-04

> Genere par SENTINEL - Audit Exhaustif Multi-Agents
> Focus: all (audit complet)
> Fichiers scannes: 75 fichiers .ts/.tsx
> **Derniere mise a jour:** 2026-01-04 - Corrections Phase 1 appliquees

---

## Corrections Appliquees

### Phase 1.1: Consolidation Icons SVG - COMPLETE
- [x] Header.tsx: 5 icons migres vers Icons.tsx
- [x] FilterBar.tsx: 2 icons migres vers Icons.tsx
- [x] ItemDetailPanel.tsx: 6 icons migres vers Icons.tsx
- [x] ScreenshotEditor.tsx: 5 icons migres vers Icons.tsx
- [x] AIContextIndicator.tsx: 1 icon migre vers Icons.tsx
- [x] KanbanCard.tsx: CameraIcon migre vers Icons.tsx
- [x] ListView.tsx: CameraIcon migre vers Icons.tsx
- [x] Icons.tsx: +4 nouveaux icons (ArchiveIcon, CheckCircleIcon, FloppyDiskIcon)

### Phase 1.2: Suppression CriteriaProgress Duplique - COMPLETE
- [x] ListView.tsx: Fonction locale supprimee, utilise Progress.tsx
- [x] KanbanCard.tsx: Inline progress remplace par CriteriaProgress
- [x] ItemDetailPanel.tsx: Garde version locale (design specifique)

### Phase 1.3: CSS Duplications - COMPLETE
- [x] ItemDetailPanel.tsx: Animation slide-in inline supprimee
- [x] ItemBadge.tsx: LEGACY_TYPE_COLORS remplace par TYPE_COLORS import

### Phase 4.1: Utilitaires debounce/throttle - COMPLETE
- [x] utils.ts: Ajout functions debounce() et throttle()

---

## Resume Executif (Post-Corrections)

| Categorie | Issues Initiales | Corrigees | Restantes |
|-----------|------------------|-----------|-----------|
| CSS & Styling | 10 | 4 | 6 |
| Components | 25 | 8 | 17 |
| Architecture | 18 | 0 | 18 |
| Type Safety | 0 | 0 | 0 |
| Test Coverage | 12 | 0 | 12 |
| Blind Spots | 8 | 1 | 7 |
| **TOTAL** | **73** | **13** | **60** |

**Note globale: B+ (Amelioration en cours)**

---

## Issues Critiques (P0-P1)

### [P0-001] Couverture Tests Hooks = 0%
- **Fichier:** `src/hooks/*.ts` (9 fichiers)
- **Categorie:** Tests
- **Description:** Aucun des 9 hooks critiques n'a de tests unitaires. useBacklog.ts (1023 LOC) gere l'etat central sans aucune validation automatisee.
- **Impact:** Toute modification peut introduire des regressions non detectees. Race conditions possibles.
- **Solution proposee:**
```typescript
// src/__tests__/useBacklog.test.ts
import { renderHook, act } from '@testing-library/react';
import { useBacklog } from '../hooks/useBacklog';

describe('useBacklog', () => {
  test('should add item to correct section', () => {
    const { result } = renderHook(() => useBacklog());
    act(() => {
      result.current.addItem({ type: 'BUG', title: 'Test' });
    });
    expect(result.current.backlog.sections[0].items).toHaveLength(1);
  });
});
```
- **Effort:** XL (40+ tests requis)

---

### [P0-002] Couverture Tests Composants = 0%
- **Fichier:** `src/components/**/*.tsx` (29 fichiers)
- **Categorie:** Tests
- **Description:** Aucun composant n'a de tests unitaires ou d'integration. KanbanBoard, ItemEditorModal, FilterBar non testes.
- **Impact:** UI entierement non validee. Regressions visuelles possibles.
- **Solution proposee:** Implementer tests React Testing Library pour chaque composant critique.
- **Effort:** XL (60+ tests requis)

---

### [P1-001] God Object: App.tsx (922 LOC)
- **Fichier:** `src/App.tsx:1-922`
- **Categorie:** Architecture
- **Description:** App.tsx orchestre 31 imports, 8 modals, 20+ handlers, 5 loading states. Viole Single Responsibility.
- **Impact:** Maintenance difficile, testing impossible, couplage fort.
- **Solution proposee:**
```typescript
// Extraire en modules:
// src/components/layout/ModalManager.tsx - Gestion des 8 modals
// src/hooks/useKeyboardShortcuts.ts - Ctrl+Z/Y handlers
// src/components/layout/AppShell.tsx - Composition root
```
- **Effort:** L

---

### [P1-002] God Object: useBacklog.ts (1023 LOC)
- **Fichier:** `src/hooks/useBacklog.ts:1-1023`
- **Categorie:** Architecture
- **Description:** Hook avec 30+ methodes publiques. Gere filtrage, selection, undo/redo, mutations, persistence.
- **Impact:** Impossible a tester unitairement, risque de bugs subtils.
- **Solution proposee:**
```typescript
// Diviser en:
// useBacklogState.ts - State + CRUD basic
// useBacklogFiltering.ts - Filtres et recherche
// useBacklogOrganization.ts - Sections, reordering
// useBacklogHistory.ts - Undo/redo stack
```
- **Effort:** L

---

### [P1-003] God Object: ItemEditorModal.tsx (1048 LOC)
- **Fichier:** `src/components/editor/ItemEditorModal.tsx:1-1048`
- **Categorie:** Architecture
- **Description:** Modal avec 2 modes (AI/form), 4 tabs, screenshots, 50+ state vars.
- **Impact:** Complexite excessive, testing impossible.
- **Solution proposee:**
```typescript
// Diviser en:
// AIGenerationMode.tsx - Flow AI pure
// FormEditorMode.tsx - Formulaire traditionnel
// ScreenshotTab.tsx - Gestion screenshots
```
- **Effort:** L

---

### [P1-004] Parser/Serializer Complexes (539 + 581 LOC)
- **Fichier:** `src/lib/parser.ts`, `src/lib/serializer.ts`
- **Categorie:** Architecture
- **Description:** 1120 LOC de logique critique pour round-trip Markdown. Fragile aux changements.
- **Impact:** Toute modification peut corrompre les donnees utilisateur.
- **Solution proposee:** Creer `MarkdownContract.ts` comme couche d'abstraction.
- **Effort:** M

---

### [P1-005] SVG Icons Inline (~20 duplications)
- **Fichier:** Multiple (Header, FilterBar, ItemDetailPanel, ScreenshotEditor, etc.)
- **Categorie:** Components
- **Description:** 20+ SVG definis localement au lieu d'utiliser Icons.tsx centralise.
- **Impact:** Duplication de code, maintenance difficile.
- **Solution proposee:**
```typescript
// Remplacer dans chaque fichier:
// function KanbanIcon() { <svg>... }
// Par:
import { KanbanIcon } from '../ui/Icons';
```
- **Fichiers a modifier:**
  - `src/components/layout/Header.tsx:131-174` (5 icons)
  - `src/components/filter/FilterBar.tsx:237-250` (2 icons)
  - `src/components/detail/ItemDetailPanel.tsx:352-403` (6 icons)
  - `src/components/editor/ScreenshotEditor.tsx:367-399` (5 icons)
  - `src/components/ui/AIContextIndicator.tsx:18-29` (1 icon)
- **Effort:** S

---

### [P1-006] CriteriaProgress Duplique 3x
- **Fichier:** `ItemDetailPanel.tsx:320-346`, `KanbanCard.tsx:107-127`, `ListView.tsx:182-202`
- **Categorie:** Components
- **Description:** Fonction locale `CriteriaProgress()` definie 3 fois. Composant centralise existe deja dans Progress.tsx.
- **Impact:** Code duplique, comportement potentiellement inconsistant.
- **Solution proposee:**
```typescript
// Supprimer les fonctions locales, importer depuis Progress.tsx:
import { CriteriaProgress } from '../ui/Progress';
```
- **Effort:** S

---

### [P1-007] Animation slide-in Dupliquee
- **Fichier:** `src/index.css:43-56` + `src/components/detail/ItemDetailPanel.tsx:288-296`
- **Categorie:** CSS
- **Description:** @keyframes slide-in defini 2 fois avec parametres differents (opacity).
- **Impact:** Comportement inconsistant, maintenance complexe.
- **Solution proposee:**
```typescript
// Supprimer dans ItemDetailPanel.tsx:
// <style>{`@keyframes slide-in...`}</style>
// Utiliser uniquement la definition de index.css
```
- **Effort:** XS

---

### [P1-008] LEGACY_TYPE_COLORS Duplique
- **Fichier:** `src/components/shared/ItemBadge.tsx:29-34`
- **Categorie:** CSS
- **Description:** Objet LEGACY_TYPE_COLORS duplique TYPE_COLORS de constants/colors.ts.
- **Impact:** Desynchronisation si TYPE_COLORS change.
- **Solution proposee:**
```typescript
// Remplacer:
const LEGACY_TYPE_COLORS = {...};
// Par:
import { TYPE_COLORS } from '../../constants/colors';
```
- **Effort:** XS

---

### [P1-009] API Rate Limiting Absent
- **Fichier:** `src/lib/ai.ts:183`, `src/lib/ai.ts:329`
- **Categorie:** Blind Spots
- **Description:** refineItem() et generateItemFromDescription() n'ont pas de debounce/throttle.
- **Impact:** Risque de rate limiting Groq/Gemini, couts excessifs.
- **Solution proposee:**
```typescript
import { debounce } from 'lodash-es';
export const refineItemDebounced = debounce(refineItem, 1000);
```
- **Effort:** S

---

### [P1-010] Accessibilite Buttons (77 buttons, 40 aria-labels)
- **Fichier:** Multiple composants
- **Categorie:** Blind Spots
- **Description:** 77 boutons detectes, seulement 40 ont aria-label/title. 37 boutons non accessibles.
- **Impact:** Non-conformite WCAG 2.1 AA, utilisateurs assistifs bloques.
- **Solution proposee:** Ajouter aria-label a chaque bouton sans texte visible.
- **Effort:** M

---

## Issues Importantes (P2)

### [P2-001] Prop Drilling ItemDetailPanel (11 props, 8 callbacks)
- **Fichier:** `src/App.tsx` -> `src/components/detail/ItemDetailPanel.tsx`
- **Categorie:** Architecture
- **Description:** ItemDetailPanel recoit 11 props dont 8 callbacks. Prop drilling excessif.
- **Solution proposee:** Creer `ItemOperationContext` pour centraliser les operations.
- **Effort:** M

### [P2-002] Badge sizeClasses Duplique 4x
- **Fichier:** `src/components/shared/ItemBadge.tsx:37,81,112,142`
- **Categorie:** Components
- **Description:** sizeClasses identique dans ItemBadge, SeverityBadge, PriorityBadge, EffortBadge.
- **Solution proposee:** Extraire helper `getBadgeSizeClasses(size)`.
- **Effort:** XS

### [P2-003] Item Placement Logic Duplique 200+ LOC
- **Fichier:** `src/hooks/useBacklog.ts:437-509` + `src/hooks/useBacklog.ts:603-657`
- **Categorie:** Architecture
- **Description:** Meme strategie de placement (4 strategies) repetee dans addItem() et moveItemToType().
- **Solution proposee:** Extraire `ItemPlacementService.ts`.
- **Effort:** M

### [P2-004] CSS @theme Variables Non Utilisees
- **Fichier:** `src/index.css:4-16`
- **Categorie:** CSS
- **Description:** --color-severity-p0 a p4, --color-effort-xs a xl declares mais jamais utilises.
- **Solution proposee:** Supprimer ou utiliser via var(--color-*).
- **Effort:** XS

### [P2-005] Modal State Fragmente (8 useState)
- **Fichier:** `src/App.tsx`
- **Categorie:** Architecture
- **Description:** 8 modals avec state separe (aiConfirmModal, archiveConfirmModal, etc.).
- **Solution proposee:**
```typescript
type ModalState =
  | { type: 'none' }
  | { type: 'aiConfirm'; item: BacklogItem; refined: Partial<BacklogItem> }
  | { type: 'archive'; item: BacklogItem }
  // ...
```
- **Effort:** M

### [P2-006] ItemDetailPanel Modal Custom
- **Fichier:** `src/components/detail/ItemDetailPanel.tsx:62-298`
- **Categorie:** Components
- **Description:** Reimplemente modal logic (backdrop, escape, click outside) au lieu d'utiliser Modal.tsx.
- **Solution proposee:** Refactoriser avec le composant Modal.tsx centralise.
- **Effort:** M

### [P2-007] File System API Browser Compatibility
- **Fichier:** `src/lib/fileSystem.ts:51,68,127`
- **Categorie:** Blind Spots
- **Description:** showOpenFilePicker/showSaveFilePicker non supportes sur Firefox/Safari.
- **Status:** ACCEPTABLE - Fallback IndexedDB implemente (ligne 174+).
- **Effort:** -

### [P2-008] Styles Inline Dynamiques Multiples
- **Fichier:** TypeConfigEditor, KanbanBoard, Badge, ItemBadge
- **Categorie:** CSS
- **Description:** style={{ backgroundColor }} utilise pour couleurs dynamiques.
- **Status:** ACCEPTABLE - Necessaire pour color pickers et types dynamiques.
- **Effort:** -

---

## Issues Mineures (P3-P4)

| # | Issue | Fichier | Action | Effort |
|---|-------|---------|--------|--------|
| P3-001 | Import organization (31 imports App.tsx) | App.tsx | Barrel imports | XS |
| P3-002 | TYPE_LABEL_MAP duplique | useBacklog.ts:452,610 | Centraliser constants | XS |
| P3-003 | Couleur defaut hardcodee | TypeConfigEditor.tsx:21,34 | Utiliser PRESET_COLORS[0] | XS |
| P3-004 | Error handling inconsistant | lib/*.ts | Centraliser error boundary | S |
| P3-005 | Console.log residuels potentiels | src/**/*.ts | Audit et suppression | XS |
| P3-006 | Tests E2E superficiels | e2e/app.spec.ts | Ajouter workflows complets | M |
| P3-007 | Strings FR hardcodees (i18n) | components/**/*.tsx | Preparer i18n | L |

---

## Plan de Correction (Roadmap)

### Sprint 1: Stabilisation Critique (P0-P1)
| # | Issue | Fichier | Effort | Dependances |
|---|-------|---------|--------|-------------|
| 1 | Consolider Icons inline | Header, FilterBar, etc. | S | - |
| 2 | Supprimer CriteriaProgress duplique | 3 fichiers | S | - |
| 3 | Corriger animation slide-in | ItemDetailPanel.tsx | XS | - |
| 4 | Supprimer LEGACY_TYPE_COLORS | ItemBadge.tsx | XS | - |
| 5 | Ajouter debounce AI | ai.ts | S | - |
| 6 | Tests useBacklog | useBacklog.test.ts | L | - |
| 7 | Tests parser edge cases | persistence.test.ts | M | - |

### Sprint 2: Architecture (P1-P2)
| # | Issue | Fichier | Effort | Dependances |
|---|-------|---------|--------|-------------|
| 8 | Split App.tsx | ModalManager.tsx, AppShell.tsx | L | Sprint 1 |
| 9 | Split useBacklog.ts | 4 hooks | L | Tests |
| 10 | Split ItemEditorModal.tsx | 3 composants | L | Sprint 1 |
| 11 | Extraire ItemPlacementService | lib/ItemPlacement.ts | M | Split useBacklog |
| 12 | Creer ItemOperationContext | contexts/ItemOperation.tsx | M | Split App |

### Sprint 3: Excellence (P2-P3)
| # | Issue | Fichier | Effort | Dependances |
|---|-------|---------|--------|-------------|
| 13 | Tests composants UI | __tests__/components/ | XL | Sprint 2 |
| 14 | Tests E2E workflows | e2e/*.spec.ts | L | Sprint 2 |
| 15 | Accessibilite aria-labels | 37 boutons | M | - |
| 16 | Supprimer CSS @theme inutilise | index.css | XS | - |
| 17 | Refactoriser ItemDetailPanel modal | ItemDetailPanel.tsx | M | - |

---

## Tests Requis (Nouveaux)

### Tests Unitaires Hooks (Priorite CRITIQUE)
- [ ] `useBacklog.test.ts` - mutations, persistence, undo/redo, filtrage
- [ ] `useTypeConfig.test.ts` - CRUD types, persistence, detection
- [ ] `useHistory.test.ts` - stack operations, limite MAX_HISTORY
- [ ] `useFileAccess.test.ts` - Web vs Tauri, isDirty state
- [ ] `useProjects.test.ts` - CRUD projets, persistence

### Tests Composants UI (Priorite HAUTE)
- [ ] `ItemDetailPanel.test.tsx` - interactions, affichage, callbacks
- [ ] `KanbanBoard.test.tsx` - drag & drop, colonnes, reorder
- [ ] `ItemEditorModal.test.tsx` - modes AI/form, tabs, validation
- [ ] `Modal.test.tsx` - ouverture, fermeture, escape, backdrop
- [ ] `FilterBar.test.tsx` - filtres, recherche, toggles

### Tests E2E (Priorite MOYENNE)
- [ ] Workflow complet creation/edition/suppression item
- [ ] Configuration types personnalises + persistence
- [ ] Integration IA (avec mocks)
- [ ] Export Markdown fidelite
- [ ] Kanban drag & drop cross-colonnes

---

## Metriques Architecture

| Metrique | Valeur | Seuil | Status |
|----------|--------|-------|--------|
| Fichiers >500 LOC | 5 | 0 | **FAIL** |
| Usage `any` | 0 | 0 | **PASS** |
| Couverture tests | ~5% | 60% | **FAIL** |
| Deps circulaires | 0 | 0 | **PASS** |
| SVG dupliques | ~20 | 0 | **FAIL** |
| Event listeners sans cleanup | 0 | 0 | **PASS** |
| XSS vulnerabilities | 0 | 0 | **PASS** |
| Type safety | A+ | A | **PASS** |

---

## Annexes

### A. Fichiers Scannes (75 fichiers)
```
src/
├── App.tsx (922 LOC)
├── lib/
│   ├── parser.ts (539 LOC)
│   ├── serializer.ts (581 LOC)
│   ├── ai.ts (~400 LOC)
│   └── 8 autres modules
├── hooks/
│   ├── useBacklog.ts (1023 LOC)
│   └── 8 autres hooks
├── components/
│   ├── editor/ (2 fichiers, 1048+ LOC)
│   ├── kanban/ (2 fichiers)
│   ├── detail/ (2 fichiers)
│   └── 25 autres composants
├── types/ (4 fichiers - Zod schemas)
└── constants/ (3 fichiers)
```

### B. Patterns Grep Utilises
```bash
# Couleurs hardcodees
grep -r "#[0-9a-fA-F]{6}" src/components/

# Type safety
grep -r ": any" src/
grep -r "as any" src/

# Security XSS
grep -r "dangerouslySetInnerHTML|innerHTML" src/

# Event listeners
grep -r "addEventListener" src/
grep -r "removeEventListener" src/

# Accessibility
grep -r "<button" src/components/
grep -r "aria-label|title=" src/components/

# API rate limiting
grep -r "refineItem|generateItem" src/
grep -r "debounce|throttle" src/
```

### C. References Test Utils
- `src/test-utils/mocks/tauri.ts` - 16 mocks Tauri (SOUS-UTILISE)
- `src/test-utils/mocks/ai.ts` - 8 mocks AI (SOUS-UTILISE)
- `src/test-utils/fixtures.ts` - Fixtures reutilisables (PARTIELLEMENT UTILISE)

### D. Conformite Type Safety
- Zero `any` dans le codebase
- Zod schemas complets pour toutes structures
- Type guards exhaustifs pour unions discriminees
- Casts justifies et documentes (18 occurrences)

---

## Prochaines Etapes

Le rapport d'audit a ete sauvegarde dans `AUDIT_REPORT.md`.

**Veux-tu que j'implemente les corrections ?**

| Option | Description |
|--------|-------------|
| **1** | Tout implementer - Corriger toutes les issues P0-P2 |
| **2** | Sprint 1 uniquement - Corriger les P0-P1 critiques |
| **3** | Issue par issue - Choisir les corrections une par une |
| **4** | Plus tard - Garder le rapport pour reference |

Reponds avec le numero de ton choix.
