import { describe, it, expect } from 'vitest';
import { validateStateV1, stateV1Schema } from '../../../src/core/learn-protocol/schema.js';
import type { StateV1 } from '../../../src/core/learn-protocol/types.js';

// ── Helper: a fully valid StateV1 object ──────────────────────────────

function validStateV1(overrides?: Partial<StateV1>): StateV1 {
  return {
    version: 1,
    topic: 'JavaScript',
    slug: 'javascript',
    created: '2026-01-15',
    domains: [
      {
        name: 'Functions',
        slug: 'functions',
        concepts: [
          {
            name: 'Closures',
            slug: 'closures',
            status: 'in_progress',
            confidence: 0.5,
            practice_count: 3,
            explain_count: 2,
            last_explained: '2026-01-20 14:30:00',
            last_practiced: '2026-01-22',
            details: ['Lexical scope', 'Variable capture'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ── validateStateV1 ───────────────────────────────────────────────────

describe('validateStateV1', () => {
  it('should accept a fully valid StateV1 object', () => {
    const result = validateStateV1(validStateV1());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      expect(result.data.topic).toBe('JavaScript');
      expect(result.data.domains).toHaveLength(1);
    }
  });

  it('should accept state with datetime format (YYYY-MM-DD HH:mm:ss)', () => {
    const state = validStateV1({ created: '2026-03-15 09:30:00' });
    const result = validateStateV1(state);
    expect(result.success).toBe(true);
  });

  it('should accept state with date-only format (YYYY-MM-DD)', () => {
    const state = validStateV1({ created: '2026-03-15' });
    const result = validateStateV1(state);
    expect(result.success).toBe(true);
  });

  it('should accept state with null datetime fields', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Functions',
          slug: 'functions',
          concepts: [
            {
              name: 'Closures',
              slug: 'closures',
              status: 'unexplored',
              confidence: 0,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(true);
  });

  it('should accept all four valid status values', () => {
    const statuses = ['unexplored', 'in_progress', 'needs_practice', 'mastered'] as const;
    for (const status of statuses) {
      const state = validStateV1({
        domains: [
          {
            name: 'Test',
            slug: 'test',
            concepts: [
              {
                name: 'Concept',
                slug: 'concept',
                status,
                confidence: 0.5,
                practice_count: 0,
                explain_count: 0,
                last_explained: null,
                last_practiced: null,
                details: [],
              },
            ],
          },
        ],
      });
      const result = validateStateV1(state);
      expect(result.success).toBe(true);
    }
  });

  it('should accept confidence at boundaries (0 and 1)', () => {
    for (const confidence of [0, 1]) {
      const state = validStateV1({
        domains: [
          {
            name: 'Test',
            slug: 'test',
            concepts: [
              {
                name: 'Concept',
                slug: 'concept',
                status: 'unexplored',
                confidence,
                practice_count: 0,
                explain_count: 0,
                last_explained: null,
                last_practiced: null,
                details: [],
              },
            ],
          },
        ],
      });
      const result = validateStateV1(state);
      expect(result.success).toBe(true);
    }
  });

  it('should accept empty domains array', () => {
    const state = validStateV1({ domains: [] });
    const result = validateStateV1(state);
    expect(result.success).toBe(true);
  });

  it('should accept empty details array', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: 0,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(true);
  });
});

// ── Invalid data ──────────────────────────────────────────────────────

describe('validateStateV1 (invalid data)', () => {
  it('should reject non-object input', () => {
    expect(validateStateV1(null).success).toBe(false);
    expect(validateStateV1('string').success).toBe(false);
    expect(validateStateV1(42).success).toBe(false);
    expect(validateStateV1(undefined).success).toBe(false);
  });

  it('should reject wrong version', () => {
    const state = validStateV1({ version: 2 as unknown as 1 });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path.join('.').includes('version'))).toBe(true);
    }
  });

  it('should reject missing version', () => {
    const { version, ...noVersion } = validStateV1();
    void version;
    const result = validateStateV1(noVersion);
    expect(result.success).toBe(false);
  });

  it('should reject empty topic string', () => {
    const state = validStateV1({ topic: '' });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject empty slug string', () => {
    const state = validStateV1({ slug: '' });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format', () => {
    const state = validStateV1({ created: '2026/01/15' });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject invalid status value', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unknown' as unknown as 'unexplored',
              confidence: 0.5,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject confidence below 0', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: -0.1,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject confidence above 1', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: 1.5,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject negative practice_count', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: 0,
              practice_count: -1,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject negative explain_count', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: 0,
              practice_count: 0,
              explain_count: -1,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject float practice_count', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: 'Concept',
              slug: 'concept',
              status: 'unexplored',
              confidence: 0,
              practice_count: 1.5,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject empty concept name', () => {
    const state = validStateV1({
      domains: [
        {
          name: 'Test',
          slug: 'test',
          concepts: [
            {
              name: '',
              slug: 'concept',
              status: 'unexplored',
              confidence: 0,
              practice_count: 0,
              explain_count: 0,
              last_explained: null,
              last_practiced: null,
              details: [],
            },
          ],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should reject empty domain name', () => {
    const state = validStateV1({
      domains: [
        {
          name: '',
          slug: 'test',
          concepts: [],
        },
      ],
    });
    const result = validateStateV1(state);
    expect(result.success).toBe(false);
  });

  it('should return error details when validation fails', () => {
    const result = validateStateV1({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have path information
      expect(result.errors[0].path).toBeDefined();
      expect(result.errors[0].message).toBeTruthy();
    }
  });
});

// ── stateV1Schema (direct Zod parse) ──────────────────────────────────

describe('stateV1Schema', () => {
  it('should parse valid data via safeParse', () => {
    const result = stateV1Schema.safeParse(validStateV1());
    expect(result.success).toBe(true);
  });

  it('should strip unknown fields by default', () => {
    const state = { ...validStateV1(), extraField: 'should be removed' };
    const result = stateV1Schema.safeParse(state);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)['extraField']).toBeUndefined();
    }
  });
});
