import { computed, ref } from 'vue';
import { loadSearchIndex, search, type SearchEntry } from './useSearch';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResultGroup {
  key: string;
  label: string;
  entries: SearchEntry[];
  /** Flat-array start index of this group's first entry. */
  startIndex: number;
}

export type NavAction =
  | { type: 'move'; delta: 1 | -1 }
  | { type: 'select' }
  | { type: 'close' }
  | { type: 'trap' };

/* ------------------------------------------------------------------ */
/*  Pure helpers (no Vue dependency — unit-testable in isolation)      */
/* ------------------------------------------------------------------ */

/** Group flat search results by file path for display. */
export function groupResults(entries: SearchEntry[]): ResultGroup[] {
  const out: ResultGroup[] = [];
  const map = new Map<string, ResultGroup>();

  entries.forEach((entry, i) => {
    let group = map.get(entry.path);
    if (!group) {
      group = {
        key: entry.path,
        label: `${entry.topicName} / ${entry.section}`,
        entries: [],
        startIndex: i,
      };
      map.set(entry.path, group);
      out.push(group);
    }
    group.entries.push(entry);
  });

  return out;
}

/** Extract relative file path from an API path for breadcrumb display. */
export function breadcrumb(entry: SearchEntry): string {
  return entry.path.split('/').slice(3).join('/');
}

/** Map a keyboard event key to a navigation action, or null if irrelevant. */
export function resolveNavKey(key: string): NavAction | null {
  switch (key) {
    case 'ArrowDown':
      return { type: 'move', delta: 1 };
    case 'ArrowUp':
      return { type: 'move', delta: -1 };
    case 'Enter':
      return { type: 'select' };
    case 'Escape':
      return { type: 'close' };
    case 'Tab':
      return { type: 'trap' };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Composable — reactive search modal state                           */
/* ------------------------------------------------------------------ */

export function useSearchModal() {
  const query = ref('');
  const results = ref<SearchEntry[]>([]);
  const activeIndex = ref(0);
  const loadingError = ref(false);

  const hasQuery = computed(() => query.value.trim().length > 0);
  const hasResults = computed(() => results.value.length > 0);
  const groups = computed(() => groupResults(results.value));
  const activeEntry = computed(() => results.value[activeIndex.value] ?? null);

  /** Lazily fetch the search index; sets loadingError on failure. */
  async function ensureIndex() {
    loadingError.value = false;
    try {
      await loadSearchIndex();
    } catch {
      loadingError.value = true;
    }
  }

  /** Run a client-side search and reset the active highlight. */
  function runSearch() {
    results.value = search(query.value);
    activeIndex.value = 0;
  }

  /** Reset all modal state to initial values. */
  function reset() {
    query.value = '';
    results.value = [];
    activeIndex.value = 0;
    loadingError.value = false;
  }

  /** Move the active highlight by delta (+1 / -1), wrapping around. */
  function moveActive(delta: number) {
    const n = results.value.length;
    if (n === 0) return;
    activeIndex.value = (activeIndex.value + delta + n) % n;
  }

  /** Set the active index directly (clamped to valid range). */
  function setActive(index: number) {
    if (index >= 0 && index < results.value.length) {
      activeIndex.value = index;
    }
  }

  return {
    query,
    results,
    activeIndex,
    loadingError,
    hasQuery,
    hasResults,
    groups,
    activeEntry,
    ensureIndex,
    runSearch,
    reset,
    moveActive,
    setActive,
  };
}
