/**
 * Persistence Tests - Parser, Serializer, and State Management
 *
 * 20 tests covering:
 * - Parser: 6 tests
 * - Serializer: 5 tests
 * - addItem Logic: 3 tests
 * - toggleItemCriterion Sync: 2 tests
 * - Template Generation: 3 tests
 * - Integration: 1 test
 */

import { describe, test, expect } from 'vitest';
import { parseBacklog, getAllItems } from '../lib/parser';
import { serializeBacklog, toggleCriterion, updateItem } from '../lib/serializer';
import { detectTypesFromMarkdown } from '../types/typeConfig';
import { getTypeFromId } from '../types/backlog';

// ============================================================
// TEST FIXTURES
// ============================================================

const MINIMAL_BACKLOG = `# Test Project - Product Backlog

> Test document

---

## Table des matières
1. [Bugs](#1-bugs)

---

## 1. BUGS

### BUG-001 | Test Bug
**Sévérité:** P2 - Moyenne
**Description:** A test bug

---

## 2. Légende

### Légende Effort
Some content here
`;

const BACKLOG_WITH_CRITERIA = `# Test

---

## 1. BUGS

### BUG-001 | Test Bug
**Critères d'acceptation:**
- [ ] First criterion
- [x] Second criterion checked
- [ ] Third criterion

---
`;

const EMPTY_SECTIONS_BACKLOG = `# Test

---

## 1. BUGS

---

## 2. COURT TERME

---

## 3. Légende

Content
`;

const COMPLETE_BACKLOG = `# Complete Test

> Description

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)

---

## 1. BUGS

### BUG-001 | Critical Bug
**Sévérité:** P1 - Critique
**Description:** Something is broken
**Critères d'acceptation:**
- [ ] Fix the issue
- [x] Test the fix

---

### BUG-002 | Minor Bug
**Sévérité:** P3 - Faible
**Description:** Minor issue

---

## 2. COURT TERME

### CT-001 | New Feature
**Priorité:** Haute
**Effort:** M (Medium)
**Description:** Add new functionality

---

## 3. Légende

### Légende Effort
| Code | Signification |
|------|---------------|
| XS | Extra Small |
`;

// ============================================================
// PARSER TESTS (1-6)
// ============================================================

describe('Parser', () => {
  test('1. parseBacklog returns valid structure for minimal input', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);

    expect(result).toHaveProperty('header');
    expect(result).toHaveProperty('tableOfContents');
    expect(result).toHaveProperty('sections');
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  test('2. parseBacklog skips TOC as section boundary', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);

    // TOC should NOT be in sections
    const tocSection = result.sections.find(s =>
      s.title.toLowerCase().includes('table des matières') ||
      s.title.toLowerCase().includes('table des matieres')
    );
    expect(tocSection).toBeUndefined();

    // TOC content should be in tableOfContents
    expect(result.tableOfContents).toContain('Table des matières');
  });

  test('3. parseBacklog excludes header from raw section rawMarkdown', () => {
    const result = parseBacklog(MINIMAL_BACKLOG);

    // Find Légende section
    const legendeSection = result.sections.find(s =>
      s.title.toLowerCase().includes('légende') ||
      s.title.toLowerCase().includes('legende')
    );
    expect(legendeSection).toBeDefined();

    // Raw section item should NOT include the ## header
    if (legendeSection && legendeSection.items[0]) {
      const rawItem = legendeSection.items[0];
      if ('rawMarkdown' in rawItem && rawItem.type === 'raw-section') {
        // The rawMarkdown should NOT start with the section header
        expect(rawItem.rawMarkdown).not.toMatch(/^## \d+\.\s+Légende/i);
      }
    }
  });

  test('4. parseBacklog handles Windows CRLF line endings', () => {
    const windowsBacklog = MINIMAL_BACKLOG.replace(/\n/g, '\r\n');
    const result = parseBacklog(windowsBacklog);

    expect(result.sections.length).toBeGreaterThan(0);
    const items = getAllItems(result);
    expect(items.length).toBeGreaterThan(0);
  });

  test('5. parseBacklog extracts all item types correctly', () => {
    const result = parseBacklog(COMPLETE_BACKLOG);
    const items = getAllItems(result);

    expect(items.length).toBe(3);

    const bugItems = items.filter(i => i.type === 'BUG');
    expect(bugItems.length).toBe(2);

    const ctItems = items.filter(i => i.type === 'CT');
    expect(ctItems.length).toBe(1);
  });

  test('6. getTypeFromId returns null for invalid IDs', () => {
    expect(getTypeFromId('bug-001')).toBeNull(); // lowercase
    expect(getTypeFromId('123')).toBeNull(); // numbers only
    expect(getTypeFromId('')).toBeNull(); // empty
    expect(getTypeFromId('BUG001')).toBeNull(); // no dash
    expect(getTypeFromId('BUG-001')).toBe('BUG'); // valid
    expect(getTypeFromId('CT-042')).toBe('CT'); // valid
  });
});

