/**
 * AI Integration - Multi-provider support
 *
 * Supports: Groq (default, free), Gemini
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BacklogItem } from '../types/backlog';
import { STORAGE_KEYS } from '../constants/storage';
import { AI_CONFIG } from '../constants/config';
import { setSecureItem, getSecureItem, removeSecureItem, migrateToSecureStorage } from './secure-storage';
import {
  RefineResponseSchema,
  GenerateItemResponseSchema,
  SuggestionsResponseSchema,
  MaintenanceResponseSchema,
  safeParseAIResponse,
  type MaintenanceIssue,
} from '../types/ai';
import { buildPromptWithContext, type AIOptions } from './ai-context';

// Re-export for consumers
export type { AIOptions } from './ai-context';

// ============================================================
// TYPES
// ============================================================

export type AIProvider = 'groq' | 'gemini';

interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
}

// ============================================================
// CONFIG MANAGEMENT
// ============================================================

export function getProvider(): AIProvider {
  return (localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as AIProvider) || 'groq';
}

export function setProvider(provider: AIProvider): void {
  localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
}

export function getApiKey(provider?: AIProvider): string | null {
  const p = provider || getProvider();
  return getSecureItem(p === 'groq' ? STORAGE_KEYS.GROQ_API_KEY : STORAGE_KEYS.GEMINI_API_KEY);
}

export function setApiKey(key: string, provider?: AIProvider): void {
  const p = provider || getProvider();
  setSecureItem(p === 'groq' ? STORAGE_KEYS.GROQ_API_KEY : STORAGE_KEYS.GEMINI_API_KEY, key);
}

export function clearApiKey(provider?: AIProvider): void {
  const p = provider || getProvider();
  removeSecureItem(p === 'groq' ? STORAGE_KEYS.GROQ_API_KEY : STORAGE_KEYS.GEMINI_API_KEY);
}

/**
 * Initialize secure storage - migrate legacy plaintext keys
 * Call this once on app startup
 */
export function initSecureStorage(): void {
  migrateToSecureStorage([
    STORAGE_KEYS.GROQ_API_KEY,
    STORAGE_KEYS.GEMINI_API_KEY,
  ]);
}

export function hasApiKey(provider?: AIProvider): boolean {
  return !!getApiKey(provider);
}

export function getClientConfig(overrideProvider?: AIProvider): AIClientConfig | null {
  const provider = overrideProvider || getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) return null;
  return { provider, apiKey };
}

// ============================================================
// AI CLIENTS
// ============================================================

let groqClient: Groq | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getGroqClient(apiKey: string): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  }
  return groqClient;
}

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export function resetClient(): void {
  groqClient = null;
  geminiClient = null;
}

// ============================================================
// UNIFIED COMPLETION API
// ============================================================

