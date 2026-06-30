# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.6] - 2026-06-29

### Changed

- Quiz keyboard shortcut hints now mention number keys (`1-4`) in addition to letters (`A-D`), and use a more compact range notation. (#108)

### Added

- Quiz workflow now reads explain session notes as the **preferred reference** for question generation. Questions are anchored in what the learner actually studied (analogies, code examples, misconceptions), while still allowing the AI to extend beyond the notes. Falls back to the concept's `details[]` in state.json when no session notes exist. (#107)
- New `multi_select` question type for multiple-answer quiz questions. The quiz system now supports true multi-select (checkboxes) alongside the existing single-select `multiple_choice` type. Includes full-stack support: schema, validation, UI rendering with toggle logic, keyboard shortcuts (A/B/C/D toggle), order-independent set grading, i18n labels, and AI generation template updates. (#91, #106)

## [1.5.5] - 2026-06-29

### Fixed

- Fixed skill templates silently failing to discover files under the hidden `.learn/` directory — the glob tool ignores dot-prefixed paths by default. All discovery instructions now explicitly use Bash `ls -d` instead of glob. (#72, #101)
- Fixed binary files (e.g. Rust compiled binaries) showing up in the dashboard practice directory tree. Exercises listing now detects binary files by content using Git's NUL-byte heuristic instead of an extension list, and also hides build sub-directories like `target/`. (#90, #102)
- Fixed quiz cards rendering multi-line content (especially embedded code in `error_correction` questions) on a single line. Quiz text elements now use `whitespace-pre-wrap break-words` so `\n` newlines display correctly, while keeping the XSS-safe `{{ }}` text interpolation (no `v-html`). (#92, #103)

## [1.5.4] - 2026-06-29

### Changed

- Refactored `packages/cli/site`: split large files into focused modules — `useQuiz.ts` (398 lines) split into `types.ts`, `quizApi.ts`, `grading.ts`, `useQuizQueue.ts`, `useQuizSession.ts`; extracted shared `utils/highlight.ts` and `utils/slug.ts`; extracted `fileContentCache.ts` from `useTopicData.ts`; extracted `useSearchLauncher` composable (⌘K hotkey + search-select routing) from `App.vue`; moved `Dashboard.vue` and `TopicPage.vue` into a `views/` directory.
- Configured `@/*` path alias (tsconfig + vite) and migrated all `../` relative imports to `@/`.
- Split `QuizModal.vue` into `QuizLoadingView` and `QuizPlayView`; split sidebar, content, and search components into single-responsibility files.

### Fixed

- Fixed file content cache using FIFO eviction instead of LRU — cache hits now re-insert the entry as most-recently-used.
- Fixed ⌘K (Cmd/Ctrl-K) search hotkey activating while focus is in an input, textarea, or contentEditable element.
- Prevented default space-key scrolling while a quiz modal is open.

## [1.5.3] - 2026-06-26

### Fixed

- Fixed the multi-group (queue) quiz results and summary dialogs not scrolling when content overflows: switched the per-group results and final summary dialogs from `flex flex-col` to `grid grid-rows-[minmax(0,1fr)]` so the inner `QuizResults`/`QuizSummary` components receive a definite height and their scroll area activates, keeping the header and footer fixed instead of being clipped.

## [1.5.2] - 2026-06-26

### Fixed

- Fixed 404 errors for all API routes when topic directories have non-ASCII (e.g. Chinese) names: `/api/topics/:slug`, `/api/quizzes/:topic/:restPath`, and static file serving now properly decode `pathname` before filesystem resolution. Also added `encodeURIComponent` in `useTopicData.ts` for consistency with other frontend fetch calls.

## [1.5.1] - 2026-06-26

### Fixed

- Fixed 404 errors when requesting quiz.json from quiz concept directories with non-ASCII characters (serve.mjs restPath was not URI-decoded before filesystem resolution)

## [1.5.0] - 2026-06-25

### Added

- **Quiz card practice UI**: Interactive quiz modal with keyboard shortcuts, card slide transitions, and 4 question-type renderers (multiple choice, true/false, fill-in-blank, error correction).
- **Quiz results & summary views**: Per-question grading feedback with explanations, multi-group score breakdown with progress bars.
- **Multi-group queue mode**: Sequential and shuffled batch quiz across concept groups, with per-group retry and aggregate summary.
- **Sidebar quiz tree**: New sidebar tab listing quizzes grouped by concept, with one-click single-deck launch and batch sequential/random buttons.
- **Quiz test fixtures**: 6 quiz.json files across JavaScript, Python, and React topics covering all 4 question types.

### Changed

- **READMEs synced with quiz workflow**: Both the English and Chinese READMEs now document the single-flow `/learn:quiz <name>` command (replacing the stale `<generate|grade>` two-stage syntax) and include the new `quizzes/` directory in the project structure tree.
- **CSS design tokens**: Added `--color-mastered-rgb` and `--color-brand-2-rgb` for alpha transparency support in composable styles.

## [1.4.0] - 2026-06-24

### Added

- **Quiz workflow (`/learn:quiz`)**: A new single-flow text Q&A quiz that generates, grades, and persists a reusable question deck per concept. Supports four text-answer question types — multiple choice, true/false, fill-in-blank, error correction — with a `gradeable` model (`exact` / `accepted` / `ai_only`) for consistent AI grading. Decks are saved as structured `quiz.json` files, enabling future zero-token re-practice on the dashboard.
- **Quiz deck validation (`validate-quiz.mjs`)**: A standalone validation script (mirroring `render.mjs`) that checks each `quiz.json` deck against the v1 schema — field types, type↔gradeable consistency, and required sub-fields — immediately after the deck is written. Ships inside the `learn-anything-quiz` skill directory.
- **Shared state-update table**: Quiz and practice now share a single `STATE_UPDATE_TABLE` for learning-progress updates, keeping the two workflows in sync.

## [1.3.2] - 2026-06-19

### Fixed

- **Search result layout**: Title and file path columns in search results now split the available width equally, preventing long paths from compressing the title to a single character. Long paths truncate from the left so the filename remains visible.

## [1.3.1] - 2026-06-19

### Fixed

- **Auto-find free port for `serve`**: When running `learn-anything serve`, if the target port is already in use the server now automatically probes for the next available port (up to 50 attempts) instead of exiting with an error. Use `--strict-port` to opt out and require the exact port.
- **TOC activeId flash on click**: When clicking a heading in the table of contents sidebar, the active highlight no longer flickers through intermediate headings during smooth scroll. The IntersectionObserver is temporarily suppressed until the scroll animation completes.

## [1.3.0] - 2026-06-19

### Added

- **Heading search (⌘K / Ctrl+K)**: A VitePress-style command palette opens via keyboard shortcut or sidebar button, letting users jump to any heading across session notes, the knowledge map, and exercise docs. The server builds a lazy, cached search index (`/api/search-index`) that refreshes on file change; the client filters locally with no per-keystroke requests.
- **Heading anchor links**: Every rendered heading now carries a deep-linkable `id` and a hover-revealed `#` permalink (brand-accent color). Clicking the anchor or entering a `#slug` URL scrolls smoothly to the section, surviving async content loads and page refreshes. CJK heading text is preserved in slugs.
- **Table of contents outline**: A right-side sticky TOC panel (visible at `xl` breakpoint and above) lists `h2`/`h3` headings for the current note or knowledge map. An `IntersectionObserver` scroll-spy highlights the active section; clicking an item scrolls to it and syncs the URL hash.

### Fixed

- **Dark-mode scrollbar colors**: Native scrollbars (sidebar tree, search modal, code blocks) now adapt to dark mode via CSS-variable-based `scrollbar-color` and `::-webkit-scrollbar` rules, instead of showing the light system default.
- **Heading anchor accessibility**: The permalink anchor switched from `aria-hidden="true"` to `aria-label` + `tabindex="-1"`, resolving a browser warning when the anchor receives focus on click.

## [1.2.2] - 2026-06-19

### Fixed

- **Sanitized HTML rendering**: Markdown output is now sanitized via DOMPurify. Safe HTML renders normally — including the `<details>/<summary>` collapsible blocks used for answers, tables, and code highlighting — while dangerous constructs (`<script>`, `on*` event handlers, `javascript:` URIs, `<iframe>`, etc.) are stripped, closing the `v-html` injection surface.

## [1.2.1] - 2026-06-19

### Added

- **Automated release workflow**: `scripts/release.sh` orchestrates the full release end-to-end — `develop` → release branch → CI-gated PR to `main` → tag → GitHub Release → sync back to `develop`. Release notes are sourced from the gitignored `release-notes.md`, so the CHANGELOG, PR body, and GitHub Release all stay in sync from a single source.

### Changed

- **Cleaner shareable URLs**: The sidebar tab (notes/exercises) is now inferred from the selected file's path (`/topics/<slug>/sessions/` vs `/topics/<slug>/exercises/`) instead of a redundant `&tab=` query parameter. Switching tabs is now a pure UI action that no longer pollutes the URL.

### Fixed

- **Python dunders render verbatim**: `__init__`, `__proto__`, `__name__`, and other dunder identifiers no longer get mangled into bold (`<strong>init</strong>`) by markdown's underscore emphasis rule. Underscore-based emphasis is now disabled, while `*`/`**` emphasis (bold/italic), code blocks, inline code, and links are fully preserved. (The knowledge map's manual `\_\_proto\_\_` escaping is no longer needed.)
- **Angle-bracket content no longer vanishes**: Sequences like `<init>`, `<T>`, and `<T extends U>` are no longer swallowed as raw HTML tags. Raw HTML in notes is disabled (`html: false`), which both fixes the disappearing-text bug and closes the `v-html` injection (XSS) surface.

## [1.2.0] - 2026-06-18

### Added

- **Loading overlay**: Red-pen annotated loading overlay (150ms threshold) for file loads, matching the notebook design theme.
- **Sidebar tree expansion persistence**: Expanded domains/concepts now persist across navigation and page refresh via sessionStorage; expanding one node no longer collapses others.
- **Orphan directory marking**: Directories not in `state.json` (orphans) display their English name with a gray dot and a full-row hover tooltip.

### Changed

- **Sidebar trees mirror actual directories**: The notes and exercises trees now reflect the real `sessions/` and `exercises/` directory structure; `state.json` is used only for display names and ordering.
- **Empty directory display**: Empty directories (including orphans) are now shown in the sidebar with a "no notes/no exercises" placeholder.
- **Async content loading**: File selection is now synchronous while content loads asynchronously, eliminating first-render flicker.

### Fixed

- **Note flicker on reload**: Fixed the note content flicker on page reload.
- **Skeleton screen for empty content**: Fixed the skeleton loading screen incorrectly shown for files with empty content.

## [1.1.1] - 2026-06-18

### Added

- **File-to-URL sync**: Selecting a file in the sidebar now updates the browser URL (`?file=...&tab=...`), enabling shareable, bookmarkable links to specific notes and exercises.
- **Tab state persistence**: The sidebar tab selection (topics/exercises) persists across page reloads via the URL query parameter.

### Changed

- **Smart hot reload**: File changes no longer trigger a full page reload. Instead, a reactive `dataVersion` mechanism triggers component re-renders while preserving scroll position and UI state.
- **Tree auto-expand on reload**: The sidebar navigation tree now automatically expands to the node containing the currently selected file on page load, instead of always expanding the first domain.

### Fixed

- **Hot reload UX**: Eliminated disruptive full-page refreshes when editing notes or exercises. The page stays stable with scroll position preserved.
- **Sidebar state loss**: Fixed sidebar tab and tree expansion state being lost on page reload.

## [1.1.0] - 2026-06-18

### Added

- **Standalone API server** (`serve.mjs`): Extracted the serve API logic from the Vite plugin into a standalone server, providing cleaner separation between the dev server and data layer.

### Changed

- **HTTP API data layer**: Refactored `useTopicData.ts` to fetch topic data via HTTP API instead of static file imports, enabling dynamic data updates without rebuild.
- **Simplified vite.config.ts**: Removed the inline serve API plugin; the API server now runs independently via `serve.mjs`.
- **`bundle-site.mjs` refactored**: Streamlined the site build bundle script.

### Removed

- **Legacy modules**: Removed `files.ts` and `site-generator.ts` — their functionality has been absorbed into the new API server and build pipeline.

### Fixed

- **CI build**: Added `packages/cli/site/` to the pnpm workspace so its dependencies (vue, vue-router) are installed by CI, resolving a build failure.

## [1.0.0] - 2026-06-18

### Added

- **Visual learning site**: A custom Vue 3 + Vite application with Vue Router, Tailwind CSS v4, markdown-it, and highlight.js. Provides a rich visual interface to browse knowledge maps, session notes, and exercise files.
- **SiteGenerator class**: Writes front-end site files into `.learn/` directory, with smart config overwrite rules and `--force` mode.
- **`serve` command**: `learn-anything serve [path]` generates the visual site, installs dependencies, and starts a Vite dev server with hot module replacement.
- **`--site` flag**: `learn-anything init --site` and `learn-anything update --site` generate the visual site alongside skill/command files.
- **Interactive site prompt**: `init` and `update` now prompt whether to generate the visual learning site in interactive mode.
- **Enhanced file scanning**: `sessions/*.md` and `exercises/*` files without subdirectory grouping are now supported and displayed as a flat list at the bottom of the sidebar.
- **Hot module replacement**: Modifying topic files (state.json, sessions, exercises) triggers automatic browser refresh.
- **New main specs**: `site-build`, `site-cli`, `site-generator`, `site-theme` specifications added.

### Changed

- **Monorepo structure**: `packages/cli/site/` now houses the standalone Vue 3 front-end app. Site files are bundled into `packages/cli/src/site/files.ts` at build time.
- **`.learn/` layout**: Site files now live under `.learn/site/`, separate from `.learn/topics/`.

## [0.5.1] - 2026-06-16

### Added

- **Source location annotations**: Code examples in the explain workflow now include source file and line number references, helping the AI tutor provide precise cross-references during Socratic explanations.
- **Star History chart**: Added an embeddable Star History chart to all README files for better visual visibility of project growth.

## [0.5.0] - 2026-06-11

### Changed

- **Monorepo architecture**: Converted the project to a pnpm monorepo with `packages/cli` (published as `learn-anything-cli`) and `packages/gui` (private, future GUI). Build, test, and lint commands now support per-package execution via `pnpm -F`.
- **Simplified build pipeline**: Replaced the custom `build.js` wrapper with direct `tsc` compilation, reducing indirection and making the build process more standard.

### Added

- **README enhancements**: Added badges, monorepo structure diagram, and footer to all READMEs for better visual polish and discoverability.

## [0.4.2] - 2026-06-10

### Fixed

- **YAML frontmatter compatibility for Codex**: Changed `Dual-mode:` to `Dual-mode (...)` in SKILL_DESCRIPTION to avoid colon being interpreted as a YAML key-value separator causing invalid frontmatter in Codex.

## [0.4.1] - 2026-06-09

### Added

- **Directory-based explanation storage**: Explanation sessions now store files organized by directory structure, matching the topic hierarchy in `state.json` for better session management and navigation.

## [0.4.0] - 2026-06-07

### Added

- **Learn Protocol v1**: `state.json` is now the single source of truth for all learning data, using a hierarchical knowledge map format (domains → concepts → details). The old dual-file model (state.yaml + hand-written knowledge-map.md) is replaced — `knowledge-map.md` is now a **generated artifact** produced by `render.mjs` from `state.json`, never edited directly. AI instructions explicitly forbid reading or writing `knowledge-map.md` as a data source.
- **Automatic v0→v1 migration**: Existing learning data is auto-migrated on `learn-anything init` or `update`, with backup files created for safety.
- **Schema validation**: `render.mjs` validates `state.json` against the v1 schema before generating `knowledge-map.md`, with clear error messages on field mismatches.
- **Status script**: New standalone `status.mjs` script reads `state.json` and outputs a formatted heatmap or topic summary, reducing AI token spend. Supports `--locale en|zh-CN` for i18n output.
- **Shared utils** (`utils.mjs`): Extracted shared types, validation, and helpers used by both `render.mjs` and `status.mjs`.

### Changed

- **Prompt compression**: Reduced skill template INSTRUCTIONS by ~69% (457 fewer lines) across 4 workflow templates, eliminating redundancy while preserving all functional behavior.
- **Unified learning icons**: Replaced mixed icon styles with a consistent colored circle set (🟢 🔵 🟠 ⚪) across `render.mjs`, migration code, skill templates, and test fixtures.
- **All 5 workflow templates** updated to read/write `state.json` only, dropping `knowledge-map.md` as a data source.

## [0.3.1] - 2026-06-07

### Added

- Optional Context7 MCP integration for documentation verification during `init`. When enabled, generated skill files (topic, explain, practice) include guidance instructing the AI to verify explanations against official documentation using Context7 MCP tools (`resolve-library-id` + `query-docs`).
- `--context7` / `--no-context7` CLI flags for non-interactive Context7 control.
- After init, displays a setup hint with a link to Context7 docs for manual MCP configuration.
- i18n support for Context7 prompts in both `en` and `zh-CN`.

## [0.3.0] - 2026-06-04

### Added

- CI workflow (GitHub Actions): lint, test, and build on every push and PR.
- Pre-commit hooks: Husky with lint-staged for ESLint, Prettier, and commitlint.

### Fixed

- Session files now written BEFORE echoing to conversation in `learn:practice` and `learn:explain` workflows, eliminating drift between saved content and chat output.
- Test path assertions made cross-platform compatible (Windows vs Unix path separators).

## [0.2.1] - 2026-05-30

### Fixed

- Relax `engines.node` from `>=20.19.0` to `>=20.0.0` for broader compatibility.

## [0.2.0] - 2026-05-29

### Added

- Dual-mode practice: Project Mode creates real code files in your IDE; Chat Mode for conceptual discussion.
- Persist learning session records for continuity across sessions.

### Fixed

- Reword session-save timing from "after" to "in the same turn" for clarity.

## [0.1.0] - 2026-05-28

### Added

- `learn-anything` CLI: generate skill and command files for 30+ AI coding tools.
- `init` command: interactive tool detection and selection, skill generation.
- `update` command: update existing skill files.
- Five learning workflows: topic, explain, practice, review, status.
- Locale support: English (`en`) and Chinese (`zh-CN`).
- MIT License.

[Unreleased]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.6...HEAD
[1.5.6]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.5...v1.5.6
[1.5.5]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.4...v1.5.5
[1.5.4]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.3...v1.5.4
[1.5.3]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.5.1...v1.0.0
[0.5.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ChenChenyaqi/learn-anything/releases/tag/v0.1.0
