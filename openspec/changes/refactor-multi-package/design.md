## Context

The Learn Anything codebase is currently a single npm package (`learn-anything-cli`) that generates skill and command files for 30+ AI coding assistants. We plan to add a GUI desktop application (Tauri + React) that provides a visual "recursive learning canvas" — but building it inside the current monolith would create tight coupling between CLI-specific code (Commander.js, command-generation adapters) and shared domain logic (learning protocol, templates, i18n).

The repo uses TypeScript with project references, pnpm as the package manager, Vitest for testing, ESLint for linting, and Husky for git hooks. We need to preserve the existing npm publish identity (`learn-anything-cli`) and CLI behavior with zero regressions.

## Goals / Non-Goals

**Goals:**

- Establish a pnpm workspace monorepo with three packages: `core`, `cli`, `gui`
- Extract shared code into `@learn-anything/core` so both CLI and GUI can depend on it
- Move CLI-specific code into `packages/cli/`, published as `learn-anything-cli` (unchanged npm name)
- Scaffold `packages/gui/` as a placeholder with README only — no functional code
- Preserve all existing tests, lint rules, and CI coverage
- Keep `pnpm build`, `pnpm test`, `pnpm lint` working from the repo root

**Non-Goals:**

- Changing any behavioral requirement in existing specs (learn-protocol, skill-workflows, render-script)
- Implementing the GUI application — this is infrastructure scaffolding only
- Changing the npm publish name of the CLI package
- Adopting a changesets-based versioning system (deferred to when GUI ships)

## Decisions

### Decision 1: Three-package layout (core / cli / gui)

**Chosen:** `packages/core/`, `packages/cli/`, `packages/gui/`

**Alternatives considered:**

- `packages/core/ + apps/cli/ + apps/gui/` (Nx/Turborepo pattern): Overkill for 3 packages. Extra tooling without benefit.
- Keep core + cli in a single package, only extract gui: Would force gui to import from a CLI package, pulling in commander/chalk/@inquirer as transitive deps.

**Rationale:** A flat `packages/*` layout is the simplest pnpm workspace structure. The core/cli/gui split maps cleanly to the dependency graph: core → {cli, gui}.

### Decision 2: `init.ts` lives in CLI, not core

**Chosen:** Move `src/core/init.ts` → `packages/cli/src/init.ts`

**Alternatives considered:**

- Keep in core: init.ts imports `command-generation/` (adapters, registry), which is CLI-specific. Moving it to core would drag adapter code along and create a circular-ish dependency.
- Split into core `InitCommand` + CLI adapter injection: Over-engineering. The entire init flow is CLI-specific — GUI will never need interactive tool selection or command file generation.

**Rationale:** `InitCommand` orchestrates the full initialization pipeline: tool detection → interactive selection → skill generation → command generation. The last step (command generation) is purely CLI-domain. Placing init.ts in the CLI package as a consumer of `@learn-anything/core` keeps concerns clean.

### Decision 3: `CommandContent` type moves to core

**Chosen:** Move `CommandContent` interface from `command-generation/types.ts` → `packages/core/src/templates/types.ts`

**Alternatives considered:**

- Keep in CLI, have core reference it via `devDependencies` on CLI: Creates a circular dependency — CLI already depends on core.
- Duplicate the type in both: Violates DRY and makes template evolution brittle.

**Rationale:** `getCommandContents()` (in core's `skill-generation.ts`) returns `CommandContent[]`. The type is used by core, so it must live in core. CLI-specific types (`ToolCommandAdapter`, `GeneratedCommand`) stay in CLI.

### Decision 4: Scripts stay in CLI, not core

**Chosen:** `src/scripts/*.mts` → `packages/cli/src/scripts/`

**Alternatives considered:**

- Move to core: Scripts import from `learn-protocol/` but also have CLI-specific build output paths (compiled to `dist/scripts/`). Moving to core creates confusion about what "core scripts" means vs "skill scripts".

**Rationale:** These scripts are deployed by `learn-anything init` as infrastructure for the generated skills. They're part of the CLI's distribution mechanism, not the shared protocol. The CLI reads them at runtime via `readCompiledScript()` and copies them into skill directories.

### Decision 5: Shared tooling at root

**Chosen:** Root-level TypeScript project references, ESLint flat config, Vitest workspace

**Alternatives considered:**

- Per-package tooling configs: More isolation but more duplication. The codebase is small enough that shared configs reduce maintenance burden.
- Turborepo for orchestration: Added complexity without commensurate value for 3 packages.

**Rationale:** TypeScript project references (`tsc -b`) handle incremental builds and package ordering natively. Vitest workspaces run tests across packages in one command. ESLint flat config with `tseslint.config()` covers all packages.

### Decision 6: Single CHANGELOG at root

**Chosen:** Keep `CHANGELOG.md` at repository root, maintain synchronized versioning for now.

**Alternatives considered:**

- Per-package CHANGELOGs managed by Changesets: Correct for mature monorepos but premature here. We have one published package today (cli); core will be published but primarily consumed internally.

**Rationale:** Synchronized versioning keeps the release process simple. When GUI ships and diverges in release cadence, we can adopt Changesets. This is intentionally deferred.

### Decision 7: GUI placeholder — README only

**Chosen:** Scaffold `packages/gui/` with `package.json`, `tsconfig.json`, and `README.md`. No `src/` directory.

**Rationale:** The GUI's architecture (Tauri + React, Milkdown/Tiptap editor, React Flow tree visualization) deserves its own design process. Scaffolding the package now ensures the monorepo structure accounts for it from day one, but doesn't lock in premature technical decisions.

## Risks / Trade-offs

**[R1] Import path churn causes build failures**
→ Mitigation: Move files first with `git mv`, then batch-update imports with find-and-replace. Verify with `pnpm typecheck` before committing each package.

**[R2] `readCompiledScript()` resolves wrong path after move**
→ Mitigation: The function uses `path.dirname(fileURLToPath(import.meta.url))` relative to `init.js` in `dist/`. After move, init.js lives at `packages/cli/dist/init.js`, so `../scripts/` resolves to `packages/cli/dist/scripts/` — correct. Write a test that verifies this at build time.

**[R3] npm publish breaks due to changed file layout**
→ Mitigation: Publish dry-run (`pnpm pack` in `packages/cli/`) to verify the tarball contains `dist/`, `bin/`, and correct `package.json` fields before actual publish.

**[R4] Git history discontinuity for moved files**
→ Mitigation: Use `git mv` wherever possible to preserve file history. For files that split into core/cli portions (e.g., types that move to core while implementation stays in CLI), document the lineage in the commit message.

**[R5] CI cache misses due to new lockfile location**
→ Mitigation: `pnpm-lock.yaml` stays at root. `actions/setup-node` with `cache: pnpm` should continue to work.

## Open Questions

1. **Should `@learn-anything/core` use `"private": false` and be published to npm immediately?** Yes — publishing core enables potential external consumers (plugin authors, other tools in the Learn Anything ecosystem). The version starts at `0.4.1` to match CLI.

2. **Should GUI use `"private": true` initially?** Yes — until the first GUI release, setting `"private": true` prevents accidental publish.

3. **Does the `openspec/specs/` directory need restructuring?** No — specs are project-level, not package-level. They describe capability contracts independent of code location.

4. **Should scripts stay `.mts` (TypeScript source) or be committed as compiled `.mjs`?** Keep source as `.mts`, compiled to `.mjs` by tsc during build. The CLI's `readCompiledScript()` reads from `dist/scripts/` at runtime.
