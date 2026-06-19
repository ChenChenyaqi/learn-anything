## Context

The Learn Anything site is a custom Vue 3 + Vite + Tailwind v4 SPA served by a
local Node.js HTTP server (`serve.mjs`). The server reads topic files from disk
and exposes REST endpoints (`/api/topics`, `/api/topics/:slug`, `/api/file`). A
fetch-based data layer (`useTopicData`) loads topic metadata eagerly at boot and
fetches note content on demand; file changes propagate via SSE.

Today, navigation is limited to expanding the sidebar file tree. There is no
search, and Markdown headings render without `id` attributes, so no section can
be deep-linked or shared by URL. Markdown is rendered by `markdown-it` and
sanitized with DOMPurify (`utils/markdown.ts`).

Stakeholders: note authors browsing growing knowledge bases, and anyone who
needs to share a link to a specific section of a note.

## Goals / Non-Goals

**Goals:**

- Let users find any note or heading by typing, from anywhere, via a keyboard
  shortcut (`Cmd/Ctrl+K`) and a top-left sidebar trigger.
- Match VitePress search depth (heading + filename level) and the VitePress
  heading-anchor UX (hover-revealed `#`, click to set URL hash).
- Support direct deep-linking: entering or refreshing a URL with a `#slug`
  locates the section even though content loads asynchronously.
- Stay inside the existing design system (VitePress tokens, red-pen accent) with
  no new colors or heavy dependencies.

**Non-Goals:**

- Full-body / fuzzy content search (matching a sentence inside a paragraph).
  Heading + filename matching only, per the agreed VitePress-default scope.
- Searching non-Markdown exercise code files (`.js`, `.py`, etc.).
- Server-side query execution per keystroke (index is fetched once, filtered
  client-side).
- Building a search index at static-build time (the index is built at runtime by
  the dev/prod server, consistent with the existing data layer).

## Decisions

### Decision 1: Server-built heading index, client-side filtering

The search index is built by `serve.mjs` by scanning the in-scope Markdown files
and extracting headings (`/^(#{1,6})\s+(.+)/`). It is exposed at
`/api/search-index` as a flat array of entries. The client fetches it once (lazily
on first search open) and filters locally as the user types.

**Why over alternatives:**

- vs. client-side full-text index: avoids downloading every note's body into the
  browser. A heading-only index is tiny (a few hundred bytes per file) and keeps
  boot fast because it loads lazily.
- vs. per-keystroke `/api/search?q=`: avoids request latency and server load on
  every keystroke; local filtering is instant.
- The server already has filesystem access and a file watcher, so building and
  invalidating the cache is trivial and reuses existing machinery.

The index cache is invalidated on the existing file-change SSE cycle, and the
client refetches when `dataVersion` bumps (mirroring `useTopicData`).

### Decision 2: Index entry shape and scoping

Each entry: `{ title, level, path, topicSlug, topicName, section, kind }`.

- `level`: heading level 1–6, or `0` for a synthesized filename pseudo-entry (so
  files with no matching headings are still discoverable by filename).
- `kind`: `'note' | 'knowledge-map' | 'exercise'`.
- `section`: breadcrumb context (domain/concept name, or "Knowledge Map").
- `path`: the same API path the sidebar uses (e.g.
  `/topics/javascript/sessions/language-basics/2026-06-13.md`), so a result opens
  via the existing file-selection flow.

Knowledge-map entries are flagged so clicking them navigates to the topic's
default view (no `?file=` query) rather than treating the map as a selected file.

### Decision 3: `markdown-it-anchor` for heading IDs + permalinks

Use the `markdown-it-anchor` plugin (zero sub-dependencies) rather than a
hand-rolled slugify/post-processor.

**Why:** it provides heading `id` injection, the `#` permalink, duplicate-heading
suffixing (`-1`, `-2`), and a configurable `slugify` in one maintained package.
A hand-rolled solution would have to replicate all of that, including the
tricky duplicate-slug and permalink-rendering logic.

Configuration: `permalink` via the header-link style placed before the heading,
`permalinkSymbol: '#'`, and a **custom `slugify` that preserves CJK characters**
(remove `[^\p{L}\p{N}\s-]`, lowercase, spaces → `-`), matching VitePress behavior
so Chinese headings are deep-linkable. Heading IDs are prefixed (e.g. `h-`) to
mitigate DOM clobbering, per markdown-it's security guidance.

### Decision 4: DOMPurify compatibility

`renderMarkdown` already sanitizes output. DOMPurify's defaults allow `id`,
`class`, `aria-*`, and `<a href="#...">` hash links, so the anchor markup
survives. This will be verified during implementation; if any attribute is
stripped, an explicit `ADD_ATTR`/`ALLOW_UNKNOWN_PROTOCOLS`-free config adjustment
will be applied. Hash-only `href`s are safe and require no protocol relaxation.

### Decision 5: Async-aware hash deep-linking (two-phase)

Direct entry of a `#slug` URL is the hard case because note content loads
asynchronously after route resolution, so the heading element does not exist when
the router's `scrollBehavior` first runs.

- **Phase 1 (router):** `scrollBehavior` returns `{ el: to.hash, behavior:
'smooth' }` when a hash is present — handles the common case where content is
  already rendered.
- **Phase 2 (content-load fallback):** in `App.vue`, after the selected file's
  content is applied and the DOM updates (`nextTick`), if `route.hash` still has
  no resolved element, scroll to it then. This closes the gap for the
  asynchronous-load path.

### Decision 6: Modal UX and keyboard model

A centered command-palette modal (`role="dialog"`, `aria-modal`, focus trap) with
a single input, grouped results, active-item highlighting, and a footer hint
(`↵ open · esc close`). Results are grouped by topic/file; the active item shows
a left red-pen accent bar (`brand-2`) and a monospace breadcrumb — the one
signature element, keeping the rest of the UI quiet and on-token.

## Risks / Trade-offs

- [Heading index goes stale if the watcher misses a change] → Mitigation: the
  index cache is cleared on the same SSE reload cycle that already refreshes all
  topic data; the client refetches on `dataVersion` bump.
- [CJK headings could produce empty/ambiguous slugs] → Mitigation: custom
  unicode-preserving slugify; duplicate-suffix logic still applies.
- [DOMPurify may strip an anchor attribute] → Mitigation: verify during
  implementation; fall back to an explicit allowed-attribute config (no protocol
  relaxation needed for `#` links).
- [Asynchronous content defeats one-shot scroll] → Mitigation: two-phase scroll
  (router + content-load fallback).
- [Large knowledge bases slow first index build] → Mitigation: index is built
  lazily on first search (not at boot) and cached; only headings are scanned, so
  build cost is bounded by file count, not content size.
- [DOM clobbering from user-controlled heading text] → Mitigation: stable `id`
  prefix on all generated heading IDs.
