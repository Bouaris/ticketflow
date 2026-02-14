/**
 * AI Service Mocks
 *
 * Mocks for Groq and Gemini AI APIs to enable testing
 * without making actual API calls.
 */

import { vi } from 'vitest';
import type { RefinementResult, GenerateItemResult } from '../../lib/ai';

// ============================================================
// MOCK RESPONSES
// ============================================================

export const mockRefinedItem = {
  title: 'Mock Refined Title',
  userStory: 'En tant que testeur, je veux des mocks pour tester facilement.',
  specs: ['Spec 1', 'Spec 2'],
  criteria: [
    { text: 'Criterion 1', checked: false },
    { text: 'Criterion 2', checked: false },
  ],
  suggestions: ['Suggestion 1', 'Suggestion 2'],
};

export const mockGeneratedItem = {
  title: 'Mock Generated Title',
  description: 'Description générée par mock',
  userStory: 'En tant que utilisateur, je veux...',
  specs: ['Spec générée'],
  criteria: [{ text: 'Critère généré', checked: false }],
  suggestedType: 'CT' as const,
  suggestedPriority: 'Moyenne' as const,
  suggestedSeverity: undefined,
  suggestedEffort: 'M' as const,
  suggestedModule: undefined,
  emoji: undefined,
};

// ============================================================
// MOCK: AI Functions
// ============================================================

export const mockAI = {
  getProvider: vi.fn(() => 'gemini' as const),
  setProvider: vi.fn(),
  getApiKey: vi.fn(() => 'mock-api-key'),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  hasApiKey: vi.fn(() => true),
  getClientConfig: vi.fn(() => ({ provider: 'gemini' as const, apiKey: 'mock-api-key' })),
  resetClient: vi.fn(),

  refineItem: vi.fn((): Promise<RefinementResult> =>
    Promise.resolve({
      success: true,
      refinedItem: mockRefinedItem,
    })
  ),

  generateItemFromDescription: vi.fn((): Promise<GenerateItemResult> =>
    Promise.resolve({
      success: true,
      item: mockGeneratedItem,
    })
  ),

  suggestImprovements: vi.fn(() =>
    Promise.resolve({
      success: true,
      suggestions: ['Amélioration 1', 'Amélioration 2'],
    })
  ),

  initSecureStorage: vi.fn(),
};

// ============================================================
// APPLY MOCKS
// ============================================================

/**
 * Apply AI mocks to the module system.
 */
export function applyAIMocks() {
  vi.mock('../../lib/ai', () => mockAI);
}

/**
 * Reset all AI mocks between tests.
 */
export function resetAIMocks() {
  Object.values(mockAI).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
}

/**
 * Configure mock to return an error.
 */
export function mockAIError(errorMessage = 'API Error') {
  mockAI.refineItem.mockResolvedValueOnce({
    success: false,
    error: errorMessage,
  });
  mockAI.generateItemFromDescription.mockResolvedValueOnce({
    success: false,
    error: errorMessage,
  });
}
