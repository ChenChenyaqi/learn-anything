# Proposal: Standardize Learning Record Format

## Why

Learning records are currently scattered across two files — `knowledge-map.md` (course structure) and `state.yaml` (learning progress). This separation creates data synchronization risks, inconsistent field name bugs (`last_practiced` vs `last_session`), and overhead for every workflow to read both files. We need to establish `state.json` as the single source of truth, with `knowledge-map.md` becoming a derived view.

## What Changes

- **BREAKING**: Learning record format migrates from `state.yaml` (v0) to `state.json` (v1), switching from YAML to JSON
- **BREAKING**: `knowledge-map.md` changes from being directly written by AI to being rendered by a `render.mjs` script from `state.json`; AI no longer reads or writes it directly
- New `state.json` v1 schema: hierarchical `domains → concepts → details` structure, using `slug` as a stable ID, adding `last_explained` and `explain_count` fields, fixing the `last_session` → `last_explained` inconsistency
- New standalone `render.mjs` script that generates `knowledge-map.md` with status icons and progress, deployed to each skill's `scripts/` directory
- Update all 5 skill workflow templates: AI only reads/writes `state.json`, running `render.mjs` to regenerate `knowledge-map.md` after modifications
- New v0→v1 migration that runs automatically during `learn-anything init/update`

## Capabilities

### New Capabilities

- `learn-protocol`: state.json v1 data format definition, Zod validation, v0→v1 migration logic, knowledge-map.md parser
- `render-script`: standalone zero-dependency Node.js script that renders knowledge-map.md from state.json, deployed to skill directories

### Modified Capabilities

- `skill-workflows`: 5 learning workflows (topic/explain/practice/review/status) need to be updated to only read/write state.json + call render.mjs

## Impact

- **Source code**: `src/core/templates/workflows/learn-*.ts` (5 workflows), `src/core/init.ts` (initialization logic), `src/core/shared/skill-generation.ts` (skill generation pipeline)
- **New code**: `src/core/learn-protocol/` (types, schema, knowledge-map parser, migrate), `src/core/templates/render-script.ts` (render.mjs template)
- **Tests**: `test/skill-templates.test.ts` and new test files
- **Dependencies**: new explicit `unified`/`remark-parse` dependency for parsing knowledge-map.md during migration
- **User projects**: changes to the `.learn/topics/<topic>/` directory structure generated at runtime (state.yaml → state.json, knowledge-map.md becomes a derived file)
