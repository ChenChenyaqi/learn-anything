## 1. Setup

- [x] 1.1 Add `markdown-it-anchor` to `packages/cli/site/package.json` devDependencies and install
- [x] 1.2 Add search i18n keys (`search.placeholder`, `search.noResults`, `search.open`, `search.shortcutMac`, `search.shortcutNonMac`) to `useI18n.ts` for EN and zh-CN

## 2. Server-side search index

- [x] 2.1 Add `buildSearchIndex()` to `serve.mjs` that scans `sessions/**/*.md`, `knowledge-map.md`, and `exercises/**/*.md`, extracting headings (`/^(#{1,6})\s+(.+)/`) and emitting entries `{ title, level, path, topicSlug, topicName, section, kind }`
- [x] 2.2 Add one filename pseudo-entry (`level: 0`) per in-scope file so heading-less files are discoverable
- [x] 2.3 Cache the index in a module-level variable and clear it on the existing file-change watcher cycle
- [x] 2.4 Register the `GET /api/search-index` route in the request handler returning the cached/lazily-built index

## 3. Markdown heading anchors

- [x] 3.1 Register `markdown-it-anchor` in `utils/markdown.ts` with header-link permalink (`#` symbol, placed before heading)
- [x] 3.2 Implement a CJK-preserving `slugify` (lowercase, strip `[^\p{L}\p{N}\s-]`, whitespace → `-`) and pass it to the plugin
- [x] 3.3 Prefix generated heading ids (e.g. `h-`) to mitigate DOM clobbering
- [x] 3.4 Verify rendered anchors and ids survive `DOMPurify.sanitize`; adjust allowed attributes if any are stripped

## 4. Anchor-link and hash deep-link styling/scroll

- [x] 4.1 Add `.header-anchor` hover styles to `styles/main.css` (hidden by default, brand-2 accent on `:hover`, float-left offset) within `.prose-content`
- [x] 4.2 Update `router/index.ts` `scrollBehavior` to return `{ el: to.hash, behavior: 'smooth' }` when a hash is present
- [x] 4.3 Add the content-load fallback in `App.vue`: after selected-file content is applied, on `nextTick` scroll to `route.hash` if unresolved

## 5. Client search composable

- [x] 5.1 Create `src/composables/useSearch.ts` exposing `loadSearchIndex()` (lazy fetch `/api/search-index`, in-memory cache) and `search(query)` (case-insensitive title/filename filter, no per-keystroke requests)
- [x] 5.2 Invalidate/refetch the cached index when `getDataVersion()` bumps (SSE reload alignment)

## 6. Search UI components

- [x] 6.1 Create `src/components/SearchTrigger.vue` (search button + `⌘K`/`Ctrl K` badge, emits `open`) and place it in `AppSidebar.vue` below the site title
- [x] 6.2 Create `src/components/SearchModal.vue`: accessible dialog (`role="dialog"`, `aria-modal`, focus trap), autofocus input, grouped results with monospace breadcrumb, active-item brand-2 left accent bar
- [x] 6.3 Implement keyboard handling in the modal: `ArrowUp`/`ArrowDown` move active (scroll into view), `Enter` opens, `Escape` closes and restores focus to the trigger
- [x] 6.4 Render empty/no-result states using i18n strings

## 7. App wiring and navigation

- [x] 7.1 Mount `<SearchModal>` in `App.vue` with open state; register global `Cmd+K`/`Ctrl+K` listener (suppressed while focused in a text input or while open)
- [x] 7.2 Handle result selection: note/exercise entries reuse `selectFile()` (navigate to `/topics/:slug?file=<path>`); knowledge-map entries navigate to the topic default view (no `file` query)
- [x] 7.3 After opening a result, scroll to its heading anchor (reusing the §4 scroll mechanism) and close the modal

## 8. Verification

- [ ] 8.1 Run `pnpm --filter learn-anything-site dev` and verify `⌘K`/`Ctrl+K` opens the modal; results match headings/filenames across notes, knowledge map, and exercise docs
- [ ] 8.2 Verify deep-linking: hover heading shows `#`, click sets URL hash; entering a `#slug` URL on refresh scrolls to the section; Chinese headings deep-link
- [ ] 8.3 Verify dark mode, EN/zh-CN switching, and that editing a note triggers an index refresh via SSE
- [ ] 8.4 Run `pnpm lint` and `pnpm format:check` from the repo root
