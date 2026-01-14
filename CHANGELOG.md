# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.4.2] - 2026-01-14

### Corrigé
- **BUG-003**: Sections vides personnalisées disparaissaient du dropdown de types (ex: "BUG V5" sans items)
- Types personnalisés avec espaces maintenant correctement détectés (convertis en underscore: "BUG V5" → "BUG_V5")

### Améliorations
- `detectTypesFromMarkdown()`: Match exact au lieu de `startsWith()` pour éviter faux positifs ("BUG V5" n'est plus mappé à "BUG")
- `ItemTypeSchema`: Support étendu pour underscores et chiffres dans les types personnalisés
- Parser: Création automatique de raw-section markers pour sections vides (préservation de la structure)
- `findTargetSectionIndex()`: Nouvelle stratégie pour matcher les sections vides par titre

### Architecture
- 5 blindspots identifiés et documentés dans le système de types dynamiques
- Robustesse accrue: sections vides sont maintenant des citoyens de première classe

## [1.4.1] - 2026-01-14

### Corrigé
- **BUG-002**: Export ticket après raffinage IA affichait l'ancienne version (race condition entre setState et re-render React)

### Améliorations
- ExportModal génère le contenu au moment du render (plus de snapshot stale)
- Architecture plus robuste: l'item exporté est toujours récupéré depuis le backlog (source de vérité)

## [1.4.0] - 2026-01-10

### Ajouté
- **LT-002 - Analyse IA du Backlog**: Priorisation automatique avec scores 0-100, regroupements intelligents, détection bugs bloquants
- **Score Badges**: Badges colorés (vert/jaune/orange/rouge) affichés sur les cartes Kanban et ListView
- **Panneau d'Analyse IA**: Interface slide-over avec insights, groupements suggérés, boutons accept/reject
- **Cache Session**: Résultats d'analyse cachés 30 minutes avec invalidation intelligente par hash
- **Indicateur Bugs Bloquants**: Badge pulsant rouge pour les bugs qui bloquent d'autres items

### Corrigé
- **BUG-001**: Analyse IA isolée par projet (plus de fuite de données inter-projets)
- Tooltip Score IA: utilisation de React Portal pour z-index correct
- DragOverlay conserve les badges IA pendant le drag & drop
- Progress affiche correctement 1/3, 2/3, 3/3 (corrigé off-by-one)
- Déduplication des résultats IA (priorities, groups, blockingBugs)
- Callbacks ListView optimisés (extraction en variables, plus d'appels multiples)
- Z-index des toasts d'erreur augmentés pour visibilité

### Améliorations
- Hash stable pour invalidation cache (basé sur IDs des items)
- ARIA labels ajoutés pour accessibilité (ScoreBadge, AIBlockingIndicator, GroupPanel)
- Architecture AI robuste avec isolation projet complète

## [1.3.0] - 2026-01-08

### Ajouté
- **OpenAI Provider**: 3e provider IA (GPT-4o, GPT-4o-mini, o1-mini, o3-mini) (LT-003)
- **Config IA par projet**: Choix du provider, modèle et température par projet
- **ProjectSettingsModal**: Interface de configuration projet avec override IA
- **Fichiers contexte configurables**: Sélection des fichiers inclus dans le contexte IA (CT-001)
- Hook `useProjectAIConfig` pour la gestion de l'état IA projet

### Modifié
- Bouton "Paramètres Projet" déplacé du FAB vers le header (style rectangulaire indigo)
- Providers non configurés masqués dans les paramètres projet

### Corrigé
- Footer du panneau de détail correctement positionné dans le slot Modal

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

## [1.1.3] - 2026-01-04

### Ajouté
- Injection automatique CLAUDE.md/AGENTS.md dans les prompts IA (CT-006)
- Affichage du nom du projet dans le header (CT-007)
- Toggle 1x/2x largeur colonnes Kanban avec persistence localStorage (CT-005)
- Indicateur visuel du contexte IA chargé

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
