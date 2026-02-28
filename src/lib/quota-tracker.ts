/**
 * Quota Tracker - Local sliding-window API usage estimation
 *
 * Since the Gemini API does not return rate-limit headers via the
 * @google/generative-ai SDK (GenerateContentResult has no HTTP header access),
 * a local sliding-window approach is the only viable way to track usage.
 *
 * Tracks timestamps of each successful API request per provider.
 * RPM = requests in the last 60 seconds.
 * RPD = requests in the last 24 hours.
 *
 * Data is persisted to localStorage under STORAGE_KEYS.QUOTA_TRACKER.
 * Storage format: { [providerId]: number[] } — arrays of Unix timestamps (ms).
 */

import { STORAGE_KEYS } from '../constants/storage';

// ============================================================
// TYPES
// ============================================================

export interface QuotaSnapshot {
  /** Requests in the last 60 seconds */
  rpm: number;
  /** Requests in the last 24 hours */
  rpd: number;
  /** Provider RPM limit */
  rpmLimit: number;
  /** Provider RPD limit */
  rpdLimit: number;
}

export interface ProviderLimits {
  rpm: number;
  rpd: number;
}

// ============================================================
// KNOWN FREE-TIER LIMITS
// ============================================================

/**
 * Conservative free-tier limit estimates per provider.
 * Gemini: 10 RPM / 250 RPD (free tier with billing level 1)
 * Groq: 30 RPM / 14400 RPD (free tier)
 * OpenAI: 60 RPM / 10000 RPD (tier 1 estimate)
 */
export const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  gemini: { rpm: 10, rpd: 250 },
  groq: { rpm: 30, rpd: 14400 },
  openai: { rpm: 60, rpd: 10000 },
};

const DEFAULT_LIMITS: ProviderLimits = { rpm: 60, rpd: 10000 };

// Sliding window durations in ms
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Max entries stored per provider to bound localStorage size
const MAX_ENTRIES = 500;

// ============================================================
// STORAGE HELPERS
// ============================================================

function loadStore(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUOTA_TRACKER);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number[]>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, number[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUOTA_TRACKER, JSON.stringify(store));
  } catch {
    // localStorage write failure is non-fatal — quota data is estimative only
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Record a successful API request for a provider.
 * Pushes the current timestamp and prunes entries older than 24h.
 * Caps the array at MAX_ENTRIES to bound storage usage.
 */
export function recordRequest(providerId: string): void {
  const now = Date.now();
  const cutoff = now - ONE_DAY_MS;
  const store = loadStore();

  const timestamps = (store[providerId] ?? []).filter(ts => ts > cutoff);
  timestamps.push(now);

  // Cap to MAX_ENTRIES — discard oldest entries first
  store[providerId] = timestamps.length > MAX_ENTRIES
    ? timestamps.slice(timestamps.length - MAX_ENTRIES)
    : timestamps;

  saveStore(store);
}

/**
 * Get a quota snapshot for a provider.
 * Counts timestamps within sliding windows: 60s for RPM, 24h for RPD.
 * Returns limits from PROVIDER_LIMITS (or defaults for unknown providers).
 */
export function getQuotaSnapshot(providerId: string): QuotaSnapshot {
  const now = Date.now();
  const rpmCutoff = now - ONE_MINUTE_MS;
  const rpdCutoff = now - ONE_DAY_MS;

  const store = loadStore();
  const timestamps = store[providerId] ?? [];

  const rpm = timestamps.filter(ts => ts > rpmCutoff).length;
  const rpd = timestamps.filter(ts => ts > rpdCutoff).length;

  const limits = PROVIDER_LIMITS[providerId] ?? DEFAULT_LIMITS;

  return {
    rpm,
    rpd,
    rpmLimit: limits.rpm,
    rpdLimit: limits.rpd,
  };
}

/**
 * Reset quota data for a specific provider or all providers.
 * @param providerId - If provided, clears only that provider's data.
 *   If omitted, clears all providers.
 */
export function resetQuota(providerId?: string): void {
  const store = loadStore();
  if (providerId) {
    delete store[providerId];
  } else {
    Object.keys(store).forEach(key => delete store[key]);
  }
  saveStore(store);
}
