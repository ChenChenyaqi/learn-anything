import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useSetupForm } from '@/composables/useSetupForm';
import { saveKey, setConfig, testKey } from '@/lib/commands';
import type { AppConfig } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  saveKey: vi.fn(),
  setConfig: vi.fn(),
  testKey: vi.fn(),
}));

const mockSaveKey = vi.mocked(saveKey);
const mockSetConfig = vi.mocked(setConfig);
const mockTestKey = vi.mocked(testKey);

function cfg(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: 'openai',
    model: '',
    base_url: null,
    last_working_folder: null,
    ...overrides,
  };
}

/** Build a form bound to reactive config/preview so hasExistingKey is live. */
function makeForm(overrides: { config?: AppConfig | null; preview?: string | null } = {}) {
  const config = ref<AppConfig | null>(overrides.config ?? cfg({ model: 'gpt-4o' }));
  const preview = ref<string | null>(overrides.preview ?? null);
  const onSaved = vi.fn();
  const form = useSetupForm({
    config: () => config.value,
    existingKeyPreview: () => preview.value,
    onSaved,
  });
  return { form, config, preview, onSaved };
}

describe('useSetupForm', () => {
  beforeEach(() => {
    mockSaveKey.mockReset();
    mockSetConfig.mockReset();
    mockTestKey.mockReset();
  });

  describe('initial values', () => {
    it('pre-fills provider/model/base_url from config', () => {
      const { form } = makeForm({
        config: cfg({ provider: 'anthropic', model: 'claude-x', base_url: 'https://x' }),
      });
      expect(form.provider.value).toBe('anthropic');
      expect(form.model.value).toBe('claude-x');
      expect(form.baseUrl.value).toBe('https://x');
      expect(form.key.value).toBe('');
    });

    it('hasExistingKey tracks the preview reactively', async () => {
      const { form, preview } = makeForm({ preview: null });
      expect(form.hasExistingKey.value).toBe(false);
      preview.value = 'sk-…';
      expect(form.hasExistingKey.value).toBe(true);
    });
  });

  describe('onTest', () => {
    it('refuses without any key', async () => {
      const { form } = makeForm({ preview: null });
      await form.onTest();
      expect(mockTestKey).not.toHaveBeenCalled();
      expect(form.status.value).toMatchObject({ kind: 'error' });
    });

    it('falls back to the stored key when the field is blank', async () => {
      mockTestKey.mockResolvedValue('ok');
      const { form } = makeForm({ preview: 'sk-…' });
      await form.onTest();
      expect(mockTestKey).toHaveBeenCalledWith(expect.objectContaining({ key: undefined }));
      expect(form.status.value).toMatchObject({ kind: 'ok' });
    });

    it('surfaces a provider failure as an error status', async () => {
      mockTestKey.mockRejectedValue(new Error('401 unauthorized'));
      const { form } = makeForm();
      form.key.value = 'sk-bad';
      await form.onTest();
      expect(form.status.value).toMatchObject({ kind: 'error' });
      expect(form.status.value.text).toContain('401');
    });
  });

  describe('onSave', () => {
    it('rejects an empty model', async () => {
      const { form, onSaved } = makeForm({ config: cfg({ model: '' }) });
      await form.onSave();
      expect(mockSaveKey).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(form.status.value).toMatchObject({ kind: 'error' });
    });

    it('saves the key, writes config (preserving the folder), and notifies', async () => {
      mockSaveKey.mockResolvedValue(undefined);
      mockSetConfig.mockResolvedValue(undefined);
      const { form, onSaved } = makeForm({
        config: cfg({ last_working_folder: '/keep' }),
      });
      form.model.value = 'gpt-4o';
      form.key.value = 'sk-new';

      await form.onSave();

      expect(mockSaveKey).toHaveBeenCalledWith('sk-new');
      expect(mockSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o', last_working_folder: '/keep' }),
      );
      expect(onSaved).toHaveBeenCalled();
    });

    it('keeps the existing key when the field is left blank', async () => {
      mockSetConfig.mockResolvedValue(undefined);
      const { form, onSaved } = makeForm({ preview: 'sk-…' });
      form.key.value = '   ';

      await form.onSave();

      expect(mockSaveKey).not.toHaveBeenCalled();
      expect(mockSetConfig).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });

    it('surfaces a save failure and does not notify', async () => {
      mockSaveKey.mockResolvedValue(undefined);
      mockSetConfig.mockRejectedValue(new Error('disk full'));
      const { form, onSaved } = makeForm();
      form.key.value = 'sk';

      await form.onSave();

      expect(form.status.value).toMatchObject({ kind: 'error' });
      expect(form.status.value.text).toContain('disk full');
      expect(onSaved).not.toHaveBeenCalled();
    });
  });
});
