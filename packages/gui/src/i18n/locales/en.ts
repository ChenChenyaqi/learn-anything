/* English messages — the source of truth for the message schema.
 *
 * Every locale file must keep the exact same key structure; `MessageSchema`
 * (derived from this object) is fed to `createI18n`'s generics so `t()` keys
 * are compile-time checked, and `zh-CN.ts` annotates itself against the same
 * type so a missing/extra key fails `vue-tsc`.
 *
 * Keys are organized by feature domain: `common.*` (cross-page strings),
 * `app.*`, `setup.*`, `header.*`, `main.*`, `overview.*`, `workspace.*`,
 * `quiz.*`, `chat.*`. Values use vue-i18n message syntax: `{name}` named
 * interpolation, `@` / `|` / `{` are special and must be escaped if a
 * translation ever needs them literally. */

const en = {
  common: {
    loading: 'Loading…',
    retry: 'Retry',
    back: 'Back',
    save: 'Save',
    saving: 'Saving…',
    fileNotFound: 'File not found.',
  },
  setup: {
    language: 'Language',
    languageSystem: 'Follow system',
  },
};

/** The master shape every locale file must match (widened to `string`). */
export type MessageSchema = typeof en;

export default en;
