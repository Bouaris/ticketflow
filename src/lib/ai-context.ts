/**
 * AI Context - Dynamic prompt injection from project files
 *
 * Reads CLAUDE.md and AGENTS.md from project root and injects
 * their content into AI prompts for contextualized suggestions.
 */

import { isTauri, fileExists, readTextFileContents, joinPath, getDirFromPath, listMarkdownFilesRecursive } from './tauri-bridge';
import { getContextFilesKey, getGsdConfigKey } from '../constants/storage';
import type { AIProvider } from './ai';
import type { TypeDefinition } from '../types/typeConfig';

// ============================================================
// TYPES
// ============================================================

export interface ContextFileEntry {
  filename: string;
  content: string;
}

export interface ProjectContext {
  files: ContextFileEntry[];
  loadedAt: number;
  projectPath: string;
}

export interface AIOptions {
  provider?: AIProvider;
  projectPath?: string;
  /** Available types for dynamic classification (custom types support) */
  availableTypes?: TypeDefinition[];
}

export interface ContextStatus {
  loaded: boolean;
  files: Array<{ filename: string; chars: number }>;
  totalChars: number;
}

export interface ContextFilesConfig {
  files: string[];
  version: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CONTEXT_FILES = ['CLAUDE.md', 'AGENTS.md'];
const MAX_CONTEXT_LENGTH = 4000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// GSD INTEGRATION
// ============================================================

export type GsdLevel = 'essential' | 'complete';

export interface GsdConfig {
  enabled: boolean;
  level: GsdLevel;
  version: number;
}

/** Token budgets per GSD level (in characters, ~4 chars per token) */
const GSD_TOKEN_BUDGETS: Record<GsdLevel, number> = {
  essential: 32000,   // ~8K tokens
  complete: 80000,    // ~20K tokens
};

/** File patterns included per GSD level (curated whitelists — only ticket-relevant files) */
const GSD_LEVEL_PATTERNS: Record<GsdLevel, RegExp[]> = {
  essential: [/^PROJECT\.md$/i, /^REQUIREMENTS\.md$/i, /^ROADMAP\.md$/i],
  complete: [
    /^PROJECT\.md$/i, /^REQUIREMENTS\.md$/i, /^ROADMAP\.md$/i,
    /^STATE\.md$/i,
    /^codebase\/ARCHITECTURE\.md$/i,
    /^codebase\/STRUCTURE\.md$/i,
    /^codebase\/CONVENTIONS\.md$/i,
    /^codebase\/STACK\.md$/i,
  ],
};

/** File priority order for truncation (higher priority = truncated last) */
const GSD_FILE_PRIORITY: [RegExp, number][] = [
  [/^PROJECT\.md$/i, 10],
  [/^REQUIREMENTS\.md$/i, 9],
  [/^ROADMAP\.md$/i, 8],
  [/^STATE\.md$/i, 7],
  [/^codebase\//i, 6],
  [/./, 1],  // fallback
];

// ============================================================
// CONFIG PERSISTENCE
// ============================================================

/**
 * Load context files configuration from localStorage
 */
export function loadContextFilesConfig(projectPath: string): string[] {
  try {
    const key = getContextFilesKey(projectPath);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return DEFAULT_CONTEXT_FILES;
    }
    const config: ContextFilesConfig = JSON.parse(stored);
    return config.files;
  } catch {
    return DEFAULT_CONTEXT_FILES;
  }
}

/**
 * Save context files configuration to localStorage
 */
export function saveContextFilesConfig(projectPath: string, files: string[]): void {
  try {
    const key = getContextFilesKey(projectPath);
    const config: ContextFilesConfig = { files, version: 1 };
    localStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.warn('[AI Context] Failed to save config:', error);
  }
}

// ============================================================
// CACHE
// ============================================================

const contextCache = new Map<string, ProjectContext>();

/**
 * Clear context cache for a specific project or all projects
 */
export function clearContextCache(projectPath?: string): void {
  if (projectPath) {
    // Normalize to directory path (cache keys are dir paths)
    const dirPath = projectPath.endsWith('.md')
      ? getDirFromPath(projectPath)
      : projectPath;
    contextCache.delete(dirPath);
  } else {
    contextCache.clear();
  }
}

/**
 * Check if cached context is still valid
 */
function isCacheValid(context: ProjectContext): boolean {
  return Date.now() - context.loadedAt < CACHE_TTL_MS;
}

// ============================================================
// FILE READING
// ============================================================

/**
 * Safely read a context file with error handling
 */
async function readContextFile(projectPath: string, filename: string): Promise<string | null> {
  try {
    const filePath = joinPath(projectPath, filename);
    const exists = await fileExists(filePath);

    if (!exists) {
      return null;
    }

    const content = await readTextFileContents(filePath);

    // Return null for empty files
    if (!content || content.trim().length === 0) {
      return null;
    }

    return content;
  } catch (error) {
    console.warn(`[AI Context] Failed to read ${filename}:`, error);
    return null;
  }
}

/**
 * Truncate content to max length with clean line break
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Find last line break before max length
  const truncated = content.substring(0, maxLength);
  const lastLineBreak = truncated.lastIndexOf('\n');

  if (lastLineBreak > maxLength * 0.8) {
    return truncated.substring(0, lastLineBreak) + '\n\n[...truncated]';
  }

  return truncated + '\n\n[...truncated]';
}

// ============================================================
// GSD CONTEXT LOADING
// ============================================================

/**
 * Load GSD config from localStorage for a project
 * Pure function - no side effects
 */
function loadGsdConfig(projectPath: string): GsdConfig | null {
  try {
    const key = getGsdConfigKey(projectPath);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const raw = JSON.parse(stored);
    // Migrate old levels (light -> essential, mid/full -> complete)
    let level: GsdLevel = raw.level ?? 'essential';
    if (level === 'light' as string) level = 'essential';
    if (level === 'mid' as string || level === 'full' as string) level = 'complete';
    const config: GsdConfig = {
      enabled: raw.enabled ?? false,
      level,
      version: raw.version ?? 1,
    };
    if (!config.enabled) return null;

    return config;
  } catch {
    return null;
  }
}

/**
 * Get priority score for a GSD file path
 */
function getGsdFilePriority(filePath: string): number {
  const normalized = filePath.replace(/\\/g, '/');
  for (const [pattern, priority] of GSD_FILE_PRIORITY) {
    if (pattern.test(normalized)) return priority;
  }
  return 1;
}

/**
 * Load GSD planning context with level filtering and token budget
 */
async function loadGsdContext(dirPath: string, config: GsdConfig): Promise<ContextFileEntry[]> {
  const planningDir = joinPath(dirPath, '.planning');
  const dirExists = await fileExists(planningDir);

  if (!dirExists) {
    return [];
  }

  // List all .md files recursively
  const allFiles = await listMarkdownFilesRecursive(planningDir);

  // Filter by level patterns (curated whitelists — inherently excludes irrelevant dirs)
  // Normalize backslash → forward slash for Windows compatibility with regex patterns
  const levelPatterns = GSD_LEVEL_PATTERNS[config.level];
  const filteredFiles = allFiles.filter(file => {
    const f = file.replace(/\\/g, '/');
    return levelPatterns.some(pattern => pattern.test(f));
  });

  if (filteredFiles.length === 0) {
    return [];
  }

  // Read all filtered files
  const fileEntries: (ContextFileEntry & { priority: number })[] = [];
  for (const relativePath of filteredFiles) {
    const content = await readContextFile(planningDir, relativePath);
    if (content) {
      fileEntries.push({
        filename: `.planning/${relativePath.replace(/\\/g, '/')}`,
        content,
        priority: getGsdFilePriority(relativePath),
      });
    }
  }

  if (fileEntries.length === 0) {
    return [];
  }

  // Sort by priority (highest first)
  fileEntries.sort((a, b) => b.priority - a.priority);

  // Check total size against budget
  const budget = GSD_TOKEN_BUDGETS[config.level];
  const totalChars = fileEntries.reduce((sum, f) => sum + f.content.length, 0);

  if (totalChars <= budget) {
    // Under budget - return as-is
    return fileEntries.map(({ filename, content }) => ({ filename, content }));
  }

  // Over budget - allocate proportionally by priority weight
  const totalWeight = fileEntries.reduce((sum, f) => sum + f.priority, 0);
  const results: ContextFileEntry[] = [];

  for (const entry of fileEntries) {
    const allocatedBudget = Math.floor((entry.priority / totalWeight) * budget);
    const truncated = truncateContent(entry.content, allocatedBudget);
    results.push({ filename: entry.filename, content: truncated });
  }

  return results;
}

// ============================================================
// CONTEXT LOADING
// ============================================================

/**
 * Load project context from configured files
 *
 * @param projectPath Path to project directory (or backlog file path)
 * @returns ProjectContext with file contents
 */
export async function loadProjectContext(projectPath: string): Promise<ProjectContext> {
  // Not available in web mode
  if (!isTauri()) {
    return {
      files: [],
      loadedAt: Date.now(),
      projectPath,
    };
  }

  // Normalize to directory path
  const dirPath = projectPath.endsWith('.md')
    ? getDirFromPath(projectPath)
    : projectPath;

  // Check cache first
  const cached = contextCache.get(dirPath);
  if (cached && isCacheValid(cached)) {
    return cached;
  }

  // Get configured files (or defaults)
  const configuredFiles = loadContextFilesConfig(dirPath);

  // Load all configured files in parallel
  const fileResults = await Promise.all(
    configuredFiles.map(async (filename) => {
      const content = await readContextFile(dirPath, filename);
      return { filename, content };
    })
  );

  // Filter out missing files (content is null)
  const files: ContextFileEntry[] = fileResults
    .filter((f): f is { filename: string; content: string } => f.content !== null)
    .map(({ filename, content }) => ({ filename, content }));

  // Load GSD context if enabled
  const gsdConfig = loadGsdConfig(dirPath);
  if (gsdConfig?.enabled) {
    try {
      const gsdFiles = await loadGsdContext(dirPath, gsdConfig);
      files.push(...gsdFiles);
    } catch (error) {
      console.warn('[AI Context] Failed to load GSD context:', error);
    }
  }

  const context: ProjectContext = {
    files,
    loadedAt: Date.now(),
    projectPath: dirPath,
  };

  // Update cache
  contextCache.set(dirPath, context);

  // Log status
  if (files.length > 0) {
    const status = files.map(f => `${f.filename} (${f.content.length} chars)`);
    console.log(`[AI Context] Loaded: ${status.join(', ')}`);
  }

  return context;
}

/**
 * Get context status for UI indicator
 */
export function getContextStatus(projectPath: string): ContextStatus {
  // Normalize path
  const dirPath = projectPath.endsWith('.md')
    ? getDirFromPath(projectPath)
    : projectPath;

  const cached = contextCache.get(dirPath);

  if (!cached) {
    return {
      loaded: false,
      files: [],
      totalChars: 0,
    };
  }

  const files = cached.files.map(f => ({
    filename: f.filename,
    chars: f.content.length,
  }));

  return {
    loaded: true,
    files,
    totalChars: files.reduce((sum, f) => sum + f.chars, 0),
  };
}

// ============================================================
// PROMPT INJECTION
// ============================================================

/**
 * Format context for injection into prompt
 * Separates regular context files from GSD planning files into distinct XML blocks
 */
function formatContextBlock(context: ProjectContext): string {
  if (context.files.length === 0) {
    return '';
  }

  const regularFiles = context.files.filter(f => !f.filename.startsWith('.planning/'));
  const gsdFiles = context.files.filter(f => f.filename.startsWith('.planning/'));

  let result = '';

  if (regularFiles.length > 0) {
    const sections = regularFiles.map(({ filename, content }) => {
      const truncated = truncateContent(content, MAX_CONTEXT_LENGTH);
      return `## ${filename}\n${truncated}`;
    });
    result += `<project-context>\n${sections.join('\n\n')}\n</project-context>\n\n`;
  }

  if (gsdFiles.length > 0) {
    const sections = gsdFiles.map(({ filename, content }) => {
      // Already truncated by loadGsdContext
      return `## ${filename}\n${content}`;
    });
    result += `<gsd-planning-context>\n${sections.join('\n\n')}\n</gsd-planning-context>\n\n`;
  }

  return result;
}

/**
 * Build prompt with injected project context
 *
 * @param basePrompt Original prompt
 * @param options AI options including projectPath
 * @returns Enriched prompt with context prepended
 */
export async function buildPromptWithContext(
  basePrompt: string,
  options?: AIOptions
): Promise<string> {
  // No projectPath = no context injection
  if (!options?.projectPath) {
    return basePrompt;
  }

  // Not in Tauri = no file access
  if (!isTauri()) {
    return basePrompt;
  }

  try {
    const context = await loadProjectContext(options.projectPath);
    const contextBlock = formatContextBlock(context);

    if (!contextBlock) {
      console.log('[AI Context] No context files found, using base prompt');
      return basePrompt;
    }

    console.log('[AI Context] Injecting context into prompt:', {
      files: context.files.map(f => f.filename),
      totalChars: context.files.reduce((sum, f) => sum + f.content.length, 0),
    });

    return contextBlock + basePrompt;
  } catch (error) {
    console.warn('[AI Context] Failed to build context:', error);
    return basePrompt;
  }
}
