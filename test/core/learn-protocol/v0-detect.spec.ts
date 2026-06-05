import { describe, it, expect } from 'vitest';
import { isV0State } from '../../../src/core/learn-protocol/migrate.js';

describe('isV0State', () => {
  // ── Valid v0 detection ────────────────────────────────────────────

  it('should detect valid v0 state with topic and concepts', () => {
    const v0 = {
      topic: 'JavaScript',
      created: '2026-01-01',
      concepts: [
        { path: 'Functions/Closures', status: 'unexplored', confidence: 0, practice_count: 0 },
      ],
    };
    expect(isV0State(v0)).toBe(true);
  });

  it('should detect v0 state with empty concepts array', () => {
    const v0 = {
      topic: 'Empty',
      created: '2026-01-01',
      concepts: [],
    };
    expect(isV0State(v0)).toBe(true);
  });

  it('should detect v0 state with extra fields (tolerant)', () => {
    const v0 = {
      topic: 'JavaScript',
      created: '2026-01-01',
      concepts: [],
      someExtraField: 'value',
    };
    expect(isV0State(v0)).toBe(true);
  });

  // ── v1 should NOT be detected as v0 ──────────────────────────────

  it('should reject v1 state (has version field)', () => {
    const v1 = {
      version: 1,
      topic: 'JavaScript',
      slug: 'javascript',
      created: '2026-01-01',
      domains: [],
    };
    expect(isV0State(v1)).toBe(false);
  });

  // ── Invalid / missing fields ─────────────────────────────────────

  it('should reject null', () => {
    expect(isV0State(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(isV0State(undefined)).toBe(false);
  });

  it('should reject non-object types', () => {
    expect(isV0State('string')).toBe(false);
    expect(isV0State(42)).toBe(false);
    expect(isV0State(true)).toBe(false);
  });

  it('should reject object with missing topic', () => {
    const data = {
      created: '2026-01-01',
      concepts: [],
    };
    expect(isV0State(data)).toBe(false);
  });

  it('should reject object with empty topic string', () => {
    const data = {
      topic: '',
      created: '2026-01-01',
      concepts: [],
    };
    expect(isV0State(data)).toBe(false);
  });

  it('should reject object with missing concepts', () => {
    const data = {
      topic: 'JavaScript',
      created: '2026-01-01',
    };
    expect(isV0State(data)).toBe(false);
  });

  it('should reject object with non-array concepts', () => {
    const data = {
      topic: 'JavaScript',
      created: '2026-01-01',
      concepts: 'not-an-array',
    };
    expect(isV0State(data)).toBe(false);
  });

  it('should reject object where concepts is an object (not array)', () => {
    const data = {
      topic: 'JavaScript',
      created: '2026-01-01',
      concepts: { 0: 'item' },
    };
    expect(isV0State(data)).toBe(false);
  });
});
