/**
 * AI Provider Health Check Module
 *
 * Provides connectivity testing for AI providers with error classification.
 * Used by ProviderCard to validate API keys and measure latency.
 *
 * @module lib/ai-health
 */

import { testProviderConnection } from './ai';
import { createTimeoutController, clearControllerTimeout, isAbortError } from './abort';
import { track } from './telemetry';

/**
 * Result of a provider health check.
 */
export interface HealthCheckResult {
  /** Whether the connection was successful */
  success: boolean;
  /** Round-trip latency in milliseconds (if successful) */
  latencyMs?: number;
  /** Human-readable error message */
  error?: string;
  /** Classified error type for targeted user guidance */
  errorType?: 'network' | 'auth' | 'rate_limit' | 'timeout' | 'unknown';
}

/**
 * Test provider connectivity with minimal token usage.
 *
 * Makes a lightweight completion request (maxTokens: 5) to verify:
 * - API key is valid
 * - Provider endpoint is reachable
 * - No rate limiting in effect
 *
 * Error classification helps users diagnose issues:
 * - `auth`: Invalid API key → check key and retry
 * - `rate_limit`: Rate limit hit → wait and retry
 * - `timeout`: Request timed out → check network/provider status
 * - `network`: Network connectivity issue → check internet
 * - `unknown`: Unclassified error → try again later
 *
 * @param providerId - Provider to test (groq/gemini/openai or custom provider ID)
 * @param timeoutMs - Max wait time in milliseconds (default: 10000)
 * @returns Health check result with latency or classified error
 */
export async function testProviderHealth(
  providerId: string,
  timeoutMs = 10000
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const controller = createTimeoutController(timeoutMs);

  try {
    // Make minimal test request (5 tokens max)
    await testProviderConnection(providerId);

    const latencyMs = Date.now() - startTime;
    const result: HealthCheckResult = {
      success: true,
      latencyMs,
    };
    track('ai_health_check_run', { provider: providerId, success: true, latency_ms: latencyMs });
    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Classify error type for targeted user guidance
    if (isAbortError(error)) {
      track('ai_health_check_run', { provider: providerId, success: false, latency_ms: latencyMs });
      return {
        success: false,
        latencyMs,
        error: 'Connection timeout',
        errorType: 'timeout',
      };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Authentication errors (401, 403, invalid key)
    if (/\b(401|403)\b|unauthorized|forbidden|invalid.*api.*key/i.test(errorMsg)) {
      track('ai_health_check_run', { provider: providerId, success: false, latency_ms: latencyMs });
      return {
        success: false,
        latencyMs,
        error: 'Invalid API key',
        errorType: 'auth',
      };
    }

    // Rate limit errors (429, rate limit, quota)
    if (/\b429\b|rate.?limit|resource.?exhausted/i.test(errorMsg)) {
      track('ai_health_check_run', { provider: providerId, success: false, latency_ms: latencyMs });
      return {
        success: false,
        latencyMs,
        error: 'Rate limit reached',
        errorType: 'rate_limit',
      };
    }

    // Network errors (connection refused, DNS, etc.)
    if (/network|fetch|ECONNREFUSED|ENOTFOUND|ERR_NAME/i.test(errorMsg)) {
      track('ai_health_check_run', { provider: providerId, success: false, latency_ms: latencyMs });
      return {
        success: false,
        latencyMs,
        error: 'Network error',
        errorType: 'network',
      };
    }

    // Unclassified error
    track('ai_health_check_run', { provider: providerId, success: false, latency_ms: latencyMs });
    return {
      success: false,
      latencyMs,
      error: errorMsg,
      errorType: 'unknown',
    };
  } finally {
    clearControllerTimeout(controller);
  }
}
