/* Unicode-aware slugify for heading anchors. */

/**
 * Unicode-aware slugify that preserves CJK characters.
 * Prefixes every id with `h-` to mitigate DOM clobbering from user-controlled
 * heading text (per markdown-it security guidance).
 */
export function headingSlug(str: string): string {
  return (
    'h-' +
    str
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
  );
}
