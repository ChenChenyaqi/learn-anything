import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, ref, type Component } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useTopicData } from '@/components/workspace/useTopicData';
import { siteTopicData } from '@/lib/commands';
import type { TopicData, Concept, Domain, ConceptStatus } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  siteTopicData: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

const mockTopicData = vi.mocked(siteTopicData);
const mockListen = vi.mocked(listen);

const flush = () => new Promise((r) => setTimeout(r));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Mount a component whose setup runs `composable`, so its onMounted hooks
 *  fire. Returns the composable's return value + an unmount handle. */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const Comp: Component = {
    setup() {
      result = composable();
      return () => h('div');
    },
  };
  const app = createApp(Comp);
  const el = document.createElement('div');
  app.mount(el);
  return { result, unmount: () => app.unmount() };
}

function concept(overrides: Partial<Concept> = {}): Concept {
  return {
    name: 'Ownership',
    slug: 'ownership',
    status: 'mastered',
    confidence: 1,
    practice_count: 0,
    explain_count: 0,
    last_explained: null,
    last_practiced: null,
    details: [],
    ...overrides,
  };
}

function domain(overrides: Partial<Domain> = {}): Domain {
  return {
    name: 'Basics',
    slug: 'basics',
    concepts: [concept()],
    ...overrides,
  };
}

function topicData(overrides: Partial<TopicData> = {}): TopicData {
  return {
    state: {
      version: 1,
      topic: 'Rust',
      slug: 'rust',
      created: '2026-01-01',
      domains: [domain()],
    },
    knowledgeMap: '',
    files: { sessions: [], exercises: [], quizzes: [] },
    ...overrides,
  };
}

/** Listen mock that captures the handler per-event and resolves to a stop spy. */
function installListen() {
  const handlers: Record<string, (e: { payload: unknown }) => void> = {};
  (mockListen as any).mockImplementation(
    (event: string, handler: (e: { payload: unknown }) => void) => {
      handlers[event] = handler;
      return Promise.resolve(vi.fn());
    },
  );
  return {
    fire(event: string) {
      handlers[event]?.({ payload: undefined });
    },
    registered(event: string) {
      return event in handlers;
    },
  };
}

