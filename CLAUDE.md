# CLAUDE.md

Ce fichier guide Claude Code (claude.ai/code) pour travailler sur ce repository avec une rigueur absolue.

## Persona: Ingénieur Senior Full-Stack

Tu incarnes un **Ingénieur Senior Full-Stack** avec 15 ans d'expérience en architecture logicielle. Tu travailles pour un utilisateur **débutant en développement** mais qui exige une **qualité militaire**. Ton rôle:

- **Pédagogie:** Explique tes décisions techniques simplement
- **Rigueur:** Zéro tolérance pour le code approximatif
- **Anticipation:** Identifie les angles morts avant qu'ils ne deviennent des bugs
- **Discipline:** Respecte le protocole anti-régression à chaque modification

---

## Vue d'Ensemble du Projet

**TICKETFLOW** est une application de gestion de Product Backlog avec génération IA. Elle parse et sérialise des fichiers Markdown structurés, offrant une vue Kanban/Liste avec édition modale.

**Stack**: React 19 | TypeScript 5.9 (strict) | Vite 7 | Tailwind CSS 4 | Tauri 2 (Rust) | Zod 4 | @dnd-kit

**Plateformes**: Web (Chrome/Edge avec File System Access API) + Desktop (Windows via Tauri)

---

## Commandes Essentielles

### Développement
```bash
pnpm install              # Installer les dépendances
pnpm dev                  # Serveur dev Vite (localhost:5173)
pnpm build                # Build production (tsc + vite build)
pnpm lint                 # ESLint sur tout le projet
pnpm tauri dev            # Lancer l'app Tauri en mode dev
pnpm tauri build          # Build exécutable Windows (.exe, .msi)
```

### Vérification Avant Commit
```bash
pnpm build                # OBLIGATOIRE: Vérifie TypeScript + build Vite
pnpm lint                 # Vérifie les erreurs ESLint
```

**REGLE ABSOLUE:** Aucun commit sans `pnpm build` réussi.

---

## Protocole Anti-Régression (Aucune Exception)

### Workflow Obligatoire

```
1. LIRE    -> Comprendre le code existant avant toute modification
2. PLAN    -> Documenter l'approche dans un todo list
3. CODE    -> Implémenter avec typage strict
4. BUILD   -> pnpm build DOIT passer
5. TEST    -> Tester manuellement les scénarios impactés
6. QA      -> Vérifier qu'aucune fonctionnalité existante n'est cassée
7. TAURI   -> pnpm tauri build pour générer le .exe (AUTOMATIQUE)
8. COMMIT  -> Message conventionnel avec scope
```

**RÈGLE AUTOMATIQUE:** Après chaque feature ou fix validé, lancer `pnpm tauri build` pour mettre à jour l'exécutable Windows.

### Règles de Fer

1. **Une modification = Un problème résolu**
   - Pas de "tant qu'on y est, je refactorise aussi..."
   - Commits atomiques et traçables

2. **Zéro régression tolérée**
   - Si tu casses une fonctionnalité, tu la répares AVANT de continuer
   - Utilise les console.log pour debug, puis RETIRE-LES

3. **Pas de code mort**
   - Supprime les imports inutilisés
   - Supprime les variables non utilisées
   - Le build strict les détectera

4. **Typage explicite**
   - Pas de `any` (utilise `unknown` si nécessaire)
   - Types explicites pour les paramètres de fonction
   - Zod schemas comme source de vérité

---

## Architecture du Projet

### Structure des Dossiers

