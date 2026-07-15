import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error The published server runtime is intentionally plain ESM.
import {
  TopicCatalogStore,
  buildTopicCatalog,
  ensureCatalogIgnore,
  isValidCatalog,
  writeTopicCatalog,
} from '../catalog.mjs';

const roots: string[] = [];

function makeTopic() {
  const root = join(tmpdir(), `learn-anything-catalog-${process.pid}-${roots.length}`);
  roots.push(root);
  const topic = join(root, '.learn', 'topics', 'frontend');
  mkdirSync(topic, { recursive: true });
  writeFileSync(
    join(topic, 'state.json'),
    JSON.stringify({
      version: 1,
      topic: 'Frontend',
      slug: 'frontend',
      created: '2026-07-15',
      domains: [
        {
          name: 'CSS',
          slug: 'css',
          concepts: [{ name: 'Box model', slug: 'box-model' }],
        },
      ],
    }),
  );
  return { root, topic, topics: join(root, '.learn', 'topics') };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('topic catalog', () => {
  it('discovers legacy and domain-nested files recursively', () => {
    const { topic } = makeTopic();
    mkdirSync(join(topic, 'sessions', 'css'), { recursive: true });
    mkdirSync(join(topic, 'exercises', 'css', 'box-model', 'challenge'), { recursive: true });
    mkdirSync(join(topic, 'exercises', 'box-model'), { recursive: true });
    mkdirSync(join(topic, 'quizzes', 'css', 'box-model'), { recursive: true });
    writeFileSync(join(topic, 'sessions', 'css', 'note.md'), '# Note');
    writeFileSync(
      join(topic, 'exercises', 'css', 'box-model', 'challenge', 'README.md'),
      '# Exercise',
    );
    writeFileSync(join(topic, 'exercises', 'box-model', 'starter.js'), '// TODO');
    writeFileSync(join(topic, 'quizzes', 'css', 'box-model', 'quiz.json'), '{}');

    expect(buildTopicCatalog(topic).entries).toEqual([
      {
        path: 'exercises/box-model/starter.js',
        kind: 'exercise',
        domainSlug: 'css',
        conceptSlug: 'box-model',
      },
      {
        path: 'exercises/css/box-model/challenge/README.md',
        kind: 'exercise',
        domainSlug: 'css',
        conceptSlug: 'box-model',
      },
      {
        path: 'quizzes/css/box-model/quiz.json',
        kind: 'quiz',
        domainSlug: 'css',
        conceptSlug: 'box-model',
      },
      { path: 'sessions/css/note.md', kind: 'session', domainSlug: 'css' },
    ]);
  });

  it('skips hidden, excluded, symlink, binary, and unsupported files', () => {
    const { topic } = makeTopic();
    mkdirSync(join(topic, 'sessions', 'css', '.hidden'), { recursive: true });
    mkdirSync(join(topic, 'exercises', 'node_modules'), { recursive: true });
    mkdirSync(join(topic, 'quizzes', 'box-model'), { recursive: true });
    writeFileSync(join(topic, 'sessions', 'css', '.hidden', 'note.md'), 'hidden');
    writeFileSync(join(topic, 'sessions', 'css', 'note.txt'), 'unsupported');
    writeFileSync(join(topic, 'exercises', 'node_modules', 'index.js'), 'ignored');
    writeFileSync(join(topic, 'exercises', 'binary.bin'), Buffer.from([0, 1, 2]));
    writeFileSync(join(topic, 'quizzes', 'box-model', 'notes.md'), 'unsupported');

    expect(buildTopicCatalog(topic).entries).toEqual([]);
  });

  it('persists a per-topic catalog and preserves the central ignore file', () => {
    const { root, topic, topics } = makeTopic();
    const ignore = join(root, '.learn', '.gitignore');
    writeFileSync(ignore, 'node_modules/\n');
    expect(ensureCatalogIgnore(topics)).toBe(true);
    expect(ensureCatalogIgnore(topics)).toBe(false);
    expect(readFileSync(ignore, 'utf8')).toBe('node_modules/\ntopics/*/catalog.json\n');

    const catalog = buildTopicCatalog(topic);
    expect(writeTopicCatalog(topic, catalog)).toBe(true);
    expect(writeTopicCatalog(topic, catalog)).toBe(false);
    expect(isValidCatalog(JSON.parse(readFileSync(join(topic, 'catalog.json'), 'utf8')))).toBe(
      true,
    );
  });

  it('reconciles malformed catalogs and isolates topic caches', () => {
    const { topic, topics } = makeTopic();
    writeFileSync(join(topic, 'catalog.json'), '{broken');
    const store = new TopicCatalogStore(topics);
    store.reconcileAll();

    expect(store.get('frontend')).toEqual({ version: 1, entries: [] });
    expect(existsSync(join(topic, 'catalog.json'))).toBe(true);
    expect(isValidCatalog(JSON.parse(readFileSync(join(topic, 'catalog.json'), 'utf8')))).toBe(
      true,
    );
  });
});
