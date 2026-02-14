/**
 * I18n Provider and useTranslation hook
 *
 * Lightweight custom i18n system with:
 * - React context for locale state
 * - SQLite persistence via user_preferences table
 * - Immediate UI updates on locale change (no page refresh)
 * - Type-safe t() accessor returning the full Translations object
 *
 * Usage:
 * ```tsx
 * // In main.tsx or app root
 * <I18nProvider defaultLocale="fr">
 *   <App />
 * </I18nProvider>
 *
 * // In any component
 * const { t, locale, setLocale } = useTranslation();
 * return <span>{t.settings.title}</span>;
 * ```
 *
 * @module i18n
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { Translations, Locale } from './types';
import { SUPPORTED_LOCALES } from './types';
import { fr } from './locales/fr';
import { en } from './locales/en';

// Re-export types for convenience
export { SUPPORTED_LOCALES } from './types';
export type { Translations, Locale } from './types';

/** Map of locale code to translations object */
const LOCALE_MAP: Record<Locale, Translations> = { fr, en };

/** Default locale used when no preference is stored */
const DEFAULT_LOCALE: Locale = 'fr';

// ── Context ──────────────────────────────────────────────────

interface I18nContextValue {
  /** Current translations object (use t.section.key) */
  t: Translations;
  /** Current locale code */
  locale: Locale;
  /** Change the active locale (persists to SQLite if available) */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ── SQLite persistence helpers ───────────────────────────────

/**
 * Load locale preference from SQLite user_preferences table.
 * Returns null if not in Tauri or no preference stored.
 */
async function loadLocaleFromDb(): Promise<Locale | null> {
  try {
    // Dynamic import to avoid bundling tauri-plugin-sql in web builds
    const { getDatabase, getCurrentProjectPath } = await import('../db/database');
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return null;

    const db = await getDatabase(projectPath);
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM user_preferences WHERE key = $1',
      ['locale']
    );
    if (rows.length > 0 && isValidLocale(rows[0].value)) {
      return rows[0].value as Locale;
    }
  } catch {
    // Not in Tauri or DB not available - fall through
  }
  return null;
}

/**
 * Persist locale preference to SQLite user_preferences table.
 * Silently fails if not in Tauri or DB not available.
 */
async function saveLocaleToDb(locale: Locale): Promise<void> {
  try {
    const { getDatabase, getCurrentProjectPath } = await import('../db/database');
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const db = await getDatabase(projectPath);
    await db.execute(
      'INSERT INTO user_preferences (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      ['locale', locale]
    );
  } catch {
    // Not in Tauri or DB not available - silent
  }
}

/** Type guard for valid locale codes */
function isValidLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.some(l => l.code === value);
}

// ── Non-React locale accessor ────────────────────────────────

/** Module-level locale for non-React consumers (ai.ts, etc.) */
let _currentLocale: Locale = DEFAULT_LOCALE;

/** Get current locale from non-React code (lib modules, utilities) */
export function getCurrentLocale(): Locale {
  return _currentLocale;
}

/** Get current translations from non-React code */
export function getTranslations(): Translations {
  return LOCALE_MAP[_currentLocale];
}

// ── Provider ─────────────────────────────────────────────────

interface I18nProviderProps {
  /** Default locale before DB preference is loaded */
  defaultLocale?: Locale;
  children: ReactNode;
}

/**
 * Provides i18n context to the component tree.
 *
 * On mount, attempts to load persisted locale from SQLite.
 * Falls back to defaultLocale (default: 'fr').
 */
export function I18nProvider({
  defaultLocale = DEFAULT_LOCALE,
  children,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Load persisted locale on mount
  useEffect(() => {
    loadLocaleFromDb().then(persisted => {
      if (persisted) {
        setLocaleState(persisted);
        _currentLocale = persisted;
      }
    });
  }, []);

  // Stable setLocale callback that also persists
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    _currentLocale = newLocale;
    saveLocaleToDb(newLocale);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<I18nContextValue>(
    () => ({
      t: LOCALE_MAP[locale],
      locale,
      setLocale,
    }),
    [locale, setLocale]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

/**
 * Access translations and locale controls from any component.
 *
 * @returns { t, locale, setLocale }
 * @throws Error if used outside I18nProvider
 *
 * @example
 * ```tsx
 * const { t, locale, setLocale } = useTranslation();
 * return (
 *   <button onClick={() => setLocale('en')}>
 *     {t.settings.language}
 *   </button>
 * );
 * ```
 */
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
