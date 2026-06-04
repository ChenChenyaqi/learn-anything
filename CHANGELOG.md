# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/ChenChenyaqi/learn-anything/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ChenChenyaqi/learn-anything/releases/tag/v0.1.0
