/* The app's vue-i18n instance (Composition API mode).
 *
 * Created once at module scope and installed in `main.ts`. The initial locale
 * is resolved synchronously from the system languages so the very first paint
 * (including the "Starting…" boot screen) is already in the right language;
 * `useLanguage` may then switch it once the stored preference loads.
 *
 * Design notes:
 * - `legacy: false` — Composition API only (`useI18n()` in components,
 *   `i18n.global` outside them). Legacy API mode is deprecated in vue-i18n v11.
 *   The third generic (`false`) tells TypeScript the instance is a Composer
 *   (where `locale` is a writable ref), matching the runtime `legacy: false`.
 * - `globalInjection: true` — exposes `$t` in all templates as a convenience
 *   for markup-only components; script components use `useI18n()`.
 * - Schema-typed generics give compile-time key checking; `missing` logs a
 *   dev warning as a runtime safety net (missing keys fall back to English).
 */

import { createI18n } from 'vue-i18n';
import en, { type MessageSchema } from './locales/en';
import zhCN from './locales/zh-CN';
import { resolveLocale, type SupportedLocale } from './resolve';

export const i18n = createI18n<[MessageSchema], SupportedLocale, false>({
  legacy: false,
  locale: resolveLocale(navigator.languages),
  fallbackLocale: 'en',
  globalInjection: true,
  missing(locale, key) {
    // Dev-time net: parity is enforced by types + a unit test, but a warning
    // here catches dynamic keys the compiler cannot see.
    console.warn(`[i18n] missing message "${key}" for locale "${locale}"`);
  },
  messages: {
    en,
    'zh-CN': zhCN,
  },
});

// Sync `<html lang>` with the boot-resolved locale immediately (index.html
// ships a neutral `lang="en"`; this corrects it before first paint for
// Chinese-system users, without waiting for the stored preference to load).
document.documentElement.lang = i18n.global.locale.value;

/** Set the active locale and keep `<html lang>` in sync (screen readers and
 *  font selection key off it). Callers own the persistence policy. */
export function setI18nLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

export { resolveLocale, type SupportedLocale };
