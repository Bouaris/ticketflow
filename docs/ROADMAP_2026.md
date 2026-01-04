# ROADMAP STRATEGIQUE TICKETFLOW 2026

> **Date:** 2026-01-04
> **Mission:** Positionner Ticketflow dans le Top 1% des outils de backlog management
> **Horizon:** Q1-Q2 2026

---

## DIAGNOSTIC ACTUEL

### Forces (Avantages Compétitifs)

| Force | Détail |
|-------|--------|
| **Round-trip Markdown** | Préservation fidèle du formatage - aucun concurrent ne fait ça |
| **IA Multi-provider** | Groq (gratuit) + Gemini - flexibilité unique |
| **Desktop Native** | Tauri = performance + accès fichiers natif |
| **Types Dynamiques** | Personnalisation colonnes Kanban sans limites |
| **Zero Backend** | Fichiers locaux = vie privée + offline-first |

### Faiblesses Critiques (vs Linear, Jira, Plane)

| Gap | Impact Business |
|-----|-----------------|
| **Pas de Sprints/Cycles** | Impossible planifier releases |
| **Single-user only** | Marché limité aux solo devs |
| **Pas de statuts workflow** | Types ≠ États (To Do → Done) |
| **Pas de dépendances visuelles** | Données stockées mais jamais exploitées |
| **Recherche basique** | Pas de query language ("is:open severity:P0") |
| **Performance 1000+ items** | Freeze sans virtualisation |

---

## TENDANCES MARCHE 2025-2026

### Révolution Agentic AI

> "Unlike traditional AI that reacts to commands, agentic AI acts proactively."

**Exemples concurrents:**
- **Asana AI Studio** - Agents autonomes
- **Linear AI** - Auto-labeling, prédictions
- **Jira Atlassian Intelligence** - Story generation

### Natural Language Queries

> "LLMs enable everyday language for complex queries."

**Opportunité:** "Montre-moi les bugs P0 non résolus depuis 7 jours"

---

## 3 PANS STRATEGIQUES

---

## PAN 1: AI COPILOT PROACTIF

> **Différenciateur Majeur**

### Features

| Feature | Valeur |
|---------|--------|
| **Smart Inbox** | "3 tickets stagnent, 2 bloqués" |
| **Natural Language Query** | Recherche en langage naturel |
| **Auto-Categorization** | Suggère type, priorité, effort |
| **Dependency Alert** | Graph visuel des blocages |
| **Sprint Forecast** | Prédiction completion |

### Architecture

```
src/lib/ai-copilot/
├── analyzer.ts      # Insights backlog
├── query-parser.ts  # NLQ → filtres
├── suggestions.ts   # Suggestions proactives
└── forecaster.ts    # Prédictions

src/components/copilot/
├── SmartInbox.tsx
├── QueryBar.tsx
└── InsightCard.tsx
```

---

## PAN 2: WORKFLOW ENGINE

> **Fondation Pro**

### Features

| Feature | Valeur |
|---------|--------|
| **Statuts Personnalisés** | To Do → In Progress → Done |
| **Cycles/Sprints** | Planification releases |
| **Automations** | When X → Do Y |
| **Burndown Chart** | Progression visuelle |
| **Dependencies Graph** | Vue blocages |

### Architecture

```
src/types/workflow.ts
src/lib/workflow-engine.ts
src/lib/graph.ts
src/hooks/useCycles.ts
src/components/workflow/
src/components/charts/
```

---

## PAN 3: COLLABORATION LAYER

> **Market Expansion**

### Features

| Feature | Valeur |
|---------|--------|
| **Activity Feed** | Historique modifications |
| **Comments** | Discussion + @mentions |
| **Assignation** | Qui fait quoi |
| **Sync Cloud** | Supabase (optionnel) |

### Mode Hybride

- **Local (défaut):** Fichiers .md, single user, offline
- **Sync (opt-in):** Multi-user, real-time, activity log

---

## SEQUENCE EXECUTION

| Phase | Pan | Durée |
|-------|-----|-------|
| **Quick Wins** | Virtual scroll, Search, Undo | 2-3 jours |
| **Phase 1** | Workflow Engine | 2-3 semaines |
| **Phase 2** | AI Copilot | 2 semaines |
| **Phase 3** | Collaboration | 3-4 semaines |

---

## TECHNOLOGIES

| Besoin | Technologie |
|--------|-------------|
| Search | MiniSearch |
| Graphs | D3.js / vis-network |
| Charts | Recharts |
| Sync | Supabase |
| NLQ | Groq structured output |

---

## METRIQUES CIBLES

| Métrique | Actuel | Final |
|----------|--------|-------|
| Items supportés | ~500 | 10000+ |
| Temps recherche | 30s | 1s |
| Users/projet | 1 | 10 |

---

*Roadmap générée le 2026-01-04*
