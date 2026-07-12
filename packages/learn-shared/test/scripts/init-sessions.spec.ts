import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSessions } from '../../src/scripts/init-sessions.mts';
import type { StateV1 } from '../../src/scripts/utils.mts';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpRoot = resolve(__dirname, '__tmp_init_sessions__');

interface Domain {
  name: string;
  slug: string;
  concepts: {
    name: string;
    slug: string;
    status: string;
    confidence: number;
    practice_count: number;
    explain_count: number;
    last_explained: string | null;
    last_practiced: string | null;
    details: string[];
  }[];
}

function makeState(topic: string, domains: Domain[]): StateV1 {
  return {
    version: 1,
    topic,
    slug: topic.toLowerCase().replace(/\s+/g, '-'),
    created: '2026-01-01',
    domains,
  };
}

function makeDomain(name: string, slug: string, conceptCount = 1): Domain {
  return {
    name,
    slug,
    concepts: Array.from({ length: conceptCount }, (_, i) => ({
      name: `${name} Concept ${i + 1}`,
      slug: `${slug}-concept-${i + 1}`,
      status: 'unexplored',
      confidence: 0,
      practice_count: 0,
      explain_count: 0,
      last_explained: null,
      last_practiced: null,
      details: [],
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('initSessions()', () => {
  beforeEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  // ── Basic creation ──────────────────────────────────────────────────

  it('should create domain subdirectories under sessions/', () => {
    const topicDir = join(tmpRoot, 'my-topic');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('My Topic', [
      makeDomain('Basics', 'basics'),
      makeDomain('Advanced', 'advanced'),
    ]);

    const created = initSessions(topicDir, state);

    expect(created).toBe(2);
    expect(existsSync(join(topicDir, 'sessions', 'basics'))).toBe(true);
    expect(existsSync(join(topicDir, 'sessions', 'advanced'))).toBe(true);
  });

  it('should create sessions/ parent directory if it does not exist', () => {
    const topicDir = join(tmpRoot, 'no-sessions');
    mkdirSync(topicDir, { recursive: true });
    // No sessions/ dir created beforehand

    const state = makeState('Test', [makeDomain('D', 'd')]);

    expect(existsSync(join(topicDir, 'sessions'))).toBe(false);
    initSessions(topicDir, state);
    expect(existsSync(join(topicDir, 'sessions'))).toBe(true);
    expect(existsSync(join(topicDir, 'sessions', 'd'))).toBe(true);
  });

  // ── Idempotency ─────────────────────────────────────────────────────

  it('should return 0 when all domain directories already exist', () => {
    const topicDir = join(tmpRoot, 'idempotent');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('Idempotent', [makeDomain('A', 'a'), makeDomain('B', 'b')]);

    // First run
    expect(initSessions(topicDir, state)).toBe(2);
    // Second run
    expect(initSessions(topicDir, state)).toBe(0);

    // Directories still exist
    expect(existsSync(join(topicDir, 'sessions', 'a'))).toBe(true);
    expect(existsSync(join(topicDir, 'sessions', 'b'))).toBe(true);
  });

  it('should only create new directories on partial re-run', () => {
    const topicDir = join(tmpRoot, 'partial');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('Partial', [makeDomain('X', 'x'), makeDomain('Y', 'y')]);

    // First run creates both
    expect(initSessions(topicDir, state)).toBe(2);

    // Manually remove one
    rmSync(join(topicDir, 'sessions', 'y'), { recursive: true });

    // Re-run should only recreate 'y'
    expect(initSessions(topicDir, state)).toBe(1);
  });

  // ── Empty / edge cases ──────────────────────────────────────────────

  it('should handle empty domains array (no subdirectories created)', () => {
    const topicDir = join(tmpRoot, 'empty');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('Empty', []);

    const created = initSessions(topicDir, state);
    expect(created).toBe(0);
    // sessions/ dir should still be created as parent
    expect(existsSync(join(topicDir, 'sessions'))).toBe(true);
  });

  it('should handle domains with no concepts', () => {
    const topicDir = join(tmpRoot, 'no-concepts');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('No Concepts', [
      { name: 'Empty Domain', slug: 'empty-domain', concepts: [] },
    ]);

    const created = initSessions(topicDir, state);
    expect(created).toBe(1);
    expect(existsSync(join(topicDir, 'sessions', 'empty-domain'))).toBe(true);
  });

  // ── Unicode slugs ───────────────────────────────────────────────────

  it('should handle Chinese slugs', () => {
    const topicDir = join(tmpRoot, 'chinese');
    mkdirSync(topicDir, { recursive: true });

    const state = makeState('Chinese', [
      makeDomain('语言基础', '语言基础'),
      makeDomain('函数与作用域', '函数与作用域'),
      makeDomain('es6-新特性', 'es6-新特性'),
    ]);

    const created = initSessions(topicDir, state);
    expect(created).toBe(3);
    expect(existsSync(join(topicDir, 'sessions', '语言基础'))).toBe(true);
    expect(existsSync(join(topicDir, 'sessions', '函数与作用域'))).toBe(true);
    expect(existsSync(join(topicDir, 'sessions', 'es6-新特性'))).toBe(true);
  });

  // ── Real fixture ────────────────────────────────────────────────────

  it('should create all 7 domain directories from real javascript fixture', () => {
    const fixtureDir = resolve(__dirname, 'fixtures', 'javascript');
    const state = JSON.parse(readFileSync(join(fixtureDir, 'state.json'), 'utf-8')) as StateV1;

    const topicDir = join(tmpRoot, 'javascript');
    mkdirSync(topicDir, { recursive: true });

    const created = initSessions(topicDir, state);
    expect(created).toBe(7);

    // Verify all expected domain slugs
    const slugs = state.domains.map((d) => d.slug);
    for (const slug of slugs) {
      expect(existsSync(join(topicDir, 'sessions', slug))).toBe(true);
    }
  });
});
