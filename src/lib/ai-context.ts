/**
 * AI Context - Dynamic prompt injection from project files
 *
 * Reads CLAUDE.md and AGENTS.md from project root and injects
 * their content into AI prompts for contextualized suggestions.
 */

import { isTauri, fileExists, readTextFileContents, joinPath, getDirFromPath } from './tauri-bridge';
import { getContextFilesKey } from '../constants/storage';
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
    contextCache.delete(projectPath);
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
 */
function formatContextBlock(context: ProjectContext): string {
  if (context.files.length === 0) {
    return '';
  }

  const sections = context.files.map(({ filename, content }) => {
    const truncated = truncateContent(content, MAX_CONTEXT_LENGTH);
    return `## ${filename}\n${truncated}`;
  });

  return `<project-context>\n${sections.join('\n\n')}\n</project-context>\n\n`;
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
