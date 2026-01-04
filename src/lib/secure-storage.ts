/**
 * Secure Storage - Encrypted API key storage
 *
 * Provides obfuscated storage for sensitive data.
 * - Tauri: Uses localStorage with obfuscation (isolated app context)
 * - Web: Uses sessionStorage (keys cleared on tab close)
 *
 * Note: This is defense-in-depth, not cryptographic security.
 * The keys are obfuscated to prevent casual inspection.
 */

import { isTauri } from './tauri-bridge';

// Obfuscation prefix to identify encoded values
const ENCODED_PREFIX = 'enc:v1:';

// Simple XOR key for obfuscation (not cryptographic, just obfuscation)
const OBFUSCATION_KEY = 'TF_2026_ARIA';

/**
 * Simple XOR obfuscation
 * Not cryptographically secure, but prevents plaintext storage
 */
function xorObfuscate(input: string): string {
  const key = OBFUSCATION_KEY;
  let result = '';
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(
      input.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return result;
}

/**
 * Encode a value for storage
 */
function encode(value: string): string {
  const obfuscated = xorObfuscate(value);
  // Use btoa for base64 encoding
  const encoded = btoa(unescape(encodeURIComponent(obfuscated)));
  return ENCODED_PREFIX + encoded;
}

/**
 * Decode a stored value
 */
function decode(stored: string): string | null {
  if (!stored.startsWith(ENCODED_PREFIX)) {
    // Legacy plaintext value - return as-is and migrate on next save
    return stored;
  }
  try {
    const encoded = stored.slice(ENCODED_PREFIX.length);
    const obfuscated = decodeURIComponent(escape(atob(encoded)));
    return xorObfuscate(obfuscated);
  } catch {
    return null;
  }
}

/**
 * Get the appropriate storage based on environment
 * - Tauri: localStorage (app is sandboxed)
 * - Web: sessionStorage (more secure, clears on close)
 */
function getStorage(): Storage {
  if (isTauri()) {
    return localStorage;
  }
  // Web mode: use sessionStorage for better security
  return sessionStorage;
}

/**
 * Store a sensitive value securely
 * @param key Storage key
 * @param value Value to store
 */
export function setSecureItem(key: string, value: string): void {
  const storage = getStorage();
  storage.setItem(key, encode(value));
}

/**
 * Retrieve a sensitive value
 * @param key Storage key
 * @returns Decoded value or null
 */
export function getSecureItem(key: string): string | null {
  const storage = getStorage();
  const stored = storage.getItem(key);
  if (!stored) return null;
  return decode(stored);
}

/**
 * Remove a sensitive value
 * @param key Storage key
 */
export function removeSecureItem(key: string): void {
  const storage = getStorage();
  storage.removeItem(key);
}

/**
 * Check if a key exists in secure storage
 * @param key Storage key
 */
export function hasSecureItem(key: string): boolean {
  const storage = getStorage();
  return storage.getItem(key) !== null;
}

/**
 * Migrate legacy plaintext values to encoded format
 * Call this once on app startup
 */
export function migrateToSecureStorage(keys: string[]): void {
  const storage = getStorage();
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value && !value.startsWith(ENCODED_PREFIX)) {
      // Re-encode the plaintext value
      storage.setItem(key, encode(value));
    }
  }
}
