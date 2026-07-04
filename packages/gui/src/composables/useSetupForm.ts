import { computed, ref } from 'vue';
import { type AppConfig, type Provider, saveKey, setConfig, testKey } from '../lib/commands';

// State machine for the API-key setup form, pulled out of SetupScreen.vue so
// the component is pure markup.
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

  // Doubles as the "Test" result and save feedback line.
  const status = ref<{ kind: 'idle' | 'ok' | 'error'; text: string }>({
    kind: 'idle',
    text: '',
  });
  const testing = ref(false);
  const saving = ref(false);

  function normalizedBaseUrl(): string | null {
    const v = baseUrl.value.trim();
    return v === '' ? null : v;
  }

  /** Key to send to `test_key`: the typed value, or fall back to the stored one. */
  function keyForRequest(): string | undefined {
    const v = key.value.trim();
    return v === '' ? undefined : v;
  }

  async function onTest() {
    if (keyForRequest() === undefined && !hasExistingKey.value) {
      status.value = { kind: 'error', text: 'Enter an API key first.' };
      return;
    }
    testing.value = true;
    status.value = { kind: 'idle', text: 'Testing connection…' };
    try {
      const reply = await testKey({
        key: keyForRequest(),
        provider: provider.value,
        model: model.value.trim(),
        base_url: normalizedBaseUrl() ?? undefined,
      });
      status.value = {
        kind: 'ok',
        text: `Connected. Provider replied: “${reply.trim()}”.`,
      };
    } catch (e) {
      status.value = { kind: 'error', text: String(e) };
    } finally {
      testing.value = false;
    }
  }

  async function onSave() {
    const modelTrim = model.value.trim();
    if (modelTrim === '') {
      status.value = { kind: 'error', text: 'Model id must not be empty.' };
      return;
    }
    const newKey = key.value.trim();
    if (newKey === '' && !hasExistingKey.value) {
      status.value = { kind: 'error', text: 'Enter an API key first.' };
      return;
    }

    saving.value = true;
    status.value = { kind: 'idle', text: 'Saving…' };
    try {
      if (newKey !== '') {
        await saveKey(newKey);
      }
      // Preserve the existing working folder when editing settings later.
      const config: AppConfig = {
        provider: provider.value,
        model: modelTrim,
        base_url: normalizedBaseUrl(),
        last_working_folder: opts.config()?.last_working_folder ?? null,
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
    testing,
    saving,
    hasExistingKey,
    onTest,
    onSave,
  };
}
