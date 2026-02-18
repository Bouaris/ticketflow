/**
 * Serializer Module Tests
 *
 * Tests for markdown serialization functions:
 * - buildItemMarkdown (9 tests)
 * - serializeBacklog (4 tests)
 * - updateItem (2 tests)
 * - toggleCriterion (4 tests)
 * - exportItemForClipboard (2 tests)
 * - removeSectionFromMarkdown (4 tests)
 */

import { describe, test, expect } from 'vitest';
import {
  buildItemMarkdown,
  serializeBacklog,
  updateItem,
  toggleCriterion,
  exportItemForClipboard,
  removeSectionFromMarkdown,
} from '../lib/serializer';
import { parseBacklog, getAllItems } from '../lib/parser';
import type { BacklogItem, Backlog, Section, Criterion } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const createMockItem = (overrides: Partial<BacklogItem> = {}): BacklogItem => ({
  id: 'BUG-001',
  type: 'BUG',
  title: 'Test Bug',
  rawMarkdown: '### BUG-001 | Test Bug\n**Description:** Original\n\n---\n',
  sectionIndex: 0,
  ...overrides,
} as BacklogItem);

// ============================================================
// buildItemMarkdown TESTS (1-6)
// ============================================================

describe('buildItemMarkdown', () => {
  test('1. generates basic item with id and title', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature Title',
    });

    expect(result).toContain('### CT-001 | Feature Title');
    expect(result).toContain('---');
  });

  test('2. includes emoji when provided', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature',
      emoji: '🚀',
    });

    expect(result).toContain('### CT-001 | 🚀 Feature');
  });

  test('3. includes all metadata fields', () => {
    const result = buildItemMarkdown({
      id: 'BUG-001',
      title: 'Bug',
      component: 'Auth',
      module: 'Login',
      severity: 'P1',
      effort: 'M',
      description: 'Bug description',
    });

    expect(result).toContain('**Composant:** Auth');
    expect(result).toContain('**Module:** Login');
    expect(result).toContain('**Sévérité:**');
    expect(result).toContain('**Effort:**');
    expect(result).toContain('**Description:** Bug description');
  });

  test('4. includes user story with blockquote', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature',
      userStory: 'As a user, I want to login',
    });

    expect(result).toContain('**User Story:**');
    expect(result).toContain('> As a user, I want to login');
  });

  test('5. includes criteria with checkboxes', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature',
      criteria: [
        { text: 'First criterion', checked: false },
        { text: 'Second criterion', checked: true },
      ],
    });

    expect(result).toContain("**Critères d'acceptation:**");
    expect(result).toContain('- [ ] First criterion');
    expect(result).toContain('- [x] Second criterion');
  });

  test('6. includes numbered lists for reproduction and screens', () => {
    const result = buildItemMarkdown({
      id: 'BUG-001',
      title: 'Bug',
      reproduction: ['Open app', 'Click button', 'See error'],
      screens: ['Home', 'Dashboard'],
    });

    expect(result).toContain('**Reproduction:**');
    expect(result).toContain('1. Open app');
    expect(result).toContain('2. Click button');
    expect(result).toContain('3. See error');
    expect(result).toContain('**Écrans:**');
    expect(result).toContain('1. Home');
    expect(result).toContain('2. Dashboard');
  });

  test('7. includes priority for non-BUG items', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature',
      priority: 'Haute',
    });

    expect(result).toContain('**Priorité:** Haute');
    expect(result).not.toContain('**Sévérité:**');
  });

  test('8. includes dependencies and constraints lists', () => {
    const result = buildItemMarkdown({
      id: 'CT-001',
      title: 'Feature',
      dependencies: ['API v2', 'Auth module'],
      constraints: ['Must work offline', 'Mobile first'],
    });

    expect(result).toContain('**Dépendances:**');
    expect(result).toContain('- API v2');
    expect(result).toContain('- Auth module');
    expect(result).toContain('**Contraintes:**');
    expect(result).toContain('- Must work offline');
    expect(result).toContain('- Mobile first');
  });

  test('9. includes screenshots with relative paths', () => {
    const result = buildItemMarkdown({
      id: 'BUG-001',
      title: 'Bug',
      screenshots: [
        { filename: 'BUG-001_12345.png' },
        { filename: 'BUG-001_67890.png', alt: 'Error screenshot' },
      ],
    });

    expect(result).toContain('**Screenshots:**');
    expect(result).toContain('BUG-001_12345.png');
    expect(result).toContain('BUG-001_67890.png');
  });
});

