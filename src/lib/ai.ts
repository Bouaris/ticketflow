/**
 * AI Integration - Multi-provider support
 *
 * Supports: Groq (default, free), Gemini
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BacklogItem } from '../types/backlog';

// ============================================================
// TYPES
// ============================================================

export type AIProvider = 'groq' | 'gemini';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

// ============================================================
// STORAGE KEYS
// ============================================================

const PROVIDER_KEY = 'ai-provider';
const GROQ_KEY = 'groq-api-key';
const GEMINI_KEY = 'gemini-api-key';

// ============================================================
// CONFIG MANAGEMENT
// ============================================================

export function getProvider(): AIProvider {
  return (localStorage.getItem(PROVIDER_KEY) as AIProvider) || 'groq';
}

export function setProvider(provider: AIProvider): void {
  localStorage.setItem(PROVIDER_KEY, provider);
}

export function getApiKey(provider?: AIProvider): string | null {
  const p = provider || getProvider();
  return localStorage.getItem(p === 'groq' ? GROQ_KEY : GEMINI_KEY);
}

export function setApiKey(key: string, provider?: AIProvider): void {
  const p = provider || getProvider();
  localStorage.setItem(p === 'groq' ? GROQ_KEY : GEMINI_KEY, key);
}

export function clearApiKey(provider?: AIProvider): void {
  const p = provider || getProvider();
  localStorage.removeItem(p === 'groq' ? GROQ_KEY : GEMINI_KEY);
}

export function hasApiKey(provider?: AIProvider): boolean {
  return !!getApiKey(provider);
}

export function getConfig(): AIConfig | null {
  const provider = getProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) return null;
  return { provider, apiKey };
}

// Legacy exports for compatibility
export const getStoredApiKey = () => getApiKey();
export const storeApiKey = (key: string) => setApiKey(key);

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

async function generateCompletion(prompt: string): Promise<string> {
  const config = getConfig();
  if (!config) {
    throw new Error('API key non configurée');
  }

  if (config.provider === 'groq') {
    const client = getGroqClient(config.apiKey);
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    });
    return response.choices[0]?.message?.content || '';
  } else {
    const client = getGeminiClient(config.apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
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

const REFINE_PROMPT = `Tu es un Product Owner expert en méthodologie Agile. Analyse cet item de backlog et propose des améliorations.

ITEM ACTUEL:
ID: {id}
Type: {type}
Titre: {title}
{description_section}
{user_story_section}
{specs_section}
{criteria_section}

INSTRUCTIONS:
1. Reformule le titre pour qu'il soit plus clair et actionnable
2. Améliore la user story si présente (format "En tant que... je veux... afin de...")
3. Affine les spécifications pour qu'elles soient plus précises
4. Propose des critères d'acceptation SMART (Spécifiques, Mesurables, Atteignables, Réalistes, Temporels)
5. Identifie les dépendances ou risques potentiels

RÉPONDS EN JSON avec ce format exact:
{
  "title": "Nouveau titre affiné",
  "userStory": "User story reformulée ou null si non applicable",
  "specs": ["Spec 1 affinée", "Spec 2 affinée"],
  "criteria": [
    {"text": "Critère 1 SMART", "checked": false},
    {"text": "Critère 2 SMART", "checked": false}
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

export async function refineItem(item: BacklogItem): Promise<RefinementResult> {
  try {
    let prompt = REFINE_PROMPT
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

    prompt = prompt
      .replace('{description_section}', descSection)
      .replace('{user_story_section}', userStorySection)
      .replace('{specs_section}', specsSection)
      .replace('{criteria_section}', criteriaSection);

    const text = await generateCompletion(prompt);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      refinedItem: {
        title: parsed.title,
        userStory: parsed.userStory || undefined,
        specs: parsed.specs,
        criteria: parsed.criteria,
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
    suggestedType: 'BUG' | 'EXT' | 'ADM' | 'COS' | 'LT';
    suggestedPriority?: 'Haute' | 'Moyenne' | 'Faible';
    suggestedSeverity?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
    suggestedEffort?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    suggestedModule?: string;
    emoji?: string;
  };
  error?: string;
}

const GENERATE_ITEM_PROMPT = `Tu es un Product Owner expert en méthodologie Agile. À partir de la description suivante, génère un item de backlog complet et structuré.

DESCRIPTION DE L'UTILISATEUR:
{user_description}

CONTEXTE DU PROJET:
C'est un backlog pour une extension Chrome d'aide aux audioprothésistes (AudioPilot).
Les types d'items sont:
- BUG: Bug à corriger (utilise P0-P4 pour la sévérité, PAS de user story)
- EXT: Feature pour l'extension Chrome
- ADM: Feature pour le panel admin
- COS: Intégration API Cosium (logiciel métier)
- LT: Feature long terme (vision produit)

INSTRUCTIONS:
1. Analyse la description et détermine le type d'item le plus approprié
2. Génère un titre clair et actionnable (max 60 caractères)
3. Rédige une description technique du problème ou de la feature
4. User Story: SEULEMENT si elle apporte de la valeur. Pour un bug d'affichage simple → null. Pour une feature ou un bug impactant l'UX → "En tant que... je veux... afin de...". Ne génère PAS de user story générique/cheesy juste pour remplir le champ.
5. Liste 2-4 spécifications techniques ou étapes de reproduction (pour bugs)
6. Définis 3-5 critères d'acceptation/vérification
7. Suggère une priorité (features) OU sévérité (bugs) et un effort estimé
8. Propose un emoji représentatif (🐛 pour bug, 🚀 pour feature, etc.)

RÉPONDS EN JSON avec ce format exact:
{
  "title": "Titre clair et actionnable",
  "description": "Description technique détaillée",
  "userStory": null ou "En tant que [persona], je veux [action] afin de [bénéfice]" si pertinent,
  "specs": ["Spec technique 1", "Spec technique 2"],
  "criteria": [
    {"text": "Critère d'acceptation 1", "checked": false},
    {"text": "Critère d'acceptation 2", "checked": false}
  ],
  "suggestedType": "BUG ou EXT ou ADM ou COS ou LT",
  "suggestedPriority": "Haute/Moyenne/Faible ou null si BUG",
  "suggestedSeverity": "P0/P1/P2/P3/P4 ou null si pas BUG",
  "suggestedEffort": "XS/S/M/L/XL",
  "suggestedModule": "Module concerné ou null",
  "emoji": "🐛 ou autre emoji pertinent"
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

export async function generateItemFromDescription(description: string): Promise<GenerateItemResult> {
  try {
    const prompt = GENERATE_ITEM_PROMPT.replace('{user_description}', description);
    const text = await generateCompletion(prompt);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      item: {
        title: parsed.title,
        description: parsed.description || undefined,
        userStory: parsed.userStory || undefined,
        specs: parsed.specs || [],
        criteria: parsed.criteria || [],
        suggestedType: parsed.suggestedType || 'EXT',
        suggestedPriority: parsed.suggestedPriority || undefined,
        suggestedSeverity: parsed.suggestedSeverity || undefined,
        suggestedEffort: parsed.suggestedEffort || undefined,
        suggestedModule: parsed.suggestedModule || undefined,
        emoji: parsed.emoji || undefined,
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

export async function suggestImprovements(items: BacklogItem[]): Promise<RefinementResult> {
  try {
    const itemsList = items
      .slice(0, 20)
      .map(item => `- ${item.id}: ${item.title} (${item.type}, ${item.priority || 'N/A'})`)
      .join('\n');

    const prompt = BULK_SUGGEST_PROMPT.replace('{items_list}', itemsList);
    const text = await generateCompletion(prompt);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse invalide de l\'IA');
    }

    const parsed = JSON.parse(jsonMatch[0]);

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
