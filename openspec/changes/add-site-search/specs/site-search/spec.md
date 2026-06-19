## ADDED Requirements

### Requirement: Server exposes a heading search index

The system SHALL expose a `/api/search-index` endpoint that returns a flat JSON
array of searchable entries built by scanning Markdown files from the configured
`TOPICS_DIR`. The index SHALL cover three scopes: session notes
(`sessions/**/*.md`), the knowledge map (`knowledge-map.md`), and exercise docs
(`exercises/**/*.md`). Each entry SHALL include a display `title`, a heading
`level` (1–6), the API `path` used to open the file, the owning `topicSlug` and
`topicName`, a `section` breadcrumb (domain/concept name or "Knowledge Map"), and
a `kind` (`note`, `knowledge-map`, or `exercise`). Every in-scope file SHALL also
produce one filename pseudo-entry with `level: 0` so files without matching
headings remain discoverable by filename. The index SHALL be built lazily on the
first request and cached server-side; the cache SHALL be invalidated on the same
file-change cycle that refreshes topic data.

#### Scenario: Index includes headings from a session note

- **WHEN** the server receives `GET /api/search-index` and a topic has
  `sessions/language-basics/2026-06-13.md` containing `## Operators`
- **THEN** the response array contains an entry with `title` "Operators",
  `level` 2, `kind` "note", and a `path` resolving to that file

#### Scenario: Index includes a filename pseudo-entry

- **WHEN** a session note contains no headings
- **THEN** the index still contains one entry for that file whose `title` is the
  filename and whose `level` is 0

#### Scenario: Index covers the knowledge map and exercise docs

- **WHEN** a topic has a `knowledge-map.md` with `## Domains` and an
  `exercises/variables/README.md` with `# Variables`
- **THEN** the index contains both headings, distinguished by `kind`
  "knowledge-map" and "exercise" respectively

#### Scenario: Index refreshes after a file change

- **WHEN** a note file is added or edited and the file-change watcher fires
- **THEN** the cached search index is cleared and the next `/api/search-index`
  request rebuilds it with the updated content

### Requirement: Client fetches and filters the search index locally

The system SHALL provide a `useSearch` composable that lazily fetches the search
index from `/api/search-index` on first use, caches it in memory, and exposes a
`search(query)` function that filters entries client-side with case-insensitive
matching against each entry's title and filename. Filtering SHALL NOT issue a
network request per keystroke. The cached index SHALL be discarded and refetched
when topic data is refreshed (the SSE reload cycle), so results stay current.

#### Scenario: First search triggers a single fetch

- **WHEN** the user opens the search modal for the first time and types a query
- **THEN** exactly one `GET /api/search-index` request is issued and subsequent
  keystrokes filter the cached results locally

#### Scenario: Case-insensitive heading match

- **WHEN** the user types "opera" and an entry's title is "Operators"
- **THEN** that entry is included in the results

#### Scenario: Index refetches after a reload event

- **WHEN** the SSE reload cycle bumps the data version
- **THEN** the next search refetches `/api/search-index` instead of using the
  stale cached index

### Requirement: Search modal opens via keyboard shortcut and sidebar trigger

The system SHALL render a search trigger in the top-left of the sidebar (below
the site title) that opens a centered search modal. The modal SHALL also open in
response to a global keyboard shortcut: `Cmd+K` on macOS and `Ctrl+K` on Windows
and Linux. The shortcut SHALL be inactive while the modal is already open or
while the user is typing in an existing text input, to avoid stealing keystrokes.
Closing the modal SHALL restore focus to the trigger.

#### Scenario: Keyboard shortcut opens the modal

- **WHEN** the modal is closed and the user presses `Cmd+K` (macOS) or
  `Ctrl+K` (Windows/Linux)
- **THEN** the search modal opens and the input receives focus

#### Scenario: Sidebar trigger opens the modal

- **WHEN** the user clicks the search trigger in the sidebar header
- **THEN** the search modal opens and the input receives focus

#### Scenario: Shortcut does not fire while typing in an input

- **WHEN** the user is focused in a text input and presses `Cmd+K`/`Ctrl+K`
- **THEN** the modal does not open from the shortcut (the input retains the
  keystroke)

### Requirement: Search modal supports keyboard navigation

The modal SHALL be an accessible dialog (`role="dialog"`, `aria-modal="true"`)
with a focus trap. The user SHALL move the active result with `ArrowUp`/`ArrowDown`,
open the active result with `Enter`, and close the modal with `Escape`. The
active result SHALL be scrolled into view when moved out of the visible region,
and SHALL be visually indicated with the brand accent.

#### Scenario: Arrow keys move the active result

- **WHEN** the results list is visible and the user presses `ArrowDown` then
  `ArrowUp`
- **THEN** the active result moves accordingly and remains visible

#### Scenario: Enter opens the active result

- **WHEN** the user presses `Enter` with an active result highlighted
- **THEN** that result is opened and the modal closes

#### Scenario: Escape closes the modal

- **WHEN** the user presses `Escape` while the modal is open
- **THEN** the modal closes and focus returns to the search trigger

#### Scenario: Empty query shows no results

- **WHEN** the search input is empty
- **THEN** no result entries are rendered

#### Scenario: No matches show a guiding empty state

- **WHEN** the query matches no entries
- **THEN** the modal displays an empty-state message (not an error)

### Requirement: Selecting a search result opens the note or section

The system SHALL navigate to a selected result's file using the existing
file-selection flow. Selecting a note or exercise entry SHALL select the file
(navigating to `/topics/:slug?file=<path>`). Selecting a knowledge-map entry
SHALL navigate to the topic's default view (no `?file=` query). When a result
carries a heading anchor, the system SHALL scroll to that section after the
content renders, reusing the heading-anchor deep-link mechanism.

#### Scenario: Selecting a session-note heading opens the file

- **WHEN** the user selects an entry titled "Operators" in
  `/topics/javascript/sessions/language-basics/2026-06-13.md`
- **THEN** the file is selected and the view scrolls to the "Operators" heading

#### Scenario: Selecting a knowledge-map entry shows the default view

- **WHEN** the user selects a knowledge-map heading entry for topic "javascript"
- **THEN** the route becomes `/topics/javascript` (no `file` query) and the
  knowledge map renders, scrolled to the selected heading

#### Scenario: Selecting an exercise doc opens it

- **WHEN** the user selects an `exercises/variables/README.md` heading entry
- **THEN** the README file is selected and rendered
