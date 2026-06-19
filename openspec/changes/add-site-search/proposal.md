## Why

The site offers no way to locate notes other than manually expanding the sidebar
file tree. As a knowledge base grows across multiple topics, domains, and dated
session files, finding a specific note or heading becomes painful, and there is
no way to link directly to a section of a note. A VitePress-style search
experience and shareable heading anchors solve both discoverability and
deep-linking.

## What Changes

- Add a server-side search index that scans every note's headings and filenames,
  exposed as a new `/api/search-index` endpoint (lazy-built, cache-invalidated on
  file change).
- Add a search trigger placed in the top-left of the sidebar and a centered
  command-palette modal with full keyboard navigation (`Cmd/Ctrl+K` to open,
  `↑/↓` to move, `Enter` to open, `Esc` to close).
- Search covers three scopes at the heading/filename level (matching VitePress
  default depth): session notes (`sessions/**/*.md`), the knowledge map
  (`knowledge-map.md`), and exercise docs (`exercises/**/*.md`).
- Add heading anchor links to rendered Markdown — a `#` permalink that appears on
  hover (left of each heading), so any heading is deep-linkable via a `#slug` URL
  hash that survives page refresh and direct URL entry.
- Wire search results to deep-link into a specific section by reusing the
  heading-anchor scroll mechanism.
- Add i18n strings (EN + zh-CN) for all search UI text.

## Capabilities

### New Capabilities

- `site-search`: Full-text-discovery search experience — server-side heading
  index, client-side filtering, the search modal UI with keyboard navigation, the
  sidebar trigger, and navigation from a result into a note/section.

### Modified Capabilities

- `site-theme`: Markdown rendering gains heading `id` attributes and hover
  anchor-link permalinks (the `#` symbol), and the router gains hash-aware scroll
  so `#slug` URLs locate a section even when content loads asynchronously.

## Impact

- **New dependency**: `markdown-it-anchor` (zero sub-dependencies) added to
  `packages/cli/site`.
- **Server**: `packages/cli/site/serve.mjs` gains a `/api/search-index` route and
  a heading-extraction/index-cache routine.
- **Frontend**: new `useSearch` composable, new `SearchModal` and `SearchTrigger`
  components; `App.vue` (global shortcut + modal mounting + result navigation),
  `AppSidebar.vue` (trigger placement), `router/index.ts` (hash scroll),
  `utils/markdown.ts` (anchor plugin + CJK-preserving slugify), `composables/useI18n.ts`
  (search strings), and `styles/main.css` (anchor-link hover styles).
- **No breaking changes** to existing routes or data contracts; the new endpoint
  and components are purely additive.
