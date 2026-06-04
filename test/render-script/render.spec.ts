import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, totalCount, masteredCount } from '../../src/render-script/render.mts';

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