// ============================================================
// serializeBacklog TESTS (10-13)
// ============================================================

describe('serializeBacklog', () => {
  const createMockSection = (id: string, title: string, items: BacklogItem[] = []): Section => ({
    id,
    title,
    rawHeader: `## ${id}. ${title}`,
    items,
  });

  const createMinimalBacklog = (): Backlog => ({
    header: '# Project Backlog\n',
    tableOfContents: '',
    sections: [
      createMockSection('1', 'BUGS', [
        createMockItem({ id: 'BUG-001', title: 'First Bug' }),
      ]),
    ],
  });

  test('10. serializes header and sections', () => {
    const backlog = createMinimalBacklog();
    const result = serializeBacklog(backlog);

    expect(result).toContain('# Project Backlog');
    expect(result).toContain('## 1. BUGS');
  });

  test('11. includes table of contents when present', () => {
    const backlog = createMinimalBacklog();
    backlog.tableOfContents = '## Table des matières\n1. [Bugs](#1-bugs)\n';

    const result = serializeBacklog(backlog);

    expect(result).toContain('## Table des matières');
    expect(result).toContain('[Bugs]');
  });

  test('12. adds separators between sections', () => {
    const backlog: Backlog = {
      header: '# Backlog\n',
      tableOfContents: '',
      sections: [
        createMockSection('1', 'BUGS', [createMockItem()]),
        createMockSection('2', 'FEATURES', [createMockItem({ id: 'CT-001', type: 'CT' })]),
      ],
    };

    const result = serializeBacklog(backlog);

    // Should have separator between sections
    expect(result).toContain('---');
  });

  test('13. includes footer when present', () => {
    const backlog = createMinimalBacklog();
    (backlog as Backlog & { footer: string }).footer = '\n---\n*Generated by TicketFlow*\n';

    const result = serializeBacklog(backlog);

    expect(result).toContain('*Generated by TicketFlow*');
  });
});

// ============================================================
// updateItem TESTS (14-15)
// ============================================================

describe('updateItem', () => {
  test('14. updates item properties and sets _modified flag', () => {
    const item = createMockItem({ title: 'Original' });
    const updated = updateItem(item, { title: 'Updated', description: 'New desc' });

    expect(updated.title).toBe('Updated');
    expect(updated.description).toBe('New desc');
    expect((updated as BacklogItem & { _modified: boolean })._modified).toBe(true);
  });

  test('15. preserves id, type, and sectionIndex', () => {
    const item = createMockItem({ id: 'BUG-001', type: 'BUG', sectionIndex: 2 });
    const updated = updateItem(item, { title: 'New Title' });

    expect(updated.id).toBe('BUG-001');
    expect(updated.type).toBe('BUG');
    expect(updated.sectionIndex).toBe(2);
  });
});

// ============================================================
// toggleCriterion TESTS (16-19)
// ============================================================

describe('toggleCriterion', () => {
  test('16. toggles criterion from unchecked to checked', () => {
    const criteria: Criterion[] = [
      { text: 'First', checked: false },
      { text: 'Second', checked: false },
    ];
    const item = createMockItem({
      criteria,
      rawMarkdown: '### BUG-001 | Test\n- [ ] First\n- [ ] Second\n---\n',
    });

    const updated = toggleCriterion(item, 0);

    expect(updated.criteria![0].checked).toBe(true);
    expect(updated.criteria![1].checked).toBe(false);
  });

  test('17. toggles criterion from checked to unchecked', () => {
    const criteria: Criterion[] = [
      { text: 'First', checked: true },
    ];
    const item = createMockItem({
      criteria,
      rawMarkdown: '### BUG-001 | Test\n- [x] First\n---\n',
    });

    const updated = toggleCriterion(item, 0);

    expect(updated.criteria![0].checked).toBe(false);
  });

  test('18. returns original item if criterion index is invalid', () => {
    const item = createMockItem({ criteria: [{ text: 'Only one', checked: false }] });

    const updated = toggleCriterion(item, 5); // Invalid index

    expect(updated).toBe(item);
  });

  test('19. returns original item if no criteria array', () => {
    const item = createMockItem({ criteria: undefined });

    const updated = toggleCriterion(item, 0);

    expect(updated).toBe(item);
  });
});

