/**
 * Parser Tests
 *
 * 28 tests covering:
 * - parseBacklog basic parsing (4 tests)
 * - Section parsing (3 tests)
 * - Item parsing (4 tests)
 * - Edge cases (3 tests)
 * - getAllItems/getItemsByType (4 tests)
 * - Table groups (3 tests)
 * - Raw sections (3 tests)
 * - Metadata parsing (4 tests)
 */

import { describe, test, expect } from 'vitest';
import { parseBacklog, getAllItems, getItemsByType } from '../lib/parser';
import type { BacklogItem, TableGroup } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const MINIMAL_BACKLOG = `# Project Backlog

## Table des matières
1. [Bugs](#1-bugs)

---

## 1. BUGS

### BUG-001 | Test Bug
**Description:** A test bug

---
`;

const MULTI_SECTION_BACKLOG = `# Project Backlog

## 1. BUGS

### BUG-001 | Bug One
**Description:** First bug

---

## 2. FEATURES

### CT-001 | Feature One
**Description:** First feature

---

### CT-002 | Feature Two
**Description:** Second feature

---
`;

const COMPLEX_ITEM_BACKLOG = `# Backlog

## 1. FEATURES

### CT-001 | 🚀 Feature with All Fields
**Composant:** Auth
**Module:** Login
**Sévérité:** P1 - Haute
**Priorité:** Haute
**Effort:** M
**Description:** Full description here

**User Story:**
> As a user, I want to login

**Critères d'acceptation:**
- [ ] First criterion
- [x] Second criterion (done)
- [ ] Third criterion

**Screenshots:**
![Screen1](./screenshots/CT-001_12345.png)

---
`;

// ============================================================
// BASIC PARSING TESTS (1-4)
// ============================================================

describe('parseBacklog - Basic Parsing', () => {
  test('1. parses minimal backlog structure', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);

    expect(result.header).toContain('# Project Backlog');
    expect(result.sections.length).toBe(1);
    expect(result.sections[0].title).toBe('BUGS');
  });

  test('2. extracts table of contents', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);

    expect(result.tableOfContents).toContain('## Table des matières');
    expect(result.tableOfContents).toContain('[Bugs]');
  });

  test('3. parses multiple sections', () => {
    const result = parseBacklog(MULTI_SECTION_BACKLOG);

    expect(result.sections.length).toBe(2);
    expect(result.sections[0].title).toBe('BUGS');
    expect(result.sections[1].title).toBe('FEATURES');
  });

  test('4. assigns correct section indices', () => {
    const result = parseBacklog(MULTI_SECTION_BACKLOG);

    expect(result.sections[0].id).toBe('1');
    expect(result.sections[1].id).toBe('2');
  });
});

// ============================================================
// SECTION PARSING TESTS (5-7)
// ============================================================

describe('parseBacklog - Section Parsing', () => {
  test('5. parses items within sections', () => {
    const result = parseBacklog(MULTI_SECTION_BACKLOG);

    expect(result.sections[0].items.length).toBe(1);
    expect(result.sections[1].items.length).toBe(2);
  });

  test('6. extracts item IDs and titles', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.id).toBe('BUG-001');
    expect(item.title).toBe('Test Bug');
  });

  test('7. preserves rawMarkdown for items', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.rawMarkdown).toContain('### BUG-001 | Test Bug');
    expect(item.rawMarkdown).toContain('**Description:** A test bug');
  });
});

// ============================================================
// ITEM PARSING TESTS (8-11)
// ============================================================

describe('parseBacklog - Item Parsing', () => {
  test('8. parses item metadata fields', () => {
    const result = parseBacklog(COMPLEX_ITEM_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.component).toBe('Auth');
    expect(item.module).toBe('Login');
    expect(item.severity).toBe('P1');
    expect(item.priority).toBe('Haute');
    expect(item.effort).toBe('M');
  });

  test('9. parses item description', () => {
    const result = parseBacklog(COMPLEX_ITEM_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.description).toBe('Full description here');
  });

  test('10. parses user story', () => {
    const result = parseBacklog(COMPLEX_ITEM_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.userStory).toBe('As a user, I want to login');
  });

  test('11. parses criteria with checkbox state', () => {
    const result = parseBacklog(COMPLEX_ITEM_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.criteria).toHaveLength(3);
    expect(item.criteria![0].text).toBe('First criterion');
    expect(item.criteria![0].checked).toBe(false);
    expect(item.criteria![1].text).toBe('Second criterion (done)');
    expect(item.criteria![1].checked).toBe(true);
  });
});

