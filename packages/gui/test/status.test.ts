import { describe, expect, it } from 'vitest';
import { statusDot, statusSquare, statusLabel, domainMastery } from '@/lib/status';
import type { Concept, ConceptStatus, Domain } from '@/lib/commands';

function concept(status: ConceptStatus): Concept {
  return {
    name: 'x',
    slug: 'x',
    status,
    confidence: 0,
    practice_count: 0,
    explain_count: 0,
    last_explained: null,
    last_practiced: null,
    details: [],
  };
}

function domain(concepts: Concept[]): Domain {
  return { name: 'Basics', slug: 'basics', concepts };
}

describe('status visual mapping', () => {
  it('maps every status to its colour token', () => {
    const cases: Array<[ConceptStatus, string]> = [
      ['mastered', 'bg-(--color-mastered)'],
      ['in_progress', 'bg-(--color-progress)'],
      ['needs_practice', 'bg-(--color-accent)'],
      ['unexplored', 'bg-(--color-border)'],
    ];
    for (const [status, bg] of cases) {
      expect(statusDot(status)).toContain(bg);
      expect(statusSquare(status)).toContain(bg);
    }
  });

  it('statusDot carries the 7px dot shape', () => {
    expect(statusDot('mastered')).toContain('w-[7px]');
    expect(statusDot('mastered')).toContain('rounded-full');
  });

  it('statusSquare carries the 16px square shape', () => {
    expect(statusSquare('mastered')).toContain('w-4');
    expect(statusSquare('mastered')).toContain('rounded-[3px]');
  });

  it('statusLabel returns the human-readable phrase', () => {
    expect(statusLabel('mastered')).toBe('mastered');
    expect(statusLabel('in_progress')).toBe('in progress');
    expect(statusLabel('needs_practice')).toBe('needs practice');
    expect(statusLabel('unexplored')).toBe('unexplored');
  });
});

describe('domainMastery', () => {
  it('counts mastered concepts and rounds the percentage', () => {
    const d = domain([
      concept('mastered'),
      concept('mastered'),
      concept('in_progress'),
      concept('unexplored'),
    ]);
    expect(domainMastery(d)).toEqual({ mastered: 2, total: 4, pct: 50 });
  });

  it('handles a fully-mastered domain', () => {
    const d = domain([concept('mastered'), concept('mastered')]);
    expect(domainMastery(d)).toEqual({ mastered: 2, total: 2, pct: 100 });
  });

  it('handles an empty domain without dividing by zero', () => {
    const d = domain([]);
    expect(domainMastery(d)).toEqual({ mastered: 0, total: 0, pct: 0 });
  });

  it('rounds down partial percentages (1 of 3 → 33%)', () => {
    const d = domain([concept('mastered'), concept('in_progress'), concept('unexplored')]);
    expect(domainMastery(d).pct).toBe(33);
  });
});
