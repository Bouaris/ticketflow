# TicketFlow

## What This Is

TicketFlow est une application desktop (Tauri + Web) de gestion de Product Backlog avec generation IA de tickets. Ciblee pour les "vibecoders" — developpeurs solo qui utilisent l'IA pour organiser leurs idees. Positionnement: AI-native, local-first, desktop-first ticket management. Inclut import massif d'idees brutes (texte + images) via IA bulk extraction.

## Core Value

**Application desktop polished et productive: dark mode, command palette, inline editing, AI chat, bulk import, modular AI providers — une experience comparable a Linear pour les projets personnels.**

## Requirements

### Validated

- ✓ **SQL-01..10**: SQLite persistence complete — v1.0 Phase 1
- ✓ **STATE-01..05**: Per-project state isolation — v1.0 Phase 2
- ✓ **BACKUP-01..03**: Backup & migration system — v1.0 Phase 2
- ✓ **AI-01..10**: AI generation with few-shot, questioning, feedback — v1.0 Phases 3-4
- ✓ **SEARCH-01**: FTS5 full-text search — v1.0 Phase 5
- ✓ **REL-01..02**: Ticket relations & graph visualization — v1.0 Phase 5
- ✓ **UX-01..03**: Keyboard shortcuts & templates — v1.0 Phase 6
- ✓ **DASH-01..02**: Analytics dashboard — v1.0 Phase 7
- ✓ **IO-01..04**: Markdown import/export — v1.0 Phase 1
- ✓ **CLEAN-01..10**: Code cleanup, dead code removal, migrations — v1.5 Phase 8
- ✓ **I18N-01..04**: Custom i18n system FR + EN — v1.5 Phase 8
- ✓ **DARK-01..10**: Dark mode with Tailwind @theme semantic — v1.5 Phase 9
- ✓ **PALETTE-01..07**: Command Palette with fuzzy search — v1.5 Phase 10
- ✓ **EDIT-01..06**: Inline editing — v1.5 Phase 11
- ✓ **BULK-01..06**: Bulk operations — v1.5 Phase 11
- ✓ **CHAT-01..10**: AI Chat lateral panel — v1.5 Phase 12
- ✓ **ANIM-01..05**: Framer Motion animations — v1.5 Phase 13
- ✓ **CAPTURE-01..02**: Quick Capture — v1.5 Phase 13
- ✓ **ONBOARD-01..02**: Onboarding wizard — v1.5 Phase 13
- ✓ **VIEWS-01..01**: Saved views — v1.5 Phase 13
- ✓ **IMPORT-01..10**: AI bulk import with wizard — v1.6 Phases 14-15
- ✓ **CAPT-01..02**: In-project bulk capture — v1.6 Phase 15
- ✓ **ONBD-01..05**: Enhanced onboarding with AI setup — v1.6 Phase 16
- ✓ **LEGCY-01..02**: Legacy Markdown import removal — v1.6 Phase 17
- ✓ **SEC-01..07**: Security audit (gitleaks, CSP, OWASP, dependencies) — v2.0 Phase 18
- ✓ **REPO-01..07**: Repository hygiene (fresh git init, GitHub public repo) — v2.0 Phase 19
- ✓ **DOCS-01..03**: OSS documentation (README, LICENSE, SECURITY.md) — v2.0 Phase 20
- ✓ **REL-01..06**: Release engineering (signing keys, CI/CD, v2.0.0 release) — v2.0 Phase 21
- ✓ **SETT-01..04**: Settings split (App Settings + AI Settings) — v2.1 Phase 23
- ✓ **PROV-01..06**: Provider management (registry, custom providers, health check, CSP) — v2.1 Phases 22-25
- ✓ **GENX-01..05**: Generation UX (progress, cancel, provider override, Gemini badge, errors) — v2.1 Phases 24-25
- ✓ **INTL-01..03**: AI internals (provider registry, client cache, i18n) — v2.1 Phases 22-24

### Active

(No active milestone — all shipped through v2.1)

### Out of Scope

- Multi-user collaboration — Architecture single-user, hors scope
- Serveur/cloud sync — Tout reste local par design
- OAuth/SSO login — Single-user desktop app
- Mobile app — Desktop-first par design
- RAG with vector embeddings — Keyword + few-shot sufficient for current scale
- Real-time collaboration — Single-user app
- Video/audio attachments — Text-based backlog management
- Automatic background extraction — Privacy concerns, unexpected behavior
- Live URL/web scraping — Rate limits, auth issues, fragile scraping
- Unlimited batch size — API rate limits, UI freezing — cap at 50 per batch
- Automatic deduplication — False positives, complex matching — show warning instead
- Built-in LLM server — Support external endpoints (Ollama, LM Studio) via custom providers
- Provider health dashboard — Deferred (PROV-07, PROV-09)
- Smart provider switching — Deferred (PROV-08)
- Streaming response preview — Deferred (GENX-06)
- AI onboarding wizard for providers — Deferred (GENX-07)

## Context

**v1.0 complete (2026-02-06):** 7 phases, 22 plans. SQLite persistence, AI generation (3 providers, questioning flow, few-shot, feedback), FTS5, relations, graph, templates, analytics.

