import { describe, expect, it } from 'vitest';
import {
  buildTopicTree,
  ROOT_CLUSTER_SLUG,
  type ClusterNode,
} from '@/components/workspace/topicTree';
import type { TopicData } from '@/lib/commands';

/** Minimal TopicData builder — only the fields buildTopicTree reads. */
function data(partial: Partial<TopicData> = {}): TopicData {
  return {
    state: { version: 1, topic: 'T', slug: 't', created: '', domains: [] },
    knowledgeMap: '',
    ...partial,
  } as TopicData;
}

const md = (filename: string, path?: string) => ({ filename, path: path ?? `/p/${filename}` });
const ex = (name: string, path?: string) => ({ name, path: path ?? `/p/${name}` });

const names = (c: ClusterNode) => c.sessions.map((s) => s.filename);
const exNames = (c: ClusterNode) => c.exercises.map((e) => e.name);

describe('buildTopicTree', () => {
  it('returns [] for a null payload', () => {
    expect(buildTopicTree(null)).toEqual([]);
  });

  it('emits one cluster per declared domain in state.json order', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'Rust',
          slug: 'rust',
          created: '',
          domains: [
            { name: 'Basics', slug: 'basics', concepts: [] },
            { name: 'Traits', slug: 'traits', concepts: [] },
          ],
        },
      }),
    );
    expect(tree.map((c) => c.name)).toEqual(['Basics', 'Traits']);
    expect(tree.map((c) => c.isOrphan)).toEqual([false, false]);
  });

  it('counts mastered concepts per domain', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [
            {
              name: 'Basics',
              slug: 'basics',
              concepts: [
                {
                  name: 'a',
                  slug: 'a',
                  status: 'mastered',
                  confidence: 0.9,
                  practice_count: 0,
                  explain_count: 0,
                  last_explained: null,
                  last_practiced: null,
                  details: [],
                },
                {
                  name: 'b',
                  slug: 'b',
                  status: 'unexplored',
                  confidence: 0,
                  practice_count: 0,
                  explain_count: 0,
                  last_explained: null,
                  last_practiced: null,
                  details: [],
                },
                {
                  name: 'c',
                  slug: 'c',
                  status: 'mastered',
                  confidence: 1,
                  practice_count: 0,
                  explain_count: 0,
                  last_explained: null,
                  last_practiced: null,
                  details: [],
                },
              ],
            },
          ],
        },
      }),
    );
    expect(tree[0].mastered).toBe(2);
    expect(tree[0].total).toBe(3);
  });

  it('matches sessions to a domain by the directory (= domain slug)', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Basics', slug: 'basics', concepts: [] }],
        },
        sessions: { basics: [md('lifetimes.md'), md('borrow.md')] },
      }),
    );
    expect(tree).toHaveLength(1);
    expect(names(tree[0])).toEqual(['lifetimes.md', 'borrow.md']);
  });

  it('routes exercises back to the domain that owns the concept', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [
            {
              name: 'Basics',
              slug: 'basics',
              concepts: [
                {
                  name: 'Lifetimes',
                  slug: 'lifetimes',
                  status: 'mastered',
                  confidence: 1,
                  practice_count: 0,
                  explain_count: 0,
                  last_explained: null,
                  last_practiced: null,
                  details: [],
                },
              ],
            },
            {
              name: 'Async',
              slug: 'async',
              concepts: [
                {
                  name: 'Futures',
                  slug: 'futures',
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
        },
        exercises: [
          { conceptSlug: 'lifetimes', conceptName: 'Lifetimes', files: [ex('longest.rs')] },
          { conceptSlug: 'futures', conceptName: 'Futures', files: [ex('spawn.rs'), ex('pin.rs')] },
        ],
      }),
    );
    expect(exNames(tree[0])).toEqual(['longest.rs']);
    expect(exNames(tree[1])).toEqual(['spawn.rs', 'pin.rs']);
  });

  it('surfaces orphan session dirs as their own cluster', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Basics', slug: 'basics', concepts: [] }],
        },
        sessions: {
          basics: [md('a.md')],
          stray: [md('b.md')], // no domain named 'stray'
        },
      }),
    );
    expect(tree.map((c) => c.name)).toEqual(['Basics', 'stray']);
    expect(tree[1].isOrphan).toBe(true);
    expect(tree[1].slug).toBe('s:stray');
    expect(names(tree[1])).toEqual(['b.md']);
  });

  it('surfaces orphan exercise concepts as their own cluster', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Basics', slug: 'basics', concepts: [] }],
        },
        exercises: [{ conceptSlug: 'mystery', conceptName: 'Mystery', files: [ex('e.rs')] }],
      }),
    );
    expect(tree).toHaveLength(2);
    expect(tree[1].name).toBe('Mystery');
    expect(tree[1].slug).toBe('x:mystery');
    expect(tree[1].isOrphan).toBe(true);
    expect(exNames(tree[1])).toEqual(['e.rs']);
  });

  it('collects top-level root files into a trailing cluster', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Basics', slug: 'basics', concepts: [] }],
        },
        rootSessions: [md('intro.md')],
        rootExercises: [ex('scratch.rs')],
      }),
    );
    const root = tree[tree.length - 1];
    expect(root.slug).toBe(ROOT_CLUSTER_SLUG);
    expect(root.name).toBe('其他');
    expect(names(root)).toEqual(['intro.md']);
    expect(exNames(root)).toEqual(['scratch.rs']);
  });

  it('omits the trailing root cluster when there are no root files', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Basics', slug: 'basics', concepts: [] }],
        },
      }),
    );
    expect(tree[tree.length - 1].slug).not.toBe(ROOT_CLUSTER_SLUG);
  });

  it('keeps cluster slugs unique across orphans and domains', () => {
    // A domain, an orphan session dir, and an orphan exercise concept that all
    // share the raw token "dup" must not collide.
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Dup', slug: 'dup', concepts: [] }],
        },
        sessions: { dup: [md('s.md')], extra: [] },
        exercises: [{ conceptSlug: 'dup', conceptName: 'Dup', files: [ex('e.rs')] }],
      }),
    );
    const slugs = tree.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('a domain with no matching sessions/exercises still appears empty', () => {
    const tree = buildTopicTree(
      data({
        state: {
          version: 1,
          topic: 'T',
          slug: 't',
          created: '',
          domains: [{ name: 'Traits', slug: 'traits', concepts: [] }],
        },
      }),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].sessions).toEqual([]);
    expect(tree[0].exercises).toEqual([]);
  });
});
