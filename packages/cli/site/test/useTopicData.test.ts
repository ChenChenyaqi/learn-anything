import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllTopics,
  loadTopic,
  loadTopicFiles,
  loadKnowledgeMap,
  loadSessionContent,
  loadExerciseContent,
  __resetForTest,
  __injectTestData,
} from '@/composables/useTopicData';
import type { TopicSummary, StateV1, TopicFiles } from '@/composables/useTopicData';

/* ==================================================================== */
/*  Fixture-based tests against packages/cli/test/fixtures/topics/       */
/*  The JavaScript fixture has:                                          */
/*    - state.json with 6 domains, 24 concepts (mixed learning states)   */
/*    - knowledge-map.md                                                  */
/*    - sessions/language-basics/2026-06-13.md                            */
/*    - sessions/language-basics/2026-06-14.md                            */
/*    - sessions/functions-scope/2026-06-14.md                            */
/*    - sessions/overview.md (orphan, no domain dir)                      */
/*    - exercises/variables-data-types/{README,starter,solution}.{md,js}  */
/*    - exercises/variables-data-types/practice-2026-06-14.json           */
/*    - exercises/warmup.js (orphan, no concept dir)                      */
/* ==================================================================== */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '..', '..', 'test', 'fixtures', 'topics');

const VALID_SLUG = 'javascript';
const NONEXISTENT_SLUG = 'zzz-nonexistent';

/* ------------------------------------------------------------------ */
/*  Fixture data loader                                                */
/* ------------------------------------------------------------------ */

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function safeReadText(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function loadFixtureData() {
  const summaries: TopicSummary[] = [];
  const states: Record<string, StateV1> = {};
  const knowledgeMaps: Record<string, string> = {};
  const filesBySlug: Record<string, TopicFiles> = {};
  const fileContentsMap: Record<string, string> = {};

  const topicDirs = readdirSync(FIXTURE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const slug of topicDirs) {
    const topicDir = join(FIXTURE_DIR, slug);

    const state: StateV1 = readJson(join(topicDir, 'state.json'));
    states[slug] = state;

    const km = safeReadText(join(topicDir, 'knowledge-map.md'));
    if (km !== null) knowledgeMaps[slug] = km;

    const allConcepts = state.domains.flatMap((d) => d.concepts);
    const total = allConcepts.length;
    const mastered = allConcepts.filter((c) => c.status === 'mastered').length;
    summaries.push({
      slug,
      name: state.topic || slug,
      domainCount: state.domains.length,
      totalConcepts: total,
      masteredCount: mastered,
      percentage: total > 0 ? Math.round((mastered / total) * 100) : 0,
    });

    filesBySlug[slug] = {
      sessions: walkSessions(topicDir, slug, fileContentsMap),
      exercises: walkGeneric(topicDir, 'exercises', null, fileContentsMap, slug),
      quizzes: walkGeneric(topicDir, 'quizzes', '.json', fileContentsMap, slug),
    };
  }

  summaries.sort((a, b) => a.name.localeCompare(b.name));

  return {
    summaries,
    states,
    knowledgeMaps,
    files: filesBySlug,
    fileContents: fileContentsMap,
  };
}

function walkSessions(topicDir: string, slug: string, contents: Record<string, string>): string[] {
  const dir = join(topicDir, 'sessions');
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const prefix = 'sessions';
  function dfs(currentDir: string, rel: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const childPath = join(currentDir, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        dfs(childPath, childRel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(childRel);
        const content = safeReadText(childPath);
        if (content !== null) contents[`/topics/${slug}/${childRel}`] = content;
      }
    }
  }
  dfs(dir, prefix);
  out.sort();
  return out;
}

function walkGeneric(
  topicDir: string,
  subdir: string,
  ext: string | null,
  contents: Record<string, string>,
  slug: string,
): string[] {
  const dir = join(topicDir, subdir);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const prefix = subdir;
  function dfs(currentDir: string, rel: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const childPath = join(currentDir, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        dfs(childPath, childRel);
      } else if (entry.isFile() && (ext === null || entry.name.endsWith(ext))) {
        out.push(childRel);
        const content = safeReadText(childPath);
        if (content !== null) contents[`/topics/${slug}/${childRel}`] = content;
      }
    }
  }
  dfs(dir, prefix);
  out.sort();
  return out;
}

beforeAll(() => {
  __resetForTest();
  __injectTestData(loadFixtureData());
});

