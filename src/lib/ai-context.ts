/**
 * AI Context - Dynamic prompt injection from project files
 *
 * Reads CLAUDE.md and AGENTS.md from project root and injects
 * their content into AI prompts for contextualized suggestions.
 */

import { isTauri, fileExists, readTextFileContents, joinPath, getDirFromPath } from './tauri-bridge';
import type { AIProvider } from './ai';

// ============================================================
// TYPES
// ============================================================

export interface ProjectContext {
  claudeMd: string | null;
  agentsMd: string | null;
  loadedAt: number;
  projectPath: string;
}

export interface AIOptions {
  provider?: AIProvider;
  projectPath?: string;
}

export interface ContextStatus {
  loaded: boolean;
  hasClaude: boolean;
  hasAgents: boolean;
  claudeChars: number;
  agentsChars: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONTEXT_FILES = {
  CLAUDE: 'CLAUDE.md',
  AGENTS: 'AGENTS.md',
} as const;

const MAX_CONTEXT_LENGTH = 4000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Load project context from CLAUDE.md and AGENTS.md
 *
 * @param projectPath Path to project directory (or backlog file path)
 * @returns ProjectContext with file contents or null values
 */
export async function loadProjectContext(projectPath: string): Promise<ProjectContext> {
  // Not available in web mode
  if (!isTauri()) {
    return {
      claudeMd: null,
      agentsMd: null,
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

  // Load files in parallel
  const [claudeMd, agentsMd] = await Promise.all([
    readContextFile(dirPath, CONTEXT_FILES.CLAUDE),
    readContextFile(dirPath, CONTEXT_FILES.AGENTS),
  ]);

  const context: ProjectContext = {
    claudeMd,
    agentsMd,
    loadedAt: Date.now(),
    projectPath: dirPath,
  };

  // Update cache
  contextCache.set(dirPath, context);

  // Log status
  const status = [];
  if (claudeMd) status.push(`CLAUDE.md (${claudeMd.length} chars)`);
  if (agentsMd) status.push(`AGENTS.md (${agentsMd.length} chars)`);
  if (status.length > 0) {
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
      hasClaude: false,
      hasAgents: false,
      claudeChars: 0,
      agentsChars: 0,
    };
  }

  return {
    loaded: true,
    hasClaude: !!cached.claudeMd,
    hasAgents: !!cached.agentsMd,
    claudeChars: cached.claudeMd?.length || 0,
    agentsChars: cached.agentsMd?.length || 0,
  };
}

// ============================================================
// PROMPT INJECTION
// ============================================================

/**
 * Format context for injection into prompt
 */
function formatContextBlock(context: ProjectContext): string {
  const sections: string[] = [];

  if (context.claudeMd) {
    const content = truncateContent(context.claudeMd, MAX_CONTEXT_LENGTH);
    sections.push(`## CLAUDE.md\n${content}`);
  }

  if (context.agentsMd) {
    const content = truncateContent(context.agentsMd, MAX_CONTEXT_LENGTH);
    sections.push(`## AGENTS.md\n${content}`);
  }

  if (sections.length === 0) {
    return '';
  }

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
      claudeChars: context.claudeMd?.length || 0,
      agentsChars: context.agentsMd?.length || 0,
    });

    return contextBlock + basePrompt;
  } catch (error) {
    console.warn('[AI Context] Failed to build context:', error);
    return basePrompt;
  }
}
