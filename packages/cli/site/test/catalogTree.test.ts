import { describe, expect, it } from 'vitest';
import { buildCatalogTree, collectCatalogFiles } from '@/components/sidebar/catalogTree';
import type { StateV1, TopicCatalog } from '@/composables/topicDataTypes';

const state: StateV1 = {
  version: 1,
  topic: 'Frontend',
  slug: 'frontend',
  created: '2026-07-15',
  domains: [
    {
      name: 'CSS',
      slug: 'css',
      concepts: [
        {
          name: 'Box Model',
          slug: 'box-model',
          status: 'in_progress',
          confidence: 0.5,
          practice_count: 1,
          explain_count: 1,
          last_explained: null,
          last_practiced: null,
          details: [],
        },
      ],
    },
  ],
};

describe('catalog tree', () => {
  it('reconstructs physical nesting and applies semantic labels', () => {
    const catalog: TopicCatalog = {
      version: 1,
      entries: [
        {
          path: 'exercises/css/box-model/challenge/README.md',
          kind: 'exercise',
          domainSlug: 'css',
          conceptSlug: 'box-model',
        },
      ],
    };

    const tree = buildCatalogTree(catalog, 'exercise', 'frontend', state);
    expect(tree[0]).toMatchObject({
      type: 'directory',
      name: 'css',
      label: 'CSS',
      isOrphan: false,
    });
    if (tree[0].type !== 'directory') throw new Error('expected directory');
    expect(tree[0].children[0]).toMatchObject({
      type: 'directory',
      name: 'box-model',
      label: 'Box Model',
      isOrphan: false,
    });
    expect(collectCatalogFiles(tree)[0]).toMatchObject({
      name: 'README.md',
      path: '/topics/frontend/exercises/css/box-model/challenge/README.md',
    });
  });

  it('keeps unmatched folders as physical orphan nodes', () => {
    const catalog: TopicCatalog = {
      version: 1,
      entries: [{ path: 'exercises/misc/warmup.js', kind: 'exercise' }],
    };
    const tree = buildCatalogTree(catalog, 'exercise', 'frontend', state);
    expect(tree[0]).toMatchObject({ name: 'misc', label: 'misc', isOrphan: true });
  });

  it('filters by tab kind and supports root files', () => {
    const catalog: TopicCatalog = {
      version: 1,
      entries: [
        { path: 'sessions/overview.md', kind: 'session' },
        { path: 'exercises/warmup.js', kind: 'exercise' },
      ],
    };
    const tree = buildCatalogTree(catalog, 'session', 'frontend', state);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ type: 'file', name: 'overview.md' });
  });
});
