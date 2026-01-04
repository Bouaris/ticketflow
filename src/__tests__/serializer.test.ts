/**
 * Serializer Module Tests
 *
 * Tests for markdown serialization functions:
 * - buildItemMarkdown (6 tests)
 * - updateItem (2 tests)
 * - toggleCriterion (3 tests)
 * - exportItemForClipboard (2 tests)
 * - removeSectionFromMarkdown (3 tests)
 */

import { describe, test, expect } from 'vitest';
import {
  buildItemMarkdown,
  updateItem,
  toggleCriterion,
  exportItemForClipboard,
  removeSectionFromMarkdown,
} from '../lib/serializer';
import type { BacklogItem, Criterion } from '../types/backlog';

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
});

// ============================================================
// updateItem TESTS (7-8)
// ============================================================

describe('updateItem', () => {
  test('7. updates item properties and sets _modified flag', () => {
    const item = createMockItem({ title: 'Original' });
    const updated = updateItem(item, { title: 'Updated', description: 'New desc' });

    expect(updated.title).toBe('Updated');
    expect(updated.description).toBe('New desc');
    expect((updated as BacklogItem & { _modified: boolean })._modified).toBe(true);
  });

  test('8. preserves id, type, and sectionIndex', () => {
    const item = createMockItem({ id: 'BUG-001', type: 'BUG', sectionIndex: 2 });
    const updated = updateItem(item, { title: 'New Title' });

    expect(updated.id).toBe('BUG-001');
    expect(updated.type).toBe('BUG');
    expect(updated.sectionIndex).toBe(2);
  });
});

// ============================================================
// toggleCriterion TESTS (9-11)
// ============================================================

describe('toggleCriterion', () => {
  test('9. toggles criterion from unchecked to checked', () => {
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

  test('10. toggles criterion from checked to unchecked', () => {
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

  test('11. returns original item if criterion index is invalid', () => {
    const item = createMockItem({ criteria: [{ text: 'Only one', checked: false }] });

    const updated = toggleCriterion(item, 5); // Invalid index

    expect(updated).toBe(item);
  });
});

// ============================================================
// exportItemForClipboard TESTS (12-13)
// ============================================================

describe('exportItemForClipboard', () => {
  test('12. includes source path header', () => {
    const item = createMockItem({ title: 'Test' });
    const result = exportItemForClipboard(item, '/path/to/file.md');

    expect(result).toContain('From /path/to/file.md :');
    expect(result).toContain('### BUG-001 | Test');
  });

  test('13. uses absolute paths for screenshots when basePath provided', () => {
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
// removeSectionFromMarkdown TESTS (14-16)
// ============================================================

describe('removeSectionFromMarkdown', () => {
  const SAMPLE_MARKDOWN = `# Project

## Table des matières
1. [Bugs](#1-bugs)
2. [Features](#2-features)
3. [Légende](#3-legende)

---

## 1. BUGS

### BUG-001 | Bug One
Description

---

## 2. FEATURES

### CT-001 | Feature One
Description

---

## 3. Légende

Content here
`;

  test('14. removes section header and updates TOC', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'BUG');

    // Section header removed
    expect(result).not.toContain('## 1. BUGS');
    // TOC entry removed
    expect(result).not.toContain('[Bugs]');
    // Other sections preserved
    expect(result).toContain('FEATURES');
  });

  test('15. renumbers remaining sections', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'BUG');

    // After removing BUGS, FEATURES should become section 1
    expect(result).toContain('## 1. FEATURES');
    expect(result).toContain('## 2. Légende');
  });

  test('16. returns original if section not found', () => {
    const result = removeSectionFromMarkdown(SAMPLE_MARKDOWN, 'NONEXISTENT');

    expect(result).toBe(SAMPLE_MARKDOWN);
  });
});
