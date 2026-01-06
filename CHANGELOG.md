# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.2.0] - 2026-01-06

### Ajouté
- **AIRefineModal**: Affinage IA avec prompt personnalisé et prévisualisation
- **WhatsNewModal**: Affichage des nouveautés après mise à jour (CT-003)
- Bouton "Changelog" dans les paramètres pour consulter l'historique
- Dépendances et contraintes dans la génération IA
- Parsing automatique du CHANGELOG.md embarqué au build

### Corrigé
- Largeur colonnes Kanban persistée par projet
- Positionnement modal définitif + layout dynamique
- Prop name CheckboxListEditor (onUpdateText)

### Refactoring
- Audit architecture: god objects split + accessibilité
- Phase 4.3 audit + tests hooks

### Tests
- Coverage étendu de 27% à 62.27% (375+ tests)
- useUpdater: coverage 46.8% → 98.07%
- Infrastructure test-utils complète

---

## [1.1.3] - 2026-01-04

### Ajouté
- Injection automatique CLAUDE.md/AGENTS.md dans les prompts IA (CT-006)
- Affichage du nom du projet dans le header (CT-007)
- Toggle 1x/2x largeur colonnes Kanban avec persistence localStorage (CT-005)
- Indicateur visuel du contexte IA chargé

---

## [1.1.2] - 2026-01-04

### Ajouté
- Virtual scrolling Kanban pour performance 1000+ items
- Recherche indexée instantanée (MiniSearch)
- Système Undo/Redo (Ctrl+Z / Ctrl+Y, 50 états max)
- Roadmap stratégique 2026

### Corrigé
- Affichage Kanban: virtualisation conditionnelle (< 15 items = rendu classique)

## [1.1.1] - 2026-01-04

### Corrigé
- Animation CSS `animate-fade-in` manquante
- Unification du schema `CriterionSchema` (default false)
- Type `suggestedSeverity` (null → undefined)

### Refactoring
- Extraction `hexToRgba()` dans lib/utils.ts (DRY)
- Suppression dead code serializer (wrappers inline)
- Suppression exports legacy ai.ts
- Nettoyage CSS variables orphelines
- Standardisation backdrop opacity

### Tests
- Infrastructure test-utils (setup, mocks, fixtures)
- Configuration Playwright E2E

## [1.1.0] - 2026-01-04

### Ajouté
- System tray avec minimisation dans la barre des tâches
- Protection single-instance (empêche plusieurs fenêtres)
- Système de mise à jour automatique via GitHub Releases
- Modal de confirmation pour quitter sans sauvegarder
- Bouton "Vérifier les mises à jour" dans Paramètres
- Badge notification rouge sur Settings quand une mise à jour est disponible mais reportée
- Smart dismiss: le modal de mise à jour ne réapparaît pas après "Plus tard" (sauf vérification manuelle)
- Persistance du dismiss entre les sessions (localStorage)

### Corrigé
- Bug du logo violet géant dans les suggestions IA
- Nom de l'action Rust dans le workflow CI
- Bug du modal de mise à jour qui ne réapparaissait pas après clic sur "Vérifier"

## [1.0.0] - 2026-01-02

### Ajouté
- Gestion complète du backlog produit (CRUD tickets)
- Génération IA avec Groq (Llama 3.3) et Gemini (1.5 Flash)
- Système de screenshots intégré avec stockage local
- Export des tickets pour clipboard (format Markdown)
- Application desktop Tauri pour Windows
- Vue Kanban avec drag & drop
- Vue liste avec filtres avancés
- Types de tickets dynamiques et personnalisables
- Sélecteur de provider IA (Groq/Gemini)
- Parsing et round-trip Markdown préservant le formatage
- Project Launcher style GitHub Desktop
