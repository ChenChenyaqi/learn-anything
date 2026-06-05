# Design: Standardize Learning Record Format

## Context

The current system generates learning data distributed across different files. The `learn-anything init` command writes 5 SKILL.md files to each AI tool's skills directory. These SKILL.md files contain natural language instructions that guide the AI at runtime to create and manage learning data under the `.learn/topics/<topic>/` directory.

Current data model (v0):

- `state.yaml` — flat list of concept statuses, linked to the knowledge map via string `path` (e.g., `"Functions/Closures"`)
- `knowledge-map.md` — Markdown hierarchical structure, with AI manually synchronizing between the two files

Core problem: both files maintain structural information independently. The `path` field in `state.yaml` has an implicit coupling with the hierarchy in `knowledge-map.md`, and field names are inconsistent (`last_practiced` vs `last_session`).

## Goals / Non-Goals

**Goals:**

- state.json becomes the single source of truth, carrying both structure (domains/concepts hierarchy) and status (status/confidence/practice counts)
- knowledge-map.md becomes a purely derived view, rendered by render.mjs
- Fix `last_session` → `last_explained` field name inconsistency
- Add `explain_count` tracking
- v0→v1 automatic migration
- render.mjs has zero dependencies and runs independently in any Node.js environment

**Non-Goals:**

- Do not change status enum values (still unexplored/in_progress/needs_practice/mastered)
- Do not change the file format of sessions/ and exercises/
- Do not add persistent state for spaced repetition (SM-2 parameters) in this iteration; can be extended later
- Do not limit knowledge map hierarchy depth (AI prompts suggest 2-4 levels, but the schema does not enforce a hard limit)

## Decisions

### 1. JSON instead of YAML

**Choice**: state.json uses JSON format
**Reason**: render.mjs needs to run with zero dependencies. Node.js natively supports `JSON.parse` without installing a `yaml` package.
**Trade-off**: JSON does not support comments, but state files are machine-generated and do not rely on comments.

### 2. Hierarchical structure instead of flat paths

**Choice**: Use `domains[].concepts[].details[]` nested structure
**Alternative**: Keep flat list + path field
**Reason**:

- Structure is the path; no need to manually maintain path strings
- Eliminates synchronization issues with knowledge-map.md
- details as a plain string array has no independent state (following the "minimum trackable unit = concept" principle)

### 3. slug as stable ID

**Choice**: Each domain/concept has a `slug` field (kebab-case)
**Reason**:

- `name` is human-readable mixed Chinese/English text, not suitable as an identifier
- Translated English slugs (e.g., `scope-closures`) are more readable than pinyin (e.g., `zuo-yong-yu-yu-bi-bao`)
- slug is used for internal references in state.json and file path generation

### 4. render.mjs deployed to each skill directory

**Choice**: Each of the 5 skill directories has its own copy of `scripts/render.mjs`
**Alternative**: Shared script in `.learn/scripts/` or the AI tool's top-level directory
**Reason**:

- AI runs within a single skill context and does not load other skills
- Each skill is self-contained with no cross-directory references needed
- The script is small (~150 lines), so duplication cost is negligible

### 5. Using unified + remark-parse as markdown parser

**Choice**: Use `unified` + `remark-parse` during migration to parse v0 `knowledge-map.md`
**Reason**:

- The parser is only used during init/update migration, not at AI runtime; package size does not affect the skill runtime environment
- unified/remark-parse is already an indirect dependency (present in node_modules), only needs to be added as an explicit declaration in package.json
- Compared to a hand-written ~30-line parser, a mature library is more robust and correctly handles edge cases (blank lines, nested lists, special characters, etc.)

**Trade-off**: Adds one explicit dependency, but provides a more reliable migration process.

### 6. Migration runs at init/update time

**Choice**: Detect and run migration during `learn-anything init` and `learn-anything update`
**Reason**:

- Ensures AI always works with v1 format at runtime
- Idempotent design: already-migrated topics are not re-migrated
- Backup mechanism (.bak files) ensures safety

## Risks / Trade-offs

- **[Data Loss Risk] Migration bugs could cause state data loss** → Create .bak backup files before migration; users can manually recover
- **[Compatibility] Old AI skill files still reference state.yaml** → Users get new skill files after update, and AI behavior switches accordingly; old users are not affected
- **[JSON Parse Failure] AI-written state.json may have format errors** → render.mjs has comprehensive error handling and clear error messages
- **[Concurrency Conflicts] Multiple AI instances modifying state.json simultaneously** → Currently no file locking. Can suggest via prompt that AI follows a "read-modify-write" pattern

## Migration Plan

### Migration Chain

```
v0 state.yaml (no version field)
  → migrateV0ToV1() → state.json (v1) + state.yaml.v0.bak + knowledge-map.md.v0.bak backups
```

### Backup Convention

- `state.yaml.v0.bak`, `knowledge-map.md.v0.bak`
- Migration is idempotent: if backup files already exist, skip
- Backup files can be manually deleted after confirming migration success

### Deployment Order

1. Release new CLI version (including migration + render.mjs deployment)
2. Users run `learn-anything update` or `learn-anything init`
3. Automatically detect existing data version and execute migration
4. Newly generated skill files already contain v1 instructions

## Open Questions

- Will details[] need independent status tracking in the future? (Current: no, keep it simple)
- Should SM-2 parameters for spaced repetition (ease_factor, interval, next_review_date) be added to the schema? (Current: out of scope for this iteration, can be considered a Phase 2 extension)
