# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [2.2.1] - 2026-02-19

> **"Battle-Ready"** — Stress-tested, audited, refactored, and hardened for production.

### Added — Stress Testing & Performance

- **23+ stress tests** validating CRUD at 1000+ ticket scale, bulk import endurance (50x20 rounds), FTS5 search <100ms, concurrent operations
- **PERF-REPORT.md** with concrete benchmarks: INSERT 7.48ms/1000, SELECT ALL 0.31ms, memory 5.82MB peak
- **ListView virtualization** with `@tanstack/react-virtual` — padding-based spacer rows for 500+ items
- **React.memo** on KanbanCard preventing sibling re-renders during drag & sort

### Added — Codebase Audit & Gap Closure

- **AUDIT-REPORT.md** consolidating 44 prioritized findings (0 critical, 7 high, 24 medium, 13 low)
- **OWASP Desktop Top 10 delta review** covering v2.1 and v2.2 changes
- **4 gap closure phases** (33-36) resolving all 44 audit findings

### Added — README Showcase

- **Hero light mode screenshot** as README header image
- **3 animated GIFs** demonstrating AI generation, bulk import, and command palette workflows
- **3x2 media gallery** with 6 app screenshots
- **"Built with GSD"** attribution (badge, section, footer)

### Changed — Architecture Refactoring

- **ai.ts** split from 2235→487 lines into 6 focused modules (ai-client, ai-config, ai-maintenance, ai-analysis, ai-prompts, ai)
- **ProjectWorkspace.tsx** decomposed from 1569→555 lines into 5 hooks + WorkspaceDialogs component
- **useAIFeedbackStats** hook extracted from AISettingsModal (database queries no longer called from UI component)
- **ProviderCard** static objects moved to module scope, inline SVG replaced with InfoIcon

### Fixed — Type Safety & Critical Bugs

- **initTelemetry()** now idempotent — duplicate calls no longer stack event listeners (SMELL-010)
- **Type-safe provider selection** via `isBuiltInProvider` type predicate (eliminates all `as any` casts)
- **Zod-inferred BulkTicket type** replaces `ticket: any` in ai-bulk.ts
- **chatPanel.loadHistory** added to useEffect dependency array (no stale closure on project switch)
- **STORAGE_KEYS centralized** — `ticketflow-questioning-mode` and `ticketflow-locale` imported from constants

### Fixed — Dead Code & Dependencies

- **11 DEAD-xxx findings removed** — MaintenanceModal.tsx deleted, 5 unused exports purged, 3 icon duplicates merged
- **`_projectPath` parameter removed** from `getEffectiveAIConfig` and all 16+ call sites
- **SHA-pinned CI actions** in ci.yml (eliminates tag-mutation supply chain risk)
- **Tauri ecosystem updated** to 2.10.x, all npm patch/minor updates applied
- **bytes/time Cargo CVEs resolved** via cargo update

### Removed

- Dead code: MaintenanceModal, clearTelemetry, getRecentTelemetry, getBuiltInProvider, getDefaultModelForProvider, getProjectAIConfigKey, shutdownTelemetry, mockIpcWithState

### Security

- SHA-pinned all GitHub Actions (no more tag-pinned supply chain risk)
- IPC api_key pass-through and devtools-always-enabled documented as accepted risks in SECURITY.md
- Tracked Cargo CVEs: rsa 0.9.x and rkyv 0.7.x (no upstream fix, documented)

## [2.2.0] - 2026-02-18

> **"Quality & Insights"** — Test infrastructure, telemetry, and CI pipeline.

### Added — Telemetry & Privacy
- **PostHog telemetry** with full GDPR consent flow (ConsentDialog, settings toggle, 15 instrumented events)
- **Rust IPC relay** for telemetry (ph_send_batch, SQLite offline queue, startup_flush on app launch)
- **PRIVACY.md** documenting all data collection practices and user rights

### Added — Test Infrastructure
- **Vitest 4.x** test infrastructure with Tauri IPC mocks (setupTauriMocks)
- **490+ unit tests** across 22 files: parser 86%, serializer 94%, ai-retry 80%, ai-health 100%
- **GitHub Actions CI workflow** — automated tests + coverage on every push/PR to master
- **Per-file coverage thresholds** at 70% on all critical modules

### Fixed
- **startup_flush timing** — Rust telemetry relay now correctly flushes queued events on app startup

### Removed
- Dead code: `BatchPayload` type, unused imports across telemetry modules

## [2.1.0] - 2026-02-17

> **"AI Refresh"** — Full AI provider registry overhaul with custom endpoint support.

### Added — AI Provider Registry
- **Provider Registry SSOT** (`ai-provider-registry.ts`) with built-in providers + full CRUD for custom providers
- **Custom OpenAI-compatible providers** — add Ollama, LM Studio, or any OpenAI-compatible endpoint
- **Settings split** — App Settings (language, theme, updates, backups) and AI Settings (providers, keys, models) as separate modals
- **Provider health check** — 5-type error classification (auth, rate_limit, timeout, network, unknown)
- **AbortSignal cancellation** for AI generation with visible cancel button
- **Generation progress UX** — per-step status indicators during AI generation
- **Model resolution** with 3-tier fallback (persisted preference > registry default > hardcoded)
- **Model selector dropdown** per provider in AI settings

