import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchEntry } from '../../site/src/composables/useSearch';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/*                                                                     */
/*  useSearch has module-level state (indexCache, loadedVersion, etc.) */
/*  so we vi.resetModules() in beforeEach and re-import fresh each     */
/*  time.  getDataVersion is mocked so we can simulate SSE version     */
/*  bumps without importing the full useTopicData module.              */
/* ------------------------------------------------------------------ */

const mockGetDataVersion = vi.fn(() => 0);

vi.mock('../../site/src/composables/useTopicData', () => ({
  getDataVersion: () => mockGetDataVersion(),
}));

/* ------------------------------------------------------------------ */
/*  Fixture data                                                       */
/* ------------------------------------------------------------------ */

const FIXTURE: SearchEntry[] = [
  {
    title: 'language-basics',
    level: 0,
    path: '/topics/javascript/sessions/language-basics/2026-06-14.md',
    topicSlug: 'javascript',
    topicName: 'JavaScript',
    section: 'Language Basics',
    kind: 'note',
  },
  {
    title: 'Operators and Control Flow',
    level: 2,
    path: '/topics/javascript/sessions/language-basics/2026-06-14.md',
    topicSlug: 'javascript',
    topicName: 'JavaScript',
    section: 'Language Basics',
    kind: 'note',
  },
  {
    title: '控制流',
    level: 3,
    path: '/topics/javascript/sessions/language-basics/2026-06-14.md',
    topicSlug: 'javascript',
    topicName: 'JavaScript',
    section: 'Language Basics',
    kind: 'note',
  },
  {
    title: 'knowledge-map',
    level: 0,
    path: '/topics/javascript/knowledge-map.md',
    topicSlug: 'javascript',
    topicName: 'JavaScript',
    section: 'Knowledge Map',
    kind: 'knowledge-map',
  },
  {
    title: 'Overview',
    level: 2,
    path: '/topics/javascript/knowledge-map.md',
    topicSlug: 'javascript',
    topicName: 'JavaScript',
    section: 'Knowledge Map',
    kind: 'knowledge-map',
  },
  {
    title: 'use-effect',
    level: 0,
    path: '/topics/react/exercises/use-effect/prompt.md',
    topicSlug: 'react',
    topicName: 'React',
    section: 'Use Effect',
    kind: 'exercise',
  },
  {
    title: 'Challenge',
    level: 2,
    path: '/topics/react/exercises/use-effect/prompt.md',
    topicSlug: 'react',
    topicName: 'React',
    section: 'Use Effect',
    kind: 'exercise',
  },
];

function mockResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useSearch', () => {
  let loadSearchIndex: typeof import('../../site/src/composables/useSearch').loadSearchIndex;
  let search: typeof import('../../site/src/composables/useSearch').search;
  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockGetDataVersion.mockReturnValue(0);

    const mod = await import('../../site/src/composables/useSearch');
    loadSearchIndex = mod.loadSearchIndex;
    search = mod.search;
  });

  /* ---- loadSearchIndex ---- */

  it('fetches from /api/search-index and returns the parsed array', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));

    const result = await loadSearchIndex();

    expect(mockFetch).toHaveBeenCalledWith('/api/search-index');
    expect(result).toBe(FIXTURE);
  });

  it('caches the result — second call does not fetch again', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));

    await loadSearchIndex();
    await loadSearchIndex();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent calls into a single fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));

    const [a, b] = await Promise.all([loadSearchIndex(), loadSearchIndex()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(FIXTURE);
    expect(b).toBe(FIXTURE);
  });

  it('throws when the response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(loadSearchIndex()).rejects.toThrow('search-index: 500');
  });

  /* ---- search (before index is loaded) ---- */

  it('returns an empty array when the index has not been loaded', () => {
    expect(search('anything')).toEqual([]);
  });

  /* ---- search (basic matching) ---- */

  it('matches case-insensitively', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    const upper = search('OPERATORS');
    const lower = search('operators');

    expect(upper.map((e) => e.title)).toEqual(['Operators and Control Flow']);
    expect(lower.map((e) => e.title)).toEqual(['Operators and Control Flow']);
  });

  it('matches partial substrings', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    const results = search('control').map((e) => e.title);
    expect(results).toEqual(['Operators and Control Flow']);
  });

  it('matches CJK text', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    const results = search('控制').map((e) => e.title);
    expect(results).toEqual(['控制流']);
  });

  it('matches filename entries (level 0)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    const results = search('knowledge-map').map((e) => e.title);
    expect(results).toEqual(['knowledge-map']);
  });

  it('returns multiple matches across topics', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    const results = search('o').map((e) => e.title);
    expect(results).toContain('Operators and Control Flow');
    expect(results).toContain('Overview');
  });

  /* ---- search (edge cases) ---- */

  it('returns an empty array for an empty query', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    expect(search('')).toEqual([]);
  });

  it('returns an empty array for a whitespace-only query', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    expect(search('   ')).toEqual([]);
  });

  it('returns an empty array when no titles match', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    expect(search('zzz-nonexistent')).toEqual([]);
  });

  /* ---- SSE invalidation ---- */

  it('refetches when getDataVersion() bumps', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    // Simulate SSE reload — version goes from 0 → 1
    mockGetDataVersion.mockReturnValue(1);
    mockFetch.mockResolvedValueOnce(
      mockResponse([...FIXTURE, { ...FIXTURE[0], title: 'New Entry' }]),
    );

    await loadSearchIndex();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(search('New Entry')).toHaveLength(1);
  });

  it('does not refetch when getDataVersion() is unchanged', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(FIXTURE));
    await loadSearchIndex();

    mockGetDataVersion.mockReturnValue(0);
    await loadSearchIndex();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
