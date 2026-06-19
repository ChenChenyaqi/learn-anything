// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchEntry } from '../../site/src/composables/useSearch';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/*                                                                     */
/*  useSearchModal imports loadSearchIndex and search from useSearch.  */
/*  We mock the module so the composable's ensureIndex / runSearch     */
/*  can be tested without real fetch or module-level cache state.      */
/* ------------------------------------------------------------------ */

const mockLoadSearchIndex = vi.fn();
const mockSearch = vi.fn();

vi.mock('../../site/src/composables/useSearch', () => ({
  loadSearchIndex: (...a: unknown[]) => mockLoadSearchIndex(...a),
  search: (...a: unknown[]) => mockSearch(...a),
}));

import {
  groupResults,
  breadcrumb,
  resolveNavKey,
  useSearchModal,
} from '../../site/src/composables/useSearchModal';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                            */
/* ------------------------------------------------------------------ */

function entry(overrides: Partial<SearchEntry> = {}): SearchEntry {
  return {
    title: 'Default',
    level: 1,
    path: '/topics/js/sessions/basics/2026-01-01.md',
    topicSlug: 'js',
    topicName: 'JavaScript',
    section: 'Basics',
    kind: 'note',
    ...overrides,
  };
}

const FIXTURE: SearchEntry[] = [
  entry({ title: 'language-basics', level: 0 }),
  entry({ title: 'Operators', level: 2 }),
  entry({ title: 'Control Flow', level: 2 }),
  entry({
    title: 'Overview',
    level: 2,
    path: '/topics/js/knowledge-map.md',
    section: 'Knowledge Map',
    kind: 'knowledge-map',
  }),
  entry({
    title: 'Challenge',
    level: 2,
    path: '/topics/react/exercises/hooks/prompt.md',
    topicSlug: 'react',
    topicName: 'React',
    section: 'Hooks',
    kind: 'exercise',
  }),
];

/* ================================================================== */
/*  Pure functions                                                     */
/* ================================================================== */

describe('groupResults', () => {
  it('returns an empty array for empty input', () => {
    expect(groupResults([])).toEqual([]);
  });

  it('creates one group per unique file path', () => {
    const groups = groupResults(FIXTURE);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.key)).toEqual([
      '/topics/js/sessions/basics/2026-01-01.md',
      '/topics/js/knowledge-map.md',
      '/topics/react/exercises/hooks/prompt.md',
    ]);
  });

  it('groups entries with the same path together', () => {
    const groups = groupResults(FIXTURE);
    expect(groups[0].entries).toHaveLength(3);
    expect(groups[0].entries.map((e) => e.title)).toEqual([
      'language-basics',
      'Operators',
      'Control Flow',
    ]);
  });

  it('computes label as "topicName / section"', () => {
    const groups = groupResults(FIXTURE);
    expect(groups[0].label).toBe('JavaScript / Basics');
    expect(groups[1].label).toBe('JavaScript / Knowledge Map');
    expect(groups[2].label).toBe('React / Hooks');
  });

  it('sets startIndex to the flat-array position of the first entry', () => {
    const groups = groupResults(FIXTURE);
    expect(groups[0].startIndex).toBe(0);
    expect(groups[1].startIndex).toBe(3);
    expect(groups[2].startIndex).toBe(4);
  });

  it('preserves entry order within a group', () => {
    const groups = groupResults(FIXTURE);
    expect(groups[1].entries[0].title).toBe('Overview');
  });
});

describe('breadcrumb', () => {
  it('extracts relative path after /topics/<slug>/', () => {
    expect(breadcrumb(entry({ path: '/topics/js/sessions/basics/2026-01-01.md' }))).toBe(
      'sessions/basics/2026-01-01.md',
    );
  });

  it('handles knowledge-map paths', () => {
    expect(breadcrumb(entry({ path: '/topics/js/knowledge-map.md' }))).toBe('knowledge-map.md');
  });

  it('handles nested exercise paths', () => {
    expect(breadcrumb(entry({ path: '/topics/react/exercises/hooks/prompt.md' }))).toBe(
      'exercises/hooks/prompt.md',
    );
  });
});

describe('resolveNavKey', () => {
  it('maps ArrowDown to move +1', () => {
    expect(resolveNavKey('ArrowDown')).toEqual({ type: 'move', delta: 1 });
  });

  it('maps ArrowUp to move -1', () => {
    expect(resolveNavKey('ArrowUp')).toEqual({ type: 'move', delta: -1 });
  });

  it('maps Enter to select', () => {
    expect(resolveNavKey('Enter')).toEqual({ type: 'select' });
  });

  it('maps Escape to close', () => {
    expect(resolveNavKey('Escape')).toEqual({ type: 'close' });
  });

  it('maps Tab to trap', () => {
    expect(resolveNavKey('Tab')).toEqual({ type: 'trap' });
  });

  it('returns null for irrelevant keys', () => {
    expect(resolveNavKey('a')).toBeNull();
    expect(resolveNavKey('Shift')).toBeNull();
    expect(resolveNavKey('Backspace')).toBeNull();
  });
});

/* ================================================================== */
/*  Composable — useSearchModal                                        */
/* ================================================================== */

