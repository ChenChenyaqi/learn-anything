/* ================================================================== */
/*  useTopicData — Data access layer (fetch-based)                     */
/*                                                                     */
/*  Fetches data from the local API server (serve.mjs).                */
/*  All data is loaded eagerly on initTopicData() and cached in memory. */
/*  Session/exercise content is loaded on demand via fetch().          */
/*                                                                     */
/*  In dev, vite proxies /api → serve.mjs (port 24277).                */
/*  In prod, serve.mjs serves both static + API on a single port.      */
/* ================================================================== */

import { ref } from 'vue';
import type {
  StateV1,
  TopicSummary,
  SessionFile,
  ExerciseFile,
  ExerciseGroup,
} from './topicDataTypes';
import { createSSEListener } from './useSSE';
import { clearFileContentCache, setFileContent } from './fileContentCache';

/* ------------------------------------------------------------------ */
/*  Types (re-exported for consumers)                                 */
/* ------------------------------------------------------------------ */

export type {
  ConceptStatus,
  Concept,
  Domain,
  StateV1,
  TopicSummary,
  SessionFile,
  ExerciseFile,
  ExerciseGroup,
  SelectedFilePayload,
} from './topicDataTypes';

export { loadFileContent, loadSessionContent, loadExerciseContent } from './fileContentCache';

/* ------------------------------------------------------------------ */
/*  In-memory indexes (populated by initTopicData)                     */
/* ------------------------------------------------------------------ */

let ready = false;
let initPromise: Promise<void> | null = null;
let initVersion = 0;

const stateBySlug = new Map<string, StateV1>();
const knowledgeMapBySlug = new Map<string, string>();
const sessionsBySlug = new Map<string, Map<string, SessionFile[]>>();
const exerciseGroupsBySlug = new Map<string, ExerciseGroup[]>();
const orphanSessionsBySlug = new Map<string, SessionFile[]>();
const orphanExercisesBySlug = new Map<string, ExerciseFile[]>();

let topicSummaryCache: TopicSummary[] | null = null;

const dataVersion = ref(0);

export function getDataVersion(): number {
  return dataVersion.value;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function clearIndexes() {
  initPromise = null;
  ready = false;
  initVersion++;
  stateBySlug.clear();
  knowledgeMapBySlug.clear();
  sessionsBySlug.clear();
  exerciseGroupsBySlug.clear();
  orphanSessionsBySlug.clear();
  orphanExercisesBySlug.clear();
  clearFileContentCache();
  topicSummaryCache = null;
}

/* ------------------------------------------------------------------ */
/*  Test-only injection API                                            */
/* ------------------------------------------------------------------ */

export function __resetForTest(): void {
  clearIndexes();
}

export function __injectTestData(data: {
  summaries: TopicSummary[];
  states: Record<string, StateV1>;
  knowledgeMaps: Record<string, string>;
  sessions: Record<string, Record<string, SessionFile[]>>;
  exerciseGroups: Record<string, ExerciseGroup[]>;
  orphanSessions: Record<string, SessionFile[]>;
  orphanExercises: Record<string, ExerciseFile[]>;
  fileContents: Record<string, string>;
}): void {
  topicSummaryCache = data.summaries;
  for (const [slug, state] of Object.entries(data.states)) stateBySlug.set(slug, state);
  for (const [slug, md] of Object.entries(data.knowledgeMaps)) knowledgeMapBySlug.set(slug, md);
  for (const [slug, domainMap] of Object.entries(data.sessions)) {
    sessionsBySlug.set(slug, new Map(Object.entries(domainMap)));
  }
  for (const [slug, groups] of Object.entries(data.exerciseGroups))
    exerciseGroupsBySlug.set(slug, groups);
  for (const [slug, files] of Object.entries(data.orphanSessions))
    orphanSessionsBySlug.set(slug, files);
  for (const [slug, files] of Object.entries(data.orphanExercises))
    orphanExercisesBySlug.set(slug, files);
  for (const [path, content] of Object.entries(data.fileContents)) setFileContent(path, content);
  ready = true;
}

/* ------------------------------------------------------------------ */
/*  Build indexes from API response                                    */
/* ------------------------------------------------------------------ */

function buildIndexes(
  summaries: TopicSummary[],
  topicDataMap: Map<
    string,
    {
      state: StateV1;
      knowledgeMap: string;
      sessions: Record<string, SessionFile[]>;
      rootSessions: SessionFile[];
      exercises: ExerciseGroup[];
      rootExercises: ExerciseFile[];
    }
  >,
) {
  topicSummaryCache = summaries;

  for (const [slug, data] of topicDataMap) {
    stateBySlug.set(slug, data.state);
    knowledgeMapBySlug.set(slug, data.knowledgeMap || '');

    if (data.sessions) {
      const domainMap = new Map<string, SessionFile[]>();
      for (const [domain, files] of Object.entries(data.sessions)) {
        domainMap.set(domain, files);
      }
      if (domainMap.size > 0) sessionsBySlug.set(slug, domainMap);
    }

    if (data.exercises && data.exercises.length > 0) {
      exerciseGroupsBySlug.set(slug, data.exercises);
    }

    if (data.rootSessions && data.rootSessions.length > 0) {
      orphanSessionsBySlug.set(slug, data.rootSessions);
    }

    if (data.rootExercises && data.rootExercises.length > 0) {
      orphanExercisesBySlug.set(slug, data.rootExercises);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Initialization (called once on app mount)                          */
/* ------------------------------------------------------------------ */

export async function initTopicData(): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;

  const version = initVersion;

  initPromise = (async () => {
    const resp = await fetch('/api/topics');
    if (!resp.ok || version !== initVersion) {
      initPromise = null;
      return;
    }
    const summaries: TopicSummary[] = await resp.json();

    const topicDataMap = new Map();
    await Promise.all(
      summaries.map(async (s) => {
        const r = await fetch(`/api/topics/${encodeURIComponent(s.slug)}`);
        if (r.ok && version === initVersion) {
          topicDataMap.set(s.slug, await r.json());
        }
      }),
    );

    if (version !== initVersion) {
      initPromise = null;
      return;
    }
    buildIndexes(summaries, topicDataMap);
    ready = true;
  })();

  return initPromise;
}

/* ------------------------------------------------------------------ */
/*  SSE file change listener                                           */
/* ------------------------------------------------------------------ */

export function listenForChanges(callback: () => void): () => void {
  return createSSEListener('/api/events', () => {
    clearIndexes();
    initTopicData().then(() => {
      dataVersion.value++;
      callback();
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export function listAllTopics(): TopicSummary[] {
  return topicSummaryCache ?? [];
}

export function loadTopic(slug: string): StateV1 | null {
  return stateBySlug.get(slug) ?? null;
}

export function loadKnowledgeMap(slug: string): string | null {
  return knowledgeMapBySlug.get(slug) ?? null;
}

export function scanSessions(slug: string, domain: string): SessionFile[] {
  return sessionsBySlug.get(slug)?.get(domain) ?? [];
}

/** Slugs of the actual `sessions/<domain>` folders that contain note files. */
export function scanDomainDirs(slug: string): string[] {
  return [...(sessionsBySlug.get(slug)?.keys() ?? [])];
}

export function scanExercises(slug: string): ExerciseGroup[] {
  return exerciseGroupsBySlug.get(slug) ?? [];
}

export function scanRootSessions(slug: string): SessionFile[] {
  return orphanSessionsBySlug.get(slug) ?? [];
}

export function scanRootExercises(slug: string): ExerciseFile[] {
  return orphanExercisesBySlug.get(slug) ?? [];
}
