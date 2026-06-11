## ADDED Requirements

### Requirement: pnpm Workspace Configuration

The repository SHALL use a pnpm workspace to manage multiple packages under a single repository root. The workspace SHALL define `packages/*` as the package glob via `pnpm-workspace.yaml`.

Root `package.json` SHALL be `"private": true` and SHALL NOT include runtime dependencies. Root-level scripts (`build`, `test`, `lint`, `typecheck`) SHALL delegate to all packages using `pnpm -r <command>`.

#### Scenario: Workspace discovery

- **WHEN** `pnpm install` is run at the repository root
- **THEN** all packages under `packages/*` are linked into `node_modules` via workspace symlinks
- **AND** `@learn-anything/core` is importable as `@learn-anything/core` from sibling packages

#### Scenario: Build all packages

- **WHEN** `pnpm build` is run at the repository root
- **THEN** all packages are built in dependency order (core before cli before gui)
- **AND** each package's `dist/` directory is populated

### Requirement: @learn-anything/core Package

There SHALL be a `packages/core/` directory containing the shared domain logic as an npm package named `@learn-anything/core`. The package SHALL export the following modules from its public API (`src/index.ts`):

- `config.ts` — `AI_TOOLS`, `AIToolOption`, `LEARN_DIR`
- `learn-protocol/` — schema validation (`schema.ts`), state parser (`parser.ts`), v0→v1 migration (`migrate.ts`), slug generation (`slug.ts`), type definitions (`types.ts`)
- `templates/` — skill templates (5 workflows), command templates, template types (including `CommandContent`)
- `shared/skill-generation.ts` — `getSkillTemplates()`, `getCommandTemplates()`, `getCommandContents()`, `generateSkillContent()`
- `i18n/` — locale messages, locale detection, type definitions
- `utils/` — `FileSystemUtils`, `isInteractive()`

The core package SHALL NOT depend on CLI-specific packages (`commander`, `chalk`, `@inquirer/prompts`).

#### Scenario: Core is importable by CLI

- **WHEN** `packages/cli/src/init.ts` imports from `@learn-anything/core`
- **THEN** TypeScript resolves the import to `packages/core/src/index.ts` during development
- **AND** Node.js resolves to `packages/core/dist/index.js` after build via `exports` field

#### Scenario: Core has zero CLI dependencies

- **WHEN** `packages/core/package.json` is inspected
- **THEN** none of `commander`, `chalk`, or `@inquirer/prompts` appear in `dependencies` or `devDependencies`

### Requirement: @learn-anything/cli Package (published as learn-anything-cli)

There SHALL be a `packages/cli/` directory containing the CLI application. Its `package.json` SHALL use:

- `"name": "learn-anything-cli"` (unchanged from current npm identity)
- `"bin": { "learn-anything": "./bin/learn-anything.js" }` (unchanged command name)
- `"dependencies": { "@learn-anything/core": "workspace:*" }` (for local development)

The CLI package SHALL contain:

- `src/cli/index.ts` — Commander.js CLI definition
- `src/init.ts` — `InitCommand` class (moved from `src/core/init.ts`)
- `src/command-generation/` — tool adapters, registry, generator
- `src/scripts/` — standalone `.mts` scripts (`utils.mts`, `render.mts`, `init-sessions.mts`, `status.mts`)
- `bin/learn-anything.js` — entry point shim

#### Scenario: CLI binary resolves after move

- **WHEN** `node packages/cli/bin/learn-anything.js` is executed
- **THEN** it loads `packages/cli/dist/cli/index.js` and displays the help text

#### Scenario: npm publish preserves identity

- **WHEN** `pnpm pack` is run in `packages/cli/`
- **THEN** the tarball's `package.json` has `"name": "learn-anything-cli"` and `"bin": { "learn-anything": "./bin/learn-anything.js" }`

### Requirement: Shared TypeScript Configuration via Project References

The repository SHALL use TypeScript project references (`tsc -b`) for incremental, dependency-ordered builds. Root `tsconfig.json` SHALL define `"references"` to `packages/core` and `packages/cli` (and `packages/gui` when active). Each package's `tsconfig.json` SHALL specify `"composite": true` and its own `rootDir`/`outDir`.

#### Scenario: Incremental build

- **WHEN** only `packages/cli/src/` has changes
- **THEN** `tsc -b` rebuilds only the CLI package, reusing core's cached build output
- **AND** the CLI's `.d.ts` files resolve to core's prebuilt declarations

### Requirement: Shared Vitest Workspace

The repository SHALL use a Vitest workspace configuration (`vitest.workspace.ts` at root) that discovers test files across all non-private packages. Running `pnpm test` at root SHALL execute tests in all packages.

#### Scenario: Tests run across packages

- **WHEN** `pnpm test` is run at the repository root
- **THEN** tests from `packages/core/test/` and `packages/cli/test/` are both executed
- **AND** total pass/fail/skip counts are aggregated

### Requirement: Shared ESLint Configuration

The repository SHALL use a single ESLint flat config (`eslint.config.mjs` at root) that covers all packages. The config SHALL extend the current rules (TypeScript ESLint recommended, Prettier compatibility). Running `pnpm lint` at root SHALL check all TypeScript source files across all packages.

#### Scenario: Lint covers all packages

- **WHEN** `pnpm lint` is run at the repository root
- **THEN** files under `packages/core/src/`, `packages/cli/src/`, and `packages/gui/src/` (when present) are all checked
- **AND** `dist/` and `node_modules/` are ignored

### Requirement: CI Pipeline for Multi-Package

The CI workflow (`.github/workflows/ci.yml`) SHALL build, lint, typecheck, and test all packages. The `pnpm -r build` step SHALL execute before `pnpm exec tsc --noEmit` to ensure project references are satisfied.

#### Scenario: CI passes on PR

- **WHEN** a pull request is opened against `main` or `develop`
- **THEN** the CI pipeline runs lint, typecheck, test, and build jobs
- **AND** all jobs must pass before merge
