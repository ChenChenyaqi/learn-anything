import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllTopics,
  loadTopic,
  loadKnowledgeMap,
  scanSessions,
  scanExercises,
  scanRootSessions,
  scanRootExercises,
  loadSessionContent,
  loadExerciseContent,
  __resetForTest,
  __injectTestData,
} from '../../site/src/composables/useTopicData';
import type {
  SessionFile,
  ExerciseGroup,
  TopicSummary,
  StateV1,
  ExerciseFile,
} from '../../site/src/composables/useTopicData';

/* ==================================================================== */
/*  Fixture-based tests against packages/cli/test/fixtures/topics/       */
/*  The JavaScript fixture has:                                          */
/*    - state.json with 6 domains, 24 concepts (all 'unexplored')        */
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
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'topics');

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

function scanDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

function isDir(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function loadFixtureData() {
  const summaries: TopicSummary[] = [];
  const states: Record<string, StateV1> = {};
  const knowledgeMaps: Record<string, string> = {};
  const sessions: Record<string, Record<string, SessionFile[]>> = {};
  const exerciseGroups: Record<string, ExerciseGroup[]> = {};
  const orphanSessions: Record<string, SessionFile[]> = {};
  const orphanExercises: Record<string, ExerciseFile[]> = {};
  const fileContentsMap: Record<string, string> = {};

  const topicDirs = scanDir(FIXTURE_DIR).filter((d) => isDir(join(FIXTURE_DIR, d)));

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

    // Sessions
    const sessionsDir = join(topicDir, 'sessions');
    if (existsSync(sessionsDir)) {
      const sEntries = readdirSync(sessionsDir, { withFileTypes: true });
      for (const entry of sEntries) {
        if (entry.isDirectory()) {
          const domain = entry.name;
          const domainDir = join(sessionsDir, domain);
          const files = readdirSync(domainDir)
            .filter((f) => f.endsWith('.md'))
            .map(
              (f): SessionFile => ({
                filename: f,
                path: `/topics/${slug}/sessions/${domain}/${f}`,
              }),
            )
            .sort((a, b) => b.filename.localeCompare(a.filename));
          if (files.length > 0) {
            if (!sessions[slug]) sessions[slug] = {};
            sessions[slug][domain] = files;
          }
          for (const f of readdirSync(domainDir)) {
            const filePath = join(domainDir, f);
            const content = safeReadText(filePath);
            if (content !== null) {
              fileContentsMap[`/topics/${slug}/sessions/${domain}/${f}`] = content;
            }
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          if (!orphanSessions[slug]) orphanSessions[slug] = [];
          orphanSessions[slug].push({
            filename: entry.name,
            path: `/topics/${slug}/sessions/${entry.name}`,
          });
          const content = safeReadText(join(sessionsDir, entry.name));
          if (content !== null) {
            fileContentsMap[`/topics/${slug}/sessions/${entry.name}`] = content;
          }
        }
      }
      if (orphanSessions[slug]) {
        orphanSessions[slug].sort((a, b) => b.filename.localeCompare(a.filename));
      }
    }

    // Exercises
    const exercisesDir = join(topicDir, 'exercises');
    if (existsSync(exercisesDir)) {
      const nameMap = new Map<string, string>();
      for (const domain of state.domains) {
        for (const concept of domain.concepts) {
          nameMap.set(concept.slug, concept.name);
        }
      }

      const raw = new Map<string, ExerciseFile[]>();
      const eEntries = readdirSync(exercisesDir, { withFileTypes: true });
      for (const entry of eEntries) {
        if (entry.isDirectory()) {
          const conceptSlug = entry.name;
          const conceptDir = join(exercisesDir, conceptSlug);
          const files = readdirSync(conceptDir).map(
            (f): ExerciseFile => ({
              name: f,
              path: `/topics/${slug}/exercises/${conceptSlug}/${f}`,
            }),
          );
          raw.set(conceptSlug, files);
          for (const f of readdirSync(conceptDir)) {
            const content = safeReadText(join(conceptDir, f));
            if (content !== null) {
              fileContentsMap[`/topics/${slug}/exercises/${conceptSlug}/${f}`] = content;
            }
          }
        } else if (entry.isFile()) {
          if (!orphanExercises[slug]) orphanExercises[slug] = [];
          orphanExercises[slug].push({
            name: entry.name,
            path: `/topics/${slug}/exercises/${entry.name}`,
          });
          const content = safeReadText(join(exercisesDir, entry.name));
          if (content !== null) {
            fileContentsMap[`/topics/${slug}/exercises/${entry.name}`] = content;
          }
        }
      }

      const groups: ExerciseGroup[] = [];
      for (const [conceptSlug, files] of raw) {
        groups.push({
          conceptSlug,
          conceptName: nameMap.get(conceptSlug) || conceptSlug,
          files,
        });
      }
      groups.sort((a, b) => a.conceptName.localeCompare(b.conceptName));
      if (groups.length > 0) exerciseGroups[slug] = groups;
    }
  }

  summaries.sort((a, b) => a.name.localeCompare(b.name));

  return {
    summaries,
    states,
    knowledgeMaps,
    sessions,
    exerciseGroups,
    orphanSessions,
    orphanExercises,
    fileContents: fileContentsMap,
  };
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

  it('reports zero mastered when all concepts are unexplored', () => {
    const topics = listAllTopics();
    expect(topics[0].masteredCount).toBe(0);
    expect(topics[0].percentage).toBe(0);
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
/*  scanSessions                                                      */
/* ------------------------------------------------------------------ */

describe('scanSessions', () => {
  const slug = VALID_SLUG;

  describe('language-basics domain (2 session files)', () => {
    let sessions: SessionFile[];

    beforeAll(() => {
      sessions = scanSessions(slug, 'language-basics');
    });

    it('returns 2 session files', () => {
      expect(sessions).toHaveLength(2);
    });

    it('returns SessionFile objects with filename and path (content loaded lazily)', () => {
      for (const s of sessions) {
        expect(s).toHaveProperty('filename');
        expect(s).toHaveProperty('path');
        expect(typeof s.filename).toBe('string');
        expect(typeof s.path).toBe('string');
      }
    });

    it('sorts by filename descending (newest first)', () => {
      expect(sessions[0].filename).toBe('2026-06-14.md');
      expect(sessions[1].filename).toBe('2026-06-13.md');
    });

    it('filenames are just the file name, not full paths', () => {
      for (const s of sessions) {
        expect(s.filename).not.toContain('/');
        expect(s.filename).toMatch(/^\d{4}-\d{2}-\d{2}\.md$/);
      }
    });

    it('paths contain the correct topic and domain', () => {
      for (const s of sessions) {
        expect(s.path).toContain(`/topics/${slug}/sessions/language-basics/`);
      }
    });
  });

  describe('functions-scope domain (1 session file)', () => {
    it('returns 1 session file', () => {
      const sessions = scanSessions(slug, 'functions-scope');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].filename).toBe('2026-06-14.md');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for domain with no session files', () => {
      const sessions = scanSessions(slug, 'async-programming');
      expect(sessions).toHaveLength(0);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('returns empty array for non-existent domain', () => {
      const sessions = scanSessions(slug, 'zzz-no-domain');
      expect(sessions).toHaveLength(0);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('returns empty array for non-existent topic', () => {
      const sessions = scanSessions(NONEXISTENT_SLUG, 'language-basics');
      expect(sessions).toHaveLength(0);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('returns empty array for empty domain string', () => {
      const sessions = scanSessions(slug, '');
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  scanExercises                                                     */
/* ------------------------------------------------------------------ */

describe('scanExercises', () => {
  const slug = VALID_SLUG;

  describe('JavaScript topic (has exercises)', () => {
    let groups: ExerciseGroup[];

    beforeAll(() => {
      groups = scanExercises(slug);
    });

    it('returns at least 1 exercise group', () => {
      expect(groups.length).toBeGreaterThan(0);
    });

    it('each group has conceptSlug, conceptName, and files', () => {
      for (const g of groups) {
        expect(g).toHaveProperty('conceptSlug');
        expect(g).toHaveProperty('conceptName');
        expect(g).toHaveProperty('files');
        expect(typeof g.conceptSlug).toBe('string');
        expect(typeof g.conceptName).toBe('string');
        expect(Array.isArray(g.files)).toBe(true);
      }
    });

    it('groups are sorted by conceptName alphabetically', () => {
      for (let i = 1; i < groups.length; i++) {
        expect(
          groups[i].conceptName.localeCompare(groups[i - 1].conceptName),
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it('"variables-data-types" group has 4 files', () => {
      const group = groups.find((g) => g.conceptSlug === 'variables-data-types');
      expect(group).toBeDefined();
      expect(group!.conceptName).toBe('变量与数据类型');
      expect(group!.files).toHaveLength(4);
    });

    it('exercise files have name and path', () => {
      for (const g of groups) {
        for (const f of g.files) {
          expect(f).toHaveProperty('name');
          expect(f).toHaveProperty('path');
          expect(typeof f.name).toBe('string');
          expect(typeof f.path).toBe('string');
        }
      }
    });

    it('exercise file names are just the file name, not full paths', () => {
      for (const g of groups) {
        for (const f of g.files) {
          expect(f.name).not.toContain('/');
        }
      }
    });

    it('exercise file paths contain the correct topic and exercises directory', () => {
      for (const g of groups) {
        for (const f of g.files) {
          expect(f.path).toContain(`/topics/${slug}/exercises/`);
        }
      }
    });

    it('exercise file names include expected files', () => {
      const group = groups.find((g) => g.conceptSlug === 'variables-data-types');
      const names = group!.files.map((f) => f.name);
      expect(names).toContain('README.md');
      expect(names).toContain('starter.js');
      expect(names).toContain('solution.js');
      expect(names).toContain('practice-2026-06-14.json');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for non-existent topic', () => {
      const groups = scanExercises(NONEXISTENT_SLUG);
      expect(groups).toHaveLength(0);
      expect(Array.isArray(groups)).toBe(true);
    });

    it('returns empty array for empty slug', () => {
      const groups = scanExercises('');
      expect(groups).toHaveLength(0);
      expect(Array.isArray(groups)).toBe(true);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  scanRootSessions                                                   */
/* ------------------------------------------------------------------ */

describe('scanRootSessions', () => {
  const slug = VALID_SLUG;

  it('returns orphan session files directly under sessions/', () => {
    const files = scanRootSessions(slug);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(files)).toBe(true);
  });

  it('returns SessionFile objects with filename and path', () => {
    const files = scanRootSessions(slug);
    for (const f of files) {
      expect(f).toHaveProperty('filename');
      expect(f).toHaveProperty('path');
      expect(typeof f.filename).toBe('string');
      expect(typeof f.path).toBe('string');
    }
  });

  it('filenames are just the file name, not full paths', () => {
    const files = scanRootSessions(slug);
    for (const f of files) {
      expect(f.filename).not.toContain('/');
    }
  });

  it('includes the overview.md file', () => {
    const files = scanRootSessions(slug);
    const names = files.map((f) => f.filename);
    expect(names).toContain('overview.md');
  });

  it('paths contain the correct topic and sessions directory', () => {
    const files = scanRootSessions(slug);
    for (const f of files) {
      expect(f.path).toContain(`/topics/${slug}/sessions/`);
    }
  });

  it('returns empty array for non-existent topic', () => {
    const files = scanRootSessions(NONEXISTENT_SLUG);
    expect(files).toHaveLength(0);
    expect(Array.isArray(files)).toBe(true);
  });

  it('returns empty array for empty slug', () => {
    const files = scanRootSessions('');
    expect(files).toHaveLength(0);
    expect(Array.isArray(files)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  scanRootExercises                                                  */
/* ------------------------------------------------------------------ */

describe('scanRootExercises', () => {
  const slug = VALID_SLUG;

  it('returns orphan exercise files directly under exercises/', () => {
    const files = scanRootExercises(slug);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(files)).toBe(true);
  });

  it('returns ExerciseFile objects with name and path', () => {
    const files = scanRootExercises(slug);
    for (const f of files) {
      expect(f).toHaveProperty('name');
      expect(f).toHaveProperty('path');
      expect(typeof f.name).toBe('string');
      expect(typeof f.path).toBe('string');
    }
  });

  it('exercise file names include expected orphan files', () => {
    const files = scanRootExercises(slug);
    const names = files.map((f) => f.name);
    expect(names).toContain('warmup.js');
  });

  it('file names are just the file name, not full paths', () => {
    const files = scanRootExercises(slug);
    for (const f of files) {
      expect(f.name).not.toContain('/');
    }
  });

  it('paths contain the correct topic and exercises directory', () => {
    const files = scanRootExercises(slug);
    for (const f of files) {
      expect(f.path).toContain(`/topics/${slug}/exercises/`);
    }
  });

  it('returns empty array for non-existent topic', () => {
    const files = scanRootExercises(NONEXISTENT_SLUG);
    expect(files).toHaveLength(0);
    expect(Array.isArray(files)).toBe(true);
  });

  it('returns empty array for empty slug', () => {
    const files = scanRootExercises('');
    expect(files).toHaveLength(0);
    expect(Array.isArray(files)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  loadSessionContent                                                */
/* ------------------------------------------------------------------ */

describe('loadSessionContent', () => {
  it('loads content for a valid session path', async () => {
    const sessions = scanSessions(VALID_SLUG, 'language-basics');
    const content = await loadSessionContent(sessions[0].path);
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
    const sessions = scanSessions(VALID_SLUG, 'language-basics');
    for (const s of sessions) {
      const content = await loadSessionContent(s.path);
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });

  it('loads content for orphan session file under sessions/', async () => {
    const files = scanRootSessions(VALID_SLUG);
    expect(files.length).toBeGreaterThan(0);
    const content = await loadSessionContent(files[0].path);
    expect(content).not.toBeNull();
    expect(content).toContain('JavaScript Overview');
  });
});

/* ------------------------------------------------------------------ */
/*  loadExerciseContent                                               */
/* ------------------------------------------------------------------ */

describe('loadExerciseContent', () => {
  it('loads content for a valid exercise path', async () => {
    const groups = scanExercises(VALID_SLUG);
    const readme = groups
      .find((g) => g.conceptSlug === 'variables-data-types')!
      .files.find((f) => f.name === 'README.md')!;

    const content = await loadExerciseContent(readme.path);
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
    const groups = scanExercises(VALID_SLUG);
    const starter = groups
      .find((g) => g.conceptSlug === 'variables-data-types')!
      .files.find((f) => f.name === 'starter.js')!;

    const content = await loadExerciseContent(starter.path);
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
  });

  it('loads a JSON file as raw text', async () => {
    const groups = scanExercises(VALID_SLUG);
    const jsonFile = groups
      .find((g) => g.conceptSlug === 'variables-data-types')!
      .files.find((f) => f.name === 'practice-2026-06-14.json')!;

    const content = await loadExerciseContent(jsonFile.path);
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
  });

  it('loads orphan exercise file under exercises/', async () => {
    const files = scanRootExercises(VALID_SLUG);
    expect(files.length).toBeGreaterThan(0);
    const content = await loadExerciseContent(files[0].path);
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
    expect(content).toContain('typeCheck');
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

  it('scanSessions + loadSessionContent provides valid markdown', async () => {
    const sessions = scanSessions(VALID_SLUG, 'language-basics');
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      const content = await loadSessionContent(s.path);
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });

  it('scanExercises + loadExerciseContent return consistent data', async () => {
    const groups = scanExercises(VALID_SLUG);
    for (const group of groups) {
      for (const file of group.files) {
        const content = await loadExerciseContent(file.path);
        expect(content).not.toBeNull();
        expect(typeof content).toBe('string');
      }
    }
  });

  it('topic page flow: loadTopic then scanSessions for each domain', () => {
    const state = loadTopic(VALID_SLUG)!;
    let totalSessions = 0;
    for (const domain of state.domains) {
      const sessions = scanSessions(VALID_SLUG, domain.slug);
      totalSessions += sessions.length;
      for (const s of sessions) {
        expect(s.path).toContain(`/${domain.slug}/`);
      }
    }
    expect(totalSessions).toBe(3);
  });

  it('session content loaded on demand matches expected content', async () => {
    const sessions = scanSessions(VALID_SLUG, 'language-basics');
    const newest = sessions[0];
    const content = await loadSessionContent(newest.path);
    expect(content).not.toBeNull();
    expect(content).toContain('Language Basics');
  });

  it('scanRootSessions + loadSessionContent round-trip', async () => {
    const files = scanRootSessions(VALID_SLUG);
    for (const f of files) {
      const content = await loadSessionContent(f.path);
      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    }
  });

  it('scanRootExercises + loadExerciseContent round-trip', async () => {
    const files = scanRootExercises(VALID_SLUG);
    for (const f of files) {
      const content = await loadExerciseContent(f.path);
      expect(content).not.toBeNull();
      expect(typeof content).toBe('string');
    }
  });

  it('root session files do not appear in domain sessions', () => {
    const rootFiles = scanRootSessions(VALID_SLUG);
    const rootPaths = new Set(rootFiles.map((f) => f.path));
    const state = loadTopic(VALID_SLUG)!;
    for (const domain of state.domains) {
      const sessions = scanSessions(VALID_SLUG, domain.slug);
      for (const s of sessions) {
        expect(rootPaths.has(s.path)).toBe(false);
      }
    }
  });

  it('root exercise files do not appear in concept exercise groups', () => {
    const rootFiles = scanRootExercises(VALID_SLUG);
    const rootPaths = new Set(rootFiles.map((f) => f.path));
    const groups = scanExercises(VALID_SLUG);
    for (const group of groups) {
      for (const f of group.files) {
        expect(rootPaths.has(f.path)).toBe(false);
      }
    }
  });
});
