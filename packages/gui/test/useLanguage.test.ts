import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, ref, type Component, type Ref } from 'vue';
import { useLanguage } from '@/composables/useLanguage';
import { i18n } from '@/i18n';
import type { AppConfig } from '@/lib/commands';

// `useLanguage` is mocked at the command boundary: only `setLanguagePref`
// (persistence) is stubbed; locale effects are asserted against the real
// i18n instance + `<html lang>`.

vi.mock('@/lib/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/commands')>();
  return { ...original, setLanguagePref: vi.fn().mockResolvedValue(undefined) };
});

import { setLanguagePref } from '@/lib/commands';

const baseConfig = (language: AppConfig['language']): AppConfig => ({
  provider: 'openai',
  model: 'gpt-4o',
  base_url: null,
  last_working_folder: null,
  api_key: 'sk-test',
  language,
});

/** Mount a component whose setup runs `useLanguage(configRef)`, so its watch /
 *  lifecycle hooks are active. Registered for teardown in `afterEach` so
 *  `languagechange` listeners never leak across tests. */
function withSetup(configRef: Ref<AppConfig | null>): {
  setLanguage: (pref: AppConfig['language']) => Promise<void>;
} {
  let api!: ReturnType<typeof useLanguage>;
  const Comp: Component = {
    setup() {
      api = useLanguage(configRef);
      return () => h('div');
    },
  };
  const app = createApp(Comp);
  const el = document.createElement('div');
  app.mount(el);
  teardowns.push(() => app.unmount());
  return { setLanguage: api.setLanguage };
}

const teardowns: Array<() => void> = [];

/** Replace `navigator.languages` (read-only in jsdom) with a controllable list. */
function installLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', {
    value: Object.freeze([...languages]),
    configurable: true,
  });
}

/** Reset locale + html lang so cases don't leak into each other. */
function resetI18n() {
  i18n.global.locale.value = 'en';
  document.documentElement.lang = 'en';
}

beforeEach(() => {
  vi.mocked(setLanguagePref).mockClear();
  installLanguages(['en-US']);
  resetI18n();
});

afterEach(() => {
  teardowns.splice(0).forEach((fn) => fn());
  resetI18n();
});

describe('useLanguage', () => {
  it('applies an explicit preference when the config loads', () => {
    const config = ref<AppConfig | null>(null);
    withSetup(config);

    config.value = baseConfig('zh-CN');
    expect(i18n.global.locale.value).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('resolves system mode from navigator.languages', () => {
    installLanguages(['zh-Hans-CN', 'en-US']);
    const config = ref<AppConfig | null>(null);
    withSetup(config);

    config.value = baseConfig('system');
    expect(i18n.global.locale.value).toBe('zh-CN');
  });

  it('follows live OS language changes in system mode', () => {
    const config = ref<AppConfig | null>(baseConfig('system'));
    withSetup(config);

    // OS switches to Chinese → the languagechange event re-resolves.
    installLanguages(['zh-CN', 'en-US']);
    window.dispatchEvent(new Event('languagechange'));
    expect(i18n.global.locale.value).toBe('zh-CN');
  });

  it('ignores OS language changes under an explicit preference', () => {
    const config = ref<AppConfig | null>(baseConfig('en'));
    withSetup(config);

    installLanguages(['zh-CN']);
    window.dispatchEvent(new Event('languagechange'));
    expect(i18n.global.locale.value).toBe('en');
  });

  it('setLanguage applies immediately, updates config, and persists', async () => {
    const config = ref<AppConfig | null>(baseConfig('system'));
    const { setLanguage } = withSetup(config);

    await setLanguage('zh-CN');
    expect(i18n.global.locale.value).toBe('zh-CN');
    expect(config.value?.language).toBe('zh-CN');
    expect(setLanguagePref).toHaveBeenCalledWith('zh-CN');
  });

  it('setLanguage keeps working when persistence fails', async () => {
    vi.mocked(setLanguagePref).mockRejectedValueOnce(new Error('disk full'));
    const config = ref<AppConfig | null>(baseConfig('en'));
    const { setLanguage } = withSetup(config);

    await expect(setLanguage('zh-CN')).resolves.toBeUndefined();
    // Optimistic apply + config update still hold; only persistence failed.
    expect(i18n.global.locale.value).toBe('zh-CN');
    expect(config.value?.language).toBe('zh-CN');
  });

  it('stops following OS changes after unmount', () => {
    const config = ref<AppConfig | null>(baseConfig('system'));
    withSetup(config);
    teardowns.splice(0).forEach((fn) => fn());

    installLanguages(['zh-CN']);
    window.dispatchEvent(new Event('languagechange'));
    expect(i18n.global.locale.value).toBe('en');
  });
});
