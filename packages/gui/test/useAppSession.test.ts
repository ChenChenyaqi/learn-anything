import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@/composables/useAppSession';
import { getConfig, maskKey } from '@/lib/commands';
import type { AppConfig } from '@/lib/commands';

// Keep `maskKey` real (it's a pure fn); only stub the IPC call `getConfig`.
vi.mock('@/lib/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/commands')>();
  return { ...actual, getConfig: vi.fn() };
});

const mockGetConfig = vi.mocked(getConfig);

function cfg(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    base_url: null,
    last_working_folder: null,
    api_key: null,
    language: 'system',
    ...overrides,
  };
}

describe('useAppSession', () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
  });

  describe('boot', () => {
    it('routes to setup when config has no api_key', async () => {
      mockGetConfig.mockResolvedValue(cfg());
      const openFolder = vi.fn();
      const { view, keyPreview, boot } = useAppSession({ openFolder });

      await boot();

      expect(view.value).toBe('setup');
      expect(keyPreview.value).toBeNull();
      expect(openFolder).not.toHaveBeenCalled();
    });

    it('routes to main and masks the key when api_key is present', async () => {
      const key = 'sk-abcd-1234-WXYZ';
      mockGetConfig.mockResolvedValue(cfg({ api_key: key }));
      const openFolder = vi.fn();
      const { view, keyPreview, boot } = useAppSession({ openFolder });

      await boot();

      expect(view.value).toBe('main');
      expect(keyPreview.value).toBe(maskKey(key));
      expect(openFolder).not.toHaveBeenCalled();
    });

    it('opens the remembered folder on boot', async () => {
      mockGetConfig.mockResolvedValue(cfg({ api_key: 'sk-x', last_working_folder: '/proj' }));
      const openFolder = vi.fn();
      const { boot } = useAppSession({ openFolder });

      await boot();

      expect(openFolder).toHaveBeenCalledWith('/proj');
    });

    it('treats a config read failure as "no key"', async () => {
      mockGetConfig.mockRejectedValue(new Error('disk read failed'));
      const { view, boot } = useAppSession({ openFolder: vi.fn() });

      await boot();

      expect(view.value).toBe('setup');
    });
  });

  describe('refreshAfterSave', () => {
    it('reloads config, reopens the folder, and goes to main', async () => {
      const key = 'sk-abcd-1234-WXYZ';
      mockGetConfig.mockResolvedValue(cfg({ api_key: key, last_working_folder: '/proj' }));
      const openFolder = vi.fn();
      const { view, config, keyPreview, refreshAfterSave } = useAppSession({
        openFolder,
      });

      await refreshAfterSave();

      expect(keyPreview.value).toBe(maskKey(key));
      expect(config.value?.last_working_folder).toBe('/proj');
      expect(openFolder).toHaveBeenCalledWith('/proj');
      expect(view.value).toBe('main');
    });

    it('skips opening when no folder is configured', async () => {
      mockGetConfig.mockResolvedValue(cfg({ api_key: 'sk-x' }));
      const openFolder = vi.fn();
      const { refreshAfterSave } = useAppSession({ openFolder });

      await refreshAfterSave();

      expect(openFolder).not.toHaveBeenCalled();
    });
  });

  describe('reloadConfig', () => {
    it('re-reads config from appData', async () => {
      mockGetConfig.mockResolvedValue(cfg({ model: 'claude-x' }));
      const { config, reloadConfig } = useAppSession({ openFolder: vi.fn() });

      await reloadConfig();

      expect(config.value?.model).toBe('claude-x');
    });
  });
});
