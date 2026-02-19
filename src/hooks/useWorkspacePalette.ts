/**
 * useWorkspacePalette - Command palette wiring for ProjectWorkspace
 *
 * Extracts command palette state, search logic, NL parsing, and result
 * computation from ProjectWorkspace to keep the orchestrator lean.
 *
 * @module hooks/useWorkspacePalette
 */

import { useCallback, useMemo } from 'react';
import { useCommandSearch } from './useCommandSearch';
import {
  getStaticCommands,
  buildItemCommands,
  parseNLCommand,
  addRecentItem,
  getRecentItemIds,
  type WorkspaceActions,
} from '../lib/command-registry';
import type { PaletteResult } from '../components/palette/CommandPalette';
import type { UseBacklogDBReturn } from './useBacklogDB';
import type { UseTypeConfigReturn } from './useTypeConfig';
import type { UseWorkspaceModalsReturn } from './useWorkspaceModals';
import type { Translations } from '../i18n';

// ============================================================
// TYPES
// ============================================================

export interface UseWorkspacePaletteParams {
  backlog: UseBacklogDBReturn;
  typeConfig: UseTypeConfigReturn;
  modals: UseWorkspaceModalsReturn;
  projectPath: string;
  t: Translations;
  workspaceActions: WorkspaceActions;
}

export interface UseWorkspacePaletteReturn {
  paletteResults: PaletteResult[];
  recentResults: PaletteResult[];
  nlCommand: { label: string; handler: () => void } | undefined;
  handlePaletteExecute: (id: string) => void;
  handlePaletteClose: () => void;
  handlePaletteToggle: () => void;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Manages command palette search results, NL parsing, and action execution.
 *
 * @param params - backlog, typeConfig, modals state, projectPath, translations, workspace actions
 */
export function useWorkspacePalette({
  backlog,
  typeConfig,
  modals,
  projectPath,
  t,
  workspaceActions,
}: UseWorkspacePaletteParams): UseWorkspacePaletteReturn {

  const allCommands = useMemo(() => {
    const staticCmds = getStaticCommands(t, workspaceActions);
    const itemCmds = buildItemCommands(backlog.allItems, (item) => {
      addRecentItem(projectPath, item.id);
      backlog.selectItem(item);
      modals.setIsPaletteOpen(false);
      modals.setPaletteQuery('');
    });
    return [...staticCmds, ...itemCmds];
  }, [t, workspaceActions, backlog, projectPath, modals]);

  const { search: paletteSearch } = useCommandSearch(allCommands);

  const paletteResults: PaletteResult[] = useMemo(() => {
    if (!modals.paletteQuery.trim()) return [];
    const results = paletteSearch(modals.paletteQuery);
    return results.map(r => {
      const cmd = allCommands.find(c => c.id === r.id);
      return {
        id: r.id,
        label: r.label,
        category: r.category,
        shortcut: cmd?.shortcut,
        matchedTerms: r.queryTerms,
      };
    });
  }, [modals.paletteQuery, paletteSearch, allCommands]);

  const recentResults: PaletteResult[] = useMemo(() => {
    const recentIds = getRecentItemIds(projectPath);
    if (recentIds.length === 0) return [];
    const results: PaletteResult[] = [];
    for (const id of recentIds) {
      const item = backlog.allItems.find(i => i.id === id);
      if (item) {
        results.push({
          id: `item:${item.id}`,
          label: `${item.id} ${item.emoji || ''} ${item.title}`.trim(),
          category: 'recent',
          matchedTerms: [],
        });
      }
    }
    return results;
  }, [projectPath, backlog.allItems]);

  const nlCommand = useMemo(() => {
    if (!modals.paletteQuery.trim()) return undefined;
    const result = parseNLCommand(modals.paletteQuery, typeConfig.sortedTypes, {
      createItemOfType: () => {
        modals.setIsPaletteOpen(false);
        modals.setPaletteQuery('');
        modals.setEditingItem(null);
        modals.setIsEditorOpen(true);
      },
      switchView: (view) => {
        backlog.setViewMode(view);
        modals.setIsPaletteOpen(false);
        modals.setPaletteQuery('');
      },
    });
    if (!result) return undefined;
    return { label: result.label, handler: result.handler };
  }, [modals.paletteQuery, typeConfig.sortedTypes, backlog, modals]);

  const handlePaletteExecute = useCallback((id: string) => {
    if (id === 'nl:command' && nlCommand) {
      nlCommand.handler();
      return;
    }
    const cmd = allCommands.find(c => c.id === id);
    if (cmd) {
      cmd.handler();
      modals.setIsPaletteOpen(false);
      modals.setPaletteQuery('');
    }
  }, [allCommands, nlCommand, modals]);

  const handlePaletteClose = useCallback(() => {
    modals.setIsPaletteOpen(false);
    modals.setPaletteQuery('');
  }, [modals]);

  const handlePaletteToggle = useCallback(() => {
    modals.setIsPaletteOpen(prev => {
      if (prev) modals.setPaletteQuery('');
      return !prev;
    });
  }, [modals]);

  return {
    paletteResults,
    recentResults,
    nlCommand,
    handlePaletteExecute,
    handlePaletteClose,
    handlePaletteToggle,
  };
}
