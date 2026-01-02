# Ticketflow

Application de gestion de backlog produit avec génération IA.

## Features

- **Gestion de tickets** - Créez des tickets Bug, Feature, API, Long-terme
- **Génération IA** - Décrivez votre idée, l'IA génère un ticket complet (Groq ou Gemini)
- **Stockage local** - Vos données restent sur votre machine en format Markdown
- **Captures d'écran** - CTRL+V pour coller, drag & drop, stockage local
- **Drag & drop** - Réorganisez vos tickets facilement
- **Critères d'acceptation** - Checklist intégrée pour chaque ticket
- **Filtres & recherche** - Trouvez rapidement vos tickets

## Installation

### Prérequis
- Node.js 18+
- npm ou pnpm
- Chrome ou Edge (pour File System Access API)

### Setup

```bash
# Cloner le repo
git clone https://github.com/USERNAME/ticketflow.git
cd ticketflow

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build production
npm run build
```

## Usage

1. **Premier lancement** - Ouvrez un fichier Markdown existant ou créez-en un nouveau
2. **Créer un ticket** - Cliquez sur "+ Nouveau" ou utilisez le mode IA
3. **Mode IA** - Décrivez votre besoin en langage naturel, l'IA génère le ticket
4. **Screenshots** - CTRL+V dans l'éditeur pour ajouter une capture
5. **Sauvegarder** - CTRL+S ou clic sur le bouton sauvegarder

### Configuration IA

1. Ouvrez les paramètres (icône engrenage)
2. Choisissez votre fournisseur (Groq recommandé - gratuit)
3. Entrez votre clé API:
   - **Groq**: [console.groq.com/keys](https://console.groq.com/keys) (14,400 req/jour gratuit)
   - **Gemini**: [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

## Format Markdown

Ticketflow utilise un format Markdown standard:

```markdown
## Backlog

### BUG-001 | 🐛 Bug d'affichage du header

**Sévérité:** P2 - Majeur
**Effort:** M
**Composant:** Extension Chrome

**Description:**
Le header ne s'affiche pas correctement...

**Spécifications:**
- Corriger l'alignement CSS
- Tester sur Chrome et Edge

**Critères d'acceptation:**
- [ ] Header affiché correctement
- [ ] Tests passent
```

## Structure du Projet

```
ticketflow/
├── src/
│   ├── components/     # Composants React
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilitaires (parser, AI, filesystem)
│   ├── types/          # Types TypeScript & Zod schemas
│   └── App.tsx         # Composant principal
├── public/             # Assets statiques
└── docs/               # Documentation
```

## Technologies

- **React 19** - UI Framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool
- **Tailwind CSS 4** - Styling
- **Zod** - Validation de données
- **Groq/Gemini** - Génération IA
- **File System Access API** - Accès fichiers local

## Roadmap

- [ ] Version desktop avec Electron
- [ ] Synchronisation cloud optionnelle
- [ ] Export PDF
- [ ] Intégration GitHub Issues

## License

MIT License - voir [LICENSE](LICENSE)

## Contributing

Les contributions sont les bienvenues ! Ouvrez une issue ou une PR.
