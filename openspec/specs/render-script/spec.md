# Render Script Specification

Standalone zero-dependency Node.js script that renders knowledge-map.md from state.json.

## ADDED Requirements

### Requirement: render.mjs Zero-Dependency Execution

The render.mjs script SHALL only use Node.js built-in modules (`node:fs`, `node:path`) and depend on no npm packages.

#### Scenario: Script runs directly

- **WHEN** a user runs `node render.mjs <topic-dir>` in an environment with Node.js (≥18) installed
- **THEN** the script runs without requiring `npm install`

### Requirement: Command Line Interface

render.mjs SHALL accept one required argument: the path to the topic directory.

Usage: `node render.mjs <topic-dir>`

#### Scenario: Correct invocation

- **WHEN** executing `node render.mjs .learn/topics/javascript`
- **THEN** reads `.learn/topics/javascript/state.json`, writes `.learn/topics/javascript/knowledge-map.md`, prints summary to stdout

#### Scenario: Missing argument

- **WHEN** executing `node render.mjs` (no arguments)
- **THEN** prints usage instructions to stderr and exits with code 1

### Requirement: Rendering knowledge-map.md

render.mjs SHALL generate a Markdown-formatted knowledge map from state.json's hierarchical structure, including status icons and progress statistics.

Icon mapping:

- ✅ `mastered`
- 🔄 `in_progress` (labeled "in progress")
- ⚠️ `needs_practice` (labeled "needs practice")
- ⬜ `unexplored`

Header line format: `> X/Y mastered · Z% complete`

Third-level details are rendered as indented `- DetailName` without status icons.

#### Scenario: Full rendering

- **WHEN** state.json contains 2 domains and 5 concepts (2 of which are mastered)
- **THEN** knowledge-map.md header displays `> 2/5 mastered · 40% complete`, each concept has the corresponding icon and status text

#### Scenario: Empty knowledge map

- **WHEN** state.json's `domains` array is empty
- **THEN** rendering shows only the title, displaying `> 0/0 mastered`

#### Scenario: Concept missing optional fields

- **WHEN** a concept is missing `confidence` or `last_practiced` fields
- **THEN** the corresponding position displays `—` or `never` without raising an error

### Requirement: Error Handling

render.mjs SHALL provide clear error messages for various error conditions.

#### Scenario: state.json not found

- **WHEN** the specified topic directory does not contain `state.json`
- **THEN** prints `Error: state.json not found at <full-path>` to stderr and exits with code 1

#### Scenario: Invalid JSON format

- **WHEN** state.json content cannot be parsed by `JSON.parse`
- **THEN** prints `Error: Failed to parse state.json: <error-message>` to stderr and exits with code 1

#### Scenario: state.json is not v1 format

- **WHEN** state.json is missing the `version: 1` field
- **THEN** prints `Error: Unknown state.json format (missing version)` to stderr and exits with code 1

#### Scenario: Cannot write knowledge-map.md

- **WHEN** the target directory has no write permission
- **THEN** prints `Error: Cannot write knowledge-map.md: <error-message>` to stderr and exits with code 1

### Requirement: Deployment to Skill Directory

`learn-anything init` and `learn-anything update` SHALL write `render.mjs` to the `scripts/` subdirectory alongside each skill's SKILL.md during generation.

#### Scenario: init deploys render.mjs

- **WHEN** executing `learn-anything init --tools claude`
- **THEN** render.mjs is generated under `.claude/skills/learn-anything-topic/scripts/render.mjs` and all other 4 skill directories

#### Scenario: render.mjs executes from skill directory

- **WHEN** AI runs `node .claude/skills/learn-anything-explain/scripts/render.mjs ./.learn/topics/javascript` within a skill context
- **THEN** the script works correctly regardless of which skill the AI has loaded
