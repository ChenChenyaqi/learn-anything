import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '../../src/scripts/render.mts';
import { totalCount, masteredCount, validateStateV1 } from '../../src/scripts/utils.mts';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'));
}

function loadExpected(name: string): string {
  return readFileSync(resolve(fixtureDir, name), 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  Inline helpers for edge cases                                      */
/* ------------------------------------------------------------------ */

interface Concept {
  name: string;
  slug: string;
  status: 'unexplored' | 'in_progress' | 'needs_practice' | 'mastered';
  confidence: number;
  practice_count: number;
  explain_count: number;
  last_explained: string | null;
  last_practiced: string | null;
  details: string[];
}

interface Domain {
  name: string;
  slug: string;
  concepts: Concept[];
}

interface StateV1 {
  version: 1;
  topic: string;
  slug: string;
  created: string;
  domains: Domain[];
}

function c(name: string, status: Concept['status'], details: string[] = []): Concept {
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    status,
    confidence: 0,
    practice_count: 0,
    explain_count: 0,
    last_explained: null,
    last_practiced: null,
    details,
  };
}

function s(topic: string, domains: Domain[]): StateV1 {
  return {
    version: 1,
    topic,
    slug: topic.toLowerCase().replace(/\s+/g, '-'),
    created: '2025-01-01',
    domains,
  };
}

// ===========================================================================
// render() — fixture-based full comparisons
// ===========================================================================

describe('render()', () => {
  it('javascript (real .learn data: 7 domains, 34 concepts)', () => {
    const state = loadFixture('javascript/state.json') as StateV1;
    const expected = loadExpected('javascript/expected.md');
    expect(render(state)).toBe(expected);
  });

  it('empty domains', () => {
    const state = loadFixture('empty-domains.json') as StateV1;
    const expected = loadExpected('empty-domains.expected.md');
    expect(render(state)).toBe(expected);
  });

  it('all four status icons', () => {
    const state = loadFixture('all-status.json') as StateV1;
    const expected = loadExpected('all-status.expected.md');
    expect(render(state)).toBe(expected);
  });

  it('special characters (emoji, Chinese, &, parens)', () => {
    const state = loadFixture('special-chars.json') as StateV1;
    const expected = loadExpected('special-chars.expected.md');
    expect(render(state)).toBe(expected);
  });

  it('sparse domain (empty domain + populated domain)', () => {
    const state = loadFixture('sparse.json') as StateV1;
    const expected = loadExpected('sparse.expected.md');
    expect(render(state)).toBe(expected);
  });

  // -- Edge cases -----------------------------------------------------------

  it('should render concepts without details (no extra indented lines)', () => {
    const state = s('No Details', [
      { name: 'Domain', slug: 'domain', concepts: [c('Clean Concept', 'mastered')] },
    ]);
    const output = render(state);
    const lines = output.split('\n');
    const idx = lines.findIndex((l) => l.includes('Clean Concept'));
    expect(lines[idx + 1]).not.toMatch(/^ {2}- /);
  });

  it('0% when nothing mastered', () => {
    const state = s('Fresh', [
      {
        name: 'Topic',
        slug: 'topic',
        concepts: [c('A', 'unexplored'), c('B', 'in_progress'), c('C', 'needs_practice')],
      },
    ]);
    expect(render(state)).toContain('> 0/3 mastered · 0% complete');
  });

  it('100% when all mastered', () => {
    const state = s('Done', [
      { name: 'Topic', slug: 'topic', concepts: [c('A', 'mastered'), c('B', 'mastered')] },
    ]);
    expect(render(state)).toContain('> 2/2 mastered · 100% complete');
  });

  it('rounding percentage', () => {
    const state = s('R', [
      {
        name: 'T',
        slug: 't',
        concepts: [c('A', 'mastered'), c('B', 'unexplored'), c('C', 'unexplored')],
      },
    ]);
    expect(render(state)).toContain('> 1/3 mastered · 33% complete');
  });

  it('output always ends with exactly one newline', () => {
    const s1 = s('T1', []);
    const s2 = s('T2', [{ name: 'D', slug: 'd', concepts: [c('C', 'mastered')] }]);
    for (const output of [render(s1), render(s2)]) {
      expect(output).toMatch(/\n$/);
      expect(output).not.toMatch(/\n\n$/);
    }
  });
});

// ===========================================================================
// totalCount / masteredCount
// ===========================================================================

describe('totalCount', () => {
  it('0 for empty domains', () => {
    expect(totalCount(s('X', []))).toBe(0);
  });

  it('sums across all domains', () => {
    const state = s('Y', [
      { name: 'D1', slug: 'd1', concepts: [c('A', 'unexplored'), c('B', 'unexplored')] },
      { name: 'D2', slug: 'd2', concepts: [c('C', 'unexplored')] },
    ]);
    expect(totalCount(state)).toBe(3);
  });

  it('0 when domain has no concepts', () => {
    expect(totalCount(s('Z', [{ name: 'E', slug: 'e', concepts: [] }]))).toBe(0);
  });
});

describe('masteredCount', () => {
  it('0 when none mastered', () => {
    const state = s('X', [
      {
        name: 'D',
        slug: 'd',
        concepts: [c('A', 'unexplored'), c('B', 'in_progress'), c('C', 'needs_practice')],
      },
    ]);
    expect(masteredCount(state)).toBe(0);
  });

  it('counts only mastered across domains', () => {
    const state = s('Y', [
      { name: 'D1', slug: 'd1', concepts: [c('A', 'mastered'), c('B', 'mastered')] },
      { name: 'D2', slug: 'd2', concepts: [c('C', 'in_progress'), c('D', 'mastered')] },
    ]);
    expect(masteredCount(state)).toBe(3);
  });
});

// ===========================================================================
// validateStateV1
// ===========================================================================

describe('validateStateV1', () => {
  // ── Valid inputs ──────────────────────────────────────────────────────

  it('should return no errors for a valid minimal state', () => {
    const state = s('Valid', [
      { name: 'Domain', slug: 'domain', concepts: [c('Concept', 'unexplored')] },
    ]);
    expect(validateStateV1(state)).toEqual([]);
  });

  it('should return no errors for a fully populated state', () => {
    const state: StateV1 = {
      version: 1,
      topic: 'Full',
      slug: 'full',
      created: '2026-01-15 10:30:00',
      domains: [
        {
          name: 'D',
          slug: 'd',
          concepts: [
            {
              name: 'C',
              slug: 'c',
              status: 'mastered',
              confidence: 1,
              practice_count: 5,
              explain_count: 3,
              last_explained: '2026-03-01 12:00:00',
              last_practiced: '2026-03-05',
              details: ['Detail A', 'Detail B'],
            },
          ],
        },
      ],
    };
    expect(validateStateV1(state)).toEqual([]);
  });

  it('should return no errors for empty domains array', () => {
    const state = s('Empty', []);
    expect(validateStateV1(state)).toEqual([]);
  });

  it('should accept date-only and datetime formats', () => {
    const state = s('Dates', [
      {
        name: 'D',
        slug: 'd',
        concepts: [
          {
            ...c('A', 'in_progress'),
            last_explained: '2026-01-01',
            last_practiced: '2026-01-01 12:00:00',
          },
        ],
      },
    ]);
    expect(validateStateV1(state)).toEqual([]);
  });

  // ── Invalid top-level ─────────────────────────────────────────────────

  it('should reject null', () => {
    const errs = validateStateV1(null);
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain('non-null object');
  });

  it('should reject a string', () => {
    const errs = validateStateV1('not an object');
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain('non-null object');
  });

  it('should reject an array', () => {
    const errs = validateStateV1([]);
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain('non-null object');
  });

  it('should reject wrong version', () => {
    const state = { ...s('X', []), version: 2 };
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'version')).toBe(true);
  });

  it('should reject missing topic', () => {
    const { topic, ...noTopic } = s('X', []);
    void topic;
    const errs = validateStateV1(noTopic);
    expect(errs.some((e) => e.path === 'topic')).toBe(true);
  });

  it('should reject empty topic string', () => {
    const state = { ...s('X', []), topic: '' };
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'topic')).toBe(true);
  });

  it('should reject empty slug string', () => {
    const state = { ...s('X', []), slug: '' };
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'slug')).toBe(true);
  });

  it('should reject invalid created format', () => {
    const state = { ...s('X', []), created: '2026/01/15' };
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'created')).toBe(true);
  });

  it('should reject non-array domains', () => {
    const state = { ...s('X', []), domains: 'oops' };
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains')).toBe(true);
  });

  // ── Invalid domain ────────────────────────────────────────────────────

  it('should reject domain with empty name', () => {
    const state = s('X', [{ name: '', slug: 'd', concepts: [] }]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].name')).toBe(true);
  });

  it('should reject domain with non-array concepts', () => {
    const state = s('X', [{ name: 'D', slug: 'd', concepts: 'nope' } as unknown as Domain]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts')).toBe(true);
  });

  // ── Invalid concept ───────────────────────────────────────────────────

  it('should reject invalid status value', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), status: 'unknown' }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].status')).toBe(true);
  });

  it('should reject negative confidence', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), confidence: -0.1 }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].confidence')).toBe(true);
  });

  it('should reject confidence > 1', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), confidence: 1.5 }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].confidence')).toBe(true);
  });

  it('should reject negative practice_count', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), practice_count: -1 }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].practice_count')).toBe(true);
  });

  it('should reject float practice_count', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), practice_count: 1.5 }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].practice_count')).toBe(true);
  });

  it('should reject invalid last_explained format', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), last_explained: 'bad' }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].last_explained')).toBe(true);
  });

  it('should accept null last_explained', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), last_explained: null }] },
    ]);
    expect(validateStateV1(state)).toEqual([]);
  });

  it('should reject non-array details', () => {
    const state = s('X', [
      { name: 'D', slug: 'd', concepts: [{ ...c('C', 'unexplored'), details: 'nope' }] },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].details')).toBe(true);
  });

  it('should reject non-string items in details', () => {
    const state = s('X', [
      {
        name: 'D',
        slug: 'd',
        concepts: [{ ...c('C', 'unexplored'), details: ['ok', 42 as unknown as string] }],
      },
    ]);
    const errs = validateStateV1(state);
    expect(errs.some((e) => e.path === 'domains[0].concepts[0].details')).toBe(true);
  });

  // ── Multiple errors at once ───────────────────────────────────────────

  it('should report multiple errors simultaneously', () => {
    const state = { version: 2, topic: '', slug: '', created: 'bad', domains: 'nope' };
    const errs = validateStateV1(state);
    // version, topic, slug, created, domains = 5 errors
    expect(errs.length).toBeGreaterThanOrEqual(5);
  });
});
