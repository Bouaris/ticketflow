# Plan : Conversion Desktop avec Electron

## Résumé

Transformer le Backlog Manager web en application desktop standalone avec:
- **Electron** comme framework
- **Wizard d'installation** au premier lancement
- **Écran d'accueil** avec liste des projets récents

---

## Architecture Cible

```
backlog-app/
├── electron/                    # NOUVEAU - Process principal
│   ├── main.ts                 # Entry point Electron
│   ├── preload.ts              # Bridge sécurisé renderer↔main
│   └── ipc/                    # Handlers IPC
│       ├── fileOps.ts          # Opérations fichiers
│       ├── projectManager.ts   # Gestion projets
│       └── shortcuts.ts        # Création raccourcis
├── src/                        # Renderer (React existant)
│   ├── screens/                # NOUVEAU
│   │   ├── WelcomeScreen.tsx   # Écran d'accueil
│   │   └── SetupWizard.tsx     # Wizard première installation
│   ├── lib/
│   │   ├── electron-bridge.ts  # NOUVEAU - API pour appeler main
│   │   └── ... (existant)
│   └── ... (composants existants)
├── electron-builder.json       # NOUVEAU - Config packaging
└── package.json                # Mise à jour scripts
```

---

## Fonctionnalités

### 1. Premier Lancement (Setup Wizard)
```
┌─────────────────────────────────────┐
│  🎉 Bienvenue dans Backlog Manager  │
│                                     │
│  Étape 1/3: Dossier de travail      │
│  [Choisir un dossier...]            │
│                                     │
│  Étape 2/3: Créer un raccourci      │
│  ☑ Bureau  ☐ Menu Démarrer          │
│                                     │
│  Étape 3/3: Premier projet          │
│  ○ Créer un nouveau backlog         │
│  ○ Ouvrir un backlog existant       │
│                                     │
│              [Terminer]             │
└─────────────────────────────────────┘
```

### 2. Écran d'Accueil (après setup)
```
┌─────────────────────────────────────┐
│  📋 Backlog Manager                 │
├─────────────────────────────────────┤
│  Projets récents:                   │
│  ┌─────────────────────────────┐    │
│  │ 📁 AudioPilot               │    │
│  │    C:\Projets\AudioPilot    │    │
│  │    Modifié: il y a 2h       │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ 📁 Mon App                  │    │
│  │    D:\Dev\MonApp            │    │
│  │    Modifié: hier            │    │
│  └─────────────────────────────┘    │
│                                     │
│  [+ Nouveau projet] [Ouvrir...]     │
└─────────────────────────────────────┘
```

### 3. Application Principale
- Identique à l'app web actuelle
- Menu: Fichier > Ouvrir/Nouveau/Récents
- Fenêtre native avec titre du projet

---

## Fichiers à Créer

| Fichier | Rôle |
|---------|------|
| `electron/main.ts` | Process principal, création fenêtre, menu |
| `electron/preload.ts` | Bridge IPC sécurisé (contextBridge) |
| `electron/ipc/fileOps.ts` | Lecture/écriture fichiers via fs |
| `electron/ipc/projectManager.ts` | CRUD projets récents (JSON config) |
| `electron/ipc/shortcuts.ts` | Création raccourcis Windows |
| `src/screens/WelcomeScreen.tsx` | Écran d'accueil avec liste projets |
| `src/screens/SetupWizard.tsx` | Wizard première installation |
| `src/lib/electron-bridge.ts` | Wrapper pour appels IPC côté renderer |
| `electron-builder.json` | Configuration packaging/installer |

---

## Fichiers à Modifier

| Fichier | Modification |
|---------|--------------|
| `package.json` | Ajouter deps Electron, scripts build |
| `vite.config.ts` | Config pour build renderer Electron |
| `src/App.tsx` | Router: Welcome → Setup → Main |
| `src/lib/fileSystem.ts` | Utiliser electron-bridge au lieu de FSA |
| `src/hooks/useFileAccess.ts` | Adapter pour IPC |
| `src/hooks/useScreenshotFolder.ts` | Adapter pour IPC |
| `index.html` | CSP pour Electron |

---

## Implémentation par Phases

### Phase 1: Setup Electron (2h)
1. Installer dépendances: `electron`, `electron-builder`, `vite-plugin-electron`
2. Créer `electron/main.ts` - fenêtre basique
3. Créer `electron/preload.ts` - bridge vide
4. Configurer `vite.config.ts` pour dual-build
5. Scripts npm: `electron:dev`, `electron:build`