// ============================================================
// SERIALIZER TESTS (7-11)
// ============================================================

describe('Serializer', () => {
  test('7. serializeBacklog produces round-trip compatible output', () => {
    const parsed = parseBacklog(MINIMAL_BACKLOG);
    const serialized = serializeBacklog(parsed);
    const reparsed = parseBacklog(serialized);

    // Structure should be equivalent
    expect(reparsed.sections.length).toBe(parsed.sections.length);

    const originalItems = getAllItems(parsed);
    const reserializedItems = getAllItems(reparsed);

    expect(reserializedItems.length).toBe(originalItems.length);
    expect(reserializedItems[0]?.id).toBe(originalItems[0]?.id);
    expect(reserializedItems[0]?.title).toBe(originalItems[0]?.title);
  });

  test('8. serializeBacklog adds section separators', () => {
    const parsed = parseBacklog(EMPTY_SECTIONS_BACKLOG);
    const serialized = serializeBacklog(parsed);

    // Should have --- between sections (with newlines around it)
    expect(serialized).toMatch(/\n---\n/);
    // Should NOT have fused lines like "---## 1."
    expect(serialized).not.toMatch(/---##/);
  });

  test('9. serializeBacklog does not duplicate raw section headers', () => {
    const parsed = parseBacklog(MINIMAL_BACKLOG);
    const serialized = serializeBacklog(parsed);

    // Count occurrences of Légende header
    const legendeMatches = serialized.match(/## \d+\.\s*(Légende|Legende)/gi) || [];
    expect(legendeMatches.length).toBe(1);
  });

  test('10. toggleCriterion updates rawMarkdown correctly', () => {
    const parsed = parseBacklog(BACKLOG_WITH_CRITERIA);
    const item = getAllItems(parsed)[0];

    expect(item.criteria).toBeDefined();
    expect(item.criteria?.length).toBe(3);
    expect(item.criteria?.[0].checked).toBe(false);

    // Toggle first criterion
    const toggled = toggleCriterion(item, 0);

    expect(toggled.criteria?.[0].checked).toBe(true);
    expect(toggled.rawMarkdown).toContain('- [x] First criterion');
  });

  test('11. updateItem sets _modified flag', () => {
    const parsed = parseBacklog(MINIMAL_BACKLOG);
    const item = getAllItems(parsed)[0];

    const updated = updateItem(item, { title: 'New Title' });

    expect((updated as { _modified?: boolean })._modified).toBe(true);
    expect(updated.title).toBe('New Title');
  });
});

// ============================================================
// ADD ITEM SECTION PLACEMENT TESTS (12-14)
// ============================================================

describe('addItem Section Placement Logic', () => {
  // Simulating the addItem logic from useBacklog
  function findTargetSection(
    sections: { title: string; items: { type?: string }[] }[],
    newItemType: string
  ): number {
    // 1. Find section with existing items
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].items.some(item => item.type === newItemType)) {
        return i;
      }
    }

    // 2. Match by title
    const TYPE_LABEL_MAP: Record<string, string[]> = {
      'BUG': ['BUGS', 'BUG'],
      'CT': ['COURT TERME', 'CT'],
      'LT': ['LONG TERME', 'LT'],
      'AUTRE': ['AUTRES', 'AUTRE', 'IDÉES', 'IDEES'],
      'TEST': ['TESTS', 'TEST'],
    };
    const matchLabels = TYPE_LABEL_MAP[newItemType] || [newItemType];

    for (let i = 0; i < sections.length; i++) {
      const titleUpper = sections[i].title.toUpperCase();
      if (matchLabels.some(label => titleUpper.includes(label))) {
        return i;
      }
    }

    return 0; // fallback
  }

  test('12. addItem places item in correct section by type ID', () => {
    const sections = [
      { title: 'BUGS', items: [{ type: 'BUG' }] },
      { title: 'COURT TERME', items: [{ type: 'CT' }] },
    ];

    expect(findTargetSection(sections, 'BUG')).toBe(0);
    expect(findTargetSection(sections, 'CT')).toBe(1);
  });

  test('13. addItem matches section by title when no items exist', () => {
    const sections = [
      { title: 'BUGS', items: [] },
      { title: 'COURT TERME', items: [] },
      { title: 'TEST', items: [] },
    ];

    expect(findTargetSection(sections, 'BUG')).toBe(0);
    expect(findTargetSection(sections, 'CT')).toBe(1);
    expect(findTargetSection(sections, 'TEST')).toBe(2);
  });

  test('14. addItem falls back to section 0 for unknown type', () => {
    const sections = [
      { title: 'BUGS', items: [] },
      { title: 'COURT TERME', items: [] },
    ];

    expect(findTargetSection(sections, 'UNKNOWN')).toBe(0);
  });
});