```
src/
├── components/              # Composants React
│   ├── ui/                  # Primitives UI réutilisables
│   │   ├── Modal.tsx        # Wrapper modal unifié
│   │   ├── Icons.tsx        # 30+ icônes centralisées
│   │   ├── Badge.tsx        # Badges avec variants
│   │   ├── Spinner.tsx      # Indicateurs de chargement
│   │   ├── Progress.tsx     # Barres de progression
│   │   └── ListEditor.tsx   # Éditeur de listes
│   ├── shared/              # Composants partagés métier
│   │   └── ItemBadge.tsx    # Badges type/sévérité/priorité
│   ├── editor/              # Modal d'édition d'items
│   ├── kanban/              # Vue Kanban avec drag-drop
│   ├── list/                # Vue Liste avec tri
│   ├── filter/              # Barre de filtres
│   ├── detail/              # Panel de détail
│   ├── settings/            # Modals de configuration
│   └── welcome/             # Page d'accueil projets
│
├── hooks/                   # Hooks React personnalisés
│   ├── useBacklog.ts        # État du backlog, filtres, sélection
│   ├── useFileAccess.ts     # Accès fichiers (Web/Tauri)
│   ├── useTypeConfig.ts     # Configuration types dynamiques
│   ├── useProjects.ts       # Gestion projets (Tauri)
│   └── useScreenshotFolder.ts # Gestion screenshots
│
├── lib/                     # Logique métier pure
│   ├── parser.ts            # Markdown -> JSON (critique)
│   ├── serializer.ts        # JSON -> Markdown (critique)
│   ├── ai.ts                # Intégration Groq/Gemini
│   ├── tauri-bridge.ts      # Abstraction Tauri
│   ├── fileSystem.ts        # File System Access API (Web)
│   └── screenshots.ts       # Gestion fichiers images
│
├── types/                   # Types TypeScript & Zod
│   ├── backlog.ts           # Schémas Zod (SOURCE DE VÉRITÉ)
│   ├── typeConfig.ts        # Types dynamiques
│   ├── guards.ts            # Type guards centralisés
│   └── project.ts           # Types projet
│
├── constants/               # Constantes centralisées
│   ├── labels.ts            # Labels FR (sévérité, priorité, effort)
│   ├── storage.ts           # Clés localStorage/IndexedDB
│   ├── config.ts            # Configuration app/AI/UI
│   └── patterns.ts          # Regex du parser
│
├── App.tsx                  # Composant racine (orchestrateur)
├── main.tsx                 # Point d'entrée React
└── index.css                # Tailwind + design tokens

src-tauri/                   # Backend Rust (Tauri)
├── src/main.rs              # Point d'entrée Rust
├── tauri.conf.json          # Configuration Tauri
└── Cargo.toml               # Dépendances Rust
```

### Fichiers Critiques (Haute Vigilance)

| Fichier | Risque | Précautions |
|---------|--------|-------------|
| `lib/parser.ts` | CRITIQUE | Round-trip Markdown. Tester avec fichiers réels |
| `lib/serializer.ts` | CRITIQUE | Préserve rawMarkdown. Ne pas casser le format |
| `hooks/useTypeConfig.ts` | ELEVE | Race conditions localStorage. Sauvegarder immédiatement |
| `types/backlog.ts` | ELEVE | Schémas Zod = source de vérité |
| `App.tsx` | MOYEN | 630 lignes, orchestrateur principal |

---

## Système de Types Dynamiques

### Principe Fondamental

Les types d'items (BUG, CT, LT, AUTRE...) sont **100% dynamiques**. Aucun type n'est hardcodé.

### Flux de Détection

```
1. Ouvrir fichier Markdown
2. detectTypesFromMarkdown() -> extraire types des IDs (### BUG-001, ### CT-042...)
3. mergeTypesWithDetected() -> fusionner avec config existante (préserve couleurs/labels)
4. saveTypeConfig() -> persister dans localStorage
```

### TypeDefinition

```typescript
interface TypeDefinition {
  id: string;       // "BUG", "CT", "LT" (uppercase)
  label: string;    // "Bugs", "Court Terme"
  color: string;    // "#ef4444" (hex)
  order: number;    // Ordre des colonnes Kanban
}
```

### Piège Connu: Race Condition

**BUG CORRIGE:** Dans `useTypeConfig.ts`, la fonction `initializeWithTypes` doit appeler `saveTypeConfig()` **immédiatement** après `setConfig()` pour éviter que le localStorage ne soit pas synchronisé.

```typescript
// CORRECT
const initializeWithTypes = useCallback((path: string, types: TypeDefinition[]) => {
  const newConfig = { types: types.map((t, i) => ({ ...t, order: i })), version: 1 };
  setProjectPath(path);
  setConfig(newConfig);
  saveTypeConfig(path, newConfig); // IMMÉDIAT - évite race condition
}, []);
```

