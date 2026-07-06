/**
 * Format a Unix timestamp (seconds) as a compact relative string.
 *
 * Boundaries: < 1 min → "just now", < 1 h → "Xm ago", < 1 day → "Xh ago",
 * < 7 days → "Xd ago", otherwise → local "YYYY-MM-DD".
 */
export function relativeTime(unixSecs: number): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const elapsed = nowSec - unixSecs;

  if (elapsed < 60) return 'just now';
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
  if (elapsed < 604800) return `${Math.floor(elapsed / 86400)}d ago`;

  // Local timezone — desktop users expect their local calendar date.
  const d = new Date(unixSecs * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
