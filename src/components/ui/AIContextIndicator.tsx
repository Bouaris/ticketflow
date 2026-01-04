/**
 * AIContextIndicator - Badge showing AI context loading status
 *
 * Displays which project context files (CLAUDE.md, AGENTS.md) are loaded
 * and being used to enrich AI prompts.
 */

import { useState, useEffect } from 'react';
import { loadProjectContext, getContextStatus, type ContextStatus } from '../../lib/ai-context';

interface AIContextIndicatorProps {
  projectPath: string;
}

/**
 * Document icon for context indicator
 */
function DocumentIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function AIContextIndicator({ projectPath }: AIContextIndicatorProps) {
  const [status, setStatus] = useState<ContextStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!mounted) return;

      setIsLoading(true);
      try {
        await loadProjectContext(projectPath);
        if (mounted) {
          setStatus(getContextStatus(projectPath));
        }
      } catch (error) {
        // Log but don't fail - context is optional
        console.warn('[AIContextIndicator] Failed to load context:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [projectPath]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <div className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No context loaded or not available
  if (!status || (!status.hasClaude && !status.hasAgents)) {
    return null;
  }

  // Build tooltip text
  const files: string[] = [];
  if (status.hasClaude) {
    files.push(`CLAUDE.md (${formatSize(status.claudeChars)})`);
  }
  if (status.hasAgents) {
    files.push(`AGENTS.md (${formatSize(status.agentsChars)})`);
  }
  const tooltip = `Contexte projet: ${files.join(', ')}`;

  // Build display text
  const displayFiles: string[] = [];
  if (status.hasClaude) displayFiles.push('CLAUDE');
  if (status.hasAgents) displayFiles.push('AGENTS');

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"
      title={tooltip}
    >
      <DocumentIcon className="w-3 h-3" />
      <span>{displayFiles.join(' + ')}</span>
    </div>
  );
}

/**
 * Format character count to human readable size
 */
function formatSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}
