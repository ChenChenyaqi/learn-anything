import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { useDashboardStats } from '@/components/stats/useDashboardStats';
import { __resetForTest, __injectTestData } from '@/composables/useTopicData';
import type {
  Concept,
  Domain,
  StateV1,
  TopicSummary,
  SessionFile,
  ExerciseFile,
  ExerciseGroup,
} from '@/composables/useTopicData';

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

function makeSummary(slug: string, overrides: Partial<TopicSummary> = {}): TopicSummary {
  return {
    slug,
    name: slug,
    domainCount: 0,
    totalConcepts: 0,
    masteredCount: 0,
    percentage: 0,
    ...overrides,
  };
}

function sessionFile(filename: string): SessionFile {
  return { filename, path: `/sessions/${filename}` };
}

function exerciseFile(name: string): ExerciseFile {
  return { name, path: `/exercises/${name}` };
}

type InjectParts = {
  summaries?: TopicSummary[];
  states?: Record<string, StateV1>;
  sessions?: Record<string, Record<string, SessionFile[]>>;
  exerciseGroups?: Record<string, ExerciseGroup[]>;
  orphanSessions?: Record<string, SessionFile[]>;
  orphanExercises?: Record<string, ExerciseFile[]>;
};

/**
 * Reset, inject, and evaluate the computed once. A fresh `useDashboardStats()`
 * computed always re-evaluates on first `.value` access, so each call reads the
 * just-injected data (the module-level dataVersion ref is never bumped here).
 */
