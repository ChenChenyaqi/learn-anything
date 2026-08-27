/* Locale resolution: map arbitrary BCP-47 language tags to the locales the
 * app actually ships ('en' | 'zh-CN').
 *
 * Deliberately a pure function over an input tag list (no `navigator` access)
 * so it can be unit-tested directly; `useLanguage` feeds it
 * `navigator.languages` in the browser.
 *
 * Semantics: the first tag that resolves wins, mirroring how browsers order
 * user language preferences. Any Chinese variant (zh, zh-Hans, zh-TW, …)
 * maps to the single shipped Chinese locale (simplified). Anything else
 * falls back to English, matching the CLI package's `detectSystemLocale`. */

/** Locales shipped by the app. Same codes as the CLI package's i18n. */
export type SupportedLocale = 'en' | 'zh-CN';

/** Map a BCP-47-ish language tag to a supported locale, or `null` if the tag
 *  matches neither English nor Chinese (so the caller can keep scanning). */
function matchTag(tag: string): SupportedLocale | null {
  // Normalize case and both separator styles (`zh-CN` / `zh_CN`).
  const lower = tag.toLowerCase().replace('_', '-');
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  return null;
}

/** Resolve the first supported locale from an ordered list of language tags
 *  (e.g. `navigator.languages`). Falls back to English when nothing matches. */
export function resolveLocale(languageTags: readonly string[]): SupportedLocale {
  for (const tag of languageTags) {
    const matched = matchTag(tag);
    if (matched) return matched;
  }
  return 'en';
}
