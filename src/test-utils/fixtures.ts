/**
 * Test Fixtures
 *
 * Reusable test data for unit and integration tests.
 */

import type { BacklogItem, Criterion } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';

// ============================================================
// MARKDOWN FIXTURES
// ============================================================

export const MINIMAL_BACKLOG_MD = `# ticketflow - Product Backlog

> Version: 1.0
> Dernière mise à jour : 2026-01-01

---

## Table des Matières

1. [BUGS](#bugs)
2. [Court Terme](#court-terme)

---

## 1. BUGS (Hotfix)

### BUG-001 | Test Bug

**Description:** Ceci est un bug de test.

---

## 2. Court Terme (CT)

### CT-001 | Test Feature

**Description:** Ceci est une feature de test.

---
`;

export const BACKLOG_WITH_CRITERIA_MD = `# ticketflow - Product Backlog

## 1. BUGS

### BUG-001 | Bug avec critères

**Description:** Bug avec critères d'acceptation.

**Critères d'acceptation:**
- [ ] Critère non complété
- [x] Critère complété
- [ ] Autre critère

---
`;

export const EMPTY_BACKLOG_MD = `# ticketflow - Product Backlog

> Version: 1.0

---

## Table des Matières

---

## 1. BUGS

---

## 2. Court Terme

---
`;

// ============================================================
// ITEM FIXTURES
// ============================================================

export function createMockItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: 'BUG-001',
    type: 'BUG',
    title: 'Test Bug',
    description: 'Description de test',
    rawMarkdown: '### BUG-001 | Test Bug\n\n**Description:** Description de test\n\n---\n',
    sectionIndex: 0,
    ...overrides,
  };
}

export function createMockCriteria(count = 3): Criterion[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Critère ${i + 1}`,
    checked: i === 0, // First one is checked
  }));
}

export function createMockItems(count: number, type = 'BUG'): BacklogItem[] {
  return Array.from({ length: count }, (_, i) => createMockItem({
    id: `${type}-${String(i + 1).padStart(3, '0')}`,
    type,
    title: `Item ${i + 1}`,
  }));
}

// ============================================================
// TYPE CONFIG FIXTURES
// ============================================================

export const DEFAULT_TYPE_DEFINITIONS: TypeDefinition[] = [
  { id: 'BUG', label: 'Bugs', color: '#ef4444', order: 0, visible: true },
  { id: 'CT', label: 'Court Terme', color: '#3b82f6', order: 1, visible: true },
  { id: 'LT', label: 'Long Terme', color: '#8b5cf6', order: 2, visible: true },
  { id: 'AUTRE', label: 'Autres', color: '#6b7280', order: 3, visible: true },
];

export function createMockTypeDefinition(overrides: Partial<TypeDefinition> = {}): TypeDefinition {
  return {
    id: 'TEST',
    label: 'Test Type',
    color: '#000000',
    order: 0,
    visible: true,
    ...overrides,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a complete backlog markdown with custom items.
 */
export function createBacklogMarkdown(items: Array<{ id: string; title: string; description?: string }>): string {
  const itemsMarkdown = items.map(item => `
### ${item.id} | ${item.title}

**Description:** ${item.description || 'Test description'}

---
`).join('\n');

  return `# ticketflow - Product Backlog

## 1. BUGS

${itemsMarkdown}
`;
}