function evalStats(parts: InjectParts = {}) {
  __resetForTest();
  __injectTestData({
    summaries: parts.summaries ?? [],
    states: parts.states ?? {},
    knowledgeMaps: {},
    sessions: parts.sessions ?? {},
    exerciseGroups: parts.exerciseGroups ?? {},
    orphanSessions: parts.orphanSessions ?? [],
    orphanExercises: parts.orphanExercises ?? [],
    fileContents: {},
  });
  return useDashboardStats().value;
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

describe('useDashboardStats', () => {
  describe('empty state', () => {
    it('returns all-zero stats with null lastActivityDays when there are no topics', () => {
      expect(evalStats()).toEqual({
        topicCount: 0,
        domainCount: 0,
        totalConcepts: 0,
        mastered: 0,
        inProgress: 0,
        needsPractice: 0,
        unexplored: 0,
        overallPct: 0,
        totalPractice: 0,
        totalExplain: 0,
        noteCount: 0,
        exerciseCount: 0,
        lastActivityDays: null,
      });
    });
  });

  describe('concept counting', () => {
    it('maps each ConceptStatus to its own counter', () => {
      const stats = evalStats({
        summaries: [makeSummary('t', { totalConcepts: 4 })],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', status: 'mastered' }),
              makeConcept({ slug: 'b', status: 'in_progress' }),
              makeConcept({ slug: 'c', status: 'needs_practice' }),
              makeConcept({ slug: 'e', status: 'unexplored' }),
            ]),
          ]),
        },
      });
      expect(stats.totalConcepts).toBe(4);
      expect(stats.mastered).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.needsPractice).toBe(1);
      expect(stats.unexplored).toBe(1);
    });

    it('counts concepts across multiple topics and domains', () => {
      const stats = evalStats({
        summaries: [makeSummary('t1'), makeSummary('t2')],
        states: {
          t1: makeState('t1', [
            makeDomain('d', [
              makeConcept({ slug: 'a', status: 'mastered' }),
              makeConcept({ slug: 'b', status: 'mastered' }),
              makeConcept({ slug: 'c', status: 'unexplored' }),
            ]),
          ]),
          t2: makeState('t2', [
            makeDomain('d', [makeConcept({ slug: 'e', status: 'in_progress' })]),
          ]),
        },
      });
      expect(stats.topicCount).toBe(2);
      expect(stats.totalConcepts).toBe(4);
      expect(stats.mastered).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.unexplored).toBe(1);
    });

    it('skips concept counting when loadTopic returns null (state missing)', () => {
      const stats = evalStats({
        summaries: [makeSummary('ghost', { domainCount: 3 })],
        states: {},
      });
      expect(stats.topicCount).toBe(1);
      expect(stats.totalConcepts).toBe(0);
      expect(stats.mastered).toBe(0);
      expect(stats.domainCount).toBe(3);
    });
  });

  describe('overallPct', () => {
    it('rounds mastered percentage (2 of 3 → 67)', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', status: 'mastered' }),
              makeConcept({ slug: 'b', status: 'mastered' }),
              makeConcept({ slug: 'c', status: 'unexplored' }),
            ]),
          ]),
        },
      });
      expect(stats.overallPct).toBe(67);
    });

    it('rounds down (1 of 7 → 14)', () => {
      const concepts = [
        makeConcept({ slug: 'm', status: 'mastered' }),
        ...Array.from({ length: 6 }, (_, i) =>
          makeConcept({ slug: `u${i}`, status: 'unexplored' }),
        ),
      ];
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: { t: makeState('t', [makeDomain('d', concepts)]) },
      });
      expect(stats.overallPct).toBe(14);
    });

    it('is 100 when every concept is mastered', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', status: 'mastered' }),
              makeConcept({ slug: 'b', status: 'mastered' }),
            ]),
          ]),
        },
      });
      expect(stats.overallPct).toBe(100);
    });

    it('is 0 with no mastered concepts and avoids division by zero', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', status: 'unexplored' })])]),
        },
      });
      expect(stats.overallPct).toBe(0);
    });
  });

  describe('activity sums', () => {
    it('sums practice_count and explain_count across all concepts', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', practice_count: 5, explain_count: 2 }),
              makeConcept({ slug: 'b', practice_count: 3, explain_count: 7 }),
              makeConcept({ slug: 'c', practice_count: 0, explain_count: 1 }),
            ]),
          ]),
        },
      });
      expect(stats.totalPractice).toBe(8);
      expect(stats.totalExplain).toBe(10);
    });
  });

  describe('domainCount', () => {
    it('sums domainCount from each topic summary, not from the state', () => {
      const stats = evalStats({
        summaries: [makeSummary('t1', { domainCount: 3 }), makeSummary('t2', { domainCount: 4 })],
        states: {
          // intentionally fewer domains in state than in the summary
          t1: makeState('t1', [makeDomain('only', [])]),
        },
      });
      expect(stats.domainCount).toBe(7);
    });
  });

  describe('noteCount', () => {
    it('counts session files across domain dirs and orphans', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        sessions: {
          t: {
            'domain-a': [sessionFile('a1.md'), sessionFile('a2.md')],
            'domain-b': [sessionFile('b1.md')],
          },
        },
        orphanSessions: { t: [sessionFile('overview.md')] },
      });
      expect(stats.noteCount).toBe(4);
    });

    it('is 0 when a topic has no sessions', () => {
      expect(evalStats({ summaries: [makeSummary('t')] }).noteCount).toBe(0);
    });

    it('counts only orphan sessions when there are no domain dirs', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        orphanSessions: { t: [sessionFile('o1.md'), sessionFile('o2.md')] },
      });
      expect(stats.noteCount).toBe(2);
    });
  });

  describe('exerciseCount', () => {
    it('counts exercise files across groups and orphans', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        exerciseGroups: {
          t: [
            {
              conceptSlug: 'c1',
              conceptName: 'C1',
              files: [exerciseFile('a.js'), exerciseFile('b.js')],
            },
            { conceptSlug: 'c2', conceptName: 'C2', files: [exerciseFile('c.js')] },
          ],
        },
        orphanExercises: { t: [exerciseFile('warmup.js')] },
      });
      expect(stats.exerciseCount).toBe(4);
    });

    it('is 0 when a topic has no exercises', () => {
      expect(evalStats({ summaries: [makeSummary('t')] }).exerciseCount).toBe(0);
    });
  });

  describe('lastActivityDays', () => {
    it('is null when no concept has any timestamps', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [makeDomain('d', [makeConcept({ slug: 'a' })])]),
        },
      });
      expect(stats.lastActivityDays).toBeNull();
    });

    it('reports the most recent activity (minimum days across concepts)', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', last_practiced: ts(5) }),
              makeConcept({ slug: 'b', last_explained: ts(2) }),
            ]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBe(2);
    });

    it('falls back to last_explained when last_practiced is null', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', last_practiced: null, last_explained: ts(3) }),
            ]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBe(3);
    });

    it('picks the more recent of practiced vs explained within one concept', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', last_practiced: ts(10), last_explained: ts(4) }),
            ]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBe(4);
    });

    it('is 0 for activity today', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', last_practiced: ts(0) })])]),
        },
      });
      expect(stats.lastActivityDays).toBe(0);
    });

    it('picks the most recent activity across multiple topics', () => {
      const stats = evalStats({
        summaries: [makeSummary('t1'), makeSummary('t2')],
        states: {
          t1: makeState('t1', [
            makeDomain('d', [makeConcept({ slug: 'a', last_practiced: ts(6) })]),
          ]),
          t2: makeState('t2', [
            makeDomain('d', [makeConcept({ slug: 'b', last_practiced: ts(1) })]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBe(1);
    });

    it('ignores invalid date strings and falls back to a valid one', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', last_practiced: 'not-a-date', last_explained: ts(7) }),
            ]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBe(7);
    });

    it('is null when every timestamp is invalid or null', () => {
      const stats = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [
            makeDomain('d', [
              makeConcept({ slug: 'a', last_practiced: 'bad', last_explained: 'also-bad' }),
              makeConcept({ slug: 'b' }),
            ]),
          ]),
        },
      });
      expect(stats.lastActivityDays).toBeNull();
    });
  });

  describe('re-evaluation', () => {
    it('a fresh computed reflects re-injected data', () => {
      const first = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', status: 'mastered' })])]),
        },
      });
      expect(first.mastered).toBe(1);
      expect(first.overallPct).toBe(100);

      const second = evalStats({
        summaries: [makeSummary('t')],
        states: {
          t: makeState('t', [makeDomain('d', [makeConcept({ slug: 'a', status: 'unexplored' })])]),
        },
      });
      expect(second.mastered).toBe(0);
      expect(second.overallPct).toBe(0);
    });
  });

  describe('combined snapshot', () => {
    it('aggregates a realistic multi-topic dataset correctly', () => {
      const stats = evalStats({
        summaries: [makeSummary('js', { domainCount: 2 }), makeSummary('rust', { domainCount: 1 })],
        states: {
          js: makeState('js', [
            makeDomain('core', [
              makeConcept({
                slug: 'm1',
                status: 'mastered',
                practice_count: 4,
                explain_count: 2,
                last_practiced: ts(1),
              }),
              makeConcept({
                slug: 'ip1',
                status: 'in_progress',
                practice_count: 1,
                explain_count: 3,
                last_practiced: ts(3),
              }),
            ]),
          ]),
          rust: makeState('rust', [
            makeDomain('core', [
              makeConcept({
                slug: 'np1',
                status: 'needs_practice',
                practice_count: 2,
                explain_count: 0,
                last_explained: ts(8),
              }),
              makeConcept({ slug: 'u1', status: 'unexplored' }),
            ]),
          ]),
        },
        sessions: { js: { core: [sessionFile('n1.md'), sessionFile('n2.md')] } },
        exerciseGroups: {
          rust: [
            {
              conceptSlug: 'np1',
              conceptName: 'NP1',
              files: [exerciseFile('e1.rs')],
            },
          ],
        },
        orphanSessions: { js: [sessionFile('overview.md')] },
        orphanExercises: { js: [exerciseFile('warmup.js')] },
      });

      expect(stats).toEqual({
        topicCount: 2,
        domainCount: 3,
        totalConcepts: 4,
        mastered: 1,
        inProgress: 1,
        needsPractice: 1,
        unexplored: 1,
        overallPct: 25,
        totalPractice: 7,
        totalExplain: 5,
        noteCount: 3,
        exerciseCount: 2,
        lastActivityDays: 1,
      });
    });
  });
});
