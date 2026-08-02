import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, ref, type Component } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useFileContent } from '@/components/workspace/useFileContent';
import { siteFileContent } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  siteFileContent: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

const mockFileContent = vi.mocked(siteFileContent);
const mockListen = vi.mocked(listen);

const flush = () => new Promise((r) => setTimeout(r));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

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
  };
}

const API = '/topics/rust/sessions/basics/lifetimes.md';

describe('useFileContent', () => {
  beforeEach(() => {
    mockFileContent.mockReset();
    mockListen.mockReset();
  });

  it('loads file content on mount via siteFileContent(apiPath, folder)', async () => {
    installListen();
    mockFileContent.mockResolvedValue('# Title\n\nbody');

    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => '/proj',
      ),
    );
    await flush();

    expect(mockFileContent).toHaveBeenCalledWith(API, '/proj');
    expect(result.content.value).toBe('# Title\n\nbody');
    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBe('');
  });

  it('refetches when the api path changes', async () => {
    installListen();
    mockFileContent.mockResolvedValue('first');

    const path = ref(API);
    const { result } = withSetup(() =>
      useFileContent(
        () => path.value,
        () => '/proj',
      ),
    );
    await flush();
    expect(mockFileContent).toHaveBeenLastCalledWith(API, '/proj');

    const next = '/topics/rust/sessions/basics/other.md';
    mockFileContent.mockResolvedValue('second');
    path.value = next;
    await flush();

    expect(mockFileContent).toHaveBeenLastCalledWith(next, '/proj');
    expect(result.content.value).toBe('second');
  });

  it('refetches when the working folder changes', async () => {
    installListen();
    mockFileContent.mockResolvedValue('a');

    const folder = ref('/a');
    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => folder.value,
      ),
    );
    await flush();

    mockFileContent.mockResolvedValue('b');
    folder.value = '/b';
    await flush();

    expect(mockFileContent).toHaveBeenLastCalledWith(API, '/b');
    expect(result.content.value).toBe('b');
  });

  it('reloads when the site://reload event fires', async () => {
    const listener = installListen();
    mockFileContent.mockResolvedValueOnce('first');
    mockFileContent.mockResolvedValueOnce('second');

    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => '/proj',
      ),
    );
    await flush();
    expect(result.content.value).toBe('first');

    listener.fire('site://reload');
    await flush();

    expect(result.content.value).toBe('second');
  });

  it('a null path yields no content without calling the backend', async () => {
    installListen();
    const { result } = withSetup(() =>
      useFileContent(
        () => null,
        () => '/proj',
      ),
    );
    await flush();

    expect(mockFileContent).not.toHaveBeenCalled();
    expect(result.content.value).toBeNull();
    expect(result.loading.value).toBe(false);
  });

  it('a null folder yields no content without calling the backend', async () => {
    installListen();
    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => null,
      ),
    );
    await flush();

    expect(mockFileContent).not.toHaveBeenCalled();
    expect(result.content.value).toBeNull();
  });

  it('treats a 404 (null) as a valid empty result, not an error', async () => {
    installListen();
    mockFileContent.mockResolvedValue(null);

    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => '/proj',
      ),
    );
    await flush();

    expect(result.content.value).toBeNull();
    expect(result.error.value).toBe('');
    expect(result.loading.value).toBe(false);
  });

  it('captures backend errors', async () => {
    installListen();
    mockFileContent.mockRejectedValue('403|Forbidden');

    const { result } = withSetup(() =>
      useFileContent(
        () => API,
        () => '/proj',
      ),
    );
    await flush();

    expect(result.error.value).toBe('403|Forbidden');
    expect(result.loading.value).toBe(false);
    expect(result.content.value).toBeNull();
  });

  it('discards a stale response when the path changes mid-flight', async () => {
    installListen();
    const slow = deferred<string | null>();
    mockFileContent.mockImplementationOnce(() => slow.promise);
    mockFileContent.mockResolvedValueOnce('fresh');

    const path = ref(API);
    const { result } = withSetup(() =>
      useFileContent(
        () => path.value,
        () => '/proj',
      ),
    );
    await flush();

    path.value = '/topics/rust/sessions/basics/other.md';
    await flush();
    expect(result.content.value).toBe('fresh');

    slow.resolve('stale');
    await flush();
    expect(result.content.value).toBe('fresh');
  });

  it('tears down its site://reload listener on unmount', async () => {
    const stop = vi.fn();
    mockListen.mockImplementation(() => Promise.resolve(stop));

    const { unmount } = withSetup(() =>
      useFileContent(
        () => API,
        () => '/proj',
      ),
    );
    await flush();
    unmount();

    expect(stop).toHaveBeenCalled();
  });
});