// ============================================================
// EDGE CASES TESTS (12-14)
// ============================================================

describe('parseBacklog - Edge Cases', () => {
  test('12. handles empty markdown', () => {
    const result = parseBacklog('');

    expect(result.sections).toEqual([]);
    expect(result.header).toBe('');
  });

  test('13. handles fused separators (---## Title)', () => {
    const fused = `# Backlog
## 1. BUGS---## 2. FEATURES
### CT-001 | Item
---
`;
    const result = parseBacklog(fused);

    // Parser should split fused separators
    expect(result.sections.length).toBeGreaterThan(0);
  });

  test('14. extracts emoji from title', () => {
    const result = parseBacklog(COMPLEX_ITEM_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.emoji).toBe('🚀');
    expect(item.title).toBe('Feature with All Fields');
  });
});

// ============================================================
// getAllItems / getItemsByType TESTS (15-18)
// ============================================================

describe('getAllItems / getItemsByType', () => {
  test('15. getAllItems returns flat array of items', () => {
    const result = parseBacklog(MULTI_SECTION_BACKLOG);
    const items = getAllItems(result);

    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('BUG-001');
    expect(items[1].id).toBe('CT-001');
    expect(items[2].id).toBe('CT-002');
  });

  test('16. getItemsByType filters by type', () => {
    const result = parseBacklog(MULTI_SECTION_BACKLOG);

    const bugs = getItemsByType(result, 'BUG');
    const features = getItemsByType(result, 'CT');

    expect(bugs).toHaveLength(1);
    expect(features).toHaveLength(2);
  });

  test('17. getAllItems deduplicates items with same ID', () => {
    const markdown = `# Backlog

## 1. BUGS

### BUG-001 | First occurrence
Description 1

---

## 2. DUPLICATES

### BUG-001 | Duplicate occurrence
Description 2

---
`;
    const result = parseBacklog(markdown);
    const items = getAllItems(result);

    // Should only return first occurrence
    expect(items.filter(i => i.id === 'BUG-001')).toHaveLength(1);
    expect(items.find(i => i.id === 'BUG-001')?.title).toBe('First occurrence');
  });

  test('18. getItemsByType returns empty array for non-existent type', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);
    const items = getItemsByType(result, 'NONEXISTENT');

    expect(items).toEqual([]);
  });
});

// ============================================================
// TABLE GROUP TESTS (19-21)
// ============================================================

const TABLE_GROUP_BACKLOG = `# Backlog

## 1. BUGS

### BUG-005 à 007 | Bugs mineurs
**Sévérité:** P3 - Moyenne

| ID      | Description           | Action              |
|---------|-----------------------|---------------------|
| BUG-005 | Minor issue 1         | Fix styling         |
| BUG-006 | Minor issue 2         | Fix layout          |
| BUG-007 | Minor issue 3         | Fix margin          |

---
`;

describe('parseBacklog - Table Groups', () => {
  test('19. parses table group header', () => {
    const result = parseBacklog(TABLE_GROUP_BACKLOG);
    const item = result.sections[0].items[0];

    expect(item.type).toBe('table-group');
    expect((item as TableGroup).title).toContain('BUG-005 à 007');
  });

  test('20. parses table group items', () => {
    const result = parseBacklog(TABLE_GROUP_BACKLOG);
    const group = result.sections[0].items[0] as TableGroup;

    expect(group.items).toHaveLength(3);
    expect(group.items[0].id).toBe('BUG-005');
    expect(group.items[0].description).toBe('Minor issue 1');
    expect(group.items[0].action).toBe('Fix styling');
  });

  test('21. parses table group severity', () => {
    const result = parseBacklog(TABLE_GROUP_BACKLOG);
    const group = result.sections[0].items[0] as TableGroup;

    expect(group.severity).toBe('P3');
  });
});

