import { computed, ref } from 'vue';
import { type AppConfig, type Provider, setConfig } from '../lib/commands';
import { i18n } from '../i18n';

// State machine for the API-key setup form, pulled out of SetupScreen.vue so
// the component is pure markup.
//
// Status copy is resolved from the locales at assignment time (transient
// messages — a locale switch mid-display just leaves the old language until
// the next action; render-time resolution isn't worth the indirection here).
//
// `config`/`existingKeyPreview` are getters (not plain values) so the derived
// `hasExistingKey` stays reactive if the parent's props change. The field
// initial values are snapshotted from `config()` once at creation — the form
// reflects the state when it was opened, not live edits.
export function useSetupForm(opts: {
  config: () => AppConfig | null;
  existingKeyPreview: () => string | null;
  onSaved: () => void;
}) {
  const provider = ref<Provider>(opts.config()?.provider ?? 'openai');
  const model = ref(opts.config()?.model ?? '');
  const baseUrl = ref(opts.config()?.base_url ?? '');
  const key = ref('');

  const hasExistingKey = computed(() => opts.existingKeyPreview() !== null);

  const status = ref<{ kind: 'idle' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const saving = ref(false);

  function normalizedBaseUrl(): string | null {
    const v = baseUrl.value.trim();
    return v === '' ? null : v;
  }

  async function onSave() {
    const modelTrim = model.value.trim();
    if (modelTrim === '') {
      status.value = { kind: 'error', text: i18n.global.t('setup.errorModelEmpty') };
      return;
    }
    const newKey = key.value.trim();
    if (newKey === '' && !hasExistingKey.value) {
      status.value = { kind: 'error', text: i18n.global.t('setup.errorKeyMissing') };
      return;
    }

    saving.value = true;
    status.value = { kind: 'idle', text: i18n.global.t('common.saving') };
    try {
      // Preserve the existing key + working folder + language when editing
      // settings later (language is also settable independently via
      // `setLanguagePref` from the Language field).
      const config: AppConfig = {
        provider: provider.value,
        model: modelTrim,
        base_url: normalizedBaseUrl(),
        last_working_folder: opts.config()?.last_working_folder ?? null,
        api_key: newKey !== '' ? newKey : (opts.config()?.api_key ?? null),
        language: opts.config()?.language ?? 'system',
      };
      await setConfig(config);
      opts.onSaved();
    } catch (e) {
      status.value = { kind: 'error', text: String(e) };
    } finally {
      saving.value = false;
    }
  }

  return {
    provider,
    model,
    baseUrl,
    key,
    status,
    saving,
    hasExistingKey,
    onSave,
  };
}
