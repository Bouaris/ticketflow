# AGENTS.md - Contexte Projet Ticketflow

> Document de référence pour les agents IA travaillant sur ce projet
> Dernière mise à jour: 2026-01-03 | Version: 1.1.0

---

## Vue d'ensemble

**Ticketflow** est une application de gestion de Product Backlog avec génération IA.

| Aspect | Détail |
|--------|--------|
| **Type** | Application desktop + web |
| **Stack** | React 19 · TypeScript 5.9 · Vite 7 · Tailwind 4 · Tauri 2 |
| **Plateformes** | Windows (Tauri) + Web (Chrome/Edge) |
| **Stockage** | Fichiers Markdown locaux |
| **IA** | Groq (Llama 3.3) + Gemini (1.5 Flash) |
| **Repository** | https://github.com/Bouaris/ticketflow |

---

## Architecture

```
ticketflow/
├── src/
│   ├── components/
│   │   ├── ui/              # Primitives (Modal, Icons, ConfirmModal, UpdateModal)
│   │   ├── editor/          # ItemEditorModal (création/édition tickets)
│   │   ├── kanban/          # Vue Kanban drag-drop
│   │   ├── list/            # Vue liste
│   │   ├── detail/          # Panneau de détail
│   │   ├── filter/          # Barre de filtres
│   │   ├── settings/        # SettingsModal, TypeConfigModal
│   │   ├── welcome/         # WelcomePage (launcher)
│   │   └── export/          # ExportModal
│   ├── hooks/
│   │   ├── useBacklog.ts    # État central du backlog
│   │   ├── useFileAccess.ts # Accès fichiers Web/Tauri
│   │   ├── useTypeConfig.ts # Types dynamiques
│   │   ├── useProjects.ts   # Gestion projets
│   │   ├── useUpdater.ts    # Mise à jour auto
│   │   └── useScreenshotFolder.ts
│   ├── lib/
│   │   ├── parser.ts        # ⚠️ CRITIQUE - Markdown → JSON
│   │   ├── serializer.ts    # ⚠️ CRITIQUE - JSON → Markdown
│   │   ├── ai.ts            # Intégration Groq/Gemini
│   │   ├── tauri-bridge.ts  # Bridge Tauri ↔ Web
│   │   └── version.ts       # Constante APP_VERSION
│   └── types/
│       ├── backlog.ts       # Schémas Zod (source de vérité)
│       ├── typeConfig.ts    # Types dynamiques
│       └── project.ts       # Structure projet
├── src-tauri/
│   ├── src/lib.rs           # Backend Rust (tray, plugins)
│   ├── Cargo.toml           # Dépendances Rust
│   ├── tauri.conf.json      # Config Tauri + updater
│   └── capabilities/        # Permissions
├── .claude/
│   └── commands/
│       └── release.md       # Skill /release
├── .github/
│   └── workflows/
│       └── release.yml      # CI/CD GitHub Actions
├── CLAUDE.md                # Instructions pour Claude
├── AGENTS.md                # Ce fichier
├── CHANGELOG.md             # Historique versions
└── README.md                # Documentation utilisateur
```

---

## Fichiers critiques

### Parser/Serializer (Round-trip Markdown)

Le système préserve le formatage utilisateur via `rawMarkdown`:

```typescript
// Si item non modifié → retourner rawMarkdown tel quel
// Si item modifié (_modified: true) → reconstruire depuis données
```

**Fichiers:**
- `src/lib/parser.ts` - Parse Markdown → BacklogItem[]
- `src/lib/serializer.ts` - BacklogItem[] → Markdown

### Versioning

La version est centralisée et injectée par Vite:

```typescript
// src/lib/version.ts
export const APP_VERSION = __APP_VERSION__;

// vite.config.ts
define: {
  __APP_VERSION__: JSON.stringify(packageJson.version)
}
```

**Fichiers à synchroniser lors d'une release:**
1. `package.json` → `"version"`
2. `src-tauri/Cargo.toml` → `version`
3. `src-tauri/tauri.conf.json` → `"version"`

### Tauri Backend