**v1.5 complete (2026-02-08):** 6 phases, 24 plans. Dark mode, command palette, inline editing, bulk ops, AI chat, animations, onboarding, saved views, quick capture, i18n FR+EN.

**v1.6 complete (2026-02-14):** 4 phases, 8 plans. AI bulk import wizard (text + images), enhanced 7-step onboarding with AI setup, legacy cleanup.

**v2.0 complete (2026-02-16):** 4 phases, 8 plans. Security audit (gitleaks, CSP, OWASP), fresh git history, OSS docs (README, LICENSE, SECURITY.md), signed v2.0.0 release on GitHub.

**v2.1 complete (2026-02-17):** 4 phases, 11 plans. Provider registry with custom provider CRUD, settings split (App + AI), health check with error classification, AbortSignal cancellation, generation progress UX, model resolution fix + model selector UI. 54,353 LOC TypeScript.

**Tech stack:** React 19, TypeScript 5.9, Vite 7, Tailwind 4, Tauri 2, SQLite, framer-motion, MiniSearch, react-dropzone.

**Public repo:** github.com/Bouaris/ticketflow (MIT license, v2.0.0 released)

**Architecture:**
```
User -> UI -> useBacklogDB -> SQLite (per-project .db)
                           -> AI (Groq/Gemini/OpenAI + custom OpenAI-compatible)
                           -> Export -> Markdown
                           <- Bulk Import <- Text/Images -> AI Extraction
```

## Constraints

- **Tech stack**: React 19 + TypeScript 5.9 + Tauri 2 + Vite 7 + Tailwind 4
- **Persistence**: SQLite (1 fichier .db par projet)
- **AI API**: Limites de tokens et rate limits des providers (Groq/Gemini/OpenAI)
- **Bundle size**: framer-motion (~30KB gzip) + react-dropzone (~10KB) seules deps majeures
- **i18n**: Systeme leger custom (pas react-intl/i18next)
- **Theme**: Tailwind 4 @theme semantic (pas CSS-in-JS)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLite au lieu de Markdown | Parser fragile (618 lignes), fichier jamais utilise directement | ✓ Good |
| 1 fichier .db par projet | Isolation naturelle, backup facile, portable | ✓ Good |
| Key-based remounting | Simple, zero state leakage, React primitives | ✓ Good |
| Few-shot TF-IDF | Works offline, sufficient for <500 items | ✓ Good |
| Pure SVG charts | No external library, full control, small bundle | ✓ Good |
| dagre v0.8.5 (not @dagrejs/dagre v2) | ESM build of v2 broken (uses require()) | ✓ Good |
| Tailwind @theme semantic | bg-surface/text-on-surface tokens for dark mode | ✓ Good |
| i18n custom leger | react-intl/i18next trop lourd pour l'usage | ✓ Good |
| framer-motion pour animations | ~30KB acceptable, API declarative | ✓ Good |
| MiniSearch pour command palette | Deja installe, fuzzy search native | ✓ Good |
| Delta-based history | Remplace full-backlog JSON serialisation | ✓ Good |
| withTransaction() helper | Pour operations bulk atomiques | ✓ Good |
| CSP re-enabled | Whitelist AI providers uniquement | ✓ Good |
| allocateIdRange pre-allocation | Prevents race conditions in bulk inserts | ✓ Good |
| Dual localStorage + SQLite persistence | Onboarding survives browser clears | ✓ Good |
| Provider vision validation pre-call | Groq silently ignores images — validate first | ✓ Good |
| Conservative token estimation (80%) | Prevents silent API failures | ✓ Good |
| react-dropzone for image upload | Lightweight, well-maintained, drag-drop native | ✓ Good |
| Gemini as recommended provider | Free tier (15 req/min, 1M tokens/day) | ✓ Good |

| Fresh git init (no history rewrite) | History contains signing keys + passwords — fresh start is cleaner than BFG | ✓ Good |
| MIT license | Most permissive, standard for desktop OSS | ✓ Good |
| GitHub user: Bouaris | Public repo at github.com/Bouaris/ticketflow | ✓ Good |
| createUpdaterArtifacts: true | Required for .sig and latest.json generation in Tauri v2 | ✓ Good |
| Ed25519 signing with password | TF-2026-v2-release! — stored in GitHub Secrets | ✓ Good |
| tauri-action@v0.6.1 | Upgraded from v0.5, handles signing and release automatically | ✓ Good |
| Provider registry pattern (SSOT) | Centralize all provider logic in ai-provider-registry.ts | ✓ Good |
| Map-based OpenAI client cache | apiKey::baseURL key prevents state leaks between providers | ✓ Good |
| HTTPS-only CSP enforcement | https: scheme-source + localhost for custom AI endpoints | ✓ Good |
| Settings split (App + AI) | Separate concerns: language/theme vs provider/key/model | ✓ Good |
| resolveModelForProvider pattern | 3-tier fallback (persisted > registry default > hardcoded) | ✓ Good |
| Promise.race for Gemini cancellation | Google SDK lacks AbortSignal — Promise.race wrapper | ✓ Good |
| 5-type error classification | auth/rate_limit/timeout/network/unknown for actionable guidance | ✓ Good |
| Custom provider edit = remove+add | Registry has no update fn — atomic remove+add instead | ✓ Good |

---
*Last updated: 2026-02-17 after v2.1 milestone shipped*
