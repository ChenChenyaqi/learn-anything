import { ref } from 'vue';
import { type AppConfig, getConfig, hasKey, loadKey } from '../lib/commands';

// Application session state + boot routing, pulled out of App.vue.
//
// Owns the three-way `view` (loading → setup → main) plus the shared `config`
// and masked `keyPreview`. `openFolder` is injected from `useWorkingFolder` so
// this composable stays decoupled from the folder/validation concern (it just
// needs "open this dir on boot / after a save").
export function useAppSession(opts: { openFolder: (dir: string) => Promise<void> }) {
  const view = ref<'loading' | 'setup' | 'main'>('loading');
  const config = ref<AppConfig | null>(null);
  const keyPreview = ref<string | null>(null);

  /** Re-read config from appData (e.g. after the working folder is persisted). */
  async function reloadConfig() {
    config.value = await getConfig();
  }

  /** Initial boot probe: key presence + config decide the first view. */
  async function boot() {
    const [stored, cfg] = await Promise.all([
      hasKey().catch(() => false),
      getConfig().catch(() => null),
    ]);
    config.value = cfg;
    if (!stored) {
      view.value = 'setup';
      return;
    }
    keyPreview.value = await loadKey().catch(() => null);
    if (cfg?.last_working_folder) {
      await opts.openFolder(cfg.last_working_folder);
    }
    view.value = 'main';
  }

  /** After a setup save: refresh key/config, re-open the folder, go to main. */
  async function refreshAfterSave() {
    keyPreview.value = await loadKey().catch(() => null);
    config.value = await getConfig();
    if (config.value?.last_working_folder) {
      await opts.openFolder(config.value.last_working_folder);
    }
    view.value = 'main';
  }

  return { view, config, keyPreview, boot, refreshAfterSave, reloadConfig };
}
