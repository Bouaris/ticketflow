/**
 * AIContextIndicator - Badge showing AI context loading status
 *
 * Displays which project context files are loaded
 * and being used to enrich AI prompts.
 */

import { useState, useEffect } from 'react';
import { loadProjectContext, getContextStatus, type ContextStatus } from '../../lib/ai-context';
import { DocumentIcon } from './Icons';

interface AIContextIndicatorProps {
  projectPath: string;
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
      <div className="flex items-center gap-1 text-xs text-on-surface-faint">
        <div className="w-3 h-3 border border-outline-strong border-t-on-surface-muted rounded-full animate-spin" />
      </div>
    );
  }

  // No context loaded or no files
  if (!status || status.files.length === 0) {
    return null;
  }

  // Build tooltip text
  const tooltipFiles = status.files.map(f => `${f.filename} (${formatSize(f.chars)})`);
  const tooltip = `Contexte projet: ${tooltipFiles.join(', ')}`;

  // Build display text - show first 3 files max, then "+N"
  const maxDisplay = 3;
  const displayFiles = status.files.slice(0, maxDisplay).map(f => f.filename.replace('.md', ''));
  const moreCount = status.files.length - maxDisplay;

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"
      title={tooltip}
    >
      <DocumentIcon className="w-3 h-3" />
      <span>
        {displayFiles.join(' + ')}
        {moreCount > 0 && ` +${moreCount}`}
      </span>
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
