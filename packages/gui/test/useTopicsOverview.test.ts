import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, ref, type Component } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useTopicsOverview } from '@/components/overview/useTopicsOverview';
import { siteTopicSummaries } from '@/lib/commands';
import type { SiteTopicSummary } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  siteTopicSummaries: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

const mockSummaries = vi.mocked(siteTopicSummaries);
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

function row(overrides: Partial<SiteTopicSummary> = {}): SiteTopicSummary {
  return {
    slug: 'rust',
    name: 'Rust',
    domainCount: 1,
    totalConcepts: 4,
    masteredCount: 1,
    percentage: 25,
    domainNames: ['Basics'],
    ...overrides,
  };
}

/** Listen mock that captures the handler per-event and resolves to a stop spy. */
function installListen() {
  const handlers: Record<string, (e: { payload: unknown }) => void> = {};
  // `as any` matches the established pattern in useAgentSession.test.ts —
  // vitest's mocked `listen` generics fight the real `EventCallback<T>` shape.
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

describe('useTopicsOverview', () => {
  beforeEach(() => {
    mockSummaries.mockReset();
    mockListen.mockReset();
  });

  it('loads summaries on mount via siteTopicSummaries(folder)', async () => {
    installListen();
    mockSummaries.mockResolvedValue([row()]);

    const { result } = withSetup(() => useTopicsOverview(() => '/proj'));
    await flush();

    expect(mockSummaries).toHaveBeenCalledWith('/proj');
    expect(result.summaries.value).toHaveLength(1);
    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBe('');
  });

  it('overall aggregates concepts + mastery weighted by concept count', async () => {
    installListen();
    mockSummaries.mockResolvedValue([
      row({ totalConcepts: 4, masteredCount: 1 }),
      row({ totalConcepts: 6, masteredCount: 3 }),
    ]);

    const { result } = withSetup(() => useTopicsOverview(() => '/proj'));
    await flush();

    // 2 topics · 10 concepts · 4 mastered → 40%.
    expect(result.overall.value).toEqual({
      topics: 2,
      totalConcepts: 10,
      mastered: 4,
      percentage: 40,
    });
  });

  it('refetches when the working folder changes', async () => {
    installListen();
    mockSummaries.mockResolvedValue([row({ slug: 'a' })]);

    const folder = ref('/a');
    const { result } = withSetup(() => useTopicsOverview(() => folder.value));
    await flush();
    expect(mockSummaries).toHaveBeenLastCalledWith('/a');

    mockSummaries.mockResolvedValue([row({ slug: 'b' })]);
    folder.value = '/b';
    await flush();

    expect(mockSummaries).toHaveBeenLastCalledWith('/b');
    expect(result.summaries.value[0].slug).toBe('b');
  });

  it('reloads when the site://reload event fires', async () => {
    const listener = installListen();
    mockSummaries.mockResolvedValueOnce([row({ slug: 'a' })]);
    mockSummaries.mockResolvedValueOnce([row({ slug: 'b' })]);

    const { result } = withSetup(() => useTopicsOverview(() => '/proj'));
    await flush();
    expect(result.summaries.value[0].slug).toBe('a');

    listener.fire('site://reload');
    await flush();

    expect(result.summaries.value[0].slug).toBe('b');
  });

  it('a null folder yields no rows without calling the backend', async () => {
    installListen();
    const { result } = withSetup(() => useTopicsOverview(() => null));
    await flush();

    expect(mockSummaries).not.toHaveBeenCalled();
    expect(result.summaries.value).toEqual([]);
    expect(result.loading.value).toBe(false);
  });

  it('captures backend errors', async () => {
    installListen();
    mockSummaries.mockRejectedValue('404|No working folder');

    const { result } = withSetup(() => useTopicsOverview(() => '/proj'));
    await flush();

    expect(result.error.value).toBe('404|No working folder');
    expect(result.loading.value).toBe(false);
    expect(result.summaries.value).toEqual([]);
  });

  it('discards a stale response when the folder changes mid-flight', async () => {
    installListen();
    const slow = deferred<SiteTopicSummary[]>();
    mockSummaries.mockImplementationOnce(() => slow.promise);
    mockSummaries.mockResolvedValueOnce([row({ slug: 'fresh' })]);

    const folder = ref('/a');
    const { result } = withSetup(() => useTopicsOverview(() => folder.value));
    await flush(); // initial load still pending on `slow`

    folder.value = '/b';
    await flush(); // /b resolves first → summaries = fresh
    expect(result.summaries.value[0].slug).toBe('fresh');

    slow.resolve([row({ slug: 'stale' })]); // late /a response arrives
    await flush();
    // Stale write discarded — current folder is still /b.
    expect(result.summaries.value[0].slug).toBe('fresh');
  });

  it('tears down its site://reload listener on unmount', async () => {
    const stop = vi.fn();
    mockListen.mockImplementation(() => Promise.resolve(stop));

    const { unmount } = withSetup(() => useTopicsOverview(() => '/proj'));
    await flush();
    unmount();

    expect(stop).toHaveBeenCalled();
  });
});
