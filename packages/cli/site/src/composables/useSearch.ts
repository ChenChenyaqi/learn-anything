import { getDataVersion } from './useTopicData';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SearchEntry {
  /** Heading text, or the filename (without `.md`) for the level-0 entry. */
  title: string;
  /** 0 = filename pseudo-entry, 1–6 = ATX heading depth. */
  level: number;
  /** API path, e.g. `/topics/javascript/sessions/language-basics/2026-06-14.md`. */
  path: string;
  topicSlug: string;
  topicName: string;
  /** Resolved domain/concept display name, topic name, or "Knowledge Map". */
  section: string;
  kind: 'note' | 'knowledge-map' | 'exercise';
}

/* ------------------------------------------------------------------ */
/*  Module-level cache                                                 */
/*                                                                     */
/*  The index is fetched once from /api/search-index and kept in       */
/*  memory.  search() filters this array synchronously — there are no  */
/*  per-keystroke network requests.                                    */
/*                                                                     */
/*  Staleness is tracked via loadedVersion: when the SSE reload bumps   */
/*  getDataVersion(), the next loadSearchIndex() call refetches.        */
/* ------------------------------------------------------------------ */

let indexCache: SearchEntry[] | null = null;
let fetchPromise: Promise<SearchEntry[]> | null = null;
let fetchVersion = -1;
let loadedVersion = -1;

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Lazily fetch and cache the search index.
 *
 * If the SSE reload signal has bumped `getDataVersion()` since the last
 * fetch, the cache is discarded and a fresh request is made.
 */
export function loadSearchIndex(): Promise<SearchEntry[]> {
  const currentVersion = getDataVersion();

  if (loadedVersion !== currentVersion) {
    indexCache = null;
  }

  if (indexCache) return Promise.resolve(indexCache);
  if (fetchPromise && fetchVersion === currentVersion) return fetchPromise;

  fetchVersion = currentVersion;
  fetchPromise = fetch('/api/search-index')
    .then((r) => {
      if (!r.ok) throw new Error(`search-index: ${r.status}`);
      return r.json() as Promise<SearchEntry[]>;
    })
    .then((data) => {
      indexCache = data;
      loadedVersion = currentVersion;
      fetchPromise = null;
      return data;
    });

  return fetchPromise;
}

/**
 * Case-insensitive substring filter over the in-memory index.
 *
 * Returns an empty array when the index hasn't been loaded yet —
 * call `loadSearchIndex()` first (typically on modal open).
 */
export function search(query: string): SearchEntry[] {
  if (!indexCache) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return indexCache.filter((e) => e.title.toLowerCase().includes(q));
}
