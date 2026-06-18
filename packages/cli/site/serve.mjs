#!/usr/bin/env node
/* global process, setInterval, clearInterval, setTimeout, clearTimeout, URL */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync, watch } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = __dirname;
const TOPICS_DIR = process.env.TOPICS_DIR || join(__dirname, '..', '..', '.learn', 'topics');
const PORT = parseInt(process.env.PORT || '24278', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, pathname) {
  const rawPath = join(STATIC_DIR, pathname);
  const filePath = resolve(rawPath);
  if (!filePath.startsWith(resolve(STATIC_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  File watcher → SSE                                                 */
/* ------------------------------------------------------------------ */

const sseClients = new Set();

function broadcastReload() {
  for (const res of sseClients) {
    try {
      res.write('data: reload\n\n');
    } catch {
      sseClients.delete(res);
    }
  }
}

let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const res of sseClients) {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        sseClients.delete(res);
      }
    }
    if (sseClients.size === 0) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, 15000);
}

let watcherReady = false;

function startWatcher() {
  if (watcherReady) return;
  watcherReady = true;
  try {
    let timer;
    watch(TOPICS_DIR, { recursive: true }, (_event, _filename) => {
      clearTimeout(timer);
      timer = setTimeout(broadcastReload, 200);
    });
  } catch {
    // topics dir may not exist yet
  }
}

/* ------------------------------------------------------------------ */
/*  API: topic summaries                                               */
/* ------------------------------------------------------------------ */

function buildTopicSummaries() {
  const summaries = [];
  if (!existsSync(TOPICS_DIR)) return summaries;
  const entries = readdirSync(TOPICS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const state = safeReadJson(join(TOPICS_DIR, slug, 'state.json'));
    if (!state) continue;
    const allConcepts = (state.domains || []).flatMap((d) => d.concepts || []);
    const total = allConcepts.length;
    const mastered = allConcepts.filter((c) => c.status === 'mastered').length;
    summaries.push({
      slug,
      name: state.topic || slug,
      domainCount: (state.domains || []).length,
      totalConcepts: total,
      masteredCount: mastered,
      percentage: total > 0 ? Math.round((mastered / total) * 100) : 0,
    });
  }
  summaries.sort((a, b) => a.name.localeCompare(b.name));
  return summaries;
}

/* ------------------------------------------------------------------ */
/*  API: topic data (state, knowledge-map, sessions, exercises)        */
/* ------------------------------------------------------------------ */

function buildTopicData(slug) {
  const topicDir = join(TOPICS_DIR, slug);
  if (!existsSync(topicDir)) return null;

  const state = safeReadJson(join(topicDir, 'state.json'));
  const knowledgeMap = safeReadText(join(topicDir, 'knowledge-map.md')) || '';

  const sessions = {};
  const rootSessions = [];
  const sessionsDir = join(topicDir, 'sessions');
  if (existsSync(sessionsDir)) {
    const sEntries = readdirSync(sessionsDir, { withFileTypes: true });
    for (const entry of sEntries) {
      if (entry.isDirectory()) {
        const domainDir = join(sessionsDir, entry.name);
        const files = readdirSync(domainDir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => ({ filename: f, path: `/topics/${slug}/sessions/${entry.name}/${f}` }))
          .sort((a, b) => b.filename.localeCompare(a.filename));
        if (files.length > 0) sessions[entry.name] = files;
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        rootSessions.push({
          filename: entry.name,
          path: `/topics/${slug}/sessions/${entry.name}`,
        });
      }
    }
  }
  rootSessions.sort((a, b) => b.filename.localeCompare(a.filename));

  const exercises = [];
  const rootExercises = [];
  const exercisesDir = join(topicDir, 'exercises');
  const nameMap = new Map();
  if (state) {
    for (const domain of state.domains || []) {
      for (const concept of domain.concepts) {
        nameMap.set(concept.slug, concept.name);
      }
    }
  }
  if (existsSync(exercisesDir)) {
    const raw = new Map();
    const eEntries = readdirSync(exercisesDir, { withFileTypes: true });
    for (const entry of eEntries) {
      if (entry.isDirectory()) {
        const conceptDir = join(exercisesDir, entry.name);
        const files = readdirSync(conceptDir).map((f) => ({
          name: f,
          path: `/topics/${slug}/exercises/${entry.name}/${f}`,
        }));
        raw.set(entry.name, files);
      } else if (entry.isFile()) {
        rootExercises.push({
          name: entry.name,
          path: `/topics/${slug}/exercises/${entry.name}`,
        });
      }
    }
    for (const [conceptSlug, files] of raw) {
      exercises.push({
        conceptSlug,
        conceptName: nameMap.get(conceptSlug) || conceptSlug,
        files,
      });
    }
    exercises.sort((a, b) => a.conceptName.localeCompare(b.conceptName));
  }

  return { state, knowledgeMap, sessions, rootSessions, exercises, rootExercises };
}

/* ------------------------------------------------------------------ */
/*  API: file content                                                  */
/* ------------------------------------------------------------------ */

function serveFileContent(res, url) {
  const reqUrl = new URL(url, 'http://localhost');
  let relPath = reqUrl.searchParams.get('path');
  if (!relPath) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  // Convert API path to filesystem path
  // API paths like: /topics/javascript/sessions/language-basics/2026-06-14.md
  // Map to filesystem: TOPICS_DIR/javascript/sessions/language-basics/2026-06-14.md
  const match = relPath.match(/^\/topics\/(.+)/);
  if (!match) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const relativePart = match[1];
  if (relativePart.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let filePath = join(TOPICS_DIR, relativePart);
  filePath = resolve(filePath);
  if (!filePath.startsWith(resolve(TOPICS_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Server                                                        */
/* ------------------------------------------------------------------ */

function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API routes
  if (pathname === '/api/topics') {
    return json(res, buildTopicSummaries());
  }

  const topicMatch = pathname.match(/^\/api\/topics\/([^/]+)$/);
  if (topicMatch) {
    const data = buildTopicData(topicMatch[1]);
    if (!data) {
      return json(res, { error: 'Topic not found' }, 404);
    }
    return json(res, data);
  }

  const fileMatch = pathname.match(/^\/api\/file$/);
  if (fileMatch) {
    return serveFileContent(res, req.url);
  }

  // SSE
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: connected\n\n');
    sseClients.add(res);
    startWatcher();
    startHeartbeat();
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // SPA fallback: serve index.html for non-file paths
  if (!pathname.includes('.') || pathname === '/') {
    const indexPath = join(STATIC_DIR, 'index.html');
    if (existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(readFileSync(indexPath, 'utf-8'));
      return;
    }
  }

  // Static files
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  serveStatic(res, cleanPath);
}

const server = createServer(handler);
server.listen(PORT, () => {
  process.stdout.write(`SITE_READY|http://localhost:${PORT}\n`);
  startWatcher();
});

server.on('close', () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
});