### Fixed
- `resolveModelForProvider()` missing function (gap closure)

### Changed
- **CSP** updated with `https:` scheme-source to support custom AI provider endpoints

## [2.0.0] - 2026-02-16

> **"Public Release"** — Open-source release with clean history, signed binaries, and CI/CD.

### Added
- **Fresh git repository** with clean history (zero leaked secrets, gitleaks audit passed)
- **MIT License**
- **SECURITY.md** — OWASP Desktop Top 10 compliance, CSP documentation, key storage transparency
- **README.md** — Full feature documentation for public OSS release
- **Signed release binaries** (Ed25519 minisign) — all releases signed for auto-updater verification
- **GitHub Actions CI/CD** — automated release pipeline with `tauri-action` for Windows `.exe`/`.msi`
- **Auto-updater** with signature verification via `latest.json` endpoint

### Changed
- **Signing key rotated** (breaking change from v1.x — users on v1.x must manually reinstall to receive v2.x updates)

### Security
- ✅ Zero secrets in source code (gitleaks audit)
- ✅ Zero high/critical vulnerabilities (pnpm audit)

## [1.6.0] - 2026-02-14

> **Repository Migration:** Git history was reset at v1.6.0 for security and hygiene.
> All source code is preserved. If you previously cloned or forked this repository,
> please clone fresh from the new history.

### Added — Repository Hygiene
- Fresh git repository with clean history (zero leaked secrets)
- Comprehensive .gitignore preventing tracking of signing keys, databases, and internal docs
- Security audit compliance (Phase 18)

### Ajouté — Import en Masse (Smart Import)
- **Wizard d'import en 4 étapes** (Saisie → Traitement → Revue → Confirmation) pour créer plusieurs tickets d'un coup
- **Extraction IA depuis du texte brut** — collez n'importe quel texte, l'IA en extrait des tickets structurés
- **Import d'images par drag & drop** avec extraction multimodale (Gemini/OpenAI)
- **Édition inline en revue** — modifiez titre, type, priorité, effort et description avant création
- **Scores de confiance** affichés sur chaque ticket extrait avec signalement visuel des items à faible confiance
- **Barre de progression par lot** avec possibilité d'annulation pendant le traitement
- Découpage intelligent par catégorie avec retry et backoff exponentiel
- Raccourci Ctrl+Shift+I et entrée dans la palette de commandes
- Insertion atomique en base (tout ou rien) avec allocation d'IDs sans collision

### Ajouté — Onboarding Enrichi
- **Wizard d'onboarding étendu à 7 étapes** (ajout configuration IA et présentation GSD)
- **Étape AI Setup** — configuration du provider et de la clé API pendant l'onboarding
- **Étape GSD Info** — présentation du framework de planification avec CTA vers les paramètres
- **Double persistance** (localStorage + SQLite) pour fiabilité accrue

