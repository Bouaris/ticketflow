# TODO AUDIT TICKETFLOW

> **Etat au:** 2026-01-04
> **Issues:** 38/73 corrigees | 35 restantes
> **Build:** PASS | **Tests:** 45/45 PASS

---

## PHASES COMPLETEES

- [x] **Phase 1.1** - Consolidation Icons SVG (10 fichiers modifies)
- [x] **Phase 1.2** - Suppression CriteriaProgress duplique (ListView, KanbanCard)
- [x] **Phase 1.3** - Corrections CSS (slide-in, LEGACY_TYPE_COLORS)
- [x] **Phase 1.4** - Badge sizeClasses helper (skip - low priority)
- [x] **Phase 4.1** - Utilitaires debounce/throttle dans utils.ts
- [x] **Phase 3.1** - Split App.tsx (922 → 786 LOC, -15%)
  - [x] `src/hooks/useKeyboardShortcuts.ts` - Hook Ctrl+Z/Y (45 LOC)
  - [x] `src/components/welcome/WelcomeScreen.tsx` - Composant (60 LOC)
  - [x] Migration icons locaux vers Icons.tsx
  - [x] Cleanup imports inutilises
- [x] **Phase 3.2 + 3.4** - Split useBacklog.ts (1023 → 829 LOC, -19%)
  - [x] `src/hooks/useBacklogHistory.ts` - Hook undo/redo (95 LOC)
  - [x] `src/lib/itemPlacement.ts` - Service placement items (127 LOC)
  - [x] Deduplication logique placement (addItem, moveItemToType)
- [x] **Phase 3.3** - Split ItemEditorModal.tsx (1048 → 885 LOC, -16%)
  - [x] `src/components/editor/AIGenerationMode.tsx` - Mode IA (253 LOC)
  - [x] ScreenshotThumbnail integre dans AIGenerationMode
- [x] **Phase 4.2** - Accessibilite COMPLETE
  - [x] Header.tsx - 5 boutons
  - [x] FilterBar.tsx - 4 boutons + aria-haspopup
  - [x] ItemDetailPanel.tsx - 6 boutons
  - [x] KanbanBoard.tsx - 1 bouton toggle width
  - [x] ScreenshotEditor.tsx - 3 boutons
  - [x] ExportModal.tsx - 2 boutons
  - [x] AIGenerationMode.tsx - 4 boutons (nouveau fichier)
- [x] **Phase 4.3** - Refactoriser ItemDetailPanel modal (352 → 326 LOC, -7%)
  - [x] Modal.tsx: ajout variant='panel' (slide-over)
  - [x] ItemDetailPanel: utilise Modal au lieu de backdrop/escape/click-outside custom
  - [x] Suppression useEffect escape + click-outside + backdrop custom
- [x] **Phase 2.1-2.3** - Tests unitaires hooks (25 nouveaux tests)
  - [x] `@testing-library/react` installe
  - [x] `src/__tests__/useBacklogHistory.test.ts` - 10 tests (undo/redo/limits)
  - [x] `src/__tests__/useTypeConfig.test.ts` - 15 tests (CRUD/detection/hook)
  - [x] Total: **45 tests PASS** (20 existants + 25 nouveaux)

---

## PHASES EN ATTENTE

*Toutes les phases prioritaires sont completees.*

---

## FICHIERS MODIFIES

```
src/components/ui/Icons.tsx           ✓ (+4 icons)
src/components/layout/Header.tsx      ✓ (imports Icons + aria-labels)
src/components/filter/FilterBar.tsx   ✓ (imports Icons + aria-labels)
src/components/detail/ItemDetailPanel.tsx ✓ (imports Icons + aria-labels)
src/components/editor/ScreenshotEditor.tsx ✓ (imports Icons + aria-labels)
src/components/ui/AIContextIndicator.tsx ✓ (imports Icons)
src/components/kanban/KanbanCard.tsx  ✓ (imports Icons + Progress)
src/components/kanban/KanbanBoard.tsx ✓ (+aria-label)
src/components/list/ListView.tsx      ✓ (imports Icons + Progress)
src/components/shared/ItemBadge.tsx   ✓ (import TYPE_COLORS)
src/components/export/ExportModal.tsx ✓ (+aria-labels)
src/lib/utils.ts                      ✓ (+debounce, +throttle)
src/App.tsx                           ✓ (split -136 LOC)
src/hooks/useKeyboardShortcuts.ts     ✓ (NOUVEAU - 45 LOC)
src/components/welcome/WelcomeScreen.tsx ✓ (NOUVEAU - 60 LOC)
src/hooks/useBacklog.ts               ✓ (refactored -194 LOC)
src/hooks/useBacklogHistory.ts        ✓ (NOUVEAU - 95 LOC)
src/lib/itemPlacement.ts              ✓ (NOUVEAU - 127 LOC)
src/components/editor/ItemEditorModal.tsx ✓ (split -163 LOC)
src/components/editor/AIGenerationMode.tsx ✓ (NOUVEAU - 253 LOC)
src/components/ui/Modal.tsx              ✓ (+variant panel)
src/components/detail/ItemDetailPanel.tsx ✓ (uses Modal -26 LOC)
src/__tests__/useBacklogHistory.test.ts  ✓ (NOUVEAU - 10 tests)
src/__tests__/useTypeConfig.test.ts      ✓ (NOUVEAU - 15 tests)
```

---

## STATISTIQUES SESSION

| Fichier | Avant | Apres | Delta |
|---------|-------|-------|-------|
| App.tsx | 922 | 786 | -136 (-15%) |
| useBacklog.ts | 1023 | 829 | -194 (-19%) |
| ItemEditorModal.tsx | 1048 | 885 | -163 (-16%) |
| ItemDetailPanel.tsx | 352 | 326 | -26 (-7%) |
| **Total God Objects** | 3345 | 2826 | **-519 LOC** |

**Nouveaux fichiers modulaires:** 6
**Total LOC nouveaux fichiers:** 580
**Aria-labels ajoutes:** 25+
**Modal.tsx variant panel:** +21 LOC
**Tests unitaires:** 45 (20 existants + 25 nouveaux)

---

## COMMANDES UTILES

```bash
# Verification etat
git status
pnpm build

# Voir les changements
git diff --stat

# Tests existants
pnpm test

# Build Tauri (si feature majeure)
pnpm tauri build
```

---

## NOTES IMPORTANTES

1. **Build obligatoire** apres chaque phase
2. **Commits atomiques** - un probleme = un commit
3. **Zero `any`** - utiliser `unknown` si necessaire
4. **Supprimer dead code** - imports inutilises, console.log
