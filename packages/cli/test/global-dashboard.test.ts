import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFile, execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let build: string;
let root: string;
let server: ChildProcess | undefined;
let url: string;
let env: NodeJS.ProcessEnv;

beforeAll(() => {
  build = mkdtempSync(join(tmpdir(), 'learn-dashboard-build-'));
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '-p',
    join(packageDir, 'tsconfig.json'),
    '--outDir',
    join(build, 'dist'),
  ]);
  mkdirSync(join(build, 'site'));
  cpSync(join(packageDir, 'site', 'serve.mjs'), join(build, 'site', 'serve.mjs'));
  cpSync(join(packageDir, 'site', 'topic-catalog.mjs'), join(build, 'site', 'topic-catalog.mjs'));
}, 30000);
afterAll(() => rmSync(build, { recursive: true, force: true }));
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'learn-dashboard-'));
  env = { ...process.env, LEARN_ANYTHING_HOME: join(root, 'home'), TOPICS_DIR: '' };
});
afterEach(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise<void>((done) => server!.once('exit', () => done()));
    server.kill();
    await exited;
  }
  server = undefined;
  rmSync(root, { recursive: true, force: true });
});

function makeTopic(project: string) {
  const dir = join(root, project, '.learn', 'topics', 'react');
  // Stage under an ASCII path: Node 22 cpSync can misencode Windows Unicode destinations.
  const staging = mkdtempSync(join(root, 'fixture-'));
  cpSync(join(packageDir, 'test', 'fixtures', 'topics', 'react'), staging, { recursive: true });
  mkdirSync(dirname(dir), { recursive: true });
  renameSync(staging, dir);
  mkdirSync(join(dir, 'quizzes'), { recursive: true });
  writeFileSync(join(dir, 'quizzes', 'deck.json'), JSON.stringify({ title: project }));
  writeFileSync(join(dir, 'knowledge-map.md'), `# ${project}\n`);
  return dir;
}
function register(dir: string) {
  return execFileSync(
    process.execPath,
    [join(build, 'dist', 'scripts', 'init-sessions.mjs'), dir],
    { env, encoding: 'utf8' },
  );
}
async function start(topicsDir = '') {
  const port = await new Promise<number>((done) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = (probe.address() as { port: number }).port;
      probe.close(() => done(port));
    });
  });
  url = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(build, 'site', 'serve.mjs')], {
    cwd: root,
    env: { ...env, PORT: String(port), TOPICS_DIR: topicsDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
    server!.once('error', reject);
    let output = '';
    server!.stdout!.on('data', (chunk) => {
      output += chunk;
      if (output.includes('SITE_READY|')) {
        clearTimeout(timer);
        done();
      }
    });
    server!.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited: ${code}`));
    });
  });
}
async function get(route: string) {
  const response = await fetch(url + route);
  expect(response.status).toBe(200);
  return response.json();
}
function mutate(method: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url + '/api/registry', {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Learn-Anything': 'dashboard', ...headers },
    body: JSON.stringify(body),
  });
}

describe('global dashboard HTTP integration', () => {
  it('accepts default-port hosts and origins only on port 80', () => {
    // Exercise the request boundary without binding a privileged port.
    const script = `
      import { Readable } from 'node:stream';
      import { handleDashboardRequest } from ${JSON.stringify(pathToFileURL(join(build, 'site', 'topic-catalog.mjs')).href)};
      const results = [];
      for (const host of ['localhost', '127.0.0.1', 'localhost:80', '127.0.0.1:80', 'example.com']) {
        for (const method of ['GET', 'POST']) {
          const req = Readable.from(['{"path":"relative"}']);
          Object.assign(req, {
            url: method === 'GET' ? '/' : '/api/registry', method,
            headers: { host, origin: 'http://' + host,
              'content-type': 'application/json', 'x-learn-anything': 'dashboard' },
          });
          let status = 200;
          await handleDashboardRequest(req, { writeHead(code) { status = code; }, end() {} });
          results.push(status);
        }
      }
      console.log(JSON.stringify(results));
    `;
    const check = (port: string) =>
      JSON.parse(
        execFileSync(process.execPath, ['--input-type=module', '-e', script], {
          env: { ...env, PORT: port, DASHBOARD_ORIGIN: '' },
          encoding: 'utf8',
        }),
      );
    // POST reaches path validation (400) only after Host and Origin are accepted.
    expect(check('80')).toEqual([200, 400, 200, 400, 200, 400, 200, 400, 403, 403]);
    expect(check('24278')).toEqual(Array(10).fill(403));
  });

  it('returns 404 for missing resources while rejecting traversal', async () => {
    register(makeTopic('one'));
    await start();
    const [{ slug }] = await get('/api/topics');
    expect((await fetch(url + '/favicon.ico')).status).toBe(404);
    expect((await fetch(url + '/assets/missing.js')).status).toBe(404);
    expect((await fetch(url + '/..%2foutside.txt')).status).toBe(403);
    expect((await fetch(url + `/api/quizzes/${slug}/missing.json`)).status).toBe(404);
    expect(
      (await fetch(url + '/api/file?path=' + encodeURIComponent(`/topics/${slug}/missing.md`)))
        .status,
    ).toBe(404);
  });

  it('keeps every topic when different projects register concurrently', async () => {
    const topics = Array.from({ length: 8 }, (_, i) => makeTopic(`parallel-${i}`));
    await Promise.all(
      topics.map((topic) =>
        promisify(execFile)(
          process.execPath,
          [join(build, 'dist', 'scripts', 'init-sessions.mjs'), topic],
          { env },
        ),
      ),
    );
    await start();
    expect(await get('/api/topics')).toHaveLength(topics.length);
  });

  it('preserves learning files and reports a warning when the registry cannot be written', () => {
    const topic = makeTopic('one');
    const before = readFileSync(join(topic, 'state.json'), 'utf8');
    writeFileSync(env.LEARN_ANYTHING_HOME!, 'not a directory');
    const result = spawnSync(
      process.execPath,
      [join(build, 'dist', 'scripts', 'init-sessions.mjs'), topic],
      { env, encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Could not register topic');
    expect(existsSync(join(topic, 'sessions'))).toBe(true);
    expect(readFileSync(join(topic, 'state.json'), 'utf8')).toBe(before);
  });

  it('registers on topic creation/load and serves same-name topics from an unrelated directory', async () => {
    const a = makeTopic('项目 A');
    const b = makeTopic('project B');
    expect(register(a)).not.toContain('Warning');
    register(a);
    register(b);
    await start();
    const topics = await get('/api/topics');
    expect(topics).toHaveLength(2);
    expect(topics.map((t: any) => t.sourcePath).sort()).toEqual([a, b].sort());
    expect(new Set(topics.map((t: any) => t.slug)).size).toBe(2);
    for (const topic of topics) {
      const data = await get(`/api/topics/${topic.slug}`);
      expect(data.state.topic).toBe('React');
      expect(data.files.sessions.length).toBeGreaterThan(0);
      const file = await fetch(
        url + '/api/file?path=' + encodeURIComponent(`/topics/${topic.slug}/knowledge-map.md`),
      );
      expect(await file.text()).toBe(
        readFileSync(join(topic.sourcePath, 'knowledge-map.md'), 'utf8'),
      );
      const quiz = await get(`/api/quizzes/${topic.slug}/deck.json`);
      expect(['项目 A', 'project B']).toContain(quiz.title);
    }
    const index = await get('/api/search-index');
    for (const topic of topics)
      expect(index.some((entry: any) => entry.topicSlug === topic.slug)).toBe(true);
  });

  it('imports existing topics, reports unavailable paths and removes only registration', async () => {
    const topic = makeTopic('existing');
    await start();
    expect(await get('/api/topics')).toEqual([]);
    expect((await mutate('POST', { path: join(root, 'existing') })).status).toBe(200);
    const [entry] = (await get('/api/registry')).topics;
    expect(entry.available).toBe(true);
    renameSync(topic, topic + '-moved');
    expect((await get('/api/registry')).topics[0].available).toBe(false);
    expect(await get('/api/topics')).toEqual([]);
    expect((await mutate('DELETE', { id: entry.id })).status).toBe(200);
    expect((await get('/api/registry')).topics).toEqual([]);
    expect(existsSync(join(topic + '-moved', 'state.json'))).toBe(true);
  });

  it('preserves explicit project mode and rejects global mutations in that mode', async () => {
    const topic = makeTopic('local');
    register(makeTopic('other'));
    await start(dirname(topic));
    const topics = await get('/api/topics');
    expect(topics.map((t: any) => t.slug)).toEqual(['react']);
    expect(topics[0]).not.toHaveProperty('sourcePath');
    expect((await get('/api/registry')).mode).toBe('project');
    expect((await mutate('POST', { path: root })).status).toBe(409);
    expect((await get('/api/topics/react')).state.topic).toBe('React');
  });

  it('rejects cross-origin mutations, invalid paths, traversal and malformed URLs', async () => {
    register(makeTopic('one'));
    await start();
    const [{ slug }] = await get('/api/topics');
    expect((await mutate('POST', { path: root }, { Origin: 'https://example.com' })).status).toBe(
      403,
    );
    expect((await mutate('POST', { path: root }, { 'X-Learn-Anything': '' })).status).toBe(403);
    expect((await mutate('POST', { path: 'relative' })).status).toBe(400);
    expect(
      (await mutate('POST', { path: root }, { 'Content-Type': 'application/json-p' })).status,
    ).toBe(403);
    expect((await mutate('DELETE', { id: '../escape' })).status).toBe(404);
    expect((await fetch(url + '/api/topics/%E0%A4%A')).status).toBe(400);
    expect((await fetch(url + '/api/topics/%2e%2e%2fsecret')).status).toBe(404);
    expect(
      (await fetch(url + '/api/file?path=' + encodeURIComponent(`/topics/${slug}/../secret`)))
        .status,
    ).toBe(403);
    expect((await fetch(url + `/api/quizzes/${slug}/..%2Fstate.json`)).status).toBe(403);
  });

  it('blocks topic directory symlinks from exposing files outside a registered topic', async () => {
    const topic = makeTopic('one');
    const outside = join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'secret.md'), 'private');
    symlinkSync(outside, join(topic, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    register(topic);
    await start();
    const [{ slug }] = await get('/api/topics');
    expect(
      (
        await fetch(
          url + '/api/file?path=' + encodeURIComponent(`/topics/${slug}/linked/secret.md`),
        )
      ).status,
    ).toBe(403);
  });

  it('reloads over SSE when a topic is registered or its content changes', async () => {
    await start();
    const controller = new AbortController();
    const response = await fetch(url + '/api/events', { signal: controller.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    await reader.read(); // connected
    const topic = makeTopic('new');
    register(topic);
    const waitForReload = async () => {
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        let text = '';
        while (!text.includes('data: reload')) {
          const next = await reader.read();
          if (next.done) throw new Error('SSE ended before reload');
          text += decoder.decode(next.value);
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    try {
      await waitForReload();
      const [{ slug }] = await get('/api/topics');
      await get('/api/search-index');
      writeFileSync(join(topic, 'knowledge-map.md'), '# Changed heading\n');
      await waitForReload();
      expect(
        (await get('/api/search-index')).some(
          (entry: any) => entry.title === 'Changed heading' && entry.topicSlug === slug,
        ),
      ).toBe(true);
    } finally {
      controller.abort();
    }
  });
});
