## ADDED Requirements

### Requirement: GUI Package Scaffold

There SHALL be a `packages/gui/` directory containing a placeholder package for the future Tauri + React desktop application. The package SHALL have `"private": true` to prevent accidental npm publication.

The package SHALL contain at minimum:

- `package.json` with `"name": "@learn-anything/gui"`, `"private": true`, and a dependency on `@learn-anything/core: "workspace:*"`
- `tsconfig.json` extending the root TypeScript configuration with `"composite": true`
- `README.md` describing the planned "Recursive Learning Canvas" GUI with three-panel layout

The package SHALL NOT contain any source code (`src/` directory) or functional tests. This is an infrastructure placeholder.

#### Scenario: Package is discoverable by workspace

- **WHEN** `pnpm install` is run at the repository root
- **THEN** `packages/gui/package.json` is resolved as a workspace member
- **AND** `@learn-anything/gui` appears in `pnpm list --filter .`

#### Scenario: Package is not publishable

- **WHEN** `pnpm publish` is attempted inside `packages/gui/`
- **THEN** npm refuses because `"private": true`

#### Scenario: Core dependency resolves

- **WHEN** the GUI package is built (in the future, when source code is added)
- **THEN** it can import from `@learn-anything/core` and access the shared protocol, templates, i18n, and utilities

### Requirement: GUI README Documents Planned Architecture

The `packages/gui/README.md` SHALL document the planned architecture for the Learn Anything desktop application, including:

- **Purpose**: A visual "recursive learning canvas" that merges reading, questioning, and note-taking into a single continuous workflow
- **Tech stack**: Tauri (Rust backend) + React (frontend), with Milkdown or Tiptap for markdown editing and React Flow or Cytoscape.js for dialogue tree visualization
- **Three-panel layout**: Knowledge graph navigator (left), markdown reader/editor (center), recursive dialogue tree panel (right)
- **Core interaction model**: Text selection → inline question → dialogue branch → recursive follow-up → bidirectional linking between notes and dialogue nodes
- **Data model**: `DialogueNode` tree stored as `.learn/sessions/<topic>/<session-id>.dialogue.json`, integrated with the existing `state.json` protocol
- **Current status**: Placeholder package — implementation to follow in a future change

#### Scenario: README provides architecture overview

- **WHEN** a developer reads `packages/gui/README.md`
- **THEN** they understand the GUI's purpose, tech stack choices, planned layout, and how it integrates with the `.learn` protocol
