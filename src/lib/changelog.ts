/**
 * Changelog Parsing Utilities
 *
 * Parses Keep a Changelog formatted markdown and provides
 * version comparison utilities for the What's New feature.
 */

import { CHANGELOG_CONTENT } from './version';
import { STORAGE_KEYS } from '../constants/storage';

// ============================================================
// TYPES
// ============================================================

export interface ChangelogSection {
  type: string;
  items: string[];
}

export interface ChangelogVersion {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

// ============================================================
// PARSING
// ============================================================

/**
 * Get the raw changelog content (embedded at build time)
 */
export function getChangelogContent(): string {
  return CHANGELOG_CONTENT;
}

/**
 * Parse changelog markdown into structured version objects
 */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];

  // Split by version headers: ## [X.Y.Z] - YYYY-MM-DD
  const versionRegex = /^## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/gm;
  const matches = [...markdown.matchAll(versionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const date = match[2];
    const startIndex = match.index! + match[0].length;
    const endIndex = matches[i + 1]?.index ?? markdown.length;
    const sectionContent = markdown.slice(startIndex, endIndex);

    // Parse sections within this version
    const sections = parseSections(sectionContent);

    versions.push({
      version,
      date,
      sections,
    });
  }

  return versions;
}

/**
 * Parse section headers (### Ajouté, ### Corrigé, etc.)
 */
function parseSections(content: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];

  // Match section headers: ### Type
  const sectionRegex = /^### (.+)$/gm;
  const matches = [...content.matchAll(sectionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const type = match[1].trim();
    const startIndex = match.index! + match[0].length;
    const endIndex = matches[i + 1]?.index ?? content.length;
    const sectionContent = content.slice(startIndex, endIndex);

    // Parse list items: - Item text
    const items = sectionContent
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((item) => item.length > 0);

    if (items.length > 0) {
      sections.push({ type, items });
    }
  }

  return sections;
}

// ============================================================
// VERSION COMPARISON
// ============================================================

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Get versions newer than a given version (exclusive)
 */
export function getVersionsSince(
  versions: ChangelogVersion[],
  sinceVersion: string
): ChangelogVersion[] {
  return versions.filter((v) => compareVersions(v.version, sinceVersion) > 0);
}

// ============================================================
// STORAGE
// ============================================================

/**
 * Get the last-seen version from localStorage
 */
export function getLastSeenVersion(): string | null {
  return localStorage.getItem(STORAGE_KEYS.LAST_SEEN_VERSION);
}

/**
 * Save the current version as last-seen
 */
export function setLastSeenVersion(version: string): void {
  localStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, version);
}

// ============================================================
// DISPLAY LOGIC
// ============================================================

/**
 * Check if we should show the What's New modal
 * Returns true if current version is newer than last seen
 */
export function shouldShowWhatsNew(currentVersion: string): boolean {
  const lastSeen = getLastSeenVersion();

  // First time user - don't show (they haven't "missed" anything)
  // Initialize their version for future updates
  if (!lastSeen) {
    setLastSeenVersion(currentVersion);
    return false;
  }

  // Show if current version is newer than last seen
  return compareVersions(currentVersion, lastSeen) > 0;
}
