import { ref } from 'vue';
import en, { type I18nKey } from './locales/en';
import zhCN from './locales/zh-CN';

export type { I18nKey } from './locales/en';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type Locale = 'en' | 'zh-CN';

type Messages = Record<I18nKey, string>;

const messages: Record<Locale, Messages> = { en, 'zh-CN': zhCN };

/* ------------------------------------------------------------------ */
/*  Shared state (singleton across components)                        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'learn-anything-locale';
const THEME_KEY = 'learn-anything-theme';

function detectLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en') return stored;
  return 'en';
}

const locale = ref<Locale>(detectLocale());

/* ------------------------------------------------------------------ */
/*  Composable                                                        */
/* ------------------------------------------------------------------ */

export function useI18n() {
  const t = (key: I18nKey): string => {
    return messages[locale.value][key];
  };

  const toggleLocale = (): void => {
    locale.value = locale.value === 'en' ? 'zh-CN' : 'en';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale.value);
    }
  };

  const setLocale = (next: Locale): void => {
    locale.value = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const isDark = ref<boolean>(
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );

  const toggleDarkMode = (): void => {
    const next = !isDark.value;
    isDark.value = next;
    document.documentElement.classList.toggle('dark', next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    }
  };

  return { locale, t, toggleLocale, setLocale, isDark, toggleDarkMode };
}
