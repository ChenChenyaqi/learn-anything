# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.2...HEAD
[0.4.2]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ChenChenyaqi/learn-anything/releases/tag/v0.1.0
