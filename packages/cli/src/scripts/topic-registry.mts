/** Shared by the CLI, dashboard and installed topic skill; Node built-ins only. */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { validateStateV1 } from './utils.mjs';

export interface RegisteredTopic {
  id: string;
  path: string;
  name: string;
}

export function registryDir(): string {
  return join(
    resolve(process.env.LEARN_ANYTHING_HOME || join(homedir(), '.learn-anything')),
    'topics',
  );
}

function topicId(topicPath: string): string {
  const key = process.platform === 'win32' ? topicPath.toLowerCase() : topicPath;
  return createHash('sha256').update(key).digest('hex');
}

export function registerTopic(topicDir: string): RegisteredTopic {
  const topicPath = realpathSync(resolve(topicDir));
  const state = JSON.parse(readFileSync(join(topicPath, 'state.json'), 'utf8'));
  if (validateStateV1(state).length) throw new Error(`Invalid topic state: ${topicPath}`);
  const entry = { id: topicId(topicPath), path: topicPath, name: state.topic as string };
  const dir = registryDir();
  mkdirSync(dir, { recursive: true });
  // Independent entries avoid lost updates when different projects register concurrently.
  const target = join(dir, `${entry.id}.json`);
  const content = JSON.stringify(entry, null, 2) + '\n';
  if (existsSync(target) && readFileSync(target, 'utf8') === content) return entry;
  const temp = join(dir, `${entry.id}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, content, { mode: 0o600 });
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
  return entry;
}

export function listRegisteredTopics(): RegisteredTopic[] {
  const dir = registryDir();
  if (!existsSync(dir)) return [];
  const entries: RegisteredTopic[] = [];
  for (const file of readdirSync(dir)) {
    if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
    try {
      const entry = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (
        typeof entry.path === 'string' &&
        isAbsolute(entry.path) &&
        entry.id === topicId(entry.path) &&
        file === `${entry.id}.json` &&
        typeof entry.name === 'string'
      )
        entries.push(entry);
    } catch {
      // A damaged entry must not hide the remaining topics. Leave it for recovery.
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export function unregisterTopic(id: string): void {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid topic ID');
  rmSync(join(registryDir(), `${id}.json`), { force: true });
}

/** Accept a project root, .learn/topics directory, or one topic directory. */
export function registerPath(input: string): { topics: RegisteredTopic[]; skipped: string[] } {
  const root = resolve(input);
  if (existsSync(join(root, 'state.json'))) return { topics: [registerTopic(root)], skipped: [] };
  const topicsDir =
    basename(root) === 'topics' && basename(dirname(root)) === '.learn'
      ? root
      : join(root, '.learn', 'topics');
  const topics: RegisteredTopic[] = [];
  const skipped: string[] = [];
  let entries;
  try {
    entries = readdirSync(topicsDir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR')
      throw new Error(`No state.json or .learn/topics directory found at: ${root}`, {
        cause: error,
      });
    if (code === 'EACCES' || code === 'EPERM')
      throw new Error(`Cannot read topic directory; check access permissions: ${topicsDir}`, {
        cause: error,
      });
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const topicDir = join(topicsDir, entry.name);
    try {
      topics.push(registerTopic(topicDir));
    } catch (error) {
      skipped.push(`${topicDir}: ${(error as Error).message}`);
    }
  }
  return { topics, skipped };
}
