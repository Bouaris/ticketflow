# TICKETFLOW - Plan de Refactoring Complet

> **Version:** 1.0 | **Date:** 2026-01-03 | **Status:** Prêt pour exécution

## Objectif

Transformer le codebase en une architecture professionnelle, modulaire et future-proof. Éliminer tout code hardcodé, centraliser les constantes, extraire les composants réutilisables.

### Décisions Validées
- **Langue UI:** Français conservé (Haute, Moyenne, Bloquant, etc.)
- **Exécution:** Tout d'un coup - les 6 phases en une session
- **Types:** 100% Dynamique - supprimer tous les types hardcodés, tout via TypeConfig

---

## 1. Nouvelle Structure de Dossiers

```
src/
├── constants/                     # NOUVEAU: Toutes les constantes centralisées
│   ├── index.ts                   # Barrel export
│   ├── labels.ts                  # Labels FR (severity, priority, effort, type)
│   ├── storage.ts                 # Clés localStorage/IndexedDB
│   ├── config.ts                  # Configuration app (AI models, limites, etc.)
│   └── patterns.ts                # Regex patterns du parser
│
├── types/
│   ├── index.ts                   # Barrel export
│   ├── backlog.ts                 # GARDER: Schemas Zod (retirer exports labels)
│   ├── project.ts                 # GARDER: Types projet
│   ├── typeConfig.ts              # GARDER: Configuration types dynamiques
│   └── guards.ts                  # NOUVEAU: Type guards centralisés
│
├── lib/
│   ├── index.ts                   # Barrel export
│   ├── parser.ts                  # REFACTOR: Utiliser constants/patterns
│   ├── serializer.ts              # REFACTOR: Utiliser constants/labels
│   ├── ai.ts                      # REFACTOR: Utiliser constants/config
│   ├── storage.ts                 # NOUVEAU: Utilitaires localStorage/IndexedDB
│   ├── file-system.ts             # NOUVEAU: Abstraction unifiée Tauri/Web
│   ├── tauri-bridge.ts            # GARDER: Implémentation Tauri
│   ├── fileSystem.ts              # GARDER: Implémentation Web
│   └── screenshots.ts             # GARDER
│
├── hooks/
│   ├── index.ts                   # Barrel export
│   └── [hooks existants]          # REFACTOR: Utiliser imports centralisés
│
├── components/
│   ├── ui/                        # NOUVEAU: Primitives UI réutilisables
│   │   ├── index.ts
│   │   ├── Modal.tsx              # Wrapper modal unifié
│   │   ├── Button.tsx             # Boutons avec variants
│   │   ├── Badge.tsx              # Badge générique
│   │   ├── Icons.tsx              # Tous les icônes centralisés (~15 icônes)
│   │   ├── Spinner.tsx            # Loading spinner
│   │   ├── Progress.tsx           # Barre de progression
│   │   └── ListEditor.tsx         # Éditeur de liste réutilisable
│   │
│   ├── shared/
│   │   ├── index.ts
│   │   ├── CriteriaProgress.tsx   # NOUVEAU: Extrait de 3 endroits
│   │   ├── ItemBadge.tsx          # REFACTOR: Utiliser couleurs TypeConfig
│   │   ├── SeverityBadge.tsx      # Extrait de ItemBadge
│   │   ├── PriorityBadge.tsx      # Extrait de ItemBadge
│   │   └── EffortBadge.tsx        # Extrait de ItemBadge
│   │
│   ├── editor/
│   │   ├── index.ts
│   │   ├── ItemEditorModal.tsx    # REFACTOR: Orchestrateur (~300 lignes)
│   │   ├── GeneralTab.tsx         # NOUVEAU: Extrait
│   │   ├── DetailsTab.tsx         # NOUVEAU: Extrait
│   │   ├── CriteriaTab.tsx        # NOUVEAU: Extrait
│   │   ├── ScreenshotsTab.tsx     # NOUVEAU: Extrait
│   │   ├── AiModeView.tsx         # NOUVEAU: Extrait
│   │   └── ScreenshotEditor.tsx   # GARDER
│   │
│   └── [autres dossiers]          # GARDER structure existante
```

---

## 2. Fichiers à Créer

### 2.1 Constants Module (`src/constants/`)

**`labels.ts`** - Labels FR centralisés:
```typescript
export const SEVERITY_LABELS = { P0: 'Bloquant', P1: 'Critique', P2: 'Moyenne', P3: 'Faible', P4: 'Mineure' };
export const SEVERITY_FULL_LABELS = { P0: 'P0 - Bloquant', P1: 'P1 - Critique', P2: 'P2 - Moyenne', P3: 'P3 - Faible', P4: 'P4 - Mineure' };
export const PRIORITY_LABELS = { Haute: 'Haute', Moyenne: 'Moyenne', Faible: 'Faible' };
export const EFFORT_LABELS = { XS: 'Extra Small (< 2h)', S: 'Small (2-4h)', M: 'Medium (1-2j)', L: 'Large (3-5j)', XL: 'Extra Large (> 1 sem)' };
export const EFFORT_SHORT_LABELS = { XS: 'XS (Extra Small)', S: 'S (Small)', M: 'M (Medium)', L: 'L (Large)', XL: 'XL (Extra Large)' };
```

