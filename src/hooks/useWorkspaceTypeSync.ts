/**
 * useWorkspaceTypeSync - TypeConfig <-> SQLite synchronization for ProjectWorkspace
 *
 * Extracts the two-step type config sync effects from ProjectWorkspace.
 * This hook is side-effect only — it synchronizes SQLite type data with
 * the in-memory typeConfig hook state.
 *
 * Step 1: On DB load, sync SQLite types -> typeConfig hook (source of truth)
 * Step 2: When user edits typeConfig, persist changes back to SQLite
 *
 * SMELL-005 resolution: All useEffect dependency omissions are documented
 * with inline rationale explaining why each omission is safe.
 *
 * @module hooks/useWorkspaceTypeSync
 */

import { useEffect, useRef } from 'react';
import { bulkUpsertTypeConfigs, deleteTypeConfig } from '../db/queries/type-configs';
import { getAllSections, deleteSection as dbDeleteSection } from '../db/queries/sections';
import type { UseBacklogDBReturn } from './useBacklogDB';
import type { UseTypeConfigReturn } from './useTypeConfig';

// ============================================================
// TYPES
// ============================================================

export interface UseWorkspaceTypeSyncParams {
  backlog: UseBacklogDBReturn;
  typeConfig: UseTypeConfigReturn;
  projectPath: string;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Synchronizes TypeConfig <-> SQLite for the workspace.
 *
 * Side-effect only hook — returns nothing. The synchronization is
 * bidirectional:
 * - On mount / DB load: SQLite types -> typeConfig (source of truth)
 * - On user edit: typeConfig changes -> SQLite persist
 *
 * @param params - backlog state, typeConfig hook, projectPath
 */
export function useWorkspaceTypeSync({
  backlog,
  typeConfig,
  projectPath,
}: UseWorkspaceTypeSyncParams): void {

  // Tracks the set of type IDs from the previous render — used to detect deletions
  const prevTypesRef = useRef<Set<string>>(new Set());
  // Guards against re-initializing after the first DB sync for this mount
  const typesInitFromDbRef = useRef(false);
  // Serialized snapshot of types loaded from DB — used to skip no-op persists
  const dbSnapshotRef = useRef<string>('');

  // ---- Step 1: Sync SQLite types -> typeConfig hook on DB load ----
  //
  // CRITICAL: depends on both projectId AND typeConfigs because React may
  // deliver them in separate render batches (they're set across await boundaries
  // in useBacklogDB.loadFromDB). Without typeConfigs in deps, this effect would
  // only fire on the projectId render, see empty typeConfigs, and never re-fire.
  useEffect(() => {
    if (backlog.projectId && backlog.typeConfigs && backlog.typeConfigs.length > 0) {
      // Avoid re-initializing if we already synced from DB for this mount
      if (typesInitFromDbRef.current) {
        return;
      }
      // SQLite types are the source of truth — override any defaults
      const dbTypes = backlog.typeConfigs.map((c, i) => ({
        id: c.id,
        label: c.label,
        color: c.color,
        order: c.order ?? i,
        visible: c.visible !== false,
      }));
      typeConfig.initializeWithTypes(projectPath, dbTypes);
      // Seed the prev-tracker so the persistence effect doesn't see false deletions
      prevTypesRef.current = new Set(backlog.typeConfigs.map(t => t.id));
      typesInitFromDbRef.current = true;
      // Snapshot what sortedTypes will look like after initializeWithTypes.
      // initializeWithTypes re-indexes order to sequential 0, 1, 2... so we
      // replicate that here to ensure the snapshot matches sortedTypes exactly.
      dbSnapshotRef.current = JSON.stringify(
        [...dbTypes]
          .map((t, i) => ({ ...t, order: i }))
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(t => ({ id: t.id, label: t.label, color: t.color, visible: t.visible, order: t.order }))
      );
    }
  }, [backlog.projectId, backlog.typeConfigs]); // eslint-disable-line react-hooks/exhaustive-deps
  // Omitted deps rationale:
  // - typeConfig.initializeWithTypes: stable function reference from useTypeConfig (never changes)
  // - projectPath: stable for this component mount (component re-mounts via key={projectPath})
  // - prevTypesRef, typesInitFromDbRef, dbSnapshotRef: useRef objects with stable .current identity

  // ---- Step 2: Persist typeConfig changes to SQLite (only after DB sync) ----
  useEffect(() => {
    // Don't persist until we've synced from SQLite
    if (!backlog.projectId || !typesInitFromDbRef.current) {
      return;
    }

    const currentTypeIds = new Set(typeConfig.sortedTypes.map(t => t.id));
    const currentSnapshot = JSON.stringify(
      [...typeConfig.sortedTypes]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(t => ({ id: t.id, label: t.label, color: t.color, visible: t.visible, order: t.order }))
    );

    // Skip if types match what was just loaded from DB (no user changes yet)
    if (currentSnapshot === dbSnapshotRef.current) {
      // Still update prevTypesRef to track the baseline
      prevTypesRef.current = currentTypeIds;
      return;
    }

    const prevTypeIds = prevTypesRef.current;

    // Detect deleted types (were in prev, not in current)
    const deletedTypeIds = Array.from(prevTypeIds).filter(id => !currentTypeIds.has(id));

    // Persist changes asynchronously
    (async () => {
      try {
        // Delete removed types from SQLite + clean up orphaned sections
        if (deletedTypeIds.length > 0) {
          const sections = await getAllSections(projectPath, backlog.projectId!);
          const deletedSet = new Set(deletedTypeIds.map(id => id.toUpperCase()));

          for (const typeId of deletedTypeIds) {
            await deleteTypeConfig(projectPath, backlog.projectId!, typeId);
          }

          // Remove empty sections whose title matches a deleted type
          for (const section of sections) {
            const normalizedTitle = section.title.toUpperCase().replace(/\s+/g, '_');
            if (deletedSet.has(normalizedTitle) || deletedSet.has(section.title.toUpperCase())) {
              await dbDeleteSection(projectPath, section.id);
            }
          }
        }

        // Upsert all current types (handles additions and updates)
        if (typeConfig.sortedTypes.length > 0) {
          await bulkUpsertTypeConfigs(
            projectPath,
            backlog.projectId!,
            typeConfig.sortedTypes.map(t => ({
              id: t.id,
              label: t.label,
              color: t.color,
              order: t.order,
              visible: t.visible,
            }))
          );
        }

        // Update DB snapshot after successful persist so future loads match
        dbSnapshotRef.current = currentSnapshot;
      } catch (error) {
        console.error('[ProjectWorkspace] Failed to persist type config changes:', error);
      }
    })();

    // Update ref for next comparison
    prevTypesRef.current = currentTypeIds;
  }, [projectPath, backlog.projectId, typeConfig.sortedTypes]); // eslint-disable-line react-hooks/exhaustive-deps
  // Omitted deps rationale:
  // - typesInitFromDbRef, prevTypesRef, dbSnapshotRef: useRef objects with stable .current identity
  //   (reading .current inside an effect is always safe — no stale closure risk for refs)
  // - getAllSections, deleteTypeConfig, bulkUpsertTypeConfigs, dbDeleteSection: module-level
  //   imported functions with stable identity (never reassigned)
}
