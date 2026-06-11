## 1. Workspace Infrastructure Setup

- [x] 1.1 Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`
- [x] 1.2 Convert root `package.json` to workspace root: add `"private": true`, replace scripts with `pnpm -r` delegation (`build`, `test`, `lint`, `typecheck`), move all `devDependencies` to root
- [x] 1.3 Create root `vitest.workspace.ts` replacing `vitest.config.ts` with workspace-aware config
- [x] 1.4 Update root `tsconfig.json` to use project references (`"references"`, `"files": []`) instead of `rootDir`/`outDir`/`include`
- [x] 1.5 Update `eslint.config.mjs` igores to cover `packages/*/dist/` and `packages/*/node_modules/`
- [x] 1.6 Update `.gitignore` to exclude per-package `dist/` and `*.tsbuildinfo`
- [x] 1.7 Run `pnpm install` to verify workspace resolution and lockfile generation

## 2. Extract @learn-anything/core

- [x] 2.1 Scaffold `packages/core/` directory with `package.json` (`"name": "@learn-anything/core"`, version `0.4.1`, `"type": "module"`) and `tsconfig.json` (`"composite": true`)
- [x] 2.2 Move `src/core/config.ts` → `packages/core/src/config.ts`
- [x] 2.3 Move `src/utils/` → `packages/core/src/utils/`
- [x] 2.4 Move `src/i18n/` → `packages/core/src/i18n/`
- [x] 2.5 Move `src/core/learn-protocol/` → `packages/core/src/learn-protocol/`
- [x] 2.6 Move `src/core/templates/` → `packages/core/src/templates/`
- [x] 2.7 Move `src/core/shared/` → `packages/core/src/shared/`
- [x] 2.8 Move `CommandContent` type from `command-generation/types.ts` into `packages/core/src/templates/types.ts`
- [x] 2.9 Create `packages/core/src/index.ts` with public API barrel exports matching the spec
- [x] 2.10 Update all internal imports within core to use relative paths (no `@learn-anything/core` self-references)
- [x] 2.11 Move `test/core/learn-protocol/` → `packages/core/test/learn-protocol/` (fixtures and spec files)
- [x] 2.12 Move `test/skill-templates.test.ts` → `packages/cli/test/` (depends on CLI command-generation)
- [x] 2.13 Add core-specific `dependencies` to `packages/core/package.json` (yaml, zod, unified, remark-parse)
- [x] 2.14 Run `tsc -b packages/core` to verify core builds cleanly
- [x] 2.15 Run `pnpm --filter @learn-anything/core test` to verify core tests pass (95/95)

## 3. Extract @learn-anything/cli

- [x] 3.1 Scaffold `packages/cli/` directory with `package.json` (`"name": "learn-anything-cli"`, version `0.4.1`, `"bin"`, `"dependencies"` with `@learn-anything/core: "workspace:*"`)
- [x] 3.2 Create `packages/cli/tsconfig.json` with `"composite": true` and a reference to `../core`
- [x] 3.3 Move `src/cli/index.ts` → `packages/cli/src/cli/index.ts`
- [x] 3.4 Move `src/core/init.ts` → `packages/cli/src/init.ts`, update all imports to use `@learn-anything/core`
- [x] 3.5 Move `src/core/command-generation/` → `packages/cli/src/command-generation/`
- [x] 3.6 Move `src/scripts/*.mts` → `packages/cli/src/scripts/`
- [x] 3.7 Move `bin/learn-anything.js` → `packages/cli/bin/learn-anything.js`, update dist path reference
- [x] 3.8 Update `readCompiledScript()` in `init.ts` to resolve scripts from the new dist location (auto-correct — relative path resolves to dist/scripts/ correctly)
- [x] 3.9 Update all internal imports in CLI to use `@learn-anything/core` for core imports and relative paths for CLI-internal imports
- [x] 3.10 Move `test/scripts/` → `packages/cli/test/scripts/` (fixtures and spec files)
- [x] 3.11 Verify `packages/cli/package.json` `files` field includes `dist/` and `bin/` for correct npm publish tarball (verified via pnpm pack)
- [x] 3.12 Run `tsc -b` from root to verify full project builds (both core and cli build cleanly)
- [x] 3.13 Run `node packages/cli/bin/learn-anything.js` to verify CLI binary works
- [x] 3.14 Run `pnpm test` from root to verify all tests pass across both packages (196/196)

## 4. Scaffold GUI Placeholder

- [x] 4.1 Create `packages/gui/` directory
- [x] 4.2 Create `packages/gui/package.json` with `"name": "@learn-anything/gui"`, `"private": true`, `"dependencies": { "@learn-anything/core": "workspace:*" }`
- [x] 4.3 Create `packages/gui/tsconfig.json` with `"composite": true` and a reference to `../core`
- [x] 4.4 Write `packages/gui/README.md` documenting the planned architecture (Tauri + React, three-panel layout, DialogueNode data model, .learn protocol integration)
- [x] 4.5 Run `pnpm install` to verify GUI is registered as workspace member

## 5. Cleanup & Documentation

- [x] 5.1 Remove empty `src/` directories at root level that are now fully migrated
- [x] 5.2 Update `CLAUDE.md` `## Architecture` section to reflect multi-package structure
- [x] 5.3 Update `CONTRIBUTING.md` development setup steps to reference `pnpm install` and workspace commands
- [x] 5.4 Update `.github/workflows/ci.yml` to use `pnpm typecheck` instead of `pnpm exec tsc --noEmit`
- [x] 5.5 Delete unused `build.js`
- [x] 5.6 End-to-end verification: install ✓ build ✓ lint ✓ test (196/196) ✓ CLI binary ✓
- [x] 5.7 Final commit — Phase 5 cleanup and documentation update
