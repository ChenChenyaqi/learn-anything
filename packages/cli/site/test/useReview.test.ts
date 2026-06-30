import { describe, it, expect } from 'vitest';
import { computeReviewPriority } from '@/components/review/useReview';
import type { Concept, TopicSummary } from '@/composables/useTopicData';

const NOW = new Date('2026-06-29T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function ts(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

const TOPIC: TopicSummary = {
  slug: 'javascript',
  name: 'JavaScript',
  domainCount: 6,
  totalConcepts: 24,
  masteredCount: 5,
  percentage: 21,
};

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    name: 'Test Concept',
    slug: 'test-concept',
    status: 'in_progress',
    confidence: 0.5,
    practice_count: 0,
    explain_count: 0,
    last_explained: null,
    last_practiced: null,
    details: [],
    ...overrides,
  };
}

describe('computeReviewPriority', () => {
  it('returns null for completely untouched concepts', () => {
    const c = makeConcept({ status: 'unexplored', confidence: 0 });
    expect(computeReviewPriority(c, TOPIC, 'Domain', NOW)).toBeNull();
  });

  it('returns never_practiced for studied-but-not-practiced concepts', () => {
    const c = makeConcept({
      explain_count: 2,
      practice_count: 0,
      last_explained: ts(3),
      confidence: 0.6,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('never_practiced');
    expect(result!.priority).toBeGreaterThan(100);
  });

  it('returns needs_practice for concepts with needs_practice status', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 2,
      last_practiced: ts(5),
      confidence: 0.4,
      status: 'needs_practice',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('needs_practice');
  });

  it('returns low_confidence for concepts with confidence < 0.5', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 1,
      last_practiced: ts(2),
      confidence: 0.3,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('low_confidence');
  });

  it('returns stale for concepts inactive > 7 days', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 1,
      last_practiced: ts(12),
      confidence: 0.7,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('stale');
  });

  it('returns null for recently-active, decent-confidence concepts', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 2,
      last_practiced: ts(3),
      confidence: 0.7,
      status: 'in_progress',
    });
    expect(computeReviewPriority(c, TOPIC, 'Domain', NOW)).toBeNull();
  });

  it('returns null for mastered + high confidence + recent', () => {
    const c = makeConcept({
      explain_count: 2,
      practice_count: 3,
      last_practiced: ts(2),
      confidence: 0.9,
      status: 'mastered',
    });
    expect(computeReviewPriority(c, TOPIC, 'Domain', NOW)).toBeNull();
  });

  it('shows stale mastered concepts (but at low priority)', () => {
    const c = makeConcept({
      explain_count: 2,
      practice_count: 3,
      last_practiced: ts(20),
      confidence: 0.9,
      status: 'mastered',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('stale');
    expect(result!.priority).toBeLessThan(5);
  });

  it('never_practiced has higher priority than needs_practice', () => {
    const neverPracticed = computeReviewPriority(
      makeConcept({
        explain_count: 3,
        practice_count: 0,
        last_explained: ts(1),
        confidence: 0.7,
        status: 'in_progress',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    const needsPractice = computeReviewPriority(
      makeConcept({
        explain_count: 1,
        practice_count: 2,
        last_practiced: ts(1),
        confidence: 0.3,
        status: 'needs_practice',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    expect(neverPracticed!.priority).toBeGreaterThan(needsPractice!.priority);
  });

  it('lower confidence yields higher priority (same status and days)', () => {
    const lowConf = computeReviewPriority(
      makeConcept({
        explain_count: 1,
        practice_count: 1,
        last_practiced: ts(10),
        confidence: 0.2,
        status: 'in_progress',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    const highConf = computeReviewPriority(
      makeConcept({
        explain_count: 1,
        practice_count: 1,
        last_practiced: ts(10),
        confidence: 0.8,
        status: 'in_progress',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    expect(lowConf!.priority).toBeGreaterThan(highConf!.priority);
  });

  it('more days since activity yields higher priority', () => {
    const oldItem = computeReviewPriority(
      makeConcept({
        explain_count: 1,
        practice_count: 1,
        last_practiced: ts(30),
        confidence: 0.3,
        status: 'needs_practice',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    const recentItem = computeReviewPriority(
      makeConcept({
        explain_count: 1,
        practice_count: 1,
        last_practiced: ts(2),
        confidence: 0.3,
        status: 'needs_practice',
      }),
      TOPIC,
      'Domain',
      NOW,
    );
    expect(oldItem!.priority).toBeGreaterThan(recentItem!.priority);
  });

  it('correctly maps all concept fields to ReviewItem', () => {
    const c = makeConcept({
      name: 'Closures',
      slug: 'closures',
      explain_count: 2,
      practice_count: 0,
      last_explained: ts(5),
      confidence: 0.4,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Functions', NOW);
    expect(result).toEqual({
      topicSlug: 'javascript',
      topicName: 'JavaScript',
      domainName: 'Functions',
      conceptName: 'Closures',
      conceptSlug: 'closures',
      reason: 'never_practiced',
      confidence: 0.4,
      practiceCount: 0,
      explainCount: 2,
      daysSinceActivity: 5,
      priority: expect.any(Number),
    });
  });

  it('uses last_explained when last_practiced is null', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 0,
      last_explained: ts(7),
      last_practiced: null,
      confidence: 0.6,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.daysSinceActivity).toBe(7);
  });

  it('handles missing timestamps gracefully', () => {
    const c = makeConcept({
      explain_count: 1,
      practice_count: 0,
      last_explained: null,
      last_practiced: null,
      confidence: 0.5,
      status: 'in_progress',
    });
    const result = computeReviewPriority(c, TOPIC, 'Domain', NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('never_practiced');
    expect(result!.daysSinceActivity).toBe(365);
  });
});
