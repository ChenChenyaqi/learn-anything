#!/usr/bin/env node
/* global process, setInterval, clearInterval, URL, Buffer */
import { createServer } from 'node:http';
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  topicSources,
  resolveTopic,
  topicState,
  containedFile,
  withinDirectory,
  startTopicWatcher,
  stopTopicWatcher,
  handleDashboardRequest,
} from './topic-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = __dirname;
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

/**
 * Detect whether a file is binary by inspecting its content (Git heuristic).
 * Reads only the first 8 000 bytes; a NUL byte (0x00) means binary.
 * Returns false on read errors so files are never hidden by accident.
 */
function isBinaryFile(filePath) {
  let fd;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(8000);
    const bytesRead = readSync(fd, buf, 0, 8000, 0);
    return buf.slice(0, bytesRead).includes(0);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

const EXCLUDED_NAMES = new Set(['.learn', '.git', '.idea', 'node_modules']);

function isExcluded(name) {
  return name.startsWith('.') || EXCLUDED_NAMES.has(name);
}

function walkDir(dirPath, relativePrefix, includeBinary, filterFn, results) {
  if (!existsSync(dirPath)) return;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (isExcluded(entry.name) || entry.isSymbolicLink()) continue;
    const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walkDir(join(dirPath, entry.name), relativePath, includeBinary, filterFn, results);
    } else if (entry.isFile()) {
      if (filterFn(entry.name) && (includeBinary || !isBinaryFile(join(dirPath, entry.name)))) {
        results.push(relativePath);
      }
    }
  }
}

function scanTopicFiles(topicDir) {
  const files = { sessions: [], exercises: [], quizzes: [] };
  if (containedFile(topicDir, join(topicDir, 'sessions'))) {
    walkDir(
      join(topicDir, 'sessions'),
      'sessions',
      true,
      (name) => name.toLowerCase().endsWith('.md'),
      files.sessions,
    );
  }
  if (containedFile(topicDir, join(topicDir, 'exercises'))) {
    walkDir(join(topicDir, 'exercises'), 'exercises', false, () => true, files.exercises);
  }
  if (containedFile(topicDir, join(topicDir, 'quizzes'))) {
    walkDir(
      join(topicDir, 'quizzes'),
      'quizzes',
      true,
      (name) => name.toLowerCase().endsWith('.json'),
      files.quizzes,
    );
  }
  return files;
}

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
  searchIndexCache = null;
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

function startWatcher() {
  startTopicWatcher(broadcastReload);
}

/* ------------------------------------------------------------------ */
/*  API: topic summaries                                               */
/* ------------------------------------------------------------------ */

