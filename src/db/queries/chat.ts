/**
 * Query module for chat_messages table operations.
 *
 * Provides CRUD operations for AI chat message persistence.
 * Messages are stored per-project with JSON-encoded citations and actions.
 *
 * @module db/queries/chat
 */

import { getDatabase } from '../database';
import type { ChatMessage, ChatAction } from '../../types/chat';

// ============================================================
// DB ROW TYPE
// ============================================================

interface DbChatMessage {
  id: number;
  project_id: number;
  role: string;
  content: string;
  citations: string | null;
  action: string | null;
  created_at: string;
}

// ============================================================
// TRANSFORM HELPERS
// ============================================================

/**
 * Convert a database row to a ChatMessage domain type.
 */
function dbRowToChatMessage(row: DbChatMessage): ChatMessage {
  let citations: string[] | null = null;
  if (row.citations) {
    try {
      citations = JSON.parse(row.citations);
    } catch {
      citations = null;
    }
  }

  let action: ChatAction | null = null;
  if (row.action) {
    try {
      action = JSON.parse(row.action);
    } catch {
      action = null;
    }
  }

  return {
    id: row.id,
    projectId: row.project_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    citations,
    action,
    createdAt: row.created_at,
  };
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Get chat messages for a project, ordered chronologically (oldest first).
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param limit - Maximum number of messages to return (default: 50)
 * @returns Array of ChatMessages ordered by created_at ASC
 */
export async function getChatMessages(
  projectPath: string,
  projectId: number,
  limit: number = 50
): Promise<ChatMessage[]> {
  try {
    const db = await getDatabase(projectPath);
    const rows = await db.select<DbChatMessage[]>(
      `SELECT * FROM chat_messages
       WHERE project_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [projectId, limit]
    );
    return rows.map(dbRowToChatMessage);
  } catch (error) {
    console.error('[chat] Error getting messages:', error);
    throw error;
  }
}

/**
 * Insert a new chat message into the database.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message text content
 * @param citations - Optional array of item IDs cited
 * @param action - Optional action for the UI to execute
 * @returns The ID of the inserted message
 */
export async function insertChatMessage(
  projectPath: string,
  projectId: number,
  role: string,
  content: string,
  citations?: string[],
  action?: ChatAction
): Promise<number> {
  try {
    const db = await getDatabase(projectPath);
    const citationsJson = citations && citations.length > 0
      ? JSON.stringify(citations)
      : null;
    const actionJson = action
      ? JSON.stringify(action)
      : null;

    const result = await db.execute(
      `INSERT INTO chat_messages (project_id, role, content, citations, action)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, role, content, citationsJson, actionJson]
    );

    return result.lastInsertId ?? 0;
  } catch (error) {
    console.error('[chat] Error inserting message:', error);
    throw error;
  }
}

/**
 * Delete all chat messages for a project.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 */
export async function clearChatMessages(
  projectPath: string,
  projectId: number
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      'DELETE FROM chat_messages WHERE project_id = $1',
      [projectId]
    );
  } catch (error) {
    console.error('[chat] Error clearing messages:', error);
    throw error;
  }
}

/**
 * Trim old chat messages beyond a maximum count per project.
 * Keeps the most recent messages, deletes the oldest.
 * Follows the telemetry auto-trim pattern.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectId - The project ID
 * @param maxMessages - Maximum number of messages to keep (default: 200)
 */
export async function trimChatMessages(
  projectPath: string,
  projectId: number,
  maxMessages: number = 200
): Promise<void> {
  try {
    const db = await getDatabase(projectPath);
    await db.execute(
      `DELETE FROM chat_messages
       WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM chat_messages
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [projectId, maxMessages]
    );
  } catch (error) {
    console.error('[chat] Error trimming messages:', error);
    // Non-critical: don't throw, just log
  }
}