describe('useTopicData', () => {
  beforeEach(() => {
    mockTopicData.mockReset();
    mockListen.mockReset();
  });

  it('loads topic data on mount via siteTopicData(slug, folder)', async () => {
    installListen();
    mockTopicData.mockResolvedValue(topicData());

    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => '/proj',
      ),
    );
    await flush();

    expect(mockTopicData).toHaveBeenCalledWith('rust', '/proj');
    expect(result.data.value?.state.slug).toBe('rust');
    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBe('');
  });

  it('overall aggregates concept statuses + mastery percentage', async () => {
    installListen();
    const statuses: ConceptStatus[] = [
      'mastered',
      'mastered',
      'in_progress',
      'needs_practice',
      'unexplored',
      'unexplored',
    ];
    mockTopicData.mockResolvedValue(
      topicData({
        state: {
          version: 1,
          topic: 'Rust',
          slug: 'rust',
          created: '2026-01-01',
          domains: [
            domain({ concepts: statuses.map((s, i) => concept({ status: s, slug: `c${i}` })) }),
          ],
        },
      }),
    );

    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => '/proj',
      ),
    );
    await flush();

    // 6 total · 2 mastered → 33%.
    expect(result.overall.value).toEqual({
      total: 6,
      mastered: 2,
      inProgress: 1,
      needsPractice: 1,
      unexplored: 2,
      percentage: 33,
    });
  });

  it('refetches when the working folder changes', async () => {
    installListen();
    mockTopicData.mockResolvedValue(topicData({ state: { ...topicData().state, slug: 'a' } }));

    const folder = ref('/a');
    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => folder.value,
      ),
    );
    await flush();
    expect(mockTopicData).toHaveBeenLastCalledWith('rust', '/a');

    mockTopicData.mockResolvedValue(topicData({ state: { ...topicData().state, slug: 'b' } }));
    folder.value = '/b';
    await flush();

    expect(mockTopicData).toHaveBeenLastCalledWith('rust', '/b');
    expect(result.data.value?.state.slug).toBe('b');
  });

  it('refetches when the slug changes', async () => {
    installListen();
    mockTopicData.mockResolvedValue(topicData());

    const slug = ref('rust');
    const { result } = withSetup(() =>
      useTopicData(
        () => slug.value,
        () => '/proj',
      ),
    );
    await flush();
    expect(mockTopicData).toHaveBeenLastCalledWith('rust', '/proj');

    mockTopicData.mockResolvedValue(topicData({ state: { ...topicData().state, slug: 'react' } }));
    slug.value = 'react';
    await flush();

    expect(mockTopicData).toHaveBeenLastCalledWith('react', '/proj');
    expect(result.data.value?.state.slug).toBe('react');
  });

  it('reloads when the site://reload event fires', async () => {
    const listener = installListen();
    mockTopicData.mockResolvedValueOnce(topicData({ knowledgeMap: 'first' }));
    mockTopicData.mockResolvedValueOnce(topicData({ knowledgeMap: 'second' }));

    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => '/proj',
      ),
    );
    await flush();
    expect(result.data.value?.knowledgeMap).toBe('first');

    listener.fire('site://reload');
    await flush();

    expect(result.data.value?.knowledgeMap).toBe('second');
  });

  it('a null folder yields no data without calling the backend', async () => {
    installListen();
    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => null,
      ),
    );
    await flush();

    expect(mockTopicData).not.toHaveBeenCalled();
    expect(result.data.value).toBeNull();
    expect(result.loading.value).toBe(false);
  });

  it('a null slug yields no data without calling the backend', async () => {
    installListen();
    const { result } = withSetup(() =>
      useTopicData(
        () => null,
        () => '/proj',
      ),
    );
    await flush();

    expect(mockTopicData).not.toHaveBeenCalled();
    expect(result.data.value).toBeNull();
    expect(result.loading.value).toBe(false);
  });

  it('captures backend errors', async () => {
    installListen();
    mockTopicData.mockRejectedValue('500|read failed');

    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => '/proj',
      ),
    );
    await flush();

    expect(result.error.value).toBe('500|read failed');
    expect(result.loading.value).toBe(false);
    expect(result.data.value).toBeNull();
  });

  it('discards a stale response when the folder changes mid-flight', async () => {
    installListen();
    const slow = deferred<TopicData>();
    mockTopicData.mockImplementationOnce(() => slow.promise);
    mockTopicData.mockResolvedValueOnce(
      topicData({ state: { ...topicData().state, slug: 'fresh' } }),
    );

    const folder = ref('/a');
    const { result } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => folder.value,
      ),
    );
    await flush(); // initial load still pending on `slow`

    folder.value = '/b';
    await flush(); // /b resolves first → data = fresh
    expect(result.data.value?.state.slug).toBe('fresh');

    slow.resolve(topicData({ state: { ...topicData().state, slug: 'stale' } })); // late /a response
    await flush();
    // Stale write discarded — current folder is still /b.
    expect(result.data.value?.state.slug).toBe('fresh');
  });

  it('discards a stale response when the slug changes mid-flight', async () => {
    installListen();
    const slow = deferred<TopicData>();
    mockTopicData.mockImplementationOnce(() => slow.promise);
    mockTopicData.mockResolvedValueOnce(
      topicData({ state: { ...topicData().state, slug: 'fresh' } }),
    );

    const slug = ref('rust');
    const { result } = withSetup(() =>
      useTopicData(
        () => slug.value,
        () => '/proj',
      ),
    );
    await flush(); // initial load still pending on `slow`

    slug.value = 'react';
    await flush(); // react resolves first → data = fresh
    expect(result.data.value?.state.slug).toBe('fresh');

    slow.resolve(topicData({ state: { ...topicData().state, slug: 'stale' } })); // late rust response
    await flush();
    // Stale write discarded — current slug is still react.
    expect(result.data.value?.state.slug).toBe('fresh');
  });

  it('tears down its site://reload listener on unmount', async () => {
    const stop = vi.fn();
    mockListen.mockImplementation(() => Promise.resolve(stop));

    const { unmount } = withSetup(() =>
      useTopicData(
        () => 'rust',
        () => '/proj',
      ),
    );
    await flush();
    unmount();

    expect(stop).toHaveBeenCalled();
  });
});
