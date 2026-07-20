import { describe, it, expect } from 'vitest';
import { validateStateV1, validateQuizDeck } from '../../src/scripts/utils.mts';

/* ------------------------------------------------------------------ */
/*  StateV1 fixtures                                                   */
/* ------------------------------------------------------------------ */

function validStateV1(created = '2026-01-15'): unknown {
  return {
    version: 1,
    topic: 'JavaScript',
    slug: 'javascript',
    created,
    domains: [],
  };
}

function validDeck(created = '2026-06-24 10:30:00'): unknown {
  return {
    version: 1,
    topic: 'JavaScript',
    topic_slug: 'javascript',
    concept_slug: 'closures',
    concept_name: 'Closures',
    created,
    questions: [],
  };
}

/* ------------------------------------------------------------------ */
/*  dateStr — via validateStateV1.created                              */
/* ------------------------------------------------------------------ */

describe('dateStr (validateStateV1.created)', () => {
  describe('accepts valid dates', () => {
    const valid = [
      '2026-01-15',
      '2026-02-28',
      '2024-02-29', // leap year
      '2000-02-29', // century leap year
      '2026-12-31',
      '2026-01-01 00:00:00',
      '2026-01-01 23:59:59',
      '2026-02-28 12:30:30',
    ];
    for (const created of valid) {
      it(`accepts ${created}`, () => {
        expect(validateStateV1(validStateV1(created))).toEqual([]);
      });
    }
  });

  describe('rejects impossible dates', () => {
    const invalid = [
      '2026-99-99', // issue 124 case
      '2026-13-01', // month > 12
      '2026-00-15', // month = 0
      '2026-01-00', // day = 0
      '2026-01-32', // day > 31
      '2026-04-31', // April has 30 days
      '2026-02-30', // Feb never has 30 days
      '2026-02-29', // 2026 is not a leap year
      '2100-02-29', // 2100 is not a leap year (century non-divisible by 400)
      '2026-01-15 99:99:99',
      '2026-01-15 24:00:00', // hour = 24
      '2026-01-15 23:60:00', // minute = 60
      '2026-01-15 23:59:60', // second = 60
    ];
    for (const created of invalid) {
      it(`rejects ${created}`, () => {
        const errors = validateStateV1(validStateV1(created));
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.path === 'created')).toBe(true);
      });
    }
  });

  it('still rejects malformed shape', () => {
    for (const created of ['2026/01/15', '2026-1-1', 'not-a-date', '']) {
      const errors = validateStateV1(validStateV1(created));
      expect(errors.some((e) => e.path === 'created')).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  dateStr — via validateQuizDeck.created                             */
/* ------------------------------------------------------------------ */

describe('dateStr (validateQuizDeck.created)', () => {
  it('accepts a valid datetime', () => {
    expect(validateQuizDeck(validDeck('2026-06-24 10:30:00'))).toEqual([]);
  });

  it('rejects 2026-99-99', () => {
    const errors = validateQuizDeck(validDeck('2026-99-99'));
    expect(errors.some((e) => e.path === 'created')).toBe(true);
  });

  it('rejects 2026-02-30', () => {
    const errors = validateQuizDeck(validDeck('2026-02-30'));
    expect(errors.some((e) => e.path === 'created')).toBe(true);
  });
});
