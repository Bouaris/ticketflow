# Ticketflow

Application de gestion de backlog produit avec génération IA.

![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Gestion de Tickets
- **Types dynamiques** - Créez vos propres types (Bug, Feature, API, Court-terme, Long-terme...)
- **Vue Kanban** - Visualisez et réorganisez vos tickets par drag & drop
- **Vue Liste** - Tableau triable avec toutes les colonnes
- **Critères d'acceptation** - Checklist intégrée avec progression visuelle
- **Filtres & recherche** - Trouvez rapidement vos tickets

### Génération IA
- **Mode IA** - Décrivez votre idée en langage naturel, l'IA génère un ticket complet
- **Affinage IA** - Améliorez un ticket existant avec un prompt personnalisé
- **Analyse Backlog** - Priorisation automatique avec scores, regroupements et détection de bugs bloquants
- **Providers** - Support Groq (gratuit), Gemini et OpenAI (GPT-4o)

### Captures d'écran
- **CTRL+V** - Collez directement depuis le presse-papier
- **Drag & drop** - Glissez des images dans l'éditeur
- **Stockage local** - Images dans `.backlog-assets/screenshots/`
- **Indicateur visuel** - Icône caméra sur les tickets avec captures

### Export & Partage
- **Export Markdown** - Copiez un ticket formaté pour le partager
- **Chemins absolus** - Screenshots avec chemins complets pour référence externe
- **Format portable** - Markdown standard compatible avec tous les outils

### Desktop App (Windows)
- **Application native** - Exécutable Windows autonome via Tauri
- **Gestionnaire de projets** - Créez et gérez plusieurs backlogs
- **Accès fichiers natif** - Performance optimale sans limitations navigateur
- **System tray** - Minimisation dans la barre des tâches
- **Mise à jour automatique** - Notification et installation des nouvelles versions

## Installation

### Option 1: Application Desktop (Recommandé)

Téléchargez le dernier installateur depuis les [Releases](https://github.com/Bouaris/ticketflow/releases):
- `Ticketflow_x.x.x_x64-setup.exe` (Installateur NSIS)
- `Ticketflow_x.x.x_x64_en-US.msi` (Installateur MSI)

### Option 2: Version Web

#### Prérequis
- Node.js 18+
- pnpm (recommandé) ou npm
- Chrome ou Edge (pour File System Access API)

#### Setup

```bash
# Cloner le repo
git clone https://github.com/Bouaris/ticketflow.git
cd ticketflow

# Installer les dépendances
pnpm install

# Lancer en développement
pnpm dev

# Build production
pnpm build
```

### Option 3: Build Desktop depuis les sources

```bash
# Prérequis: Rust + Node.js
pnpm install
pnpm tauri build
```

## Usage

### Premier lancement
1. **Desktop** - Créez un nouveau projet ou ouvrez un dossier existant
2. **Web** - Ouvrez un fichier Markdown existant ou créez-en un nouveau

### Créer un ticket
1. Cliquez sur le bouton **+** (coin inférieur droit)
2. Choisissez **Mode Manuel** ou **Mode IA**
3. Remplissez les champs et sauvegardez

### Mode IA
1. Décrivez votre besoin en langage naturel
2. L'IA génère automatiquement tous les champs
3. Ajustez si nécessaire et sauvegardez

### Captures d'écran
- **CTRL+V** dans l'éditeur pour coller une capture
- **Glisser-déposer** des fichiers images
- Les images sont stockées localement dans `.backlog-assets/screenshots/`

### Export de ticket
1. Cliquez sur un ticket pour ouvrir le panneau de détail
2. Cliquez sur **Exporter le ticket**
3. Copiez le markdown formaté pour le partager

### Configuration IA

1. Ouvrez les paramètres (icône engrenage)
2. Choisissez votre fournisseur:
   - **Groq** (recommandé) - [console.groq.com/keys](https://console.groq.com/keys) - 14,400 req/jour gratuit
   - **Gemini** - [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
3. Entrez votre clé API

## Format Markdown

Ticketflow utilise un format Markdown structuré:

```markdown
# MonProjet - Product Backlog

## Table des matières
- [1. BUGS](#1-bugs)
- [2. COURT TERME](#2-court-terme)

---

## 1. BUGS

### BUG-001 | 🐛 Bug d'affichage du header

**Composant:** Extension Chrome
**Sévérité:** P2 - Majeur
**Effort:** M (Medium)
**Description:** Le header ne s'affiche pas correctement sur mobile.

**Critères d'acceptation:**
- [ ] Header affiché correctement
- [ ] Tests responsive passent

**Screenshots:**
![BUG-001_1234567890](.backlog-assets/screenshots/BUG-001_1234567890.png)

---
```

## Structure du Projet

```
ticketflow/
├── src/
│   ├── components/        # Composants React
│   │   ├── ui/            # Primitives UI réutilisables
│   │   ├── editor/        # Modal d'édition
│   │   ├── kanban/        # Vue Kanban
│   │   ├── list/          # Vue Liste
│   │   ├── detail/        # Panneau de détail
│   │   ├── filter/        # Barre de filtres
│   │   ├── export/        # Modal d'export
│   │   └── welcome/       # Page d'accueil
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilitaires (parser, serializer, AI)
│   ├── types/             # Types TypeScript & Zod schemas
│   └── constants/         # Constantes et configuration
├── src-tauri/             # Backend Rust (Tauri)
├── public/                # Assets statiques
└── dist/                  # Build production
```

## Technologies

| Catégorie | Technologie |
|-----------|-------------|
| Frontend | React 19, TypeScript 5.9 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Desktop | Tauri 2 (Rust) |
| Validation | Zod 4 |
| Drag & Drop | @dnd-kit |
| IA | Groq (Llama 3.3), Gemini |

## Changelog

Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique complet des versions.

### Dernière version: v1.4.2
- **Analyse IA du Backlog**: Priorisation avec scores 0-100, regroupements intelligents
- **Types personnalisés robustes**: Sections vides comme "BUG V5" maintenant supportées
- **Export fiable**: Contenu toujours à jour après raffinage IA
- **3 providers IA**: Groq, Gemini, OpenAI (GPT-4o)

## Roadmap

- [x] Application desktop Windows (Tauri)
- [x] Système de types dynamiques
- [x] Export de tickets Markdown
- [ ] Synchronisation cloud optionnelle
- [ ] Export PDF
- [ ] Intégration GitHub Issues
- [ ] Version macOS/Linux

## License

MIT License - voir [LICENSE](LICENSE)

## Contributing

Les contributions sont les bienvenues ! Ouvrez une issue ou une PR.

---

**Développé avec Claude Code** | [Anthropic](https://anthropic.com)
