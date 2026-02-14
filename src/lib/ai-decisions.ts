/**
 * AI Decisions Persistence - Store user decisions on AI suggestions
 *
 * Uses localStorage for persistent storage across sessions
 */

import type { SuggestionDecision } from '../types/ai';
import { getAIDecisionsKey } from '../constants/storage';

// ============================================================
// TYPES
// ============================================================

interface AIDecisionsStorage {
  version: number;
  decisions: SuggestionDecision[];
  lastUpdated: number;
}

const STORAGE_VERSION = 1;

// ============================================================
// LOAD/SAVE FUNCTIONS
// ============================================================

/**
 * Load all decisions for a project
 */
export function loadDecisions(projectPath: string): SuggestionDecision[] {
  try {
    const key = getAIDecisionsKey(projectPath);
    const stored = localStorage.getItem(key);

    if (!stored) return [];

    const parsed: AIDecisionsStorage = JSON.parse(stored);

    // Version check for future migrations
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('[AIDecisions] Version mismatch, clearing decisions');
      clearDecisions(projectPath);
      return [];
    }

    return parsed.decisions;
  } catch (error) {
    console.warn('[AIDecisions] Error loading decisions:', error);
    return [];
  }
}

/**
 * Save a single decision
 * Updates existing decision if same suggestionId exists
 */
export function saveDecision(
  projectPath: string,
  decision: SuggestionDecision
): void {
  try {
    const existing = loadDecisions(projectPath);

    // Update or add decision
    const index = existing.findIndex(d => d.suggestionId === decision.suggestionId);
    if (index >= 0) {
      existing[index] = decision;
    } else {
      existing.push(decision);
    }

    const storage: AIDecisionsStorage = {
      version: STORAGE_VERSION,
      decisions: existing,
      lastUpdated: Date.now(),
    };

    const key = getAIDecisionsKey(projectPath);
    localStorage.setItem(key, JSON.stringify(storage));
  } catch (error) {
    console.warn('[AIDecisions] Error saving decision:', error);
  }
}

/**
 * Get a specific decision by suggestionId
 */
export function getDecision(
  projectPath: string,
  suggestionId: string
): SuggestionDecision | null {
  const decisions = loadDecisions(projectPath);
  return decisions.find(d => d.suggestionId === suggestionId) || null;
}

/**
 * Remove a specific decision
 */
export function removeDecision(projectPath: string, suggestionId: string): void {
  try {
    const existing = loadDecisions(projectPath);
    const filtered = existing.filter(d => d.suggestionId !== suggestionId);

    if (filtered.length === existing.length) return; // Nothing to remove

    const storage: AIDecisionsStorage = {
      version: STORAGE_VERSION,
      decisions: filtered,
      lastUpdated: Date.now(),
    };

    const key = getAIDecisionsKey(projectPath);
    localStorage.setItem(key, JSON.stringify(storage));
  } catch (error) {
    console.warn('[AIDecisions] Error removing decision:', error);
  }
}

/**
 * Clear all decisions for a project
 */
export function clearDecisions(projectPath: string): void {
  try {
    const key = getAIDecisionsKey(projectPath);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[AIDecisions] Error clearing decisions:', error);
  }
}

/**
 * Get decision statistics
 */
export function getDecisionStats(projectPath: string): {
  total: number;
  accepted: number;
  rejected: number;
  modified: number;
} {
  const decisions = loadDecisions(projectPath);

  return {
    total: decisions.length,
    accepted: decisions.filter(d => d.decision === 'accepted').length,
    rejected: decisions.filter(d => d.decision === 'rejected').length,
    modified: decisions.filter(d => d.decision === 'modified').length,
  };
}

/**
 * Check if a suggestion has been decided
 */
export function hasDecision(projectPath: string, suggestionId: string): boolean {
  return getDecision(projectPath, suggestionId) !== null;
}

/**
 * Convert decisions to a Map for efficient lookup
 */
export function loadDecisionsAsMap(
  projectPath: string
): Map<string, SuggestionDecision> {
  const decisions = loadDecisions(projectPath);
  return new Map(decisions.map(d => [d.suggestionId, d]));
}
