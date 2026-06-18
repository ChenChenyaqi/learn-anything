import { ref } from 'vue';

/* ------------------------------------------------------------------ */
/*  useTreeExpansion — sidebar tree expand/collapse state              */
/*                                                                     */
/*  Persists expanded nodes to sessionStorage so they survive a page    */
/*  refresh but reset when the tab closes. Expansion is driven only by */
/*  user toggles; selecting a file may *add* a parent node but never    */
/*  collapses others. State is scoped per tree type × topic slug.      */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'learn-anything-tree-expansion';

type ExpansionStore = Record<string, Record<string, string[]>>;

function readStore(): ExpansionStore {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ExpansionStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: ExpansionStore): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota / private-mode errors — expansion is non-critical.
  }
}

export function useTreeExpansion(treeType: string) {
  const expanded = ref<Set<string>>(new Set());

  function persist(topicSlug: string): void {
    const store = readStore();
    if (!store[treeType]) store[treeType] = {};
    store[treeType][topicSlug] = [...expanded.value];
    writeStore(store);
  }

  /**
   * Load the persisted expansion for a topic. Falls back to `defaultSlugs`
   * (and persists them) when there is no prior record.
   */
  function load(topicSlug: string, defaultSlugs: string[] = []): void {
    const stored = readStore()[treeType]?.[topicSlug];
    if (stored) {
      expanded.value = new Set(stored);
    } else {
      expanded.value = new Set(defaultSlugs);
      persist(topicSlug);
    }
  }

  function toggle(topicSlug: string, slug: string): void {
    const next = new Set(expanded.value);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    expanded.value = next;
    persist(topicSlug);
  }

  /** Expand a node without collapsing others. No-op if already expanded. */
  function add(topicSlug: string, slug: string): void {
    if (expanded.value.has(slug)) return;
    const next = new Set(expanded.value);
    next.add(slug);
    expanded.value = next;
    persist(topicSlug);
  }

  function has(slug: string): boolean {
    return expanded.value.has(slug);
  }

  return { expanded, load, toggle, add, has };
}
