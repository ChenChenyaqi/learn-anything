# Learn Protocol Specification

Data format definition, validation, and migration for learning records.

## ADDED Requirements

### Requirement: state.json v1 Format Definition

The system SHALL define the `state.json` v1 format as the single data source for learning records, using JSON format with a hierarchical structure of domains, concepts, and details.

Top-level fields:

- `version` (number): fixed value `1`
- `topic` (string): topic display name, e.g., `"JavaScript"`
- `slug` (string): kebab-case identifier for the topic, e.g., `"javascript"`
- `created` (string): creation timestamp, format `YYYY-MM-DD` (date only) or `YYYY-MM-DD HH:mm:ss` (with time)
- `domains` (array): array of domains

Domain structure:

- `name` (string): domain name, e.g., `"Functions"`
- `slug` (string): kebab-case identifier for the domain, e.g., `"functions"`
- `concepts` (array): array of concepts

Concept fields:

- `name` (string): concept name
- `slug` (string): kebab-case identifier
- `status` (string): `"unexplored"` | `"in_progress"` | `"needs_practice"` | `"mastered"`
- `confidence` (number): 0.0 to 1.0, confidence level
- `practice_count` (number): practice count, ≥ 0
- `explain_count` (number): explanation count, ≥ 0
- `last_explained` (string|null): last explained timestamp, format `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`, or null
- `last_practiced` (string|null): last practiced timestamp, format `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`, or null
- `details` (array of string): third-level details, plain name list with no independent state

#### Scenario: Valid v1 file passes validation

- **WHEN** state.json contains `version: 1` and a correctly structured `domains` array
- **THEN** validation returns `{ success: true, data: <parsed object> }`

#### Scenario: Missing version field

- **WHEN** state.json is missing the `version` field
- **THEN** validation returns `{ success: false, errors: [...] }`

#### Scenario: Invalid status value

- **WHEN** a concept's `status` is not `"unexplored" | "in_progress" | "needs_practice" | "mastered"`
- **THEN** validation returns an error

#### Scenario: Confidence out of range

- **WHEN** `confidence` is greater than 1.0 or less than 0.0
- **THEN** validation returns an error

### Requirement: Slug Generation Rules

The system SHALL use the `generateConceptId()` function to generate stable kebab-case slugs.

Transformation rules:

- Replace `/` with `-`
- Replace spaces with `-`
- Remove characters that are not letters, digits, `-`, or `_`
- Convert ASCII letters to lowercase; preserve non-ASCII characters
- Merge consecutive `-`
- Trim leading and trailing `-`

#### Scenario: English path to slug

- **WHEN** input is `"Functions/Scope & Closures"`
- **THEN** output is `"functions-scope---closures"`

#### Scenario: Chinese path to slug

- **WHEN** input is `"面向对象编程/原型与继承"`
- **THEN** output is `"面向对象编程-原型与继承"`

### Requirement: v0 State Detection

The system SHALL detect whether `state.yaml` is in v0 format (has `topic` and `concepts` but no `version` field).

#### Scenario: v0 format detection

- **WHEN** YAML parse result contains `topic` and a `concepts` array but lacks a `version` key
- **THEN** `isV0State()` returns `true`

#### Scenario: v1 format not misidentified

- **WHEN** YAML parse result contains `version: 1`
- **THEN** `isV0State()` returns `false`

### Requirement: v0→v1 Migration

The system SHALL provide a `migrateV0ToV1()` function that merges v0-format data (state.yaml + knowledge-map.md) into v1 `state.json`.

Migration operations:

- Read `state.yaml` (v0) to get concept statuses
- Read `knowledge-map.md` to get hierarchical structure
- Match by `id`, generate v1 `domains[].concepts[]` structure
- Write `state.json` (v1 format)
- Back up `state.yaml` → `state.yaml.v0.bak`
- Back up `knowledge-map.md` → `knowledge-map.md.v0.bak`

#### Scenario: v0→v1 migration succeeds

- **WHEN** the directory contains v0 `state.yaml` and `knowledge-map.md`
- **THEN** `state.json` (v1 format) is generated, old files are backed up

#### Scenario: Already v1 format is skipped

- **WHEN** `state.json` already exists (whether from a previous migration or manual creation)
- **THEN** `migrateV0ToV1()` returns `{ migrated: false, reason: 'already_migrated' }` with no modifications

### Requirement: knowledge-map.md Parsing

The system SHALL provide a `parseMarkdownKnowledgeMap()` function that uses the `unified` + `remark-parse` library to extract hierarchical structure from v0-format knowledge-map.md for use during migration.

Rules:

- `# Title` (h1) → extract topic name
- `## DomainName` (h2) → create new domain
- `- concept` list → concepts under the domain
- Indented `- detail` → children of the concept

#### Scenario: Standard knowledge-map.md parsing

- **WHEN** input contains `## Functions` followed by `- Closures` and `  - Module Pattern`
- **THEN** output is `{ domains: [{ name: "Functions", concepts: [{ name: "Closures", children: [{ name: "Module Pattern" }] }] }] }`

#### Scenario: Empty knowledge-map.md

- **WHEN** input only contains `# Title`
- **THEN** output is `{ topic: "Title", domains: [] }`

### Requirement: Batch Migration Coordination

The system SHALL provide a `migrateAll()` function that iterates all topic directories under `.learn/topics/`, performing version detection and required migration (v0→v1) for each topic, returning a migration report.

#### Scenario: All v1 then skip

- **WHEN** all topics' `state.json` is already in v1 format
- **THEN** returns `{ migratedCount: 0, skippedCount: N }`