**`storage.ts`** - Clés storage:
```typescript
export const STORAGE_KEYS = {
  PROJECTS: 'ticketflow-projects',
  TYPE_CONFIG_PREFIX: 'ticketflow-type-config',
  AI_PROVIDER: 'ai-provider',
  GROQ_API_KEY: 'groq-api-key',
  GEMINI_API_KEY: 'gemini-api-key',
  TAURI_LAST_FILE: 'ticketflow-last-file',
} as const;

export const INDEXED_DB = {
  DB_NAME: 'backlog-manager',
  FILE_HANDLES_STORE: 'file-handles',
  LAST_FILE_KEY: 'last-file',
  VERSION: 2,
} as const;
```

**`config.ts`** - Configuration app:
```typescript
export const APP_CONFIG = {
  MAX_RECENT_PROJECTS: 10,
  VISIBLE_PROJECTS_COUNT: 5,
  BACKLOG_FILE_NAME: 'TICKETFLOW_Backlog.md',
  ASSETS_FOLDER: '.backlog-assets',
  SCREENSHOTS_FOLDER: 'screenshots',
} as const;

export const AI_CONFIG = {
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  GEMINI_MODEL: 'gemini-1.5-flash-latest',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
} as const;
```

**`patterns.ts`** - Regex patterns:
```typescript
export const PARSER_PATTERNS = {
  SECTION_HEADER: /^## (?:(\d+)\.\s+)?(.+)$/,
  ITEM_HEADER: /^### ([A-Z]+-\d+(?:\s*à\s*\d+)?)\s*\|\s*(.+)$/,
  METADATA: /^\*\*([^:*]+):\*\*\s*(.+)$/,
  BLOCKQUOTE: /^>\s*(.+)$/,
  CHECKBOX: /^- \[([ xX])\]\s*(.+)$/,
  LIST_ITEM: /^- (.+)$/,
  NUMBERED_LIST: /^\d+\.\s+(.+)$/,
  TABLE_ROW: /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/,
  SCREENSHOT: /!\[([^\]]*)\]\(\.?\.?backlog-assets\/screenshots\/([^)]+)\)/g,
  CODE_BLOCK: /^```/,
  TYPE_ID: /^[A-Z]+$/,
  SEVERITY: /^(P[0-4])/,
  EMOJI: /^([\u{1F300}-\u{1F9FF}]|⚠️|✅|❌|🔥|💡|🚀|📝|🐛|⚡)/u,
} as const;
```

### 2.2 Type Guards (`src/types/guards.ts`)
```typescript
import type { BacklogItem, TableGroup, RawSection } from './backlog';
import { PARSER_PATTERNS } from '../constants/patterns';

export function isBacklogItem(item: BacklogItem | TableGroup | RawSection): item is BacklogItem {
  if (!('id' in item)) return false;
  if ('items' in item) return false;
  if ('type' in item && item.type === 'raw-section') return false;
  return typeof item.type === 'string' && PARSER_PATTERNS.TYPE_ID.test(item.type);
}

export function isTableGroup(item: unknown): item is TableGroup {
  return typeof item === 'object' && item !== null && 'type' in item && (item as any).type === 'table-group';
}

