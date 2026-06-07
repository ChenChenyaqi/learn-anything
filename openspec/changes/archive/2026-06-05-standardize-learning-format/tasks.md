## 1. learn-protocol: Core Types & Validation

- [x] 1.1 Create `src/core/learn-protocol/` directory structure (types.ts, schema.ts, migrate.ts, parser.ts, slug.ts, index.ts)
- [x] 1.2 Define state.json v1 TypeScript types in types.ts (StateV1, Domain, Concept, Status, etc.)
- [x] 1.3 Implement Zod schema and `validateStateV1()` validation function in schema.ts
- [x] 1.4 Implement `generateSlug(name: string): string` — kebab-case slug generation rules
- [x] 1.5 Add unified + remark-parse to package.json dependencies

## 2. learn-protocol: v0→v1 Migration

- [x] 2.1 Implement `parseKnowledgeMap(markdown: string)` in parser.ts — use unified + remark-parse to extract hierarchical structure
- [x] 2.2 Implement `isV0State(yaml: unknown)` in migrate.ts — detect v0 format (has topic + concepts but no version)
- [x] 2.3 Implement `migrateV0ToV1(topicDir: string)` in migrate.ts — merge state.yaml + knowledge-map.md → state.json, create .bak backups
- [x] 2.4 Implement `migrateAll(baseDir: string)` in migrate.ts — iterate all topics under .learn/topics/ for batch migration, return migration report
- [x] 2.5 Export all public APIs from index.ts

## 3. render.mjs: Render Script

- [x] 3.1 Create `src/render-script/render.mts` — standalone zero-dependency TypeScript source (only uses node:fs + node:path), compiled via tsc to `dist/render-script/render.mjs`
- [x] 3.2 Implement CLI interface in render.mts: parse command line arguments, print usage and exit(1) when arguments are missing
- [x] 3.3 Implement `render(state: StateV1): string` in render.mts — status icon mapping (✅🔄⚠️⬜), header progress stats, domains/concepts/details hierarchy rendering
- [x] 3.4 Implement error handling in render.mts: state.json not found / JSON parse failure / non-v1 format / insufficient write permissions, print clear error messages to stderr
- [x] 3.5 Ensure `pnpm build` compiles `src/render-script/render.mts` to `dist/render-script/render.mjs`

## 4. Skill Deployment Pipeline

- [x] 4.1 Integrate render.mjs deployment logic in `skill-generation.ts`: when generating SKILL.md, also copy from `dist/render-script/render.mjs` to each skill's `scripts/render.mjs`
- [x] 4.2 Integrate migration call in `init.ts` InitCommand: detect and execute migrateAll before init
- [x] 4.3 Integrate migration call in `update` command (if it exists)

## 5. Skill Workflow Template Updates

- [x] 5.1 Update learn-topic template: when creating a new topic, write state.json (full domains/concepts structure) instead of knowledge-map.md + state.yaml, run render.mjs after creation
- [x] 5.2 Update learn-topic template: when loading an existing topic, only read state.json, no longer read knowledge-map.md
- [x] 5.3 Update learn-explain template: only read state.json, update fields to last_explained / explain_count, run render.mjs after modification
- [x] 5.4 Update learn-practice template: only read state.json, update last_practiced / practice_count / confidence, run render.mjs after modification
- [x] 5.5 Update learn-review template: only read state.json to calculate mastery and review priority, do not run render.mjs (read-only operation)
- [x] 5.6 Update learn-status template: only read state.json to display heatmap, do not run render.mjs (read-only operation)
- [x] 5.7 Update learn-practice template: write exercise files to exercises/ directory when creating practice files (do not render knowledge-map.md)

## 6. Tests

- [x] 6.1 Write tests for learn-protocol: Zod schema validation (valid/invalid data), slug generation rules, v0 format detection
- [x] 6.2 Write tests for migration: parseKnowledgeMap parsing standard/empty/edge-case knowledge-map.md, migrateV0ToV1 end-to-end migration, idempotency, backup file generation
- [x] 6.3 Write tests for render.mjs: full rendering, empty knowledge map, missing optional fields, error scenarios
- [x] 6.4 Update existing skill template tests: verify topic/explain/practice workflows call render.mjs, review/status do not call render.mjs, all workflows no longer reference state.yaml / knowledge-map.md
