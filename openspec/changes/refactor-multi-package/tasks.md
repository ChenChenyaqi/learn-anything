## 1. Workspace Infrastructure Setup

- [ ] 1.1 Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`
- [ ] 1.2 Convert root `package.json` to workspace root: add `"private": true`, replace scripts with `pnpm -r` delegation (`build`, `test`, `lint`, `typecheck`), move all `devDependencies` to root
- [ ] 1.3 Create root `vitest.workspace.ts` replacing `vitest.config.ts` with workspace-aware config
- [ ] 1.4 Update root `tsconfig.json` to use project references (`"references"`, `"files": []`) instead of `rootDir`/`outDir`/`include`
- [ ] 1.5 Update `eslint.config.mjs` igores to cover `packages/*/dist/` and `packages/*/node_modules/`
- [ ] 1.6 Update `.gitignore` to exclude per-package `dist/` and `*.tsbuildinfo`
- [ ] 1.7 Run `pnpm install` to verify workspace resolution and lockfile generation

## 2. Extract @learn-anything/core

- [ ] 2.1 Scaffold `packages/core/` directory with `package.json` (`"name": "@learn-anything/core"`, version `0.4.1`, `"type": "module"`) and `tsconfig.json` (`"composite": true`)
- [ ] 2.2 Move `src/config.ts` → `packages/core/src/config.ts`
- [ ] 2.3 Move `src/utils/` → `packages/core/src/utils/`
- [ ] 2.4 Move `src/i18n/` → `packages/core/src/i18n/`
- [ ] 2.5 Move `src/core/learn-protocol/` → `packages/core/src/learn-protocol/`
- [ ] 2.6 Move `src/core/templates/` → `packages/core/src/templates/`
- [ ] 2.7 Move `src/core/shared/` → `packages/core/src/shared/`
- [ ] 2.8 Move `CommandContent` type from `command-generation/types.ts` into `packages/core/src/templates/types.ts`
- [ ] 2.9 Create `packages/core/src/index.ts` with public API barrel exports matching the spec
- [ ] 2.10 Update all internal imports within core to use relative paths (no `@learn-anything/core` self-references)
- [ ] 2.11 Move `test/core/learn-protocol/` → `packages/core/test/learn-protocol/` (fixtures and spec files)
- [ ] 2.12 Move `test/skill-templates.test.ts` → `packages/core/test/skill-templates.test.ts`
- [ ] 2.13 Add core-specific `dependencies` to `packages/core/package.json` (yaml, zod, fast-glob, unified, remark-parse)
- [ ] 2.14 Run `tsc -b packages/core` to verify core builds cleanly
- [ ] 2.15 Run `pnpm --filter @learn-anything/core test` to verify core tests pass

## 3. Extract @learn-anything/cli

- [ ] 3.1 Scaffold `packages/cli/` directory with `package.json` (`"name": "learn-anything-cli"`, version `0.4.1`, `"bin"`, `"dependencies"` with `@learn-anything/core: "workspace:*"`)
- [ ] 3.2 Create `packages/cli/tsconfig.json` with `"composite": true` and a reference to `../core`
- [ ] 3.3 Move `src/cli/index.ts` → `packages/cli/src/cli/index.ts`
- [ ] 3.4 Move `src/core/init.ts` → `packages/cli/src/init.ts`, update all imports to use `@learn-anything/core`
- [ ] 3.5 Move `src/core/command-generation/` → `packages/cli/src/command-generation/`
- [ ] 3.6 Move `src/scripts/*.mts` → `packages/cli/src/scripts/`
- [ ] 3.7 Move `bin/learn-anything.js` → `packages/cli/bin/learn-anything.js`, update dist path reference
- [ ] 3.8 Update `readCompiledScript()` in `init.ts` to resolve scripts from the new dist location
- [ ] 3.9 Update all internal imports in CLI to use `@learn-anything/core` for core imports and relative paths for CLI-internal imports
- [ ] 3.10 Move `test/scripts/` → `packages/cli/test/scripts/` (fixtures and spec files)
- [ ] 3.11 Verify `packages/cli/package.json` `files` field includes `dist/` and `bin/` for correct npm publish tarball
- [ ] 3.12 Run `tsc -b` from root to verify full project builds (core first, then cli)
- [ ] 3.13 Run `node packages/cli/bin/learn-anything.js` to verify CLI binary works
- [ ] 3.14 Run `pnpm test` from root to verify all tests pass across both packages

## 4. Scaffold GUI Placeholder

- [ ] 4.1 Create `packages/gui/` directory
- [ ] 4.2 Create `packages/gui/package.json` with `"name": "@learn-anything/gui"`, `"private": true`, `"dependencies": { "@learn-anything/core": "workspace:*" }`
- [ ] 4.3 Create `packages/gui/tsconfig.json` with `"composite": true` and a reference to `../core`
- [ ] 4.4 Write `packages/gui/README.md` documenting the planned architecture (Tauri + React, three-panel layout, DialogueNode data model, .learn protocol integration)
- [ ] 4.5 Run `pnpm install` to verify GUI is registered as workspace member

## 5. Cleanup & Documentation

- [ ] 5.1 Remove empty `src/` directories at root level that are now fully migrated
- [ ] 5.2 Update `CLAUDE.md` `## Architecture` section to reflect multi-package structure
- [ ] 5.3 Update `CONTRIBUTING.md` development setup steps to reference `pnpm install` and workspace commands
- [ ] 5.4 Update `.github/workflows/ci.yml` to use `pnpm -r` commands and build before typecheck
- [ ] 5.5 Update `build.js` to use `tsc -b` instead of singleton `tsc`
- [ ] 5.6 Run final end-to-end verification: `pnpm install && pnpm build && pnpm lint && pnpm test && pnpm dev:cli`
- [ ] 5.7 Commit all changes with `git mv` for moved files where possible, with descriptive commit messages documenting the migration