describe('useSearchModal', () => {
  beforeEach(() => {
    mockLoadSearchIndex.mockReset();
    mockSearch.mockReset();
  });

  /* ---- initial state ---- */

  it('initialises with empty state', () => {
    const m = useSearchModal();
    expect(m.query.value).toBe('');
    expect(m.results.value).toEqual([]);
    expect(m.activeIndex.value).toBe(0);
    expect(m.loadingError.value).toBe(false);
    expect(m.hasQuery.value).toBe(false);
    expect(m.hasResults.value).toBe(false);
    expect(m.activeEntry.value).toBeNull();
  });

  /* ---- hasQuery / hasResults ---- */

  it('hasQuery reflects trimmed query', () => {
    const m = useSearchModal();
    expect(m.hasQuery.value).toBe(false);
    m.query.value = '  hello  ';
    expect(m.hasQuery.value).toBe(true);
    m.query.value = '   ';
    expect(m.hasQuery.value).toBe(false);
  });

  it('hasResults tracks results array', () => {
    const m = useSearchModal();
    expect(m.hasResults.value).toBe(false);
    m.results.value = [entry()];
    expect(m.hasResults.value).toBe(true);
  });

  /* ---- runSearch ---- */

  it('runSearch calls search() and stores results', () => {
    const m = useSearchModal();
    mockSearch.mockReturnValue(FIXTURE);

    m.query.value = 'operators';
    m.runSearch();

    expect(mockSearch).toHaveBeenCalledWith('operators');
    expect(m.results.value).toEqual(FIXTURE);
    expect(m.activeIndex.value).toBe(0);
  });

  it('runSearch resets activeIndex to 0', () => {
    const m = useSearchModal();
    mockSearch.mockReturnValue(FIXTURE);
    m.activeIndex.value = 3;

    m.runSearch();

    expect(m.activeIndex.value).toBe(0);
  });

  /* ---- groups / activeEntry ---- */

  it('groups is computed from results', async () => {
    const m = useSearchModal();
    mockSearch.mockReturnValue(FIXTURE);
    m.query.value = 'x';
    m.runSearch();

    expect(m.groups.value).toHaveLength(3);
  });

  it('activeEntry returns the entry at activeIndex', () => {
    const m = useSearchModal();
    m.results.value = FIXTURE;
    m.activeIndex.value = 1;

    expect(m.activeEntry.value).toEqual(FIXTURE[1]);
  });

  it('activeEntry returns null when index is out of range', () => {
    const m = useSearchModal();
    m.results.value = [entry()];
    m.activeIndex.value = 5;

    expect(m.activeEntry.value).toBeNull();
  });

  /* ---- moveActive ---- */

  it('moveActive(1) advances and wraps around', () => {
    const m = useSearchModal();
    m.results.value = FIXTURE.slice(0, 3);

    m.moveActive(1);
    expect(m.activeIndex.value).toBe(1);
    m.moveActive(1);
    expect(m.activeIndex.value).toBe(2);
    m.moveActive(1);
    expect(m.activeIndex.value).toBe(0); // wrap
  });

  it('moveActive(-1) goes backwards and wraps around', () => {
    const m = useSearchModal();
    m.results.value = FIXTURE.slice(0, 3);

    m.moveActive(-1);
    expect(m.activeIndex.value).toBe(2); // wrap from 0 → last
    m.moveActive(-1);
    expect(m.activeIndex.value).toBe(1);
  });

  it('moveActive does nothing with empty results', () => {
    const m = useSearchModal();
    m.moveActive(1);
    expect(m.activeIndex.value).toBe(0);
  });

  /* ---- setActive ---- */

  it('setActive sets index within range', () => {
    const m = useSearchModal();
    m.results.value = FIXTURE;

    m.setActive(2);
    expect(m.activeIndex.value).toBe(2);
  });

  it('setActive ignores out-of-range indices', () => {
    const m = useSearchModal();
    m.results.value = FIXTURE;
    m.activeIndex.value = 1;

    m.setActive(-1);
    expect(m.activeIndex.value).toBe(1); // unchanged

    m.setActive(999);
    expect(m.activeIndex.value).toBe(1); // unchanged
  });

  /* ---- reset ---- */

  it('reset clears all state', () => {
    const m = useSearchModal();
    m.query.value = 'test';
    m.results.value = FIXTURE;
    m.activeIndex.value = 2;
    m.loadingError.value = true;

    m.reset();

    expect(m.query.value).toBe('');
    expect(m.results.value).toEqual([]);
    expect(m.activeIndex.value).toBe(0);
    expect(m.loadingError.value).toBe(false);
  });

  /* ---- ensureIndex ---- */

  it('ensureIndex calls loadSearchIndex', async () => {
    mockLoadSearchIndex.mockResolvedValue(undefined);
    const m = useSearchModal();

    await m.ensureIndex();

    expect(mockLoadSearchIndex).toHaveBeenCalledOnce();
    expect(m.loadingError.value).toBe(false);
  });

  it('ensureIndex sets loadingError on failure', async () => {
    mockLoadSearchIndex.mockRejectedValue(new Error('network'));
    const m = useSearchModal();

    await m.ensureIndex();

    expect(m.loadingError.value).toBe(true);
  });

  it('ensureIndex clears a previous loadingError on success', async () => {
    mockLoadSearchIndex.mockRejectedValueOnce(new Error('fail'));
    mockLoadSearchIndex.mockResolvedValue(undefined);
    const m = useSearchModal();

    await m.ensureIndex();
    expect(m.loadingError.value).toBe(true);

    await m.ensureIndex();
    expect(m.loadingError.value).toBe(false);
  });
});