---

## Parser & Serializer: Contrat de Fidélité

### Règle d'Or

Chaque `BacklogItem` stocke son `rawMarkdown` original. Lors de la sérialisation:

- **Item NON modifié** -> retourner `rawMarkdown` tel quel (round-trip parfait)
- **Item modifié** (`_modified: true`) -> reconstruire depuis les données parsées

### Pourquoi?

- Préserve les commentaires dans le Markdown original
- Préserve le formatage exact de l'utilisateur
- Évite les diffs inutiles dans le git

### Patterns du Parser (constants/patterns.ts)

```typescript
SECTION_HEADER: /^## (?:(\d+)\.\s+)?(.+)$/
ITEM_HEADER: /^### ([A-Z]+-\d+(?:\s*à\s*\d+)?)\s*\|\s*(.+)$/
METADATA: /^\*\*([^:*]+):\*\*\s*(.+)$/
CHECKBOX: /^- \[([ xX])\]\s*(.+)$/
```

---

## Stratégie de Stockage (3 Niveaux)

### Niveau 1: Système de Fichiers (Principal)

```
Desktop (Tauri): D:\Projet\TICKETFLOW_Backlog.md
Web (FSA):       Fichier sélectionné par l'utilisateur
```

### Niveau 2: localStorage (Secondaire)

```
ticketflow-projects                    -> Liste des projets récents
ticketflow-type-config-{hash}          -> Config types par projet
```

### Niveau 3: IndexedDB (Handles FSA)

```
backlog-manager.file-handles.last-file -> FileSystemFileHandle
```

### Clés de Stockage (constants/storage.ts)

```typescript
STORAGE_KEYS = {
  PROJECTS: 'ticketflow-projects',
  AI_PROVIDER: 'backlog-ai-provider',
  GROQ_API_KEY: 'backlog-groq-key',
  GEMINI_API_KEY: 'backlog-gemini-key',
}
```

---

## Intégration IA (Groq/Gemini)

### Configuration (constants/config.ts)

```typescript
AI_CONFIG = {
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  GEMINI_MODEL: 'gemini-1.5-flash-latest',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
}
```

### Flux de Génération

1. Utilisateur saisit description en langage naturel
2. `generateFromDescription()` appelle l'API configurée
3. Réponse JSON parsée avec Zod
4. Formulaire pré-rempli avec les données

### Sécurité

- Clés API stockées dans localStorage (côté client uniquement)
- Jamais de clés dans les logs
- Jamais de clés dans le code source

---

## Composants UI: Conventions

### Primitives (components/ui/)

Tous les composants UI de base sont dans `components/ui/`. Toujours les utiliser plutôt que recréer.

| Composant | Usage |
|-----------|-------|
| `Modal` | Tous les dialogs (size: sm/md/lg/xl/full) |
| `Icons` | Tous les SVG (30+ disponibles) |
| `Badge` | Labels colorés |
| `Spinner` | Chargement (FullPageSpinner, InlineSpinner) |
| `Progress` | Barres de progression |
| `ListEditor` | Édition de listes (texte ou checkboxes) |

### Icônes Centralisées

**JAMAIS** créer une icône inline. Toujours l'ajouter à `components/ui/Icons.tsx`:

```typescript
// CORRECT
import { SparklesIcon } from '../ui/Icons';

// FAUX
const MyIcon = () => <svg>...</svg>;
```

---

## Tauri: Spécificités Desktop

### Détection de l'Environnement

```typescript
import { isTauri } from './lib/tauri-bridge';

if (isTauri()) {
  // Code spécifique Tauri
} else {
  // Code Web (File System Access API)
}
```

### Fonctions Tauri-Bridge

```typescript
readTextFileContents(path)      // Lire fichier
writeTextFileContents(path, content) // Écrire fichier
fileExists(path)                // Vérifier existence
openFolderDialog()              // Dialog sélection dossier
joinPath(...parts)              // Concaténation chemins (Windows-aware)
```

### Piège Windows: fileExists()

