/**
 * Chat Types - Data types for AI Chat & Natural Language feature
 *
 * Provides TypeScript interfaces for chat messages, actions, suggestions,
 * and panel state. Zod schemas live in ai.ts per project convention.
 *
 * @module types/chat
 */

// ============================================================
// CHAT ACTION
// ============================================================

/**
 * An action the AI suggests performing in the UI.
 * Actions are optional and attached to assistant messages.
 */
export interface ChatAction {
  type: 'update_item' | 'filter' | 'open_item' | 'navigate' | 'add_relation';
  payload: Record<string, unknown>;
}

// ============================================================
// CHAT MESSAGE
// ============================================================

/**
 * A single message in a chat conversation.
 * Stored in SQLite chat_messages table.
 */
export interface ChatMessage {
  id: number;
  projectId: number;
  role: 'user' | 'assistant';
  content: string;
  citations: string[] | null;
  action: ChatAction | null;
  createdAt: string;
}

// ============================================================
// PROACTIVE SUGGESTION
// ============================================================

/**
 * A proactive suggestion from the AI based on backlog analysis.
 * Used in Plan 12-03 for suggestion cards.
 */
export interface ProactiveSuggestion {
  id: string;
  message: string;
  severity: 'info' | 'warning';
  relatedItems: string[];
}

// ============================================================
// PANEL STATE
// ============================================================

/**
 * State of the chat panel UI.
 */
export type ChatPanelState = 'idle' | 'loading' | 'error';