function buildTopicSummaries() {
  const summaries = [];
  for (const entry of topicSources()) {
    const slug = entry.id;
    const state = topicState(entry.path);
    if (!state) continue;
    const allConcepts = (state.domains || []).flatMap((d) => d.concepts || []);
    const total = allConcepts.length;
    const mastered = allConcepts.filter((c) => c.status === 'mastered').length;
    summaries.push({
      slug,
      name: state.topic || slug,
      sourcePath: entry.sourcePath,
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
/*  API: topic data (state, knowledge-map, file tree)                  */
/* ------------------------------------------------------------------ */

function buildTopicData(slug) {
  const topicDir = resolveTopic(slug);
  const state = topicDir ? topicState(topicDir) : null;
  if (!state) return null;
  const mapPath = join(topicDir, 'knowledge-map.md');
  const knowledgeMap = containedFile(topicDir, mapPath) ? safeReadText(mapPath) || '' : '';
  const files = scanTopicFiles(topicDir);

  return { state, knowledgeMap, files };
}

/** Read and return a single quiz deck JSON file with path traversal protection. */
function serveQuizDeck(res, topic, restPath) {
  const topicDir = resolveTopic(topic);
  if (!topicDir || !existsSync(topicDir)) {
    return json(res, { error: 'Topic not found' }, 404);
  }
  if (restPath.includes('..')) {
    return json(res, { error: 'Forbidden' }, 403);
  }
  const quizzesRoot = resolve(join(topicDir, 'quizzes'));
  const filePath = resolve(join(quizzesRoot, restPath));
  if (!withinDirectory(quizzesRoot, filePath)) {
    return json(res, { error: 'Forbidden' }, 403);
  }
  if (!existsSync(filePath)) {
    return json(res, { error: 'Quiz not found' }, 404);
  }
  if (!containedFile(topicDir, filePath) || !containedFile(quizzesRoot, filePath)) {
    return json(res, { error: 'Forbidden' }, 403);
  }
  const data = safeReadJson(filePath);
  if (!data) {
    return json(res, { error: 'Quiz not found' }, 404);
  }
  return json(res, data);
}

/* ------------------------------------------------------------------ */
/*  API: search index                                                  */
/* ------------------------------------------------------------------ */

let searchIndexCache = null;

/** Map both domain and concept slugs → display names from a topic's state. */
function buildSlugNameMap(state) {
  const map = new Map();
  for (const domain of (state && state.domains) || []) {
    map.set(domain.slug, domain.name);
    for (const concept of domain.concepts || []) {
      map.set(concept.slug, concept.name);
    }
  }
  return map;
}

/** Collect `.md` files at root or exactly one subdirectory deep — matching the
    sidebar's two-level navigation tree (deeper nesting is not displayed, so not indexed). */
function collectMarkdownFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subDir = join(dir, entry.name);
      for (const f of readdirSync(subDir, { withFileTypes: true })) {
        if (f.isFile() && f.name.endsWith('.md')) out.push(`${entry.name}/${f.name}`);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(entry.name);
    }
  }
  return out;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/** Extract ATX headings (level 1–6), skipping fenced code blocks. */
function extractHeadings(content) {
  const out = [];
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(HEADING_RE);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].replace(/\s+#+$/, '').trim();
    if (title) out.push({ title, level });
  }
  return out;
}

/** Build entries for one in-scope file: a filename pseudo-entry plus its headings. */
function buildFileEntries({ filePath, apiPath, topicSlug, topicName, section, kind }) {
  const entries = [];
  const baseName = filePath.split('/').pop().replace(/\.md$/, '');
  entries.push({ title: baseName, level: 0, path: apiPath, topicSlug, topicName, section, kind });
  const content = safeReadText(filePath);
  if (content) {
    for (const { title, level } of extractHeadings(content)) {
      entries.push({ title, level, path: apiPath, topicSlug, topicName, section, kind });
    }
  }
  return entries;
}

/** Build the full flat search index across all topics. */
function buildSearchIndex() {
  const index = [];
  for (const entry of topicSources()) {
    const slug = entry.id;
    const topicDir = entry.path;
    const state = topicState(topicDir);
    if (!state) continue;
    const topicName = (state && state.topic) || slug;
    const slugName = buildSlugNameMap(state);

    // Session notes: sessions/**/*.md
    const sessionsDir = join(topicDir, 'sessions');
    for (const rel of containedFile(topicDir, sessionsDir)
      ? collectMarkdownFiles(sessionsDir)
      : []) {
      const dirName = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
      const section = dirName ? slugName.get(dirName) || dirName : topicName;
      index.push(
        ...buildFileEntries({
          filePath: join(sessionsDir, rel),
          apiPath: `/topics/${slug}/sessions/${rel}`,
          topicSlug: slug,
          topicName,
          section,
          kind: 'note',
        }),
      );
    }

    // Knowledge map: knowledge-map.md
    const kmPath = join(topicDir, 'knowledge-map.md');
    if (containedFile(topicDir, kmPath)) {
      index.push(
        ...buildFileEntries({
          filePath: kmPath,
          apiPath: `/topics/${slug}/knowledge-map.md`,
          topicSlug: slug,
          topicName,
          section: 'Knowledge Map',
          kind: 'knowledge-map',
        }),
      );
    }

    // Exercise docs: exercises/**/*.md
    const exercisesDir = join(topicDir, 'exercises');
    for (const rel of containedFile(topicDir, exercisesDir)
      ? collectMarkdownFiles(exercisesDir)
      : []) {
      const dirName = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
      const section = dirName ? slugName.get(dirName) || dirName : topicName;
      index.push(
        ...buildFileEntries({
          filePath: join(exercisesDir, rel),
          apiPath: `/topics/${slug}/exercises/${rel}`,
          topicSlug: slug,
          topicName,
          section,
          kind: 'exercise',
        }),
      );
    }
  }
  return index;
}

function getSearchIndex() {
  if (!searchIndexCache) searchIndexCache = buildSearchIndex();
  return searchIndexCache;
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
  // Resolve the topic ID through the active project or global registry.
  const match = relPath.match(/^\/topics\/([^/]+)\/(.+)/);
  if (!match) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const topicDir = resolveTopic(match[1]);
  if (!topicDir) return json(res, { error: 'Topic not found' }, 404);
  const relativePart = match[2];
  if (relativePart.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  let filePath = join(topicDir, relativePart);
  filePath = resolve(filePath);
  if (!withinDirectory(topicDir, filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  if (!containedFile(topicDir, filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
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

async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (await handleDashboardRequest(req, res)) return;

  // API routes
  if (pathname === '/api/topics') {
    return json(res, buildTopicSummaries());
  }

  const topicMatch = pathname.match(/^\/api\/topics\/([^/]+)$/);
  if (topicMatch) {
    const data = buildTopicData(decodeURIComponent(topicMatch[1]));
    if (!data) {
      return json(res, { error: 'Topic not found' }, 404);
    }
    return json(res, data);
  }

  const fileMatch = pathname.match(/^\/api\/file$/);
  if (fileMatch) {
    return serveFileContent(res, req.url);
  }

  const quizDeckMatch = pathname.match(/^\/api\/quizzes\/([^/]+)\/(.+)$/);
  if (quizDeckMatch) {
    return serveQuizDeck(
      res,
      decodeURIComponent(quizDeckMatch[1]),
      decodeURIComponent(quizDeckMatch[2]),
    );
  }

  if (pathname === '/api/search-index') {
    return json(res, getSearchIndex());
  }

  // SSE
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
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
  const cleanPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  serveStatic(res, cleanPath);
}

const server = createServer((req, res) => {
  handler(req, res).catch((error) => {
    if (!res.headersSent)
      json(
        res,
        { error: error instanceof URIError ? 'Invalid URL' : 'Request failed' },
        error instanceof URIError ? 400 : 500,
      );
    else res.end();
  });
});
server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`SITE_READY|http://127.0.0.1:${PORT}\n`);
  startWatcher();
});

server.on('close', () => {
  stopTopicWatcher();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
});