// ============================================================
// exportItemForClipboard TESTS (20-21)
// ============================================================

describe('exportItemForClipboard', () => {
  test('20. includes source path header', () => {
    const item = createMockItem({ title: 'Test' });
    const result = exportItemForClipboard(item, '/path/to/file.md');

    expect(result).toContain('From /path/to/file.md :');
    expect(result).toContain('### BUG-001 | Test');
  });

  test('21. uses absolute paths for screenshots when basePath provided', () => {
    const item = createMockItem({
      title: 'Test',
      screenshots: [{ filename: 'screen.png', alt: 'Screenshot', addedAt: Date.now() }],
    });
    const result = exportItemForClipboard(
      item,
      '/path/to/file.md',
      '/path/to/screenshots'
    );

    expect(result).toContain('![Screenshot](/path/to/screenshots\\screen.png)');
  });
});

// ============================================================
// removeSectionFromMarkdown TESTS (22-25)
// ============================================================

describe('removeSectionFromMarkdown', () => {
  const SAMPLE_MARKDOWN = `# Project

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)
3. [Légende](#3-legende)

---

## 1. BUGS

### BUG-001 | Bug One
Description

---

## 2. COURT TERME

### CT-001 | Feature One
Description

---

## 3. Légende

Content here
`;

  test('22. removes section header and updates TOC', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'BUG');

    // Section header removed
    expect(result).not.toContain('## 1. BUGS');
    // TOC entry removed
    expect(result).not.toContain('[Bugs]');
    // Other sections preserved
    expect(result).toContain('COURT TERME');
  });

  test('23. renumbers remaining sections', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'BUG');

    // After removing BUGS, COURT TERME should become section 1
    expect(result).toContain('## 1. COURT TERME');
    expect(result).toContain('## 2. Légende');
  });

  test('24. returns original if section not found', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'NONEXISTENT');

    expect(result).toBe(SAMPLE_MARKDOWN);
  });

  test('25. handles section removal from middle', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'CT');

    // CT/COURT TERME section header should be removed
    expect(result).not.toContain('## 2. COURT TERME');
    // BUGS section should remain as section 1
    expect(result).toContain('## 1. BUGS');
    // TOC should be updated
    expect(result).toContain('[BUGS]');
    expect(result).toContain('[Légende]');
    expect(result).not.toContain('[Court Terme]');
  });
});

// ============================================================
// ROUND-TRIP INVARIANTS (26-27)
// ============================================================

const ROUND_TRIP_MARKDOWN = `# Test Backlog

## 1. BUGS

### BUG-001 | First Bug
**Description:** A description for bug one

---

### BUG-002 | Second Bug
**Description:** A description for bug two

---

## 2. FEATURES

### CT-001 | Feature One
**Description:** A description for feature one

---
`;

describe('Round-Trip Invariants', () => {
  test('26. serialize(parse(md)) produces valid markdown that re-parses identically', () => {
    const parsed = parseBacklog(ROUND_TRIP_MARKDOWN);
    const serialized = serializeBacklog(parsed);
    const reparsed = parseBacklog(serialized);

    // Section count must be preserved
    expect(reparsed.sections.length).toBe(parsed.sections.length);

    // Item IDs must match
    const ids1 = getAllItems(parsed).map(i => i.id);
    const ids2 = getAllItems(reparsed).map(i => i.id);
    expect(ids2).toEqual(ids1);
  });

  test('27. parse(serialize(parse(md))) idempotency — item data is stable across cycles', () => {
    const parsed = parseBacklog(ROUND_TRIP_MARKDOWN);
    const serialized = serializeBacklog(parsed);
    const reparsed = parseBacklog(serialized);

    const items1 = getAllItems(parsed);
    const items2 = getAllItems(reparsed);

    // Data must be stable: id, type, title must match for each item
    expect(items2.length).toBe(items1.length);
    for (let i = 0; i < items1.length; i++) {
      expect(items2[i].id).toBe(items1[i].id);
      expect(items2[i].type).toBe(items1[i].type);
      expect(items2[i].title).toBe(items1[i].title);
    }
  });
});