// ============================================================
// RAW SECTION TESTS (22-24)
// ============================================================

const RAW_SECTION_BACKLOG = `# Backlog

## 1. Légende

| Symbole | Signification |
|---------|---------------|
| P0      | Critique      |
| P1      | Haute         |

---

## 2. Roadmap

- Q1: Feature A
- Q2: Feature B

---

## 3. BUGS

### BUG-001 | Regular bug
Description

---
`;

describe('parseBacklog - Raw Sections', () => {
  test('22. identifies raw sections by title', () => {
    const result = parseBacklog(RAW_SECTION_BACKLOG);

    const legendeSection = result.sections[0];
    expect(legendeSection.title).toBe('Légende');
    expect(legendeSection.items[0].type).toBe('raw-section');
  });

  test('23. preserves raw content in raw sections', () => {
    const result = parseBacklog(RAW_SECTION_BACKLOG);

    const legendeSection = result.sections[0];
    const rawItem = legendeSection.items[0];

    expect(rawItem.rawMarkdown).toContain('Symbole');
    expect(rawItem.rawMarkdown).toContain('Critique');
  });

  test('24. parses regular items after raw sections', () => {
    const result = parseBacklog(RAW_SECTION_BACKLOG);

    const bugsSection = result.sections[2];
    const item = bugsSection.items[0] as BacklogItem;

    expect(item.id).toBe('BUG-001');
    expect(item.title).toBe('Regular bug');
  });
});

// ============================================================
// METADATA PARSING TESTS (25-28)
// ============================================================

const METADATA_BACKLOG = `# Backlog

## 1. ITEMS

### BUG-001 | Bug with all metadata
**Composant:** AuthService
**Module:** Login
**Sévérité:** P0 - Critique
**Priorité:** Haute
**Effort:** XL
**Description:** Full bug description here

---
`;

const SPECS_BACKLOG = `# Backlog

## 1. ITEMS

### BUG-002 | Bug with specs
**Spécifications:**
- Spec line 1
- Spec line 2

---
`;

const REPRODUCTION_BACKLOG = `# Backlog

## 1. ITEMS

### BUG-003 | Bug with reproduction
**Reproduction:**
1. Open app
2. Click login
3. See error

---
`;

describe('parseBacklog - Metadata Parsing', () => {
  test('25. parses all metadata fields', () => {
    const result = parseBacklog(METADATA_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.component).toBe('AuthService');
    expect(item.module).toBe('Login');
    expect(item.severity).toBe('P0');
    expect(item.priority).toBe('Haute');
    expect(item.effort).toBe('XL');
    expect(item.description).toBe('Full bug description here');
  });

  test('26. parses specs list', () => {
    const result = parseBacklog(SPECS_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    expect(item.specs).toHaveLength(2);
    expect(item.specs![0]).toBe('Spec line 1');
    expect(item.specs![1]).toBe('Spec line 2');
  });

  test('27. preserves raw markdown for round-trip', () => {
    const result = parseBacklog(REPRODUCTION_BACKLOG);
    const item = result.sections[0].items[0] as BacklogItem;

    // The rawMarkdown should contain the original content
    expect(item.rawMarkdown).toContain('**Reproduction:**');
    expect(item.rawMarkdown).toContain('Open app');
    expect(item.rawMarkdown).toContain('Click login');
  });

  test('28. handles sections without numbered prefix', () => {
    const markdown = `# Backlog

## BUGS

### BUG-001 | Bug without section number
Description here

---
`;
    const result = parseBacklog(markdown);

    // Should still parse the section
    expect(result.sections.length).toBe(1);
    expect(result.sections[0].title).toBe('BUGS');
    // ID should be auto-generated
    expect(result.sections[0].id).toBe('1');
  });
});
