/**
 * Theme Provider and useTheme hook
 *
 * Dark mode infrastructure with:
 * - React context for theme state (light/dark/system)
 * - SQLite persistence via user_preferences table
 * - localStorage cache for flash prevention (sync read on startup)
 * - OS preference detection via matchMedia
 * - Immediate theme application via data-theme attribute
 *
 * Usage:
 * ```tsx
 * // In main.tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 *
 * // In any component
 * const { theme, resolved, setTheme } = useTheme();
 * ```
 *
 * @module theme
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

// ── Types ──────────────────────────────────────────────────

/** User-facing theme preference */
export type Theme = 'light' | 'dark' | 'system';

/** Actual applied theme (resolved from system preference if needed) */
export type ResolvedTheme = 'light' | 'dark';

// ── Context ────────────────────────────────────────────────

interface ThemeContextValue {
  /** Current user preference (light/dark/system) */
  theme: Theme;
  /** Resolved theme actually applied to the DOM */
  resolved: ResolvedTheme;
  /** Change the theme preference (persists to localStorage + SQLite) */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY = 'ticketflow-theme';
const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];

// ── SQLite persistence helpers ─────────────────────────────

/**
 * Load theme preference from SQLite user_preferences table.
 * Returns null if not in Tauri or no preference stored.
 */
async function loadThemeFromDb(): Promise<Theme | null> {
  try {
    const { getDatabase, getCurrentProjectPath } = await import('../db/database');
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return null;

    const db = await getDatabase(projectPath);
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM user_preferences WHERE key = $1',
      ['theme']
    );
    if (rows.length > 0 && isValidTheme(rows[0].value)) {
      return rows[0].value as Theme;
    }
  } catch {
    // Not in Tauri or DB not available - fall through
  }
  return null;
}

/**
 * Persist theme preference to SQLite user_preferences table.
 * Silently fails if not in Tauri or DB not available.
 */
async function saveThemeToDb(theme: Theme): Promise<void> {
  try {
    const { getDatabase, getCurrentProjectPath } = await import('../db/database');
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const db = await getDatabase(projectPath);
    await db.execute(
      'INSERT INTO user_preferences (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      ['theme', theme]
    );
  } catch {
    // Not in Tauri or DB not available - silent
  }
}

// ── Helper functions ───────────────────────────────────────

/** Type guard for valid theme values */
function isValidTheme(value: string): value is Theme {
  return VALID_THEMES.includes(value as Theme);
}

/** Detect OS color scheme preference */
function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Resolve user preference to actual theme */
function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

/** Apply resolved theme to the DOM */
function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

/** Read theme from localStorage (sync, for initial state) */
function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidTheme(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'system';
}

// ── Provider ───────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme before any preference is loaded */
  defaultTheme?: Theme;
}

/**
 * Provides theme context to the component tree.
 *
 * On mount, attempts to load persisted theme from SQLite.
 * Falls back to localStorage cache, then to 'system'.
 * Listens for OS theme changes when in 'system' mode.
 */
export function ThemeProvider({
  children,
  defaultTheme,
}: ThemeProviderProps) {
  // Initialize from localStorage for instant theme application (no flash)
  const initial = defaultTheme ?? getStoredTheme();
  const [theme, setThemeState] = useState<Theme>(initial);
  const [resolved, setResolved] = useState<ResolvedTheme>(resolveTheme(initial));

  // Load persisted theme from SQLite on mount (source of truth)
  useEffect(() => {
    loadThemeFromDb().then(persisted => {
      if (persisted) {
        setThemeState(persisted);
        localStorage.setItem(STORAGE_KEY, persisted);
        const r = resolveTheme(persisted);
        setResolved(r);
        applyTheme(r);
      }
    });
  }, []);

  // Apply theme to DOM whenever resolved changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for OS theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const r: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolved(r);
      applyTheme(r);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Stable setTheme callback that persists to both localStorage and SQLite
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const r = resolveTheme(newTheme);
    setResolved(r);
    applyTheme(r);

    // Sync to localStorage (fast, for flash prevention script)
    localStorage.setItem(STORAGE_KEY, newTheme);

    // Persist to SQLite (async, source of truth)
    saveThemeToDb(newTheme);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolved,
      setTheme,
    }),
    [theme, resolved, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────

/**
 * Access theme state and controls from any component.
 *
 * @returns { theme, resolved, setTheme }
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```tsx
 * const { theme, resolved, setTheme } = useTheme();
 * return (
 *   <button onClick={() => setTheme('dark')}>
 *     Current: {resolved}
 *   </button>
 * );
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
