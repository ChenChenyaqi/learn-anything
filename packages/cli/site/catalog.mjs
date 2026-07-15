/* global Buffer, process */
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const CATALOG_VERSION = 1;
export const CATALOG_FILENAME = 'catalog.json';

const CONTENT_ROOTS = [
  { directory: 'sessions', kind: 'session', accepts: (name) => name.toLowerCase().endsWith('.md') },
  { directory: 'exercises', kind: 'exercise', accepts: () => true },
  { directory: 'quizzes', kind: 'quiz', accepts: (name) => name.toLowerCase().endsWith('.json') },
];

const EXCLUDED_NAMES = new Set(['.learn', '.git', '.idea', 'node_modules']);

function isExcluded(name) {
  return name.startsWith('.') || EXCLUDED_NAMES.has(name);
}

function isBinaryFile(filePath) {
  let fd;
  try {
    fd = openSync(filePath, 'r');
    const buffer = Buffer.alloc(8000);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } catch {
    return true;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function safeReadState(topicDir) {
  try {
    return JSON.parse(readFileSync(join(topicDir, 'state.json'), 'utf8'));
  } catch {
    return null;
  }
}

function buildSemanticIndex(state) {
  const domains = new Map();
  const concepts = new Map();
  for (const domain of state?.domains ?? []) {
    domains.set(domain.slug, domain);
    for (const concept of domain.concepts ?? []) {
      const matches = concepts.get(concept.slug) ?? [];
      matches.push({ concept, domain });
      concepts.set(concept.slug, matches);
    }
  }
  return { domains, concepts };
}

function recognizeSemantics(pathSegments, index) {
  const domainMatches = pathSegments.filter((segment) => index.domains.has(segment));
  const domainSlug = domainMatches.length === 1 ? domainMatches[0] : undefined;

  const candidates = [];
  for (const segment of pathSegments) {
    for (const match of index.concepts.get(segment) ?? []) candidates.push(match);
  }
  const unique = candidates.filter(
    (candidate, i) =>
      candidates.findIndex(
        (other) =>
          other.concept.slug === candidate.concept.slug &&
          other.domain.slug === candidate.domain.slug,
      ) === i,
  );
  const scoped = domainSlug
    ? unique.filter((candidate) => candidate.domain.slug === domainSlug)
    : unique;
  const conceptMatch =
    scoped.length === 1 ? scoped[0] : !domainSlug && unique.length === 1 ? unique[0] : null;

  return {
    ...(domainSlug ? { domainSlug } : conceptMatch ? { domainSlug: conceptMatch.domain.slug } : {}),
    ...(conceptMatch ? { conceptSlug: conceptMatch.concept.slug } : {}),
  };
}

function walkFiles(rootDir, accepts, includeBinary, visit, currentDir = rootDir) {
  if (!existsSync(currentDir)) return;
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (isExcluded(entry.name) || entry.isSymbolicLink()) continue;
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(rootDir, accepts, includeBinary, visit, fullPath);
    } else if (
      entry.isFile() &&
      accepts(entry.name) &&
      (includeBinary || !isBinaryFile(fullPath))
    ) {
      visit(fullPath);
    }
  }
}

export function buildTopicCatalog(topicDir) {
  const state = safeReadState(topicDir);
  const semanticIndex = buildSemanticIndex(state);
  const entries = [];

  for (const root of CONTENT_ROOTS) {
    const rootDir = join(topicDir, root.directory);
    walkFiles(rootDir, root.accepts, false, (filePath) => {
      const relativePath = relative(topicDir, filePath).split(sep).join('/');
      const segments = relativePath.split('/').slice(1, -1);
      entries.push({
        path: relativePath,
        kind: root.kind,
        ...recognizeSemantics(segments, semanticIndex),
      });
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { version: CATALOG_VERSION, entries };
}

export function isValidCatalog(value) {
  if (!value || value.version !== CATALOG_VERSION || !Array.isArray(value.entries)) return false;
  return value.entries.every((entry) => {
    if (!entry || typeof entry.path !== 'string') return false;
    if (!['session', 'exercise', 'quiz'].includes(entry.kind)) return false;
    if (entry.path.startsWith('/') || entry.path.includes('..') || entry.path.includes('\\'))
      return false;
    if (entry.domainSlug !== undefined && typeof entry.domainSlug !== 'string') return false;
    if (entry.conceptSlug !== undefined && typeof entry.conceptSlug !== 'string') return false;
    return true;
  });
}

function stableCatalogJson(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export function writeTopicCatalog(topicDir, catalog) {
  const catalogPath = join(topicDir, CATALOG_FILENAME);
  const next = stableCatalogJson(catalog);
  try {
    if (readFileSync(catalogPath, 'utf8') === next) return false;
  } catch {
    // Missing or unreadable catalogs are replaced below.
  }

  const tempPath = `${catalogPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, next, 'utf8');
  try {
    renameSync(tempPath, catalogPath);
  } catch {
    rmSync(catalogPath, { force: true });
    renameSync(tempPath, catalogPath);
  }
  return true;
}

export function ensureCatalogIgnore(topicsDir) {
  const ignorePath = join(dirname(topicsDir), '.gitignore');
  const rule = 'topics/*/catalog.json';
  let content = '';
  try {
    content = readFileSync(ignorePath, 'utf8');
  } catch {
    // Created below.
  }
  if (content.split(/\r?\n/).includes(rule)) return false;
  const prefix = content.length > 0 && !content.endsWith('\n') ? `${content}\n` : content;
  writeFileSync(ignorePath, `${prefix}${rule}\n`, 'utf8');
  return true;
}

export class TopicCatalogStore {
  constructor(topicsDir) {
    this.topicsDir = resolve(topicsDir);
    this.catalogs = new Map();
  }

  reconcileAll() {
    ensureCatalogIgnore(this.topicsDir);
    const seen = new Set();
    if (existsSync(this.topicsDir)) {
      for (const entry of readdirSync(this.topicsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || isExcluded(entry.name)) continue;
        seen.add(entry.name);
        this.reconcileTopic(entry.name);
      }
    }
    for (const slug of this.catalogs.keys()) {
      if (!seen.has(slug)) this.catalogs.delete(slug);
    }
  }

  reconcileTopic(slug) {
    const topicDir = resolve(join(this.topicsDir, slug));
    if (
      dirname(topicDir) !== this.topicsDir ||
      !existsSync(topicDir) ||
      !lstatSync(topicDir).isDirectory()
    ) {
      this.catalogs.delete(slug);
      return null;
    }
    const catalog = buildTopicCatalog(topicDir);
    writeTopicCatalog(topicDir, catalog);
    this.catalogs.set(slug, catalog);
    return catalog;
  }

  get(slug) {
    return this.catalogs.get(slug) ?? null;
  }
}