/* ------------------------------------------------------------------ */
/*  listAllTopics                                                     */
/* ------------------------------------------------------------------ */

describe('listAllTopics', () => {
  it('returns the JavaScript topic from fixture data', () => {
    const topics = listAllTopics();
    expect(topics.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts correct slug and name', () => {
    const topics = listAllTopics();
    expect(topics[0].slug).toBe(VALID_SLUG);
    expect(topics[0].name).toBe('JavaScript');
  });

  it('computes correct domain and concept counts', () => {
    const topics = listAllTopics();
    expect(topics[0].domainCount).toBe(6);
    expect(topics[0].totalConcepts).toBe(24);
  });

  it('reports correct mastered count and percentage', () => {
    const topics = listAllTopics();
    expect(topics[0].masteredCount).toBe(5);
    expect(topics[0].percentage).toBe(21);
  });

  it('sorts results by name alphabetically', () => {
    const topics = listAllTopics();
    for (let i = 1; i < topics.length; i++) {
      expect(topics[i].name.localeCompare(topics[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns an array (not null) even if no topics match', () => {
    expect(Array.isArray(listAllTopics())).toBe(true);
  });

  it('returns TopicSummary objects with expected shape', () => {
    const topics = listAllTopics();
    for (const t of topics) {
      expect(t).toHaveProperty('slug');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('domainCount');
      expect(t).toHaveProperty('totalConcepts');
      expect(t).toHaveProperty('masteredCount');
      expect(t).toHaveProperty('percentage');
      expect(typeof t.slug).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.domainCount).toBe('number');
      expect(typeof t.totalConcepts).toBe('number');
      expect(typeof t.masteredCount).toBe('number');
      expect(typeof t.percentage).toBe('number');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  loadTopic                                                         */
/* ------------------------------------------------------------------ */

describe('loadTopic', () => {
  it('loads the full state for a valid slug', () => {
    const state = loadTopic(VALID_SLUG);
    expect(state).not.toBeNull();
    expect(state!.version).toBe(1);
    expect(state!.topic).toBe('JavaScript');
    expect(state!.slug).toBe(VALID_SLUG);
    expect(state!.created).toBe('2026-06-11');
  });

  it('returns all 6 domains', () => {
    const state = loadTopic(VALID_SLUG)!;
    expect(state.domains).toHaveLength(6);
  });

  it('domain objects have name, slug, and concepts', () => {
    const state = loadTopic(VALID_SLUG)!;
    for (const domain of state.domains) {
      expect(domain).toHaveProperty('name');
      expect(domain).toHaveProperty('slug');
      expect(domain).toHaveProperty('concepts');
      expect(typeof domain.name).toBe('string');
      expect(typeof domain.slug).toBe('string');
      expect(Array.isArray(domain.concepts)).toBe(true);
      expect(domain.concepts.length).toBeGreaterThan(0);
    }
  });

  it('concepts have expected shape', () => {
    const state = loadTopic(VALID_SLUG)!;
    for (const domain of state.domains) {
      for (const concept of domain.concepts) {
        expect(concept).toHaveProperty('name');
        expect(concept).toHaveProperty('slug');
        expect(concept).toHaveProperty('status');
        expect(concept).toHaveProperty('confidence');
        expect(concept).toHaveProperty('practice_count');
        expect(concept).toHaveProperty('explain_count');
        expect(concept).toHaveProperty('last_explained');
        expect(concept).toHaveProperty('last_practiced');
        expect(concept).toHaveProperty('details');
      }
    }
  });

  it('returns null for a non-existent slug', () => {
    expect(loadTopic(NONEXISTENT_SLUG)).toBeNull();
  });

  it('returns null for an empty string slug', () => {
    expect(loadTopic('')).toBeNull();
  });

  it('includes expected domain names in order', () => {
    const state = loadTopic(VALID_SLUG)!;
    const names = state.domains.map((d) => d.name);
    expect(names).toContain('语言基础');
    expect(names).toContain('函数与作用域');
    expect(names).toContain('对象与原型');
    expect(names).toContain('异步编程');
    expect(names).toContain('内置对象与集合');
    expect(names).toContain('模块与工程化');
  });
});

/* ------------------------------------------------------------------ */
/*  loadKnowledgeMap                                                  */
/* ------------------------------------------------------------------ */

describe('loadKnowledgeMap', () => {
  it('loads raw markdown content for a valid slug', () => {
    const md = loadKnowledgeMap(VALID_SLUG);
    expect(md).not.toBeNull();
    expect(typeof md).toBe('string');
    expect(md!.length).toBeGreaterThan(0);
  });

  it('returns null for a non-existent slug', () => {
    expect(loadKnowledgeMap(NONEXISTENT_SLUG)).toBeNull();
  });

  it('returns null for empty slug', () => {
    expect(loadKnowledgeMap('')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  loadSessionContent                                                */
/* ------------------------------------------------------------------ */

describe('loadSessionContent', () => {
  it('loads content for a valid session path via loadTopicFiles', async () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    const path = files.sessions.find((p) => p.endsWith('language-basics/2026-06-14.md'))!;
    const content = await loadSessionContent(`/topics/${VALID_SLUG}/${path}`);
    expect(content).not.toBeNull();
    expect(content).toContain('Language Basics');
  });

  it('returns null for a non-existent path', async () => {
    expect(await loadSessionContent('/nonexistent/path.md')).toBeNull();
  });

  it('returns null for an empty string path', async () => {
    expect(await loadSessionContent('')).toBeNull();
  });

  it('returns non-empty markdown content for all session files', async () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    for (const p of files.sessions) {
      const content = await loadSessionContent(`/topics/${VALID_SLUG}/${p}`);
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  loadExerciseContent                                               */
/* ------------------------------------------------------------------ */

describe('loadExerciseContent', () => {
  it('loads content for a valid exercise path via loadTopicFiles', async () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    const readmePath = files.exercises.find((p) => p.endsWith('variables-data-types/README.md'))!;
    const content = await loadExerciseContent(`/topics/${VALID_SLUG}/${readmePath}`);
    expect(content).not.toBeNull();
    expect(content).toContain('Variables and Data Types');
  });

  it('returns null for a non-existent path', async () => {
    expect(await loadExerciseContent('/nonexistent/path.md')).toBeNull();
  });

  it('returns null for an empty string path', async () => {
    expect(await loadExerciseContent('')).toBeNull();
  });

  it('loads a JavaScript file as raw text', async () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    const starterPath = files.exercises.find((p) => p.endsWith('variables-data-types/starter.js'))!;
    const content = await loadExerciseContent(`/topics/${VALID_SLUG}/${starterPath}`);
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
  });

  it('loads a JSON file as raw text', async () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    const jsonPath = files.exercises.find((p) =>
      p.endsWith('variables-data-types/practice-2026-06-14.json'),
    )!;
    const content = await loadExerciseContent(`/topics/${VALID_SLUG}/${jsonPath}`);
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-function integration                                        */
/* ------------------------------------------------------------------ */

describe('integration: data consistency', () => {
  it('listAllTopics → loadTopic round-trips correctly', () => {
    const summaries = listAllTopics();
    for (const summary of summaries) {
      const state = loadTopic(summary.slug);
      expect(state).not.toBeNull();
      expect(state!.topic).toBe(summary.name);
      expect(state!.domains.length).toBe(summary.domainCount);
    }
  });

  it('loadTopicFiles returns recursive nested paths', () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    expect(files.exercises).toContain('exercises/js/es6/func/arrow-func/index.js');
    expect(files.sessions).toContain('sessions/js/es6/func.md');
  });

  it('loadTopicFiles handles unicode directory names', () => {
    const files = loadTopicFiles(VALID_SLUG)!;
    expect(files.quizzes).toContain('quizzes/异步Promise/quiz.json');
  });
});

describe('loadTopicFiles', () => {
  function injectFiles(files: Record<string, TopicFiles>): void {
    __injectTestData({
      summaries: [],
      states: {},
      knowledgeMaps: {},
      fileContents: {},
      files,
    });
  }

  afterEach(() => {
    __resetForTest();
  });

  it('returns the injected files for a known slug', () => {
    const files: TopicFiles = {
      sessions: ['sessions/css/box.md'],
      exercises: ['exercises/css/task.js'],
      quizzes: ['quizzes/css/quiz.json'],
    };
    injectFiles({ frontend: files });
    expect(loadTopicFiles('frontend')).toEqual(files);
  });

  it('returns null for an unknown slug', () => {
    injectFiles({ frontend: { sessions: [], exercises: [], quizzes: [] } });
    expect(loadTopicFiles('unknown')).toBeNull();
  });

  it('returns null after reset', () => {
    injectFiles({ frontend: { sessions: [], exercises: [], quizzes: [] } });
    __resetForTest();
    expect(loadTopicFiles('frontend')).toBeNull();
  });
});
