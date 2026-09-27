import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  listRegisteredTopics,
  registerPath,
  registerTopic,
  registryDir,
  unregisterTopic,
} from '../../src/scripts/topic-registry.mts';

let root: string;
function topic(project: string) {
  const dir = join(root, project, '.learn', 'topics', 'same-topic');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'state.json'),
    JSON.stringify({
      version: 1,
      topic: 'Same topic',
      slug: 'same-topic',
      created: '2026-01-01',
      domains: [],
    }),
  );
  return dir;
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'learn-registry-'));
  vi.stubEnv('LEARN_ANYTHING_HOME', join(root, 'registry'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('topic registry', () => {
  it('is empty before first use and deduplicates canonical topic paths', () => {
    expect(listRegisteredTopics()).toEqual([]);
    const dir = topic('项目 with spaces');
    const first = registerTopic(dir);
    expect(registerTopic(join(dir, '..', 'same-topic'))).toEqual(first);
    expect(listRegisteredTopics()).toEqual([first]);
    expect(readdirSync(registryDir())).toEqual([`${first.id}.json`]);
  });

  it('keeps same-name topics from different projects independent', () => {
    const a = registerTopic(topic('one'));
    const b = registerTopic(topic('two'));
    expect(a.id).not.toBe(b.id);
    const before = readFileSync(join(a.path, 'state.json'), 'utf8');
    unregisterTopic(a.id);
    expect(listRegisteredTopics()).toEqual([b]);
    expect(readFileSync(join(a.path, 'state.json'), 'utf8')).toBe(before);
    expect(registerTopic(a.path).id).toBe(a.id);
  });

  it('retains unavailable paths and ignores damaged entries without overwriting them', () => {
    const entry = registerTopic(topic('one'));
    renameSync(entry.path, `${entry.path}-moved`);
    const damaged = join(registryDir(), `${'a'.repeat(64)}.json`);
    writeFileSync(damaged, 'broken');
    expect(listRegisteredTopics()).toEqual([entry]);
    registerTopic(topic('two'));
    expect(readFileSync(damaged, 'utf8')).toBe('broken');
  });

  it('imports project/topic/topics paths and reports invalid topics individually', () => {
    const dir = topic('one');
    const invalid = join(dir, '..', 'invalid');
    mkdirSync(invalid);
    writeFileSync(join(invalid, 'state.json'), '{}');
    const result = registerPath(join(root, 'one'));
    expect(result.topics).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(registerPath(join(dir, '..')).topics).toEqual(result.topics);
    expect(registerPath(dir).topics).toEqual(result.topics);
    expect(() => registerTopic(invalid)).toThrow('Invalid topic');
    expect(() => registerPath(join(root, 'missing'))).toThrow(
      'No state.json or .learn/topics directory found',
    );
    const broken = join(root, 'broken', '.learn');
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, 'topics'), 'not a directory');
    expect(() => registerPath(join(root, 'broken'))).toThrow(
      'No state.json or .learn/topics directory found',
    );
  });

  it('rejects identifiers that could escape the registry', () => {
    expect(() => unregisterTopic('../state')).toThrow('Invalid topic ID');
  });
});
