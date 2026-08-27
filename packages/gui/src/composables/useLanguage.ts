import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { type AppConfig, type LanguagePreference, setLanguagePref } from '../lib/commands';
import { setI18nLocale, resolveLocale } from '../i18n';

// Language preference application + persistence, mirroring the site's
// dark-mode strategy (`useDarkMode`): a stored preference wins, otherwise the
// system languages are followed live.
//
// The pipeline:
//   boot    → `i18n` is created with the system-resolved locale (first paint
//             is already right even before config loads);
//   config  → once `useAppSession` loads the stored config, a watcher applies
//             its `language` field (no-op while it stays `'system'`);
//   live    → in `'system'` mode, the standard `languagechange` event re-applies
//             the (possibly new) system languages immediately;
//   persist → `setLanguage()` flips the locale in-place AND persists the
//             preference via the dedicated `set_language` command (not
//             `set_config`, which validates the whole provider config and
//             would reject fresh installs with no model yet).
//
// Called exactly once, from App.vue. `<html lang>` is kept in sync by
// `setI18nLocale` so screen readers and font fallbacks follow the UI language.

export function useLanguage(config: Ref<AppConfig | null>) {
  /** Effective preference: the stored one once config loads, system before. */
  const preference = (): LanguagePreference => config.value?.language ?? 'system';

  /** Resolve a preference to a concrete locale and apply it globally. */
  function apply(pref: LanguagePreference) {
    setI18nLocale(pref === 'system' ? resolveLocale(navigator.languages) : pref);
  }

  /** OS language changed — only meaningful while following the system. */
  function onSystemLanguageChange() {
    if (preference() === 'system') apply('system');
  }

  // React to the stored preference (boot load, and any later config swap).
  // `sync` so the locale can never lag the config by a frame (and downstream
  // getters like `useSetupForm`'s see a consistent language immediately);
  // `immediate` so the composable is self-contained — mounting already applies
  // the current preference (idempotent with the boot-time system resolution).
  watch(preference, (pref) => apply(pref), { flush: 'sync', immediate: true });

  onMounted(() => {
    window.addEventListener('languagechange', onSystemLanguageChange);
  });

  onUnmounted(() => {
    window.removeEventListener('languagechange', onSystemLanguageChange);
  });

  /**
   * Switch the UI language immediately and persist the preference.
   *
   * Applies optimistically (the UI must never wait on disk I/O); a persist
   * failure is logged but not surfaced — the choice still holds for this
   * session and the user can retry from the settings field.
   */
  async function setLanguage(pref: LanguagePreference): Promise<void> {
    apply(pref);
    config.value = config.value ? { ...config.value, language: pref } : config.value;
    try {
      await setLanguagePref(pref);
    } catch (e) {
      console.warn('[useLanguage] failed to persist language preference:', e);
    }
  }

  return { setLanguage };
}