async function generateCompletion(prompt: string, provider?: AIProvider): Promise<string> {
  const config = getClientConfig(provider);
  if (!config) {
    const providerName = provider || getProvider();
    throw new Error(`Clé API ${providerName === 'groq' ? 'Groq' : 'Gemini'} non configurée`);
  }

  if (config.provider === 'groq') {
    const client = getGroqClient(config.apiKey);
    const response = await client.chat.completions.create({
      model: AI_CONFIG.GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: AI_CONFIG.MAX_TOKENS,
    });
    return response.choices[0]?.message?.content || '';
  } else {
    const client = getGeminiClient(config.apiKey);
    const model = client.getGenerativeModel({ model: AI_CONFIG.GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

// ============================================================
// ITEM REFINEMENT
// ============================================================

export interface RefinementResult {
  success: boolean;
  refinedItem?: Partial<BacklogItem>;
  suggestions?: string[];
  error?: string;
}

export interface RefineOptions extends AIOptions {
  additionalPrompt?: string;
}

const REFINE_PROMPT = `Tu es un Product Owner expert en méthodologie Agile. Analyse cet item de backlog et propose des améliorations.

ITEM ACTUEL:
ID: {id}
Type: {type}
Titre: {title}
{description_section}
{user_story_section}
{specs_section}
{criteria_section}
{dependencies_section}
{constraints_section}
{additional_prompt_section}

INSTRUCTIONS:
1. Reformule le titre pour qu'il soit plus clair et actionnable
2. Améliore la user story si présente (format "En tant que... je veux... afin de...")
3. Affine les spécifications pour qu'elles soient plus précises
4. Propose des critères d'acceptation SMART (Spécifiques, Mesurables, Atteignables, Réalistes, Temporels)
5. Identifie les dépendances ou risques potentiels
6. Affine ou suggère des dépendances pertinentes (autres tickets, APIs, services, composants)
7. Identifie les contraintes techniques ou business (compatibilité, performance, sécurité, budget)

RÉPONDS EN JSON avec ce format exact:
{
  "title": "Nouveau titre affiné",
  "userStory": "User story reformulée ou null si non applicable",
  "specs": ["Spec 1 affinée", "Spec 2 affinée"],
  "criteria": [
    {"text": "Critère 1 SMART", "checked": false},
    {"text": "Critère 2 SMART", "checked": false}
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "dependencies": ["Dépendance affinée 1", "Dépendance affinée 2"],
  "constraints": ["Contrainte affinée 1", "Contrainte affinée 2"]
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

export async function refineItem(item: BacklogItem, options?: RefineOptions): Promise<RefinementResult> {
  try {
    let basePrompt = REFINE_PROMPT
      .replace('{id}', item.id)
      .replace('{type}', item.type)
      .replace('{title}', item.title);

    const descSection = item.description ? `Description: ${item.description}` : '';
    const userStorySection = item.userStory ? `User Story: ${item.userStory}` : '';
    const specsSection = item.specs?.length
      ? `Spécifications:\n${item.specs.map(s => `- ${s}`).join('\n')}`
      : '';
    const criteriaSection = item.criteria?.length
      ? `Critères d'acceptation:\n${item.criteria.map(c => `- [${c.checked ? 'x' : ' '}] ${c.text}`).join('\n')}`
      : '';
    const dependenciesSection = item.dependencies?.length
      ? `Dépendances:\n${item.dependencies.map(d => `- ${d}`).join('\n')}`
      : '';
    const constraintsSection = item.constraints?.length
      ? `Contraintes:\n${item.constraints.map(c => `- ${c}`).join('\n')}`
      : '';
    const additionalPromptSection = options?.additionalPrompt
      ? `\nINSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR:\n${options.additionalPrompt}`
      : '';

    basePrompt = basePrompt
      .replace('{description_section}', descSection)
      .replace('{user_story_section}', userStorySection)
      .replace('{specs_section}', specsSection)
      .replace('{criteria_section}', criteriaSection)
      .replace('{dependencies_section}', dependenciesSection)
      .replace('{constraints_section}', constraintsSection)
      .replace('{additional_prompt_section}', additionalPromptSection);

    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, options?.provider);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = safeParseAIResponse(jsonMatch[0], RefineResponseSchema);
    if (!parsed) {
      throw new Error('Format de réponse IA invalide');
    }

    return {
      success: true,
      refinedItem: {
        title: parsed.title,
        userStory: parsed.userStory || undefined,
        specs: parsed.specs,
        criteria: parsed.criteria,
        dependencies: parsed.dependencies,
        constraints: parsed.constraints,
      },
      suggestions: parsed.suggestions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

// ============================================================
// GENERATE ITEM FROM DESCRIPTION
// ============================================================

export interface GenerateItemResult {
  success: boolean;
  item?: {
    title: string;
    description?: string;
    userStory?: string;
    specs: string[];
    criteria: { text: string; checked: boolean }[];
    suggestedType: string;
    suggestedPriority?: 'Haute' | 'Moyenne' | 'Faible';
    suggestedSeverity?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
    suggestedEffort?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    suggestedModule?: string;
    emoji?: string;
    dependencies?: string[];
    constraints?: string[];
  };
  error?: string;
}

const GENERATE_ITEM_PROMPT = `Tu es un Staff Engineer d'élite, architecte de systèmes distribués et expert en ingénierie produit. Tu combines une vision technologique avant-gardiste avec une rigueur d'exécution absolue. Tu penses en termes de systèmes, d'impacts de second ordre, et de dette technique anticipée.

Ta mission: transformer une idée brute en un item de backlog de qualité production - précis, actionnable, et aligné avec les standards d'excellence des équipes d'ingénierie de classe mondiale.

---

DESCRIPTION DE L'UTILISATEUR:
{user_description}

---

ANALYSE SYSTÉMIQUE:
Avant de générer, pose-toi ces questions:
- Quel est le VRAI problème sous-jacent (pas juste le symptôme)?
- Quels systèmes/modules sont impactés directement ET indirectement?
- Quels sont les risques de régression ou d'effets de bord?
- Cette solution est-elle la plus simple qui fonctionne (KISS)?

CLASSIFICATION DES ITEMS:
- BUG: Anomalie technique. Sévérité P0-P4. PAS de user story (le bug EST le problème).
- CT: Court Terme - Livrable dans le sprint. Impact immédiat mesurable.
- LT: Long Terme - Vision stratégique. Investissement architectural.
- AUTRE: Innovation, exploration, amélioration continue.

STANDARDS DE QUALITÉ:
1. TITRE: Verbe d'action + contexte + impact. Maximum 60 caractères.
   - ✅ "Corriger le crash au chargement des images > 5MB"
   - ❌ "Bug images" (trop vague)

2. DESCRIPTION: Technique, factuelle, sans fluff. Contexte + comportement actuel + comportement attendu.

3. USER STORY: Uniquement si elle apporte de la VALEUR MÉTIER RÉELLE.
   - Bug d'affichage mineur → null (la correction EST la valeur)
   - Feature UX significative → "En tant que [persona précis], je veux [action concrète] afin de [bénéfice mesurable et vérifiable]"
   - Évite les user stories génériques type "en tant qu'utilisateur je veux que ça marche"

4. SPECS: 2-4 points techniques précis.
   - Pour un bug: étapes de reproduction exactes
   - Pour une feature: contraintes techniques, intégrations, edge cases

5. CRITÈRES D'ACCEPTATION: 3-5 conditions VÉRIFIABLES.
   - Chaque critère doit être testable (oui/non, pas "fonctionne bien")
   - Inclure les cas limites et états d'erreur

6. EFFORT: Estimation réaliste basée sur la complexité technique réelle.
   - XS: < 2h (fix trivial, typo, config)
   - S: 2-4h (changement localisé, bien compris)
   - M: 1-2 jours (feature moyenne, tests inclus)
   - L: 3-5 jours (feature complexe, refactoring)
   - XL: 1-2 semaines (système nouveau, investigation requise)

7. DÉPENDANCES (optionnel): Éléments dont ce ticket dépend.
   - Autres tickets (ex: "BUG-003 corrigé")
   - APIs ou services (ex: "API d'authentification fonctionnelle")
   - Composants ou modules (ex: "Module de paiement déployé")

8. CONTRAINTES (optionnel): Limitations techniques ou business.
   - Contraintes techniques (ex: "Compatible IE11", "Temps de réponse < 200ms")
   - Contraintes business (ex: "RGPD compliant", "Budget max 2j")

---

RÉPONDS UNIQUEMENT avec ce JSON (aucun texte avant/après):
{
  "title": "Titre actionnable et précis",
  "description": "Description technique du problème ou de la solution",
  "userStory": null ou "En tant que [X], je veux [Y] afin de [Z mesurable]",
  "specs": ["Spécification technique 1", "Spécification technique 2"],
  "criteria": [
    {"text": "Critère d'acceptation vérifiable 1", "checked": false},
    {"text": "Critère d'acceptation vérifiable 2", "checked": false}
  ],
  "suggestedType": "BUG|CT|LT|AUTRE",
  "suggestedPriority": "Haute|Moyenne|Faible" ou null,
  "suggestedSeverity": "P0|P1|P2|P3|P4" ou null,
  "suggestedEffort": "XS|S|M|L|XL",
  "suggestedModule": "Module ou composant concerné" ou null,
  "emoji": "🐛|🚀|⚡|🔒|🎨|📦|🔧",
  "dependencies": ["Dépendance 1", "Dépendance 2"] ou [],
  "constraints": ["Contrainte 1", "Contrainte 2"] ou []
}`;

export async function generateItemFromDescription(description: string, options?: AIOptions): Promise<GenerateItemResult> {
  try {
    const basePrompt = GENERATE_ITEM_PROMPT.replace('{user_description}', description);
    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, options?.provider);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = safeParseAIResponse(jsonMatch[0], GenerateItemResponseSchema);
    if (!parsed) {
      throw new Error('Format de réponse IA invalide');
    }

    return {
      success: true,
      item: {
        title: parsed.title,
        description: parsed.description || undefined,
        userStory: parsed.userStory || undefined,
        specs: parsed.specs || [],
        criteria: parsed.criteria || [],
        suggestedType: parsed.suggestedType || 'CT',
        suggestedPriority: parsed.suggestedPriority || undefined,
        suggestedSeverity: parsed.suggestedSeverity || undefined,
        suggestedEffort: parsed.suggestedEffort || undefined,
        suggestedModule: parsed.suggestedModule || undefined,
        emoji: parsed.emoji || undefined,
        dependencies: parsed.dependencies || [],
        constraints: parsed.constraints || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

// ============================================================
// BULK SUGGESTIONS
// ============================================================

const BULK_SUGGEST_PROMPT = `Tu es un Product Owner expert. Analyse ces items de backlog et suggère des améliorations globales.

ITEMS:
{items_list}

INSTRUCTIONS:
Propose 3-5 suggestions stratégiques pour améliorer ce backlog:
- Priorisation
- Regroupements possibles
- Dépendances identifiées
- Risques à anticiper

Réponds en JSON:
{
  "suggestions": [
    "Suggestion 1 avec justification",
    "Suggestion 2 avec justification"
  ]
}`;

export async function suggestImprovements(items: BacklogItem[], options?: AIOptions): Promise<RefinementResult> {
  try {
    const itemsList = items
      .slice(0, 20)
      .map(item => `- ${item.id}: ${item.title} (${item.type}, ${item.priority || 'N/A'})`)
      .join('\n');

    const basePrompt = BULK_SUGGEST_PROMPT.replace('{items_list}', itemsList);
    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, options?.provider);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = safeParseAIResponse(jsonMatch[0], SuggestionsResponseSchema);
    if (!parsed) {
      throw new Error('Format de réponse IA invalide');
    }

    return {
      success: true,
      suggestions: parsed.suggestions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

// ============================================================
// BACKLOG MAINTENANCE
// ============================================================

export interface BacklogMaintenanceResult {
  success: boolean;
  issues: MaintenanceIssue[];
  correctedMarkdown?: string;
  summary?: string;
  error?: string;
}

const MAINTENANCE_PROMPT = `Tu es un validateur de fichiers Markdown de backlog. Analyse et retourne UNIQUEMENT un JSON valide.

## PROBLÈMES À DÉTECTER:

1. **duplicate_id**: Le MÊME ID exact apparaît 2+ fois (ex: "### BUG-001" deux fois)
   - NE PAS signaler les groupes "### BUG-005 à BUG-007"

2. **fused_items**: Items/sections collés sans saut de ligne
   - Ex: "**Effort:** M### CT-002" (### collé)
   - Ex: "- [ ] Critère## 3." (## collé)

3. **malformed_section**: Section "## X." dupliquée avec même numéro

## NE PAS SIGNALER:
- Sections vides, groupes d'items, emojis
- "### Légende", "### Conventions" (sections doc sans ID = normal)

## FICHIER:
{backlog_content}

## RÉPONSE JSON (RIEN D'AUTRE):
{"issues":[{"type":"duplicate_id|fused_items|malformed_section","description":"description courte","location":"ligne ou section","suggestion":"correction à faire"}],"correctedMarkdown":"OK","summary":"N problème(s)"}

Si aucun problème: {"issues":[],"correctedMarkdown":"OK","summary":"Aucun problème"}`;

const CORRECTION_PROMPT = `Tu es un correcteur de fichiers Markdown de backlog Ticketflow.

## FORMAT OFFICIEL TICKETFLOW:
\`\`\`markdown
# NomProjet - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : YYYY-MM-DD

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)
...

---

## 1. BUGS

### BUG-001 | Titre du bug
**Composant:** ...
**Sévérité:** P0-P4 - Description
**Effort:** XS/S/M/L/XL (description)
**Description:** ...

**Critères d'acceptation:**
- [ ] Critère 1

---

## 2. COURT TERME

### CT-001 | Titre feature
**Module:** ...
**Priorité:** Haute/Moyenne/Faible
**Effort:** ...
**Description:** ...

**User Story:**
> En tant que..., je veux...

**Critères d'acceptation:**
- [ ] Critère 1

---

## X. Légende

### Effort
| Code | Signification | Estimation |
...

### Sévérité (Bugs)
...

### Priorité (Features)
...
\`\`\`

## PROBLÈMES DÉTECTÉS:
{issues_list}

## FICHIER À CORRIGER:
{backlog_content}

## INSTRUCTIONS:
1. Corrige TOUS les problèmes listés
2. duplicate_id: renomme le second ID (ex: CT-002 → CT-003, trouve le prochain ID libre)
3. fused_items: ajoute une ligne vide ET "---" entre les items/sections
4. malformed_section: renumérote la section dupliquée
5. GARDE le contenu des tickets INTACT, corrige seulement la structure
6. Respecte le format officiel ci-dessus

## RÉPONSE:
Retourne UNIQUEMENT le fichier Markdown corrigé.
Commence par # et termine par ---.
Pas de texte avant ni après.`;

export async function analyzeBacklogFormat(
  markdownContent: string,
  options?: AIOptions
): Promise<BacklogMaintenanceResult> {
  try {
    // Limit content size to avoid token limits
    const truncatedContent = markdownContent.length > 50000
      ? markdownContent.slice(0, 50000) + '\n\n[...contenu tronqué...]'
      : markdownContent;

    const basePrompt = MAINTENANCE_PROMPT.replace('{backlog_content}', truncatedContent);
    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, options?.provider);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = safeParseAIResponse(jsonMatch[0], MaintenanceResponseSchema);
    if (!parsed) {
      throw new Error('Format de réponse IA invalide');
    }

    return {
      success: true,
      issues: parsed.issues,
      correctedMarkdown: parsed.correctedMarkdown,
      summary: parsed.summary,
    };
  } catch (error) {
    return {
      success: false,
      issues: [],
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

/**
 * Correct a backlog file based on detected issues (2nd AI call)
 */
export async function correctBacklogFormat(
  markdownContent: string,
  issues: MaintenanceIssue[],
  options?: AIOptions
): Promise<{ success: boolean; correctedMarkdown?: string; error?: string }> {
  try {
    if (issues.length === 0) {
      return { success: true, correctedMarkdown: markdownContent };
    }

    // Build issues list for the prompt
    const issuesList = issues
      .map((issue, i) => `${i + 1}. [${issue.type}] ${issue.description} (${issue.location}) → ${issue.suggestion}`)
      .join('\n');

    const truncatedContent = markdownContent.length > 50000
      ? markdownContent.slice(0, 50000) + '\n\n[...contenu tronqué...]'
      : markdownContent;

    const basePrompt = CORRECTION_PROMPT
      .replace('{issues_list}', issuesList)
      .replace('{backlog_content}', truncatedContent);

    const prompt = await buildPromptWithContext(basePrompt, options);
    const text = await generateCompletion(prompt, options?.provider);

    // The response should be the corrected markdown directly
    // Clean up any potential wrapper text
    let corrected = text.trim();

    // If wrapped in code block, extract it
    const codeBlockMatch = corrected.match(/```(?:markdown)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      corrected = codeBlockMatch[1].trim();
    }

    // Validate it looks like a markdown file
    if (!corrected.startsWith('#')) {
      throw new Error('Le fichier corrigé ne semble pas valide');
    }

    return {
      success: true,
      correctedMarkdown: corrected,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de correction',
    };
  }
}
