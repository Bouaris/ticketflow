/**
 * AI Questioning Flow - Multi-turn conversation engine
 *
 * Manages a conversation between the user and AI to clarify vague descriptions
 * before generating backlog tickets. For clear descriptions, the AI recaps
 * its understanding and confirms before proceeding.
 *
 * Key design decisions:
 * - Conversation state is ephemeral (React state only, NOT persisted to SQLite)
 * - Language auto-adapts to user input via system prompt
 * - Safety cap at 5 turns prevents infinite questioning loops
 * - Backlog context is NOT included here (saves tokens for questioning phase)
 */

import { generateCompletionWithRetry, getEffectiveAIConfig } from './ai';
import { QuestioningResponseSchema, type QuestioningResponse } from '../types/ai';
import { getCurrentLocale } from '../i18n';

// ============================================================
// TYPES
// ============================================================

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QuestioningState {
  messages: ConversationMessage[];
  phase: 'idle' | 'initial' | 'questioning' | 'recap' | 'ready' | 'skipped';
  questionsAsked: number;
  confidence: number;
  lastRecap: string | null;
  lastQuestions: string[];
  /** The original user description that started the flow */
  originalDescription: string;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * System prompt for the questioning flow.
 *
 * Instructs the AI to:
 * - Detect user's language and respond exclusively in that language
 * - Analyze the description for completeness
 * - Ask max 3 questions per turn, most important first
 * - When confidence >= 0.8, provide a recap
 * - Response format is JSON matching QuestioningResponseSchema
 *
 * Important: Does NOT include backlog context (saves tokens for questioning).
 * Backlog context is injected only at final generation time via buildFinalPrompt.
 */
const QUESTIONING_SYSTEM_PROMPT_FR = `Tu es un assistant Product Owner expert. Tu aides a creer des tickets de backlog precis et actionnables.

REGLE DE LANGUE: Reponds EXCLUSIVEMENT en francais.

TON ROLE:
1. Analyse la description de l'utilisateur pour evaluer sa completude
2. Si la description est vague ou incomplete, pose des questions de clarification
3. Si la description est claire et complete, recapitule ta comprehension et confirme

STRATEGIE DE QUESTIONS:
- Pose la question la PLUS IMPORTANTE en premier
- Maximum 3 questions par tour
- Apres chaque reponse, evalue si tu as assez de contexte
- Quand tu es confiant (>= 80%), fais un recapitulatif

TYPES DE QUESTIONS UTILES:
- Qui sont les utilisateurs concernes?
- Quel est le comportement actuel vs attendu?
- Quelles sont les contraintes techniques?
- Quel est le module/composant impacte?
- Quelle est la priorite/urgence?
- Y a-t-il des cas limites a considerer?

FORMAT DE REPONSE (JSON strict, RIEN d'autre):
{
  "status": "questioning" | "recap" | "ready",
  "questions": ["Question 1?", "Question 2?"],
  "recap": "Voici ce que je comprends: ..." ou null,
  "confidence": 0.0-1.0
}

REGLES:
- Si status = "questioning": questions doit contenir 1-3 questions, recap peut etre null
- Si status = "recap": recap doit contenir un resume clair, questions peut etre vide
- Si status = "ready": les deux peuvent etre vides, confidence doit etre >= 0.8
- Reponds UNIQUEMENT avec le JSON, sans markdown ni explication autour`;

const QUESTIONING_SYSTEM_PROMPT_EN = `You are an expert Product Owner assistant. You help create precise, actionable backlog tickets.

LANGUAGE RULE: Respond EXCLUSIVELY in English.

YOUR ROLE:
1. Analyze the user's description to evaluate its completeness
2. If the description is vague or incomplete, ask clarification questions
3. If the description is clear and complete, recap your understanding and confirm

QUESTIONING STRATEGY:
- Ask the MOST IMPORTANT question first
- Maximum 3 questions per turn
- After each answer, evaluate if you have enough context
- When confident (>= 80%), provide a recap

USEFUL QUESTION TYPES:
- Who are the affected users?
- What is the current vs expected behavior?
- What are the technical constraints?
- What module/component is impacted?
- What is the priority/urgency?
- Are there edge cases to consider?

RESPONSE FORMAT (strict JSON, NOTHING else):
{
  "status": "questioning" | "recap" | "ready",
  "questions": ["Question 1?", "Question 2?"],
  "recap": "Here is what I understand: ..." or null,
  "confidence": 0.0-1.0
}

RULES:
- If status = "questioning": questions must contain 1-3 questions, recap can be null
- If status = "recap": recap must contain a clear summary, questions can be empty
- If status = "ready": both can be empty, confidence must be >= 0.8
- Respond ONLY with JSON, no markdown or explanation around it`;

/** Get the locale-appropriate questioning system prompt */
export function getQuestioningSystemPrompt(): string {
  return getCurrentLocale() === 'en' ? QUESTIONING_SYSTEM_PROMPT_EN : QUESTIONING_SYSTEM_PROMPT_FR;
}

/** @deprecated Use getQuestioningSystemPrompt() instead */
export const QUESTIONING_SYSTEM_PROMPT = QUESTIONING_SYSTEM_PROMPT_FR;

// ============================================================
// STATE MANAGEMENT
// ============================================================

/**
 * Create initial questioning state
 */
export function createInitialState(): QuestioningState {
  return {
    messages: [],
    phase: 'idle',
    questionsAsked: 0,
    confidence: 0,
    lastRecap: null,
    lastQuestions: [],
    originalDescription: '',
  };
}

// ============================================================
// CONVERSATION ENGINE
// ============================================================

interface QuestioningOptions {
  provider?: 'groq' | 'gemini' | 'openai';
  modelId?: string;
  projectPath?: string;
}

/**
 * Build a single prompt string from conversation messages.
 *
 * Since generateCompletionWithRetry expects a single prompt string,
 * we concatenate the conversation history into a structured format.
 */
function buildPromptFromMessages(messages: ConversationMessage[]): string {
  return messages.map(msg => {
    switch (msg.role) {
      case 'system':
        return `[SYSTEM]\n${msg.content}`;
      case 'user':
        return `[USER]\n${msg.content}`;
      case 'assistant':
        return `[ASSISTANT]\n${msg.content}`;
    }
  }).join('\n\n');
}

/**
 * Parse the AI response into a QuestioningResponse, with fallback on parse failure.
 */
function parseResponse(result: { success: boolean; data?: QuestioningResponse; error?: string }): QuestioningResponse {
  if (result.success && result.data) {
    return result.data;
  }
  // On parse failure, default to 'ready' phase (don't block generation)
  return {
    status: 'ready',
    questions: [],
    recap: null,
    confidence: 1.0,
  };
}

/**
 * Start the questioning flow with a user description.
 *
 * Builds the initial message array and calls the AI to analyze
 * the description. Returns an updated QuestioningState with
 * the AI's questions or recap.
 */
export async function startQuestioningFlow(
  userDescription: string,
  options?: QuestioningOptions
): Promise<QuestioningState> {
  const { provider, modelId } = getEffectiveAIConfig(options?.projectPath);
  const effectiveProvider = options?.provider ?? provider;
  const effectiveModel = options?.modelId ?? modelId;

  const messages: ConversationMessage[] = [
    { role: 'system', content: getQuestioningSystemPrompt() },
    { role: 'user', content: userDescription },
  ];

  const prompt = buildPromptFromMessages(messages);

  const result = await generateCompletionWithRetry(
    prompt,
    QuestioningResponseSchema,
    { provider: effectiveProvider, modelId: effectiveModel }
  );

  const response = parseResponse(result);

  // Add AI response to messages
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content: JSON.stringify(response),
  };

  const updatedMessages = [...messages, assistantMessage];

  // Determine phase from AI response
  let phase: QuestioningState['phase'];
  switch (response.status) {
    case 'questioning':
      phase = 'questioning';
      break;
    case 'recap':
      phase = 'recap';
      break;
    case 'ready':
      phase = 'ready';
      break;
  }

  return {
    messages: updatedMessages,
    phase,
    questionsAsked: response.questions?.length ?? 0,
    confidence: response.confidence,
    lastRecap: response.recap ?? null,
    lastQuestions: response.questions ?? [],
    originalDescription: userDescription,
  };
}

