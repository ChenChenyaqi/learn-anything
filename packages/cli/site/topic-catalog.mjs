/* global process, setInterval, clearInterval, setTimeout, clearTimeout, URL, Buffer */
// Global topic discovery, registration management and file watching for the dashboard.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, watch } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import {
  listRegisteredTopics,
  registerPath,
  unregisterTopic,
  registryDir,
} from '../dist/scripts/topic-registry.mjs';
import { validateStateV1 } from '../dist/scripts/utils.mjs';

const TOPICS_DIR = process.env.TOPICS_DIR ? resolve(process.env.TOPICS_DIR) : null;
const PORT = parseInt(process.env.PORT || '24278', 10);
let notifyReload = () => {};

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
  return true;
}

function safeReadJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function topicSources() {
  // Only global summaries expose sourcePath to distinguish topics across projects.
  if (!TOPICS_DIR)
    return listRegisteredTopics().map((entry) => ({ ...entry, sourcePath: entry.path }));
  if (!existsSync(TOPICS_DIR)) return [];
  return readdirSync(TOPICS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, path: join(TOPICS_DIR, entry.name), name: entry.name }));
}

function resolveTopic(id) {
  return topicSources().find((entry) => entry.id === id)?.path;
}

function withinDirectory(root, file) {
  const rel = relative(resolve(root), resolve(file));
  return (
    rel !== '..' &&
    !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(rel)
  );
}

// Check real paths as well as lexical paths so symlinks cannot escape a topic.
// Missing or unresolvable paths return false; callers needing a 404 must check existence first.
function containedFile(root, file) {
  try {
    return withinDirectory(root, file) && withinDirectory(realpathSync(root), realpathSync(file));
  } catch {
    return false;
  }
}

function topicState(topicDir) {
  const file = join(topicDir, 'state.json');
  if (!containedFile(topicDir, file)) return null;
  const state = safeReadJson(file);
  return state && validateStateV1(state).length === 0 ? state : null;
}

const watchers = new Map();
let watcherTimer;
let reloadTimer;

function syncWatchers() {
  let changed = false;
  const roots = new Set(
    TOPICS_DIR ? [TOPICS_DIR] : [registryDir(), ...topicSources().map((entry) => entry.path)],
  );
  for (const [root, watcher] of watchers) {
    if (!roots.has(root) || !existsSync(root)) {
      watcher.close();
      watchers.delete(root);
      changed = true;
    }
  }
  for (const root of roots) {
    if (watchers.has(root)) continue;
    try {
      const watcher = watch(root, { recursive: true }, () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          syncWatchers();
          notifyReload();
        }, 200);
      });
      watcher.on('error', () => {
        watcher.close();
        watchers.delete(root);
      });
      watchers.set(root, watcher);
      changed = true;
    } catch {
      // Retry missing/offline paths periodically, including a deleted registry directory.
    }
  }
  if (changed) notifyReload();
}

export function startTopicWatcher(onChange) {
  notifyReload = onChange;
  if (watcherTimer) return;
  if (!TOPICS_DIR) mkdirSync(registryDir(), { recursive: true });
  syncWatchers();
  watcherTimer = setInterval(syncWatchers, 2000);
}

export function stopTopicWatcher() {
  clearInterval(watcherTimer);
  clearTimeout(reloadTimer);
  watcherTimer = null;
  for (const watcher of watchers.values()) watcher.close();
  watchers.clear();
}

/** Apply dashboard-wide request guards and handle registry routes; return false to continue. */
export async function handleDashboardRequest(req, res) {
  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  const allowedHosts = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
  if (PORT === 80) allowedHosts.push('localhost', '127.0.0.1');
  if (!allowedHosts.includes(req.headers.host)) return json(res, { error: 'Forbidden host' }, 403);

  if (pathname === '/api/registry') {
    if (req.method === 'GET') {
      return json(res, {
        mode: TOPICS_DIR ? 'project' : 'global',
        topics: TOPICS_DIR
          ? []
          : listRegisteredTopics().map((entry) => ({
              ...entry,
              available: !!topicState(entry.path),
            })),
      });
    }
    if (TOPICS_DIR)
      return json(res, { error: 'Registration management requires global mode' }, 409);
    if (!['POST', 'DELETE'].includes(req.method))
      return json(res, { error: 'Method not allowed' }, 405);
    const allowedOrigins = allowedHosts.map((host) => `http://${host}`);
    if (process.env.DASHBOARD_ORIGIN) allowedOrigins.push(process.env.DASHBOARD_ORIGIN);
    if (
      req.headers['x-learn-anything'] !== 'dashboard' ||
      req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json' ||
      (req.headers.origin && !allowedOrigins.includes(req.headers.origin))
    ) {
      return json(res, { error: 'Forbidden request' }, 403);
    }
    // StringDecoder preserves multibyte paths split across request chunks.
    req.setEncoding('utf8');
    let raw = '';
    let bytes = 0;
    for await (const chunk of req) {
      raw += chunk;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 16384) return json(res, { error: 'Request too large' }, 413);
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
    if (req.method === 'POST') {
      if (typeof body?.path !== 'string' || !isAbsolute(body.path)) {
        return json(res, { error: 'An absolute project or topic path is required' }, 400);
      }
      try {
        const result = registerPath(body.path);
        syncWatchers();
        notifyReload();
        return json(res, result);
      } catch (error) {
        return json(res, { error: error.message }, 400);
      }
    }
    if (
      typeof body?.id !== 'string' ||
      !listRegisteredTopics().some((entry) => entry.id === body.id)
    ) {
      return json(res, { error: 'Topic not found' }, 404);
    }
    unregisterTopic(body.id);
    syncWatchers();
    notifyReload();
    return json(res, { removed: body.id });
  }

  if (req.method !== 'GET') return json(res, { error: 'Method not allowed' }, 405);

  return false;
}

export { topicSources, resolveTopic, topicState, containedFile, withinDirectory };
