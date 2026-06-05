import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StateV1 } from '../../src/scripts/utils.mts';
import type { TopicSummary } from '../../src/scripts/status.mts';
import { renderStatus, renderAllTopics } from '../../src/scripts/status.mts';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string): StateV1 {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'));
}

function loadExpected(name: string): string {
  return readFileSync(resolve(fixtureDir, name), 'utf-8');
}

/** Fixed now timestamp: 2026-06-05T12:00:00 */
const NOW = new Date('2026-06-05T12:00:00').getTime();

const MIXED_SUMMARIES: TopicSummary[] = [
  {
    topic: 'JavaScript',
    slug: 'javascript',
    total: 34,
    mastered: 5,
    active: 2,
    practice: 1,
    unexplored: 26,
    pct: 15,
    lastPracticed: '2026-06-04',
    days: 8,
  },
  {
    topic: 'Rust',
    slug: 'rust',
    total: 20,
    mastered: 0,
    active: 1,
    practice: 0,
    unexplored: 19,
    pct: 0,
    lastPracticed: '2026-05-30',
    days: 12,
  },
  {
    topic: 'TypeScript',
    slug: 'typescript',
    total: 18,
    mastered: 9,
    active: 3,
    practice: 2,
    unexplored: 4,
    pct: 50,
    lastPracticed: '2026-06-05',
    days: 3,
  },
];

// ===========================================================================
// renderStatus() — English
// ===========================================================================

describe('renderStatus() — en', () => {
  it('mixed statuses', () => {
    const state = loadFixture('status-mixed.json');
    const expected = loadExpected('status-mixed.expected.txt');
    expect(renderStatus(state, NOW, 'en')).toBe(expected);
  });

  it('empty domains', () => {
    const state = loadFixture('status-empty.json');
    const expected = loadExpected('status-empty.expected.txt');
    expect(renderStatus(state, NOW, 'en')).toBe(expected);
  });

  it('all mastered', () => {
    const state = loadFixture('status-all-mastered.json');
    const expected = loadExpected('status-all-mastered.expected.txt');
    expect(renderStatus(state, NOW, 'en')).toBe(expected);
  });

  it('domain with no concepts is skipped in tree', () => {
    const state: StateV1 = {
      version: 1,
      topic: 'T',
      slug: 't',
      created: '2026-06-05',
      domains: [
        { name: 'Empty', slug: 'empty', concepts: [] },
        {
          name: 'Has',
          slug: 'has',
          concepts: [
            {
              name: 'A',
              slug: 'a',
              status: 'mastered',
              confidence: 1,
              practice_count: 1,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    };
    const output = renderStatus(state, NOW, 'en');
    expect(output).not.toContain('Empty');
    expect(output).toContain('Has');
  });

  it('output ends with exactly one newline', () => {
    const state = loadFixture('status-mixed.json');
    const output = renderStatus(state, NOW, 'en');
    expect(output).toMatch(/\n$/);
    expect(output).not.toMatch(/\n\n$/);
  });
});

// ===========================================================================
// renderStatus() — Chinese
// ===========================================================================

describe('renderStatus() — zh-CN', () => {
  it('mixed statuses', () => {
    const state = loadFixture('status-mixed.json');
    const expected = loadExpected('status-mixed.zh-CN.expected.txt');
    expect(renderStatus(state, NOW, 'zh-CN')).toBe(expected);
  });

  it('empty domains', () => {
    const state = loadFixture('status-empty.json');
    const expected = loadExpected('status-empty.zh-CN.expected.txt');
    expect(renderStatus(state, NOW, 'zh-CN')).toBe(expected);
  });

  it('all mastered', () => {
    const state = loadFixture('status-all-mastered.json');
    const expected = loadExpected('status-all-mastered.zh-CN.expected.txt');
    expect(renderStatus(state, NOW, 'zh-CN')).toBe(expected);
  });
});

// ===========================================================================
// renderAllTopics() — English
// ===========================================================================

describe('renderAllTopics() — en', () => {
  it('multiple topics', () => {
    const expected = loadExpected('status-all-topics.expected.txt');
    expect(renderAllTopics(MIXED_SUMMARIES, NOW, 'en')).toBe(expected);
  });

  it('empty topics list', () => {
    const expected = loadExpected('status-all-topics-empty.expected.txt');
    expect(renderAllTopics([], NOW, 'en')).toBe(expected);
  });

  it('output ends with exactly one newline', () => {
    const summaries: TopicSummary[] = [
      {
        topic: 'JS',
        slug: 'js',
        total: 1,
        mastered: 0,
        active: 0,
        practice: 0,
        unexplored: 1,
        pct: 0,
        lastPracticed: null,
        days: 1,
      },
    ];
    const output = renderAllTopics(summaries, NOW, 'en');
    expect(output).toMatch(/\n$/);
    expect(output).not.toMatch(/\n\n$/);
  });
});

// ===========================================================================
// renderAllTopics() — Chinese
// ===========================================================================

describe('renderAllTopics() — zh-CN', () => {
  it('multiple topics', () => {
    const expected = loadExpected('status-all-topics.zh-CN.expected.txt');
    expect(renderAllTopics(MIXED_SUMMARIES, NOW, 'zh-CN')).toBe(expected);
  });

  it('empty topics list', () => {
    const expected = loadExpected('status-all-topics-empty.zh-CN.expected.txt');
    expect(renderAllTopics([], NOW, 'zh-CN')).toBe(expected);
  });
});