### Phase 2: Bridge IPC Fichiers (3h)
1. `electron/ipc/fileOps.ts`:
   - `openFile()` → dialog.showOpenDialog + fs.readFile
   - `saveFile(path, content)` → fs.writeFile
   - `openDirectory()` → dialog.showOpenDialog
   - `readImage(path)` → fs.readFile → base64
   - `writeImage(path, base64)` → fs.writeFile
   - `deleteFile(path)` → fs.unlink
2. `electron/preload.ts` - exposer API via contextBridge
3. `src/lib/electron-bridge.ts` - wrapper TypeScript

### Phase 3: Gestion Projets (2h)
1. `electron/ipc/projectManager.ts`:
   - Config stockée dans `%APPDATA%/backlog-manager/config.json`
   - `getRecentProjects()` → liste des projets
   - `addRecentProject(path, name)` → ajouter
   - `removeRecentProject(path)` → supprimer
   - `isFirstLaunch()` → boolean
   - `markSetupComplete()` → flag
2. Structure config:
```json
{
  "setupComplete": true,
  "recentProjects": [
    {"path": "C:/Projets/AudioPilot", "name": "AudioPilot", "lastOpened": 1704153600000}
  ],
  "shortcuts": {"desktop": true, "startMenu": false}
}
```

### Phase 4: UI Welcome + Wizard (3h)
1. `src/screens/SetupWizard.tsx`:
   - Étape 1: Sélection dossier de travail
   - Étape 2: Choix raccourcis (checkboxes)
   - Étape 3: Créer/Ouvrir premier projet
   - Boutons Précédent/Suivant/Terminer
2. `src/screens/WelcomeScreen.tsx`:
   - Liste projets récents (cards cliquables)
   - Bouton "Nouveau projet"
   - Bouton "Ouvrir..."
   - Supprimer projet de la liste (clic droit ou bouton)
3. Modifier `App.tsx`:
   - Check `isFirstLaunch()` → WelcomeScreen ou SetupWizard
   - Router vers Main après sélection projet

### Phase 5: Adaptation Code Existant (2h)
1. `src/lib/fileSystem.ts`:
   - Détecter environnement: `window.electronAPI` existe?
   - Si Electron: utiliser bridge IPC
   - Si Web: garder File System Access API
2. `src/hooks/useFileAccess.ts` - même logique
3. `src/hooks/useScreenshotFolder.ts` - même logique
4. Supprimer checks "navigateur non supporté"

### Phase 6: Shortcuts Windows (1h)
1. `electron/ipc/shortcuts.ts`:
   - Utiliser `windows-shortcuts` ou script PowerShell
   - Créer `.lnk` sur Bureau
   - Créer entrée Menu Démarrer
2. Appeler depuis Setup Wizard

### Phase 7: Menu Application (1h)
1. Menu natif dans `electron/main.ts`:
   - Fichier > Nouveau / Ouvrir / Récents / Quitter
   - Édition > Annuler / Couper / Copier / Coller
   - Aide > À propos
2. Sous-menu "Récents" dynamique

### Phase 8: Packaging (2h)
1. `electron-builder.json`:
   - Target: NSIS installer (.exe)
   - App ID, nom, icône
   - Auto-update config (optionnel)
2. Build: `npm run electron:build`
3. Output: `dist/Backlog Manager Setup.exe`

---

## Flow Utilisateur Final

```
1. User double-clique sur l'installeur
2. Installation Windows classique
3. Premier lancement → Setup Wizard
   a. Choix dossier de travail
   b. Création raccourci bureau
   c. Créer nouveau backlog
4. App s'ouvre avec le backlog vide
5. User crée des tickets, ajoute screenshots
6. User ferme l'app
7. Prochain lancement → Écran d'accueil
   - Voit son projet récent
   - Clique dessus → ouvre directement
```

---

## Dépendances à Ajouter

```json
{
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "vite-plugin-electron": "^0.29.0",
    "vite-plugin-electron-renderer": "^0.14.0"
  }
}
```

---

## Estimation

| Phase | Durée |
|-------|-------|
| 1. Setup Electron | 2h |
| 2. Bridge IPC Fichiers | 3h |
| 3. Gestion Projets | 2h |
| 4. UI Welcome + Wizard | 3h |
| 5. Adaptation Code | 2h |
| 6. Shortcuts Windows | 1h |
| 7. Menu Application | 1h |
| 8. Packaging | 2h |
| **Total** | **~16h** |

---

## Prêt pour implémentation

Ordre d'exécution:
1. Phase 1: Setup Electron de base
2. Phase 2: Bridge IPC pour fichiers
3. Phase 5: Adapter le code existant (pour que l'app fonctionne)
4. Phase 3: Gestion projets
5. Phase 4: UI Welcome + Wizard
6. Phase 6: Shortcuts
7. Phase 7: Menu
8. Phase 8: Packaging final
