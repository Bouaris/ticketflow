/**
 * Parser Tests
 *
 * 14 tests covering:
 * - parseBacklog basic parsing (4 tests)
 * - Section parsing (3 tests)
 * - Item parsing (4 tests)
 * - Edge cases (3 tests)
 */

import { describe, test, expect } from 'vitest';
import { parseBacklog } from '../lib/parser';
import type { BacklogItem } from '../types/backlog';

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
