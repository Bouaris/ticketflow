/**
 * Backlog Zod Schema Tests
 *
 * 18 tests covering schema validations:
 * - ItemTypeSchema (3 tests)
 * - SeveritySchema (3 tests)
 * - PrioritySchema (3 tests)
 * - EffortSchema (3 tests)
 * - CriterionSchema (3 tests)
 * - ScreenshotSchema (3 tests)
 */

import { describe, test, expect } from 'vitest';
import {
  ItemTypeSchema,
  SeveritySchema,
  PrioritySchema,
  EffortSchema,
  CriterionSchema,
  ScreenshotSchema,
} from '../types/backlog';

// ============================================================
// ItemTypeSchema TESTS (1-3)
// ============================================================

describe('ItemTypeSchema', () => {
  test('1. accepts valid uppercase types', () => {
    expect(ItemTypeSchema.safeParse('BUG').success).toBe(true);
    expect(ItemTypeSchema.safeParse('CT').success).toBe(true);
    expect(ItemTypeSchema.safeParse('LT').success).toBe(true);
    expect(ItemTypeSchema.safeParse('AUTRE').success).toBe(true);
  });

  test('2. rejects lowercase types', () => {
    expect(ItemTypeSchema.safeParse('bug').success).toBe(false);
    expect(ItemTypeSchema.safeParse('Bug').success).toBe(false);
    expect(ItemTypeSchema.safeParse('bUG').success).toBe(false);
  });

  test('3. rejects types with invalid characters or format', () => {
    // Now allows alphanumeric + underscore: BUG1 and BUG_V5 are valid
    expect(ItemTypeSchema.safeParse('BUG1').success).toBe(true);     // was false
    expect(ItemTypeSchema.safeParse('BUG-001').success).toBe(false); // dash not allowed
    expect(ItemTypeSchema.safeParse('').success).toBe(false);        // empty
    expect(ItemTypeSchema.safeParse('1BUG').success).toBe(false);    // starts with number
    expect(ItemTypeSchema.safeParse('bug_v5').success).toBe(false);  // lowercase
  });
});

// ============================================================
// SeveritySchema TESTS (4-6)
// ============================================================

describe('SeveritySchema', () => {
  test('4. accepts valid severity values', () => {
    expect(SeveritySchema.safeParse('P0').success).toBe(true);
    expect(SeveritySchema.safeParse('P1').success).toBe(true);
    expect(SeveritySchema.safeParse('P2').success).toBe(true);
    expect(SeveritySchema.safeParse('P3').success).toBe(true);
    expect(SeveritySchema.safeParse('P4').success).toBe(true);
  });

  test('5. rejects invalid severity values', () => {
    expect(SeveritySchema.safeParse('P5').success).toBe(false);
    expect(SeveritySchema.safeParse('HIGH').success).toBe(false);
    expect(SeveritySchema.safeParse('p1').success).toBe(false);
  });

  test('6. rejects non-string values', () => {
    expect(SeveritySchema.safeParse(1).success).toBe(false);
    expect(SeveritySchema.safeParse(null).success).toBe(false);
  });
});

// ============================================================
// PrioritySchema TESTS (7-9)
// ============================================================

describe('PrioritySchema', () => {
  test('7. accepts valid priority values', () => {
    expect(PrioritySchema.safeParse('Haute').success).toBe(true);
    expect(PrioritySchema.safeParse('Moyenne').success).toBe(true);
    expect(PrioritySchema.safeParse('Faible').success).toBe(true);
  });

  test('8. rejects invalid priority values', () => {
    expect(PrioritySchema.safeParse('High').success).toBe(false);
    expect(PrioritySchema.safeParse('haute').success).toBe(false);
    expect(PrioritySchema.safeParse('HAUTE').success).toBe(false);
  });

  test('9. rejects empty or null values', () => {
    expect(PrioritySchema.safeParse('').success).toBe(false);
    expect(PrioritySchema.safeParse(null).success).toBe(false);
  });
});

// ============================================================
// EffortSchema TESTS (10-12)
// ============================================================

describe('EffortSchema', () => {
  test('10. accepts valid effort values', () => {
    expect(EffortSchema.safeParse('XS').success).toBe(true);
    expect(EffortSchema.safeParse('S').success).toBe(true);
    expect(EffortSchema.safeParse('M').success).toBe(true);
    expect(EffortSchema.safeParse('L').success).toBe(true);
    expect(EffortSchema.safeParse('XL').success).toBe(true);
  });

  test('11. rejects invalid effort values', () => {
    expect(EffortSchema.safeParse('XXL').success).toBe(false);
    expect(EffortSchema.safeParse('small').success).toBe(false);
    expect(EffortSchema.safeParse('m').success).toBe(false);
  });

  test('12. rejects numbers', () => {
    expect(EffortSchema.safeParse(1).success).toBe(false);
    expect(EffortSchema.safeParse(5).success).toBe(false);
  });
});

// ============================================================
// CriterionSchema TESTS (13-15)
// ============================================================

describe('CriterionSchema', () => {
  test('13. accepts valid criterion', () => {
    const result = CriterionSchema.safeParse({ text: 'Test criterion', checked: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('Test criterion');
      expect(result.data.checked).toBe(true);
    }
  });

  test('14. defaults checked to false', () => {
    const result = CriterionSchema.safeParse({ text: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checked).toBe(false);
    }
  });

  test('15. rejects missing text', () => {
    expect(CriterionSchema.safeParse({ checked: true }).success).toBe(false);
    expect(CriterionSchema.safeParse({}).success).toBe(false);
  });
});

// ============================================================
// ScreenshotSchema TESTS (16-18)
// ============================================================

describe('ScreenshotSchema', () => {
  test('16. accepts valid screenshot', () => {
    const result = ScreenshotSchema.safeParse({
      filename: 'BUG-001_12345.png',
      addedAt: 1704153600000,
    });
    expect(result.success).toBe(true);
  });

  test('17. accepts optional alt text', () => {
    const result = ScreenshotSchema.safeParse({
      filename: 'test.png',
      alt: 'Screenshot description',
      addedAt: 1704153600000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alt).toBe('Screenshot description');
    }
  });

  test('18. rejects missing required fields', () => {
    expect(ScreenshotSchema.safeParse({ filename: 'test.png' }).success).toBe(false);
    expect(ScreenshotSchema.safeParse({ addedAt: 123 }).success).toBe(false);
    expect(ScreenshotSchema.safeParse({}).success).toBe(false);
  });
});
