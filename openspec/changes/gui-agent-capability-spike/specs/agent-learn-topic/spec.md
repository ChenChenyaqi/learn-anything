## ADDED Requirements

### Requirement: Generate a validated StateV1 knowledge map

The `learn-topic` workflow SHALL use structured extraction (via the `ModelClient` trait) to produce a `StateV1` value for a user-supplied topic, where every concept has a valid status (`unexplored` | `in_progress` | `needs_practice` | `mastered`), `confidence` in `[0,1]`, non-negative integer counts, and a `details` string array — matching the v1 schema defined in the CLI's `utils.mts`.

#### Scenario: Extraction yields a schema-valid map

- **WHEN** the workflow runs for a topic against a `ModelClient`
- **THEN** it returns a `StateV1` that passes all v1 validators

#### Scenario: Invalid extracted output is rejected

- **WHEN** the extracted output violates the v1 schema (e.g. `confidence` out of range)
- **THEN** the workflow rejects it and does not write a `state.json`

### Requirement: Write state.json in v1 format

The workflow SHALL persist the generated `StateV1` to `.learn/topics/<slug>/state.json` as JSON with `"version": 1`, under the active working folder.

#### Scenario: state.json is written

- **WHEN** the workflow completes extraction successfully for topic "JavaScript" in the active working folder
- **THEN** the file `.learn/topics/javascript/state.json` exists and contains `"version": 1`

### Requirement: Render knowledge-map.md from state

The workflow SHALL generate `knowledge-map.md` by rendering the `StateV1` (in Rust, mirroring the CLI `render.mts` output shape: topic title, mastered/total header, per-domain sections, per-concept bullets with status icons and detail lines) and write it to `.learn/topics/<slug>/knowledge-map.md`.

#### Scenario: knowledge-map.md is generated

- **WHEN** the workflow writes a `StateV1`
- **THEN** `.learn/topics/<slug>/knowledge-map.md` exists, starts with the topic title, and contains one bullet per concept with a status icon

#### Scenario: Render is pure and deterministic

- **WHEN** the same `StateV1` is rendered twice
- **THEN** both outputs are byte-identical

### Requirement: No v0 migration support

The system MUST NOT perform any v0→v1 migration. When opening a project, the system SHALL only accept `state.json` with `"version": 1`; a folder whose existing `state.json` has any other version SHALL be rejected with a message instructing the user to upgrade via the CLI.

#### Scenario: v1 folder is accepted

- **WHEN** the user opens a working folder whose `state.json` has `"version": 1`
- **THEN** the folder is accepted

#### Scenario: pre-v1 folder is rejected with guidance

- **WHEN** the user opens a working folder whose `state.json` has a version other than 1
- **THEN** the system rejects it and presents a message telling the user to run `learn-anything init` in the CLI to upgrade

### Requirement: Expose a streaming Tauri command

The workflow SHALL be invokable from the frontend via a Tauri command that streams progress as incremental events and completes with a final event carrying the rendered knowledge map (markdown).

#### Scenario: Progress is streamed during generation

- **WHEN** the frontend invokes the learn-topic command for a topic
- **THEN** incremental progress events are emitted to the frontend during generation

#### Scenario: Completion delivers the rendered map

- **WHEN** generation finishes successfully
- **THEN** a completion event is emitted whose payload contains the rendered `knowledge-map.md` markdown

#### Scenario: Failure delivers an error

- **WHEN** generation fails (e.g. extraction invalid after retries)
- **THEN** an error event is emitted describing the failure, and no `state.json`/`knowledge-map.md` is written
