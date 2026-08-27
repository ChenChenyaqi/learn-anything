import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useSetupForm } from '@/composables/useSetupForm';
import { setConfig } from '@/lib/commands';
import type { AppConfig } from '@/lib/commands';

vi.mock('@/lib/commands', () => ({
  setConfig: vi.fn(),
}));

const mockSetConfig = vi.mocked(setConfig);

function cfg(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: 'openai',
    model: '',
    base_url: null,
    last_working_folder: null,
    api_key: null,
    language: 'system',
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
    mockSetConfig.mockReset();
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

  describe('onSave', () => {
    it('rejects an empty model', async () => {
      const { form, onSaved } = makeForm({ config: cfg({ model: '' }) });
      await form.onSave();
      expect(mockSetConfig).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(form.status.value).toMatchObject({ kind: 'error' });
    });

    it('writes the key into config (preserving the folder) and notifies', async () => {
      mockSetConfig.mockResolvedValue(undefined);
      const { form, onSaved } = makeForm({
        config: cfg({ last_working_folder: '/keep' }),
      });
      form.model.value = 'gpt-4o';
      form.key.value = 'sk-new';

      await form.onSave();

      expect(mockSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          last_working_folder: '/keep',
          api_key: 'sk-new',
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });

    it('preserves the existing api_key when the field is left blank', async () => {
      mockSetConfig.mockResolvedValue(undefined);
      const { form, onSaved } = makeForm({
        config: cfg({ model: 'gpt-4o', api_key: 'sk-old' }),
        preview: 'sk-…',
      });
      form.key.value = '   ';

      await form.onSave();

      expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining({ api_key: 'sk-old' }));
      expect(onSaved).toHaveBeenCalled();
    });

    it('surfaces a save failure and does not notify', async () => {
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
