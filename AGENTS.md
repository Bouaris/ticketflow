# AGENTS.md - Contexte Projet Ticketflow

> Document de référence pour les agents IA travaillant sur ce projet
> Dernière mise à jour: 2026-01-06 | Version: 1.3.0

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

### Release (Processus manuel obligatoire)

⚠️ **GitHub Actions ne génère PAS correctement le `latest.json`**.
La release doit être faite **manuellement**.

Utiliser le skill `/release`:
```
/release 1.3.0
```

#### Étapes clés du processus

1. **Synchroniser les versions** dans 3 fichiers:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Build Tauri**: `pnpm tauri build`

3. **Créer le ZIP pour l'updater** (CRITIQUE):
   ```python
   # DOIT utiliser ZIP_STORED (pas de compression)
   import zipfile
   with zipfile.ZipFile('Ticketflow_X.Y.Z_x64-setup.nsis.zip', 'w', zipfile.ZIP_STORED) as zf:
       zf.write('Ticketflow_X.Y.Z_x64-setup.exe', 'Ticketflow_X.Y.Z_x64-setup.exe')
   ```
   ⚠️ NE PAS utiliser PowerShell `Compress-Archive` ou 7-Zip avec compression

4. **Signer le ZIP**:
   ```bash
   pnpm tauri signer sign -k "<CLE_BASE64>" -p <PASSWORD> "fichier.nsis.zip"
   ```

5. **Créer `latest.json`** avec la signature

6. **Uploader sur GitHub Release**:
   - `Ticketflow_X.Y.Z_x64-setup.exe`
   - `Ticketflow_X.Y.Z_x64-setup.nsis.zip`
   - `Ticketflow_X.Y.Z_x64-setup.nsis.zip.sig`
   - `latest.json`

7. **Vérifier les tailles** (local vs GitHub doivent correspondre)

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
| ZIP compression | "Compression method not supported" | Utiliser Python `zipfile.ZIP_STORED` |
| GitHub upload | Fichier pas remplacé | Vérifier tailles, `gh release delete-asset` si différent |
| Repo privé | "Could not fetch release JSON" | Rendre le repo PUBLIC |
| Signature invalide | Update échoue à l'install | Re-signer le ZIP, mettre à jour latest.json |

---

## Secrets et Clés

### Clé de signature Tauri

| Élément | Valeur |
|---------|--------|
| Chemin clé privée | `~/.tauri/ticketflow.key` |
| Chemin clé publique | `~/.tauri/ticketflow.key.pub` |
| Mot de passe | Demander à l'utilisateur |

**Format de la clé privée** (base64):
```
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5Ci4uLg==
```

**Clé publique** (dans `tauri.conf.json`):
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDBBRDBDMUVDQzg0MkVDMjcK...
```

### Secrets GitHub (optionnels, pour CI/CD)

| Secret | Usage |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signature des builds |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe clé |

---

## Auto-Updater: Architecture technique

### Flux de mise à jour

```
1. App démarre (ou clic "Vérifier mises à jour")
   ↓
2. Fetch: https://github.com/.../releases/latest/download/latest.json
   ↓
3. Compare version courante vs version dans latest.json
   ↓
4. Si nouvelle version disponible:
   → Affiche UpdateModal avec notes de version
   ↓
5. Utilisateur clique "Installer":
   → Télécharge le .nsis.zip depuis l'URL dans latest.json
   → Vérifie la signature avec la clé publique
   → Extrait et exécute l'installateur
   → Relaunch l'app
```

### Structure de latest.json

```json
{
  "version": "1.1.0",
  "notes": "Description des changements",
  "pub_date": "2026-01-03T23:45:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<SIGNATURE_BASE64>",
      "url": "https://github.com/Bouaris/ticketflow/releases/download/v1.1.0/Ticketflow_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

### Fichiers requis pour une release

| Fichier | Obligatoire | Description |
|---------|-------------|-------------|
| `latest.json` | ✅ | Manifest pour l'updater |
| `*.nsis.zip` | ✅ | Installateur zippé (method=store) |
| `*.nsis.zip.sig` | ✅ | Signature du ZIP |
| `*.exe` | Recommandé | Installateur direct (téléchargement manuel) |

### Contraintes critiques

1. **Compression ZIP**: DOIT être `ZIP_STORED` (pas de compression)
   - Tauri utilise la crate `zip` qui ne supporte pas toutes les méthodes
   - PowerShell `Compress-Archive` = ❌ (utilise méthode non supportée)
   - 7-Zip avec compression = ❌
   - Python `zipfile.ZIP_STORED` = ✅

2. **Repository PUBLIC**: L'updater télécharge sans authentification

3. **Vérification des uploads**: GitHub peut ne pas remplacer un fichier existant
   - Toujours vérifier que `Content-Length` local = remote
   - Si différent: `gh release delete-asset` puis re-upload

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