```rust
// src-tauri/src/lib.rs
// Plugins actifs:
// - tauri_plugin_fs (accès fichiers)
// - tauri_plugin_dialog (dialogues natifs)
// - tauri_plugin_shell (liens externes)
// - tauri_plugin_single_instance (une seule fenêtre)
// - tauri_plugin_updater (mise à jour auto)
// - tauri_plugin_process (relaunch)

// Fonctionnalités:
// - System tray (minimize to tray)
// - Force quit command
// - Window show/hide on tray events
```

---

## Commandes

### Développement

```bash
pnpm dev              # Serveur dev (localhost:5173)
pnpm build            # Build production
pnpm tauri dev        # App Tauri en mode dev
pnpm tauri build      # Build .exe Windows
```

### Release

Utiliser le skill `/release`:

```
/release 1.2.0
```

Ou manuellement:

```bash
# 1. Mettre à jour versions (3 fichiers)
# 2. Mettre à jour CHANGELOG.md
# 3. Commit + tag + push
git add .
git commit -m "chore: release v1.2.0"
git tag v1.2.0
git push origin master --tags
```

Le workflow GitHub Actions se déclenche automatiquement.

---

## Conventions

### Code

| Règle | Application |
|-------|-------------|
| **No Any** | Utiliser `unknown` si nécessaire |
| **No Dead Code** | Supprimer imports/variables inutilisés |
| **Atomic** | Une modification = Un problème |
| **Clean Debug** | Retirer console.log après debug |

### Composants UI

Toujours utiliser les primitives de `components/ui/`:
- `Modal` → Tous les dialogs
- `ConfirmModal` → Confirmations avec warning
- `Icons` → 30+ icônes centralisées (JAMAIS inline)

### Commits

```
type(scope): message court

Types: feat | fix | refactor | style | docs | chore
Exemples:
- feat(editor): add AI provider selector
- fix(parser): handle fused section separators
```

---

## Workflows

### Mise à jour automatique

```
App démarre
    ↓ (3s delay)
check() → GitHub Releases
    ↓
Si nouvelle version:
    → UpdateModal s'affiche
    → Téléchargement avec progress
    → Installation + relaunch
```

**Endpoint:** `https://github.com/Bouaris/ticketflow/releases/latest/download/latest.json`

### System Tray

- Clic sur X → Minimize to tray (pas fermer)
- Clic gauche tray → Restore window
- Menu tray "Quitter" → Confirmation si unsaved changes

### Single Instance

- Si app déjà ouverte → Focus sur fenêtre existante
- Plugin: `tauri-plugin-single-instance`

---

## Storage

### localStorage

| Clé | Valeur |
|-----|--------|
| `ai-provider` | 'groq' \| 'gemini' |
| `groq-api-key` | Clé API Groq |
| `gemini-api-key` | Clé API Gemini |
| `ticketflow-projects` | Liste projets JSON |

### Fichiers

```
projet/
├── TICKETFLOW_Backlog.md      # Backlog principal
├── TICKETFLOW_Archive.md      # Items archivés
├── .backlog-assets/
│   └── screenshots/           # Captures d'écran
└── .ticketflow-types.json     # Types personnalisés
```

---

## Pièges connus

| Piège | Symptôme | Solution |
|-------|----------|----------|
| Race Condition TypeConfig | Mauvais types | `saveTypeConfig()` immédiat après `setConfig()` |
| Round-Trip Markdown | Perte formatage | Ne reconstruire que si `_modified: true` |
| Tauri Process Lock | Build échoue | `taskkill /F /IM ticketflow.exe` |
| Version hardcodée | Affichage incorrect | Utiliser `APP_VERSION` de `lib/version.ts` |

---

## Secrets GitHub

| Secret | Usage |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signature des builds |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe clé |

---

## Checklist pré-commit

```
[ ] pnpm build passe sans erreur
[ ] Fonctionnalité testée manuellement
[ ] Aucune régression
[ ] Console.log de debug retirés
[ ] Imports inutilisés supprimés
[ ] Pas de `any` dans le code
```

---

*Document généré pour faciliter le travail des agents IA sur ce projet.*
