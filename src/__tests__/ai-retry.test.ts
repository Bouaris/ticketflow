/**
 * AI Retry Module Tests — TCOV-03
 *
 * Tests for src/lib/ai-retry.ts:
 * - generateWithRetry: retry logic, error classification (no retry on 429/401/403,
 *   retry on 500), error feedback in retry prompts, JSON extraction, Zod validation
 * - getStructuredOutputMode: capability detection per provider/model
 * - zodToSimpleJsonSchema: Zod-to-JSON-Schema conversion
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ============================================================
// MOCKS (hoisted by Vitest — must be at top level)
// ============================================================

vi.mock('../lib/ai-provider-registry', () => ({
  getProviderById: vi.fn(() => null),
}));

vi.mock('../i18n', () => ({
  getTranslations: () => ({
    aiErrors: {
      rateLimitReached: 'Rate limit reached',
      invalidApiKey: 'Invalid API key',
    },
  }),
}));

// ============================================================
// IMPORTS (after mocks)
// ============================================================

import {
  generateWithRetry,
  getStructuredOutputMode,
  zodToSimpleJsonSchema,
} from '../lib/ai-retry';

// ============================================================
// SUITE 1: generateWithRetry
// ============================================================

describe('generateWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. returns success on first attempt when generate returns valid JSON', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi.fn().mockResolvedValue('{"result": "hello"}');

    const result = await generateWithRetry('test prompt', schema, generate);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.result).toBe('hello');
      expect(result.retryCount).toBe(0);
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('2. does NOT retry on 429 rate limit error', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'));

    const result = await generateWithRetry('test prompt', schema, generate, 3);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Rate limit');
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('3. does NOT retry on 401 auth error', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    const result = await generateWithRetry('test prompt', schema, generate, 3);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('API key');
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('4. does NOT retry on 403 forbidden error', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

    const result = await generateWithRetry('test prompt', schema, generate, 3);

    expect(result.success).toBe(false);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('5. retries on 500 server error and succeeds on retry', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValueOnce('{"result": "ok"}');

    const result = await generateWithRetry('test prompt', schema, generate, 1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.retryCount).toBe(1);
    }
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test('6. retries on invalid JSON and includes error feedback in retry prompt', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi
      .fn()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce('{"result": "fixed"}');

    const result = await generateWithRetry('original prompt', schema, generate, 1);

    expect(result.success).toBe(true);
    // Second call should contain [CORRECTION REQUIRED] in the prompt
    const secondCallPrompt = generate.mock.calls[1]?.[0] as string;
    expect(secondCallPrompt).toContain('[CORRECTION REQUIRED]');
  });

  test('7. retries on Zod validation failure with detailed error', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const generate = vi
      .fn()
      .mockResolvedValueOnce('{"name": 123}') // wrong type for name
      .mockResolvedValueOnce('{"name": "Alice", "age": 30}');

    const result = await generateWithRetry('test prompt', schema, generate, 1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Alice');
    }
  });

  test('8. returns failure when all retries exhausted', async () => {
    const schema = z.object({ result: z.string() });
    const generate = vi.fn().mockResolvedValue('not json');

    const result = await generateWithRetry('test prompt', schema, generate, 2);

    expect(result.success).toBe(false);
    // 1 initial attempt + 2 retries = 3 total calls
    expect(generate).toHaveBeenCalledTimes(3);
  });
});

// ============================================================
// SUITE 2: getStructuredOutputMode
// ============================================================

describe('getStructuredOutputMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('9. returns strict for known Groq strict model', () => {
    expect(getStructuredOutputMode('groq', 'llama-3.3-70b-specdec')).toBe('strict');
  });

  test('10. returns bestEffort for known Groq bestEffort model', () => {
    expect(getStructuredOutputMode('groq', 'llama-3.3-70b-versatile')).toBe('bestEffort');
  });

  test('11. returns schema for known Gemini model', () => {
    expect(getStructuredOutputMode('gemini', 'gemini-2.5-flash')).toBe('schema');
  });

  test('12. returns none for unknown provider', () => {
    expect(getStructuredOutputMode('unknown-provider', 'some-model')).toBe('none');
  });
});

// ============================================================
// SUITE 3: zodToSimpleJsonSchema
// ============================================================

describe('zodToSimpleJsonSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('13. converts simple object schema', () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = zodToSimpleJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.properties).toBeDefined();
    expect(result.properties?.name).toBeDefined();
    expect(result.properties?.count).toBeDefined();
    expect(result.additionalProperties).toBe(false);
  });

  test('14. converts schema with enum', () => {
    const schema = z.object({ status: z.enum(['active', 'inactive']) });
    const result = zodToSimpleJsonSchema(schema);

    expect(result.properties?.status).toBeDefined();
    // The status property should have an enum array
    const statusProp = result.properties?.status;
    expect(statusProp?.enum).toBeDefined();
    expect(Array.isArray(statusProp?.enum)).toBe(true);
  });
});