### Ajouté — Internationalisation Complète
- **Traduction anglaise complète** (~100 nouvelles clés i18n couvrant 100% de l'interface)
- **Prompts IA sensibles à la locale** — l'IA génère dans la langue de l'utilisateur
- Migration de toutes les chaînes françaises hardcodées vers le système i18n

### Ajouté — Page d'Accueil Repensée
- **Section favoris** avec toggle étoile sur les projets
- Design repensé avec meilleure UX et organisation visuelle
- Persistance synchrone des projets corrigée

### Supprimé
- Import Markdown obsolète (UI, `markdown-import.ts`, boutons associés)
- 5 clés i18n orphelines du namespace welcome

### Corrigé
- **Opérations groupées** : deadlock SQLite résolu (pattern `retryOnBusy` remplace `withTransaction`)
- **Opérations groupées** : closure stale sur suppression en masse corrigée
- **Opérations groupées** : actions valider et archiver ajoutées à la barre d'actions
- **Import en masse** : contrainte FK et retry sur rate-limit pour la création en lot
- **Import en masse** : troncation JSON prévenue par chunking
- **Import en masse** : routage automatique des tickets (sélecteur de section supprimé)
- **Page d'accueil** : persistance des projets — lecture directe localStorage au lieu de l'état React

## [1.5.0] - 2026-02-12

### Ajouté — Dark Mode & Thème
- **Mode sombre complet** avec tokens sémantiques CSS (@theme inline, semantic tokens)
- Toggle clair/sombre avec persistance
- Migration complète de tous les composants vers tokens sémantiques (bg-surface, text-on-surface, border-outline)
- Variante dark personnalisée via `@custom-variant` et `[data-theme="dark"]`

### Ajouté — Command Palette
- **Palette de commandes** (Ctrl+K) avec recherche fuzzy/prefix (MiniSearch)
- Registre de commandes statiques, recherche d'items, parsing langage naturel
- Items récents par projet (localStorage)
- Navigation clavier complète et résultats groupés

### Ajouté — Édition Inline & Opérations Groupées
- **Édition inline** par double-clic sur les cartes Kanban et en vue liste (titre, type, priorité, effort, sévérité)
- **Multi-sélection** (Ctrl+Clic, Shift+Clic) avec barre d'actions flottante
- Opérations groupées: déplacer, supprimer, assigner en masse
- Smart Escape: multi-sélection d'abord, puis panneau détail

### Ajouté — Chat IA & Langage Naturel
- **Panneau de chat IA** (Ctrl+J) avec conversations multi-tours
- Historique de chat persisté en SQLite (20 messages contexte, 200 max DB)
- Suggestions proactives basées sur l'analyse locale du backlog
- Exécution d'actions depuis le chat (priorité, effort, sévérité)
- Support multi-provider (Groq, Gemini, OpenAI) avec mappage Gemini multi-turn

### Ajouté — Polish & Animations
- **Animations spring** (framer-motion) sur cartes Kanban, listes, modals et drag overlay
- **Prévisualisation Markdown** dans le panneau de détail (react-markdown, toggle visual)
- **Quick Capture** (Ctrl+Alt+T) — fenêtre globale de création rapide de tickets
- **Wizard d'onboarding** en 5 étapes (Bienvenue, Thème, Langue, Raccourcis, Prêt)
- **Vues sauvegardées** (filtres personnalisés persistés en SQLite)
- **Tooltips de fonctionnalités** pour guider la découverte (localStorage, auto-dismiss)

### Ajouté — Quick Tasks (post-milestone)
- **Refonte boutons style Linear**: suppression gradients, FAB→toolbar horizontal, dot indicator IA
- **Modal de création IA-first** avec toggle mode et annulation
- **Actions rapides au hover**: supprimer, valider, exporter directement depuis les cartes
- **Onglet Archives** avec stockage .ticketflow et restauration/suppression
- **Header responsive** avec collapse icon-only aux breakpoints étroits
- **Intégration GSD**: contexte IA configurable (2 niveaux curatés), injection .planning/
- **Numérotation monotone** des tickets (table type_counters, pas de réutilisation après archive/delete)
- **Contexte GSD simplifié**: 2 niveaux (essentiel/complet), whitelists curatées
- **Vision IA multimodale**: screenshots envoyés à Gemini (inlineData) et OpenAI (image_url), base64

### Ajouté — Infrastructure (Phase 8)
- Système de migrations SQLite (PRAGMA user_version, 7 migrations)
- Helper `withTransaction()` (BEGIN IMMEDIATE/COMMIT/ROLLBACK)
- Historique delta-based (jsondiffpatch) remplaçant la sérialisation JSON complète
- CSP réactivé dans Tauri (connect-src whitelist: groq, gemini, openai)
- Singletons client IA avec détection de changement de clé API
- Système i18n custom (FR/EN) avec enforcement TypeScript de complétude des locales

### Modifié
- Dead code supprimé: useBacklog, useBacklogHistory, useHistory, useKeyboardShortcuts (~2653 lignes)
- TypeConfig: SQLite seule source de vérité (localStorage supprimé)
- hashPath unifié en export unique dans storage.ts
- parseJsonArray exporté depuis transforms.ts (dédupliqué dans analytics.ts)
- AI clients singletons trackent la clé API pour hot-reload
- Registre de 20 raccourcis clavier (COMMAND_PALETTE ajouté)

### Corrigé
- **Quick Capture**: raccourci changé de Ctrl+Shift+T à Ctrl+Alt+T (conflit navigateur)
- **Quick Capture**: fermeture fenêtre améliorée (close→destroy→window.close fallback)
- **Archive**: IDs archivés inclus dans existingIds pour éviter collision de numérotation
- **Archive**: toolbar masquée et hauteur panneau latéral corrigée en mode archive
- **Archive**: boutons restaurer/supprimer responsifs dans le panneau de détail
- **Screenshots**: alignement du chemin de sauvegarde Tauri avec les refs Markdown + purge archive
- **Types**: config persistée avec deps useEffect correctes
- **Types**: arrêt de la détection de types depuis le Markdown au chargement du projet
- **Types**: chargement config depuis SQLite au lieu du Markdown au démarrage
- **Types**: suppression de types persistée en SQLite
- **UI**: modals de confirmation centrées verticalement
- **IA**: retry silencieux sur 429 rate-limit au lieu d'erreur immédiate
- **IA**: prévention retries inutiles sur 429 et fix matching chemin Windows dans contexte GSD
- **DB**: busy_timeout et logique de retry pour prévenir les locks SQLITE_BUSY
- **DB**: suppression du wrapper transaction sur compteur (prévention nested transaction)
- **DB**: résolution échecs d'initialisation de la base au lancement
- **Raccourcis globaux**: fuite mémoire corrigée (unregister on cleanup)
- **Éditeur**: IDs basés sur compteur dans la génération IA pour prévenir les collisions
- **Sauvegarde**: prévention erreurs de save et réduction latence dans create/archive

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
