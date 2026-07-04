import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { useDarkMode } from '@/composables/useDarkMode';

const THEME_KEY = 'learn-anything-theme';

/** Mount a component whose setup runs `composable`, so its onMounted hooks
 *  fire. Returns an unmount handle. */
function withSetup(composable: () => void): () => void {
  const Comp: Component = {
    setup() {
      composable();
      return () => h('div');
    },
  };
  const app = createApp(Comp);
  const el = document.createElement('div');
  app.mount(el);
  return () => app.unmount();
}

/** Stub `window.matchMedia` with a controllable `matches` value + a way to
 *  dispatch `change` to registered listeners. `matches` is backed by a getter
 *  so a later `fire(next)` is visible to code that re-reads matchMedia(). */
function installMatchMedia(matches: boolean) {
  let current = matches;
  const listeners = new Set<(e: { matches: boolean }) => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return current;
    },
    addEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) =>
      listeners.delete(cb),
  }));
  return {
    fire(next: boolean) {
      current = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

describe('useDarkMode', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the system dark theme when no preference is stored', () => {
    installMatchMedia(true);
    withSetup(() => useDarkMode());
    expect(isDark()).toBe(true);
  });

  it('follows the system light theme when no preference is stored', () => {
    installMatchMedia(false);
    withSetup(() => useDarkMode());
    expect(isDark()).toBe(false);
  });

  it('a stored "dark" preference overrides a light system', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    installMatchMedia(false);
    withSetup(() => useDarkMode());
    expect(isDark()).toBe(true);
  });

  it('a stored "light" preference overrides a dark system', () => {
    localStorage.setItem(THEME_KEY, 'light');
    installMatchMedia(true);
    withSetup(() => useDarkMode());
    expect(isDark()).toBe(false);
  });

  it('re-applies when the system theme changes live', () => {
    const mm = installMatchMedia(false);
    const unmount = withSetup(() => useDarkMode());
    expect(isDark()).toBe(false);

    mm.fire(true);
    expect(isDark()).toBe(true);

    unmount();
  });

  it('removes its change listener on unmount', () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener,
    }));
    const unmount = withSetup(() => useDarkMode());
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
