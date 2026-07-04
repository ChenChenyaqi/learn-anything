import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@/composables/useAppSession';
import { getConfig, hasKey, loadKey } from '@/lib/commands';
import type { AppConfig } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  getConfig: vi.fn(),
  hasKey: vi.fn(),
  loadKey: vi.fn(),
}));

const mockGetConfig = vi.mocked(getConfig);
const mockHasKey = vi.mocked(hasKey);
const mockLoadKey = vi.mocked(loadKey);

function cfg(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    base_url: null,
    last_working_folder: null,
    ...overrides,
  };
}

describe('useAppSession', () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockHasKey.mockReset();
    mockLoadKey.mockReset();
  });

  describe('boot', () => {
    it('routes to setup when no key is stored', async () => {
      mockHasKey.mockResolvedValue(false);
      mockGetConfig.mockResolvedValue(cfg());
      const openFolder = vi.fn();
      const { view, keyPreview, boot } = useAppSession({ openFolder });

      await boot();

      expect(view.value).toBe('setup');
      expect(keyPreview.value).toBeNull();
      expect(openFolder).not.toHaveBeenCalled();
    });

    it('routes to main and loads the key preview when a key exists', async () => {
      mockHasKey.mockResolvedValue(true);
      mockGetConfig.mockResolvedValue(cfg());
      mockLoadKey.mockResolvedValue('sk-…7X2J');
      const openFolder = vi.fn();
      const { view, keyPreview, boot } = useAppSession({ openFolder });

      await boot();

      expect(view.value).toBe('main');
      expect(keyPreview.value).toBe('sk-…7X2J');
      expect(openFolder).not.toHaveBeenCalled();
    });

    it('opens the remembered folder on boot', async () => {
      mockHasKey.mockResolvedValue(true);
      mockGetConfig.mockResolvedValue(cfg({ last_working_folder: '/proj' }));
      mockLoadKey.mockResolvedValue('sk-…');
      const openFolder = vi.fn();
      const { boot } = useAppSession({ openFolder });

      await boot();

      expect(openFolder).toHaveBeenCalledWith('/proj');
    });

    it('treats a keychain probe failure as "no key"', async () => {
      mockHasKey.mockRejectedValue(new Error('keychain locked'));
      mockGetConfig.mockResolvedValue(cfg());
      const { view, boot } = useAppSession({ openFolder: vi.fn() });

      await boot();

      expect(view.value).toBe('setup');
    });
  });

  describe('refreshAfterSave', () => {
    it('reloads key/config, reopens the folder, and goes to main', async () => {
      mockLoadKey.mockResolvedValue('sk-…new');
      mockGetConfig.mockResolvedValue(cfg({ last_working_folder: '/proj' }));
      const openFolder = vi.fn();
      const { view, config, keyPreview, refreshAfterSave } = useAppSession({
        openFolder,
      });

      await refreshAfterSave();

      expect(keyPreview.value).toBe('sk-…new');
      expect(config.value?.last_working_folder).toBe('/proj');
      expect(openFolder).toHaveBeenCalledWith('/proj');
      expect(view.value).toBe('main');
    });

    it('skips opening when no folder is configured', async () => {
      mockLoadKey.mockResolvedValue(null);
      mockGetConfig.mockResolvedValue(cfg());
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
