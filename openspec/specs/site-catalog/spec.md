## ADDED Requirements

### Requirement: Each topic has an automatic flat catalog

The server SHALL maintain a derived `catalog.json` in every directory under
`.learn/topics/`. The catalog SHALL use version 1 and contain a flat `entries`
array whose items have a topic-relative POSIX `path`, a `kind` of `session`,
`exercise`, or `quiz`, and optional `domainSlug` and `conceptSlug` associations.
`state.json` SHALL remain the source of learning semantics and progress.

#### Scenario: Legacy and nested layouts are cataloged

- **WHEN** exercise files exist at either `exercises/<concept>/...` or
  `exercises/<domain>/<concept>/...`, including additional nested directories
- **THEN** every eligible file appears in the same flat catalog format
- **AND** exact path segments are associated with matching slugs from `state.json`

#### Scenario: Unmatched paths remain visible

- **WHEN** no unambiguous state slug matches a cataloged path
- **THEN** the entry is retained without the unresolved semantic field
- **AND** the dashboard presents its physical folder as an orphan

### Requirement: Catalog generation is bounded and recoverable

The catalog builder SHALL recursively inspect only `sessions`, `exercises`, and
`quizzes`; skip symlinks, dot-prefixed nodes, nested `.learn`, `.git`, `.idea`,
and `node_modules`; exclude binary exercise files; and use the file filters
`sessions/**/*.md` and `quizzes/**/*.json`. It SHALL atomically replace missing,
malformed, or incompatible catalogs and preserve a `.learn/.gitignore` entry for
`topics/*/catalog.json`.

#### Scenario: Server starts with a stale catalog

- **WHEN** the server starts and a topic catalog is absent, invalid, or differs
  from the filesystem
- **THEN** it performs one recursive reconciliation for that topic and writes a
  valid catalog automatically

### Requirement: Runtime changes update only affected catalogs

The recursive filesystem watcher SHALL incrementally add, replace, or remove a
catalog entry for an identifiable file event. Directory, state, and ambiguous
events SHALL rescan only the affected topic where possible. Writes to
`catalog.json` itself SHALL not trigger another update cycle.

#### Scenario: One topic changes

- **WHEN** a learning file changes in one known topic
- **THEN** only that topic catalog and search state are updated
- **AND** SSE emits `{ "type": "topic-updated", "topicSlug": "<slug>" }`
- **AND** the client refetches only that topic after reconciling summaries

#### Scenario: Topic membership changes

- **WHEN** a topic is added, removed, or cannot be identified from the watcher event
- **THEN** SSE emits `{ "type": "topics-updated" }`
- **AND** the client uses summary revisions to fetch only added or changed topics

### Requirement: Dashboard renders physical catalog trees

Each learning tab SHALL construct a recursive navigation tree by splitting the
flat paths for its catalog kind. The leading `sessions`, `exercises`, or
`quizzes` segment SHALL be hidden. Exact state slug matches SHALL supply labels
and ordering; other directory names SHALL be preserved and marked as orphans.
File content SHALL continue to load lazily.

#### Scenario: Nested exercise is displayed

- **WHEN** the catalog contains `exercises/css/box-model/challenge/README.md`
- **THEN** the exercise tab displays `CSS > Box Model > challenge > README.md`
- **AND** selecting the file loads its existing `/api/file` path
