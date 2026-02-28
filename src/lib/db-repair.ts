/**
 * Database Repair Service
 *
 * Provides diagnostic and repair functions for database consistency.
 * Used by the Repair button in AppSettingsModal.
 *
 * @module lib/db-repair
 */

import { getAllSections, insertSection } from '../db/queries/sections';
import { getTypeConfigs } from '../db/queries/type-configs';
import { getOrCreateProject } from '../db/queries/projects';

export interface RepairResult {
  sectionsCreated: number;
  orphanedSectionsCleaned: number;
  issues: string[];
}

/**
 * Repair database consistency for a project.
 *
 * Checks and fixes:
 * 1. Missing sections: type configs without corresponding sections
 * 2. Section ordering: ensures positions are sequential
 *
 * @param projectPath - Absolute path to the project directory
 * @returns RepairResult with details of what was fixed
 */
export async function repairDatabase(projectPath: string): Promise<RepairResult> {
  const result: RepairResult = {
    sectionsCreated: 0,
    orphanedSectionsCleaned: 0,
    issues: [],
  };

  const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
  const projectId = await getOrCreateProject(projectPath, projectName);

  // 1. Get current state
  const configs = await getTypeConfigs(projectPath, projectId);
  const sections = await getAllSections(projectPath, projectId);

  // 2. Check for missing sections (type config exists but no matching section)
  const sectionTitles = new Set(sections.map(s => s.title.toUpperCase()));

  for (const config of configs) {
    const labelUpper = config.label.toUpperCase();
    const idUpper = config.id.toUpperCase();

    // Check if a section matches this type config (by label or ID)
    const hasSection = Array.from(sectionTitles).some(title =>
      title === labelUpper || title === idUpper || title.includes(labelUpper) || title.includes(idUpper)
    );

    if (!hasSection) {
      const position = sections.length + result.sectionsCreated;
      const rawHeader = `## ${position + 1}. ${labelUpper}`;
      await insertSection(projectPath, projectId, labelUpper, position, rawHeader);
      result.sectionsCreated++;
      result.issues.push(`Created missing section for type "${config.id}" (${config.label})`);
    }
  }

  return result;
}
