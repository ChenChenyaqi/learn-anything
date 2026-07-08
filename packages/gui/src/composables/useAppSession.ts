import { ref } from 'vue';
import { type AppConfig, getConfig, maskKey } from '../lib/commands';

// Application session state + boot routing, pulled out of App.vue.
//
// Owns the three-way `view` (loading → setup → main) plus the shared `config`
// and masked `keyPreview`. `openFolder` is injected from `useWorkingFolder` so
// this composable stays decoupled from the folder/validation concern (it just
// needs "open this dir on boot / after a save").
//
// The API key lives in plaintext inside `config.api_key`; `keyPreview` is a
// display-only mask derived from it via `maskKey`.
export function useAppSession(opts: { openFolder: (dir: string) => Promise<void> }) {
  const view = ref<'loading' | 'setup' | 'main'>('loading');
  const config = ref<AppConfig | null>(null);
  const keyPreview = ref<string | null>(null);

  /** Re-read config from appData (e.g. after the working folder is persisted). */
  async function reloadConfig() {
    config.value = await getConfig();
  }

  /** Masked preview derived from the plaintext key in config (or `null`). */
  function previewFrom(cfg: AppConfig | null): string | null {
    return cfg?.api_key ? maskKey(cfg.api_key) : null;
  }

  /** Initial boot probe: config (incl. api_key) decides the first view. */
  async function boot() {
    const cfg = await getConfig().catch(() => null);
    config.value = cfg;
    if (!cfg?.api_key) {
      view.value = 'setup';
      return;
    }
    keyPreview.value = previewFrom(cfg);
    if (cfg?.last_working_folder) {
      await opts.openFolder(cfg.last_working_folder);
    }
    view.value = 'main';
  }

  /** After a setup save: refresh config, re-open the folder, go to main. */
  async function refreshAfterSave() {
    config.value = await getConfig();
    keyPreview.value = previewFrom(config.value);
    if (config.value?.last_working_folder) {
      await opts.openFolder(config.value.last_working_folder);
    }
    view.value = 'main';
  }

  return { view, config, keyPreview, boot, refreshAfterSave, reloadConfig };
}