// ============================================================
// TOGGLEITEMCRITERION SYNC TESTS (15-16)
// ============================================================

describe('toggleItemCriterion State Sync', () => {
  test('15. toggleItemCriterion should sync rawMarkdown', () => {
    const parsed = parseBacklog(BACKLOG_WITH_CRITERIA);
    const item = getAllItems(parsed)[0];

    // Simulate toggle
    const toggled = toggleCriterion(item, 0);

    // selectedItem should have updated rawMarkdown
    expect(toggled.rawMarkdown).toContain('- [x] First criterion');
    // Other criteria should remain unchanged
    expect(toggled.rawMarkdown).toContain('- [x] Second criterion checked');
    expect(toggled.rawMarkdown).toContain('- [ ] Third criterion');
  });

  test('16. toggleItemCriterion sets _modified flag', () => {
    const parsed = parseBacklog(BACKLOG_WITH_CRITERIA);
    const item = getAllItems(parsed)[0];

    const toggled = toggleCriterion(item, 0);

    expect((toggled as { _modified?: boolean })._modified).toBe(true);
  });
});

// ============================================================
// TEMPLATE GENERATION TESTS (17-19)
// ============================================================

describe('Template Generation', () => {
  function generateTemplate(types: { id: string; label: string }[]): string {
    const sections = types.map((t, i) =>
      `## ${i + 1}. ${t.label.toUpperCase()}\n\n<!-- Type: ${t.id} -->\n`
    ).join('\n---\n\n');

    return `# Test - Product Backlog

> Document de référence

---

## Table des matières
${types.map((t, i) => `${i + 1}. [${t.label}](#${i + 1}-${t.id.toLowerCase()})`).join('\n')}

---

${sections}

---

## ${types.length + 1}. Légende

### Légende Effort
| Code | Signification |
|------|---------------|
| XS | Extra Small |
`;
  }

  test('17. template has newlines between sections', () => {
    const template = generateTemplate([
      { id: 'BUG', label: 'Bugs' },
      { id: 'CT', label: 'Court Terme' },
    ]);

    // Should have proper separation with --- on its own line
    expect(template).toMatch(/\n---\n/);
    // Should NOT have fused separators
    expect(template).not.toMatch(/---##/);
    // Should NOT have multiple --- in a row without content
    expect(template).not.toMatch(/---\n---/);
  });

  test('18. template section headers include type ID for detection', () => {
    const template = generateTemplate([
      { id: 'BUG', label: 'Bugs' },
      { id: 'CT', label: 'Court Terme' },
      { id: 'CUSTOM', label: 'Custom Type' },
    ]);

    expect(template).toContain('<!-- Type: BUG -->');
    expect(template).toContain('<!-- Type: CT -->');
    expect(template).toContain('<!-- Type: CUSTOM -->');
  });

  test('19. detectTypesFromMarkdown finds types from section headers', () => {
    // Test with existing implementation
    const markdown = `# Test

## 1. BUGS

### BUG-001 | Test
Description

## 2. COURT TERME

### CT-001 | Feature
Description
`;

    const detected = detectTypesFromMarkdown(markdown);

    expect(detected).toContain('BUG');
    expect(detected).toContain('CT');
  });
});

// ============================================================
// ROUND-TRIP INTEGRATION TEST (20)
// ============================================================

describe('Round-Trip Integration', () => {
  test('20. parse -> serialize -> parse produces identical structure', () => {
    const parsed1 = parseBacklog(COMPLETE_BACKLOG);
    const serialized = serializeBacklog(parsed1);
    const parsed2 = parseBacklog(serialized);

    // Compare section count
    expect(parsed2.sections.length).toBe(parsed1.sections.length);

    const items1 = getAllItems(parsed1);
    const items2 = getAllItems(parsed2);

    // Compare item count
    expect(items2.length).toBe(items1.length);

    // Compare each item
    for (let i = 0; i < items1.length; i++) {
      expect(items2[i].id).toBe(items1[i].id);
      expect(items2[i].type).toBe(items1[i].type);
      expect(items2[i].title).toBe(items1[i].title);
      expect(items2[i].severity).toBe(items1[i].severity);
      expect(items2[i].description).toBe(items1[i].description);
      expect(items2[i].criteria?.length).toBe(items1[i].criteria?.length);
    }
  });
});
