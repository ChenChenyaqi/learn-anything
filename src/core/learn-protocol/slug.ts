/**
 * Generate a stable kebab-case slug from a human-readable name.
 *
 * Rules (applied in order):
 * 1. Replace `/` with `-`
 * 2. Replace spaces with `-`
 * 3. Remove characters that are NOT letters, digits, `-`, or `_`
 * 4. Convert ASCII letters to lowercase; preserve non-ASCII characters
 * 5. Collapse consecutive `-` into a single `-`
 * 6. Trim leading / trailing `-`
 */
export function generateSlug(name: string): string {
  const slug = name
    // 1. / → -
    .replace(/\//g, '-')
    // 2. space → -
    .replace(/\s/g, '-')
    // 3. Remove chars that are NOT [letter, digit, -, _]
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    // 4. ASCII letters to lowercase (preserves non-ASCII)
    .replace(/[A-Z]/g, (ch) => ch.toLowerCase())
    // 5. Collapse consecutive -
    .replace(/-{2,}/g, '-')
    // 6. Trim leading/trailing -
    .replace(/^-+|-+$/g, '');

  return slug;
}