export function isRawSection(item: unknown): item is RawSection {
  return typeof item === 'object' && item !== null && 'type' in item && (item as any).type === 'raw-section';
}
```

### 2.3 UI Components (`src/components/ui/`)

**`Icons.tsx`** - 15+ icônes centralisés (CloseIcon, SparklesIcon, PlusIcon, TrashIcon, SaveIcon, CameraIcon, EditIcon, SettingsIcon, SearchIcon, ChevronDownIcon, RefreshIcon, TagIcon, DocumentIcon, FolderIcon, HomeIcon, etc.)

**`Modal.tsx`** - Modal unifié avec backdrop 60%, variants de taille

**`Spinner.tsx`** - Loading spinner standardisé

**`Progress.tsx`** - Barre de progression (utilisé par CriteriaProgress)

**`ListEditor.tsx`** - Éditeur de liste avec add/remove/update

### 2.4 Shared Components

**`CriteriaProgress.tsx`** - Unifié depuis 3 endroits:
```typescript
interface CriteriaProgressProps {
  criteria: { checked: boolean; text: string }[];
  variant?: 'compact' | 'minimal' | 'full';
  showLabel?: boolean;
}
```

---

## 3. Fichiers à Refactorer

### 3.1 `ItemEditorModal.tsx` - PRIORITÉ HAUTE
**État actuel:** 1135 lignes
**Extractions:**
1. `GeneralTab.tsx` (~150 lignes) - Type, ID, Title, Priority/Severity, Description
2. `DetailsTab.tsx` (~50 lignes) - Specs, Reproduction, Dependencies, Constraints
3. `CriteriaTab.tsx` (~60 lignes) - Critères d'acceptation
4. `ScreenshotsTab.tsx` (~50 lignes) - Gestion captures
5. `AiModeView.tsx` (~120 lignes) - Mode IA avec prompt
6. Déplacer `ListEditor` → `ui/ListEditor.tsx`
7. Déplacer icônes → `ui/Icons.tsx`
**Résultat:** ~300 lignes

### 3.2 `backlog.ts`
- Retirer: `TYPE_LABELS`, `SEVERITY_LABELS`, `PRIORITY_LABELS`, `EFFORT_LABELS`
- Garder: Schemas Zod, types inférés, `getTypeFromId`

### 3.3 `serializer.ts`
- Supprimer labels hardcodés lignes 120-140
- Importer depuis `constants/labels.ts`

### 3.4 `parser.ts`
- Supprimer `isBacklogItem` local
- Importer depuis `types/guards.ts`
- Importer patterns depuis `constants/patterns.ts`

### 3.5 `useBacklog.ts`
- Supprimer `isBacklogItem` local
- Importer depuis `types/guards.ts`

### 3.6 `ai.ts`
- Importer clés depuis `constants/storage.ts`
- Importer config depuis `constants/config.ts`

### 3.7 `ItemBadge.tsx`
- Accepter `typeConfig?: TypeDefinition` en prop
- Utiliser couleur dynamique, plus de mapping hardcodé

---

## 4. Plan d'Exécution

### Phase 1: Fondations
1. Créer `src/constants/index.ts`, `labels.ts`, `storage.ts`, `config.ts`, `patterns.ts`
2. Créer `src/types/guards.ts`
3. Créer `src/lib/storage.ts`
4. Ajouter barrel exports partout

### Phase 2: UI Components
5. Créer `src/components/ui/index.ts`
6. Créer `Icons.tsx` - centraliser 15+ icônes
7. Créer `Modal.tsx`, `Spinner.tsx`, `Progress.tsx`, `ListEditor.tsx`

### Phase 3: Shared Components
8. Créer `CriteriaProgress.tsx`
9. Refactorer `ItemBadge.tsx` pour couleurs dynamiques

### Phase 4: Migration Imports
10. `parser.ts` → guards, patterns
11. `serializer.ts` → labels
12. `useBacklog.ts` → guards
13. `ai.ts` → config, storage
14. Tous les hooks → storage keys

### Phase 5: Refactoring Majeur
15. Splitter `ItemEditorModal.tsx` en 6 composants
16. Mettre à jour KanbanCard, ListView, ItemDetailPanel → CriteriaProgress
17. Migrer modals vers ui/Modal

### Phase 6: Nettoyage
18. Supprimer code dupliqué
19. Supprimer anciens exports
20. Vérifier imports
21. Build + test

---

## 5. Fichiers Critiques

```
src/components/editor/ItemEditorModal.tsx  # 1135 lignes à splitter
src/types/backlog.ts                       # Labels à extraire
src/lib/parser.ts                          # isBacklogItem + patterns
src/lib/serializer.ts                      # Labels dupliqués
src/hooks/useBacklog.ts                    # isBacklogItem dupliqué
src/lib/ai.ts                              # Config à centraliser
src/components/shared/ItemBadge.tsx        # Couleurs dynamiques
src/components/kanban/KanbanCard.tsx       # CriteriaProgress
src/components/list/ListView.tsx           # CriteriaProgress
src/components/detail/ItemDetailPanel.tsx  # CriteriaProgress
```

---

## 6. Métriques

| Métrique | Avant | Après |
|----------|-------|-------|
| Lignes ItemEditorModal | 1135 | ~300 |
| Fichiers avec icônes dupliqués | 6+ | 1 |
| Définitions isBacklogItem | 2 | 1 |
| Labels hardcodés serializer | 20+ | 0 |
| Clés localStorage dispersées | 6 | 1 |
| CriteriaProgress implémentations | 3 | 1 |

---

## 8. Règles

- **Pas de CSS inline** - Tailwind classes uniquement
- **Barrel exports** - Chaque dossier a un `index.ts`
- **TypeScript strict** - Tous les types explicites
- **Pas de magic strings** - Tout dans constants/
- **Single source of truth** - Une seule définition par concept
- **Types 100% dynamiques** - Plus de BUG/EXT/ADM hardcodés
