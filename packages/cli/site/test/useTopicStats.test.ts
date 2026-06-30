import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { computeTopicStats } from '@/components/stats/useTopicStats';
import type { Concept, Domain, StateV1 } from '@/composables/topicDataTypes';

/* Fixed "now" so the day-since-activity math is deterministic. */
const NOW = new Date('2026-06-29T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

/** ISO timestamp `daysAgo` before the fixed NOW. */
function ts(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Builders                                                           */
/* ------------------------------------------------------------------ */

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    name: 'concept',
    slug: 'concept',
    status: 'unexplored',
    confidence: 0,
    practice_count: 0,
    explain_count: 0,
    last_explained: null,
    last_practiced: null,
    details: [],
    ...overrides,
  };
}

function makeDomain(slug: string, concepts: Concept[]): Domain {
  return { name: slug, slug, concepts };
}

function makeState(slug: string, domains: Domain[]): StateV1 {
  return { version: 1, topic: slug, slug, created: '2026-01-01', domains };
}

beforeAll(() => {
  vi.useFakeTimers({ now: NOW });
});

afterAll(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('computeTopicStats', () => {
  describe('empty state', () => {
    it('returns all-zero stats with empty perDomain when there are no domains', () => {
      expect(computeTopicStats(makeState('t', []))).toEqual({
        mastered: 0,
        inProgress: 0,
        needsPractice: 0,
        unexplored: 0,
        totalConcepts: 0,
        overallPct: 0,
        perDomain: [],
        totalPractice: 0,
        totalExplain: 0,
        lastActivityDays: null,
      });
    });

    it('emits a zeroed perDomain entry for a domain with no concepts', () => {
      const stats = computeTopicStats(makeState('t', [makeDomain('solo', [])]));
      expect(stats.perDomain).toEqual([
        {
          name: 'solo',
          slug: 'solo',
          mastered: 0,
          inProgress: 0,
          needsPractice: 0,
          unexplored: 0,
          total: 0,
          pct: 0,
        },
      ]);
      expect(stats.totalConcepts).toBe(0);
      expect(stats.overallPct).toBe(0);
    });
  });

  describe('concept counting', () => {
    it('maps each ConceptStatus to its own counter', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'in_progress' }),
            makeConcept({ slug: 'c', status: 'needs_practice' }),
            makeConcept({ slug: 'e', status: 'unexplored' }),
          ]),
        ]),
      );
      expect(stats.totalConcepts).toBe(4);
      expect(stats.mastered).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.needsPractice).toBe(1);
      expect(stats.unexplored).toBe(1);
    });

    it('counts concepts across multiple domains', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d1', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'mastered' }),
            makeConcept({ slug: 'c', status: 'unexplored' }),
          ]),
          makeDomain('d2', [makeConcept({ slug: 'e', status: 'in_progress' })]),
        ]),
      );
      expect(stats.totalConcepts).toBe(4);
      expect(stats.mastered).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.unexplored).toBe(1);
    });
  });

  describe('overallPct', () => {
    it('rounds mastered percentage (2 of 3 → 67)', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'mastered' }),
            makeConcept({ slug: 'c', status: 'unexplored' }),
          ]),
        ]),
      );
      expect(stats.overallPct).toBe(67);
    });

    it('rounds down (1 of 7 → 14)', () => {
      const concepts = [
        makeConcept({ slug: 'm', status: 'mastered' }),
        ...Array.from({ length: 6 }, (_, i) =>
          makeConcept({ slug: `u${i}`, status: 'unexplored' }),
        ),
      ];
      const stats = computeTopicStats(makeState('t', [makeDomain('d', concepts)]));
      expect(stats.overallPct).toBe(14);
    });

    it('is 100 when every concept is mastered', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'mastered' }),
          ]),
        ]),
      );
      expect(stats.overallPct).toBe(100);
    });

    it('is 0 with no mastered concepts and avoids division by zero', () => {
      const stats = computeTopicStats(
        makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', status: 'unexplored' })])]),
      );
      expect(stats.overallPct).toBe(0);
    });
  });

  describe('perDomain', () => {
    it('tracks each domain separately with its own status counts', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('core', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'in_progress' }),
          ]),
          makeDomain('advanced', [
            makeConcept({ slug: 'c', status: 'needs_practice' }),
            makeConcept({ slug: 'd', status: 'unexplored' }),
            makeConcept({ slug: 'e', status: 'unexplored' }),
          ]),
        ]),
      );
      expect(stats.perDomain).toEqual([
        {
          name: 'core',
          slug: 'core',
          mastered: 1,
          inProgress: 1,
          needsPractice: 0,
          unexplored: 0,
          total: 2,
          pct: 50,
        },
        {
          name: 'advanced',
          slug: 'advanced',
          mastered: 0,
          inProgress: 0,
          needsPractice: 1,
          unexplored: 2,
          total: 3,
          pct: 0,
        },
      ]);
    });

    it('rounds per-domain pct independently of the topic total', () => {
      // domain: 2/3 mastered → 67%; topic total also 2/3 → 67 (coincidentally equal)
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'mastered' }),
            makeConcept({ slug: 'c', status: 'unexplored' }),
          ]),
        ]),
      );
      expect(stats.perDomain[0].pct).toBe(67);
      expect(stats.overallPct).toBe(67);
    });

    it('keeps a domain with all concepts mastered at 100 while topic is lower', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('done', [
            makeConcept({ slug: 'a', status: 'mastered' }),
            makeConcept({ slug: 'b', status: 'mastered' }),
          ]),
          makeDomain('todo', [makeConcept({ slug: 'c', status: 'unexplored' })]),
        ]),
      );
      expect(stats.perDomain[0].pct).toBe(100);
      expect(stats.perDomain[1].pct).toBe(0);
      expect(stats.overallPct).toBe(67);
    });

    it('preserves domain order from the state', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('zeta', [makeConcept({ slug: 'a' })]),
          makeDomain('alpha', [makeConcept({ slug: 'b' })]),
          makeDomain('mid', [makeConcept({ slug: 'c' })]),
        ]),
      );
      expect(stats.perDomain.map((d) => d.slug)).toEqual(['zeta', 'alpha', 'mid']);
    });
  });

  describe('activity sums', () => {
    it('sums practice_count and explain_count across all concepts', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', practice_count: 5, explain_count: 2 }),
            makeConcept({ slug: 'b', practice_count: 3, explain_count: 7 }),
            makeConcept({ slug: 'c', practice_count: 0, explain_count: 1 }),
          ]),
        ]),
      );
      expect(stats.totalPractice).toBe(8);
      expect(stats.totalExplain).toBe(10);
    });
  });

  describe('lastActivityDays', () => {
    it('is null when no concept has any timestamps', () => {
      const stats = computeTopicStats(
        makeState('t', [makeDomain('d', [makeConcept({ slug: 'a' })])]),
      );
      expect(stats.lastActivityDays).toBeNull();
    });

    it('reports the most recent activity (minimum days across concepts)', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', last_practiced: ts(5) }),
            makeConcept({ slug: 'b', last_explained: ts(2) }),
          ]),
        ]),
      );
      expect(stats.lastActivityDays).toBe(2);
    });

    it('falls back to last_explained when last_practiced is null', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', last_practiced: null, last_explained: ts(3) }),
          ]),
        ]),
      );
      expect(stats.lastActivityDays).toBe(3);
    });

    it('picks the more recent of practiced vs explained within one concept', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', last_practiced: ts(10), last_explained: ts(4) }),
          ]),
        ]),
      );
      expect(stats.lastActivityDays).toBe(4);
    });

    it('is 0 for activity today', () => {
      const stats = computeTopicStats(
        makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', last_practiced: ts(0) })])]),
      );
      expect(stats.lastActivityDays).toBe(0);
    });

    it('picks the most recent activity across multiple domains', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d1', [makeConcept({ slug: 'a', last_practiced: ts(6) })]),
          makeDomain('d2', [makeConcept({ slug: 'b', last_practiced: ts(1) })]),
        ]),
      );
      expect(stats.lastActivityDays).toBe(1);
    });

    it('ignores invalid date strings and falls back to a valid one', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', last_practiced: 'not-a-date', last_explained: ts(7) }),
          ]),
        ]),
      );
      expect(stats.lastActivityDays).toBe(7);
    });

    it('is null when every timestamp is invalid or null', () => {
      const stats = computeTopicStats(
        makeState('t', [
          makeDomain('d', [
            makeConcept({ slug: 'a', last_practiced: 'bad', last_explained: 'also-bad' }),
            makeConcept({ slug: 'b' }),
          ]),
        ]),
      );
      expect(stats.lastActivityDays).toBeNull();
    });
  });

  describe('combined snapshot', () => {
    it('aggregates a realistic multi-domain dataset correctly', () => {
      const stats = computeTopicStats(
        makeState('rust', [
          makeDomain('ownership', [
            makeConcept({
              slug: 'borrow',
              status: 'mastered',
              practice_count: 4,
              explain_count: 2,
              last_practiced: ts(1),
            }),
            makeConcept({
              slug: 'lifetimes',
              status: 'in_progress',
              practice_count: 1,
              explain_count: 3,
              last_practiced: ts(3),
            }),
          ]),
          makeDomain('concurrency', [
            makeConcept({
              slug: 'async',
              status: 'needs_practice',
              practice_count: 2,
              explain_count: 0,
              last_explained: ts(8),
            }),
            makeConcept({ slug: 'channels', status: 'unexplored' }),
          ]),
        ]),
      );

      expect(stats).toEqual({
        mastered: 1,
        inProgress: 1,
        needsPractice: 1,
        unexplored: 1,
        totalConcepts: 4,
        overallPct: 25,
        perDomain: [
          {
            name: 'ownership',
            slug: 'ownership',
            mastered: 1,
            inProgress: 1,
            needsPractice: 0,
            unexplored: 0,
            total: 2,
            pct: 50,
          },
          {
            name: 'concurrency',
            slug: 'concurrency',
            mastered: 0,
            inProgress: 0,
            needsPractice: 1,
            unexplored: 1,
            total: 2,
            pct: 0,
          },
        ],
        totalPractice: 7,
        totalExplain: 5,
        lastActivityDays: 1,
      });
    });
  });
});