/**
 * Continue the conversation with a user answer.
 *
 * Appends the user answer to the conversation history,
 * calls the AI with the full history, and returns an updated state.
 *
 * Safety: If questionsAsked >= 5, forces phase to 'recap' or 'ready'.
 */
export async function continueConversation(
  state: QuestioningState,
  userAnswer: string,
  options?: QuestioningOptions
): Promise<QuestioningState> {
  const { provider, modelId } = getEffectiveAIConfig(options?.projectPath);
  const effectiveProvider = options?.provider ?? provider;
  const effectiveModel = options?.modelId ?? modelId;

  // Append user answer
  const messages: ConversationMessage[] = [
    ...state.messages,
    { role: 'user', content: userAnswer },
  ];

  // Safety check: if we've asked too many questions, force a recap
  const totalQuestionsAfterThis = state.questionsAsked + 1; // counting this interaction
  const forceRecap = totalQuestionsAfterThis >= 5;

  let prompt = buildPromptFromMessages(messages);
  if (forceRecap) {
    prompt += '\n\n[SYSTEM]\nYou have asked enough questions. Please provide a recap of your understanding now. Set status to "recap" and confidence to at least 0.8.';
  }

  const result = await generateCompletionWithRetry(
    prompt,
    QuestioningResponseSchema,
    { provider: effectiveProvider, modelId: effectiveModel }
  );

  const response = parseResponse(result);

  // Force recap/ready if safety cap reached
  let effectiveResponse = response;
  if (forceRecap && response.status === 'questioning') {
    effectiveResponse = {
      ...response,
      status: 'recap',
      confidence: Math.max(response.confidence, 0.8),
    };
  }

  // Add AI response to messages
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content: JSON.stringify(effectiveResponse),
  };

  const updatedMessages = [...messages, assistantMessage];

  // Determine phase
  let phase: QuestioningState['phase'];
  switch (effectiveResponse.status) {
    case 'questioning':
      phase = 'questioning';
      break;
    case 'recap':
      phase = 'recap';
      break;
    case 'ready':
      phase = 'ready';
      break;
  }

  // Count new questions asked
  const newQuestionsCount = effectiveResponse.questions?.length ?? 0;

  return {
    messages: updatedMessages,
    phase,
    questionsAsked: state.questionsAsked + newQuestionsCount,
    confidence: effectiveResponse.confidence,
    lastRecap: effectiveResponse.recap ?? state.lastRecap,
    lastQuestions: effectiveResponse.questions ?? [],
    originalDescription: state.originalDescription,
  };
}

