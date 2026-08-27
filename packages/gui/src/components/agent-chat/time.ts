/**
 * Format a Unix timestamp (seconds) as a compact relative string.
 *
 * Boundaries: < 1 min → "just now", < 1 h → "Xm ago", < 1 day → "Xh ago",
 * < 7 days → "Xd ago", otherwise → local "YYYY-MM-DD".
 *
 * Locale-aware: the relative phrases come from the caller's `t` (a vue-i18n
 * translate function, injected to keep this module framework-agnostic and
 * unit-testable). The date fallback stays the locale-neutral ISO-ish
 * YYYY-MM-DD on purpose — compact and unambiguous in both languages.
 */

export type RelativeTimeT = (key: string, vars?: Record<string, unknown>) => string;

export function relativeTime(unixSecs: number, t: RelativeTimeT): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = nowSec - unixSecs;

  if (elapsed < 60) return t('time.justNow');
  if (elapsed < 3600) return t('time.minAgo', { n: Math.floor(elapsed / 60) });
  if (elapsed < 86400) return t('time.hourAgo', { n: Math.floor(elapsed / 3600) });
  if (elapsed < 604800) return t('time.dayAgo', { n: Math.floor(elapsed / 86400) });

  // Local timezone — desktop users expect their local calendar date.
  const d = new Date(unixSecs * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
