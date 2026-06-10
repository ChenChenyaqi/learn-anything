## Why

The project currently lives as a single npm package (`learn-anything-cli`), but we plan to add a GUI desktop application (Tauri + React) that shares the same core learning protocol, templates, and i18n logic. Without a multi-package structure, the CLI and GUI would either duplicate code or create an awkward monolithic dependency. Restructuring into a pnpm workspace monorepo with shared `@learn-anything/core` package enables both the CLI and the future GUI to share the protocol, templates, and utilities while maintaining independent build pipelines and release cycles.

## What Changes

- **Introduce pnpm workspace**: Create `pnpm-workspace.yaml` and convert root `package.json` to a private workspace root
- **Extract `@learn-anything/core`** (new package): Move protocol definitions, skill templates, i18n, config, and utilities into a shared `packages/core/` package
- **Move CLI into `@learn-anything/cli`** (published as `learn-anything-cli`): Relocate CLI entry point, init command, command-generation adapters, and standalone scripts into `packages/cli/`
- **Scaffold `@learn-anything/gui`** (new placeholder package): Create `packages/gui/` with a README and empty package skeleton for the future Tauri + React desktop application
- **Consolidate build tooling**: Shared TypeScript project references, ESLint flat config covering all packages, and Vitest workspace config running tests across packages
- **Preserve npm publish identity**: The CLI package retains the npm name `learn-anything-cli` and the binary name `learn-anything` — zero user-facing breakage
- **Keep project-level docs at root**: README.md, README.zh-CN.md, CHANGELOG.md, CONTRIBUTING.md, and CLAUDE.md remain at the repository root; each package gets its own README for package-specific usage

## Capabilities

### New Capabilities

- `multi-package-workspace`: pnpm workspace monorepo with shared TypeScript, ESLint, and Vitest configuration. Packages are versioned independently. The workspace supports `pnpm -r build`, `pnpm -r test`, and `pnpm -r lint` for orchestrating all packages.
- `gui-package`: Placeholder `@learn-anything/gui` package scoped for a Tauri + React desktop application. Initially contains only a README.md describing the planned "recursive learning canvas" with three-panel layout (knowledge graph, markdown editor, dialogue tree). No functional code yet — this is infrastructure scaffolding.

### Modified Capabilities

None. All existing specs (`learn-protocol`, `skill-workflows`, `render-script`) retain their current requirements. This is a pure structural refactoring — behavior does not change.

## Impact

- **40+ files relocated** across new package boundaries
- **Build system**: `tsc` (singleton) → `tsc -b` (project references), `vitest` (single config) → `vitest.workspace`
- **CI pipeline**: One CI job per concern (lint/typecheck/test) now uses `pnpm -r <command>` to cover all packages
- **New npm package**: `@learn-anything/core` published publicly, consumed as `workspace:*` by CLI and GUI
- **No behavioral change**: CLI users install the same way (`npm install -g learn-anything-cli`), `learn-anything init` produces identical output