// ============================================================
// PROMPT BUILDER
// ============================================================

/**
 * Build the final enriched prompt for generation, incorporating
 * the context gathered from the questioning conversation.
 *
 * If the conversation produced a recap, uses that as the enriched context.
 * Otherwise, summarizes the Q&A exchanges.
 *
 * @param state - The current questioning state
 * @returns Enriched prompt string to prepend to generation prompt
 */
export function buildFinalPrompt(state: QuestioningState): string {
  // If skipped or idle, return original description as-is
  if (state.phase === 'skipped' || state.phase === 'idle') {
    return state.originalDescription;
  }

  // Extract Q&A pairs from conversation (skip system messages)
  const qaPairs: string[] = [];
  const userMessages = state.messages.filter(m => m.role === 'user');
  const assistantMessages = state.messages.filter(m => m.role === 'assistant');

  // First user message is the original description, subsequent are answers
  for (let i = 1; i < userMessages.length; i++) {
    const answer = userMessages[i].content;
    // Try to get the questions that preceded this answer
    const prevAssistant = assistantMessages[i - 1];
    if (prevAssistant) {
      try {
        const parsed = JSON.parse(prevAssistant.content) as QuestioningResponse;
        if (parsed.questions && parsed.questions.length > 0) {
          qaPairs.push(`Questions: ${parsed.questions.join(' / ')}\nReponse: ${answer}`);
        }
      } catch {
        qaPairs.push(`Reponse: ${answer}`);
      }
    }
  }

  const parts: string[] = [];

  // Add conversation context header
  parts.push('CONTEXTE DE LA CONVERSATION:');

  // Add recap if available
  if (state.lastRecap) {
    parts.push(`Resume: ${state.lastRecap}`);
  }

  // Add Q&A exchanges if any
  if (qaPairs.length > 0) {
    parts.push('Echanges:');
    qaPairs.forEach((qa, i) => {
      parts.push(`${i + 1}. ${qa}`);
    });
  }

  // Add enriched description section
  parts.push('');
  parts.push('DESCRIPTION ENRICHIE:');
  parts.push(state.originalDescription);

  // If there were answers, add them as additional context
  const answers = userMessages.slice(1).map(m => m.content);
  if (answers.length > 0) {
    parts.push('');
    parts.push('Precisions supplementaires:');
    answers.forEach(a => {
      parts.push(`- ${a}`);
    });
  }

  return parts.join('\n');
}