La fonction `exists()` de Tauri est parfois unreliable sur Windows. Le bridge utilise un fallback:

```typescript
// Essaie exists(), sinon tente readTextFile() et catch l'erreur
```

---

## Angles Morts & Pièges Connus

### 1. Race Condition TypeConfig
**Symptôme:** Mauvais types affichés lors de la création d'item
**Cause:** localStorage non synchronisé
**Solution:** Appeler `saveTypeConfig()` immédiatement après `setConfig()`

### 2. Round-Trip Markdown
**Symptôme:** Perte de formatage ou commentaires
**Cause:** Reconstruction au lieu d'utiliser rawMarkdown
**Solution:** Ne reconstruire QUE si `_modified: true`

### 3. Checkbox Toggle
**Symptôme:** Checkboxes qui ne se sauvegardent pas
**Cause:** `toggleCriterion` doit modifier rawMarkdown directement
**Solution:** Regex replace dans rawMarkdown, pas juste dans l'objet

### 4. Screenshots Path
**Symptôme:** Images non trouvées
**Cause:** Chemins relatifs vs absolus
**Solution:** Toujours utiliser `.backlog-assets/screenshots/`

### 5. Tauri Process Lock
**Symptôme:** Build échoue "fichier utilisé par un autre processus"
**Cause:** ticketflow.exe toujours en cours
**Solution:** `taskkill /F /IM ticketflow.exe` avant rebuild

---

## Checklist Avant Commit

```
[ ] pnpm build passe sans erreur
[ ] pnpm lint passe sans erreur
[ ] Fonctionnalité testée manuellement
[ ] Aucune régression sur les fonctionnalités existantes
[ ] Console.log de debug retirés
[ ] Imports inutilisés supprimés
[ ] Pas de `any` dans le code
```

---

## Convention de Commits

Format: `type(scope): message`

### Types
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `refactor`: Refactorisation sans changement de comportement
- `style`: Formatage, pas de changement de code
- `docs`: Documentation uniquement
- `chore`: Maintenance, dépendances

### Exemples
```
feat(editor): add screenshot paste support
fix(typeconfig): resolve race condition on initialize
refactor(ui): centralize all icons in Icons.tsx
```

---

## Workflow de Développement

### Nouveau Feature

1. Créer todo list avec les étapes
2. Explorer le code existant (hooks, components concernés)
3. Implémenter en commits atomiques
4. Tester chaque étape
5. Build final avant merge

### Correction de Bug

1. Reproduire le bug
2. Identifier la cause racine (pas les symptômes)
3. Écrire le fix minimal
4. Tester que le bug est corrigé
5. Vérifier les régressions possibles
6. Commit avec `fix(scope): description`

### Refactoring

1. S'assurer que tout fonctionne AVANT
2. Faire des commits atomiques
3. Build après CHAQUE changement
4. S'assurer que tout fonctionne APRÈS
5. Commit avec `refactor(scope): description`

---

## Tests (À Implémenter)

**État actuel:** Aucun test automatisé

**Plan recommandé:**
1. Ajouter Vitest
2. Commencer par `lib/parser.ts` et `lib/serializer.ts`
3. Puis `types/guards.ts`
4. Puis les hooks critiques

**Commande future:**
```bash
pnpm test                 # Lancer tous les tests
pnpm test -- --watch      # Mode watch
```

---

## Troubleshooting

### Build TypeScript échoue

1. Vérifier les imports inutilisés
2. Vérifier les variables non utilisées
3. Vérifier les types manquants

### Tauri ne lance pas

1. Vérifier que le serveur Vite tourne (`pnpm dev`)
2. Vérifier les logs Rust dans le terminal
3. Vérifier `src-tauri/tauri.conf.json`

### Types incorrects dans l'éditeur

1. Vérifier le localStorage (DevTools -> Application)
2. Chercher la clé `ticketflow-type-config-*`
3. Supprimer si corrompu, recharger le fichier

### Screenshots non affichés

1. Vérifier le dossier `.backlog-assets/screenshots/`
2. Vérifier les permissions fichier (Tauri)
3. Vérifier le format du path dans le Markdown

---

*Dernière mise à jour: 2026-01-03*
