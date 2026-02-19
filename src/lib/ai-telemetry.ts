/**
 * AI Telemetry Module - Error rate tracking and metrics
 *
 * Provides:
 * - Recording of AI operation success/failure metrics
 * - Error rate computation via SQL aggregation
 * - Auto-trim to prevent unbounded table growth
 *
 * @module lib/ai-telemetry
 */

import { getDatabase, getCurrentProjectPath } from '../db/database';

// ============================================================
// TYPES
// ============================================================

export type TelemetryOperation = 'generate' | 'refine' | 'analyze' | 'suggest' | 'dependency_detect' | 'chat' | 'bulk_generate';
export type TelemetryErrorType = 'json_parse' | 'validation' | 'network' | 'timeout' | 'unknown';

export interface TelemetryEntry {
  projectId: number;
  operation: TelemetryOperation;
  provider: string;
  model: string;
  success: boolean;
  errorType?: TelemetryErrorType;
  retryCount: number;
  latencyMs: number;
}

export interface ErrorRateResult {
  errorRate: number;
  totalCalls: number;
  failures: number;
}

export interface TelemetryStats {
  byProvider: Record<string, { calls: number; errorRate: number }>;
  byOperation: Record<string, { calls: number; avgLatency: number }>;
}

// ============================================================
// TELEMETRY RECORDING
// ============================================================

/**
 * Record an AI operation telemetry entry.
 *
 * Automatically trims old entries to prevent unbounded growth.
 * Fails silently - telemetry should never break AI operations.
 *
 * @param entry - Telemetry entry to record
 */
export async function recordTelemetry(entry: TelemetryEntry): Promise<void> {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      console.warn('[Telemetry] No active project path');
      return;
    }

    const db = await getDatabase(projectPath);

    // Insert telemetry entry
    await db.execute(
      `INSERT INTO ai_telemetry
       (project_id, operation, provider, model, success, error_type, retry_count, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.projectId,
        entry.operation,
        entry.provider,
        entry.model,
        entry.success ? 1 : 0,
        entry.errorType || null,
        entry.retryCount,
        entry.latencyMs
      ]
    );

    // Auto-trim to prevent unbounded growth (keep last 1000 entries per project)
    await db.execute(
      `DELETE FROM ai_telemetry
       WHERE project_id = $1
       AND id NOT IN (
         SELECT id FROM ai_telemetry
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT 1000
       )`,
      [entry.projectId]
    );
  } catch (error) {
    // Don't fail AI operations if telemetry fails - just log
    console.warn('[Telemetry] Failed to record:', error);
  }
}

// ============================================================
// ERROR RATE COMPUTATION
// ============================================================

/**
 * Get error rate for a project over a time period.
 *
 * @param projectId - Project ID to query
 * @param days - Number of days to look back (default: 7)
 * @returns Error rate percentage and counts
 */
export async function getErrorRate(projectId: number, days: number = 7): Promise<ErrorRateResult> {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return { errorRate: 0, totalCalls: 0, failures: 0 };
  }

  const db = await getDatabase(projectPath);

  const result = await db.select<Array<{ total: number; failures: number }>>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
     FROM ai_telemetry
     WHERE project_id = $1
       AND created_at > datetime('now', '-' || $2 || ' days')`,
    [projectId, days]
  );

  const row = result[0] || { total: 0, failures: 0 };
  const total = row.total || 0;
  const failures = row.failures || 0;

  return {
    errorRate: total > 0 ? (failures / total) * 100 : 0,
    totalCalls: total,
    failures
  };
}

// ============================================================
// TELEMETRY STATISTICS
// ============================================================

/**
 * Get detailed telemetry statistics for a project.
 *
 * @param projectId - Project ID to query
 * @returns Stats broken down by provider and operation
 */
export async function getTelemetryStats(projectId: number): Promise<TelemetryStats> {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return { byProvider: {}, byOperation: {} };
  }

  const db = await getDatabase(projectPath);

  // Stats by provider
  const providerStats = await db.select<Array<{
    provider: string;
    total: number;
    failures: number;
  }>>(
    `SELECT provider, COUNT(*) as total,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
     FROM ai_telemetry WHERE project_id = $1
     GROUP BY provider`,
    [projectId]
  );

  // Stats by operation
  const opStats = await db.select<Array<{
    operation: string;
    total: number;
    avg_latency: number;
  }>>(
    `SELECT operation, COUNT(*) as total, AVG(latency_ms) as avg_latency
     FROM ai_telemetry WHERE project_id = $1
     GROUP BY operation`,
    [projectId]
  );

  return {
    byProvider: Object.fromEntries(
      providerStats.map(p => [p.provider, {
        calls: p.total,
        errorRate: p.total > 0 ? ((p.failures || 0) / p.total) * 100 : 0
      }])
    ),
    byOperation: Object.fromEntries(
      opStats.map(o => [o.operation, {
        calls: o.total,
        avgLatency: Math.round(o.avg_latency || 0)
      }])
    )
  };
}

