/**
 * v0 -> v1 migration logic.
 *
 * Detects v0 state.yaml format and merges it with knowledge-map.md
 * to produce a state.json v1 file. Migration is idempotent and
 * creates .bak backups before writing.
 *
 * Migration chain:
 *   state.yaml (v0) + knowledge-map.md (v0)
 *     -> migrateV0ToV1()
 *       -> state.json (v1) + state.yaml.v0.bak + knowledge-map.md.v0.bak
 */

import { promises as fs } from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';

import type { V0State, V0Concept, ParsedKnowledgeMap, StateV1, Domain, Concept } from './types.js';
import { parseKnowledgeMap } from './parser.js';
import { generateSlug } from './slug.js';
import { stateV1Schema } from './schema.js';
import { render } from '../../scripts/render.mjs';
import { FileSystemUtils } from '../../utils/file-system.js';

// ---- Public API ---------------------------------------------------------

/**
 * Check if a parsed YAML object matches the v0 state format.
 *
 * v0 is identified by having `topic` and `concepts` fields but
 * NO `version` field. Returns `true` when the data matches v0.
 */
export function isV0State(data: unknown): data is V0State {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // v0: has topic (string) and concepts (array), no version field
  if (typeof obj.topic !== 'string' || !obj.topic) return false;
  if (!Array.isArray(obj.concepts)) return false;
  if (obj.version !== undefined) return false;

  return true;
}

export interface MigrationResult {
  migrated: boolean;
  topic: string;
  reason?: 'already_migrated' | 'already_v1' | 'not_v0' | 'no_state_yaml' | 'error';
  error?: string;
}

export interface MigrationReport {
  migratedCount: number;
  skippedCount: number;
  results: MigrationResult[];
}

/**
 * Migrate a single topic directory from v0 to v1.
 *
 * Reads `state.yaml` and `knowledge-map.md`, merges them into `state.json`,
 * and creates `.bak` backup files. Idempotent — skips if already migrated.
 *
 * @param topicDir — Absolute path to the topic directory (e.g. `.learn/topics/javascript`)
 * @returns A MigrationResult describing what happened
 */
export async function migrateV0ToV1(topicDir: string): Promise<MigrationResult> {
  const stateYamlPath = path.join(topicDir, 'state.yaml');
  const knowledgeMapPath = path.join(topicDir, 'knowledge-map.md');
  const stateJsonPath = path.join(topicDir, 'state.json');
  const stateYamlBackup = path.join(topicDir, 'state.yaml.v0.bak');
  const knowledgeMapBackup = path.join(topicDir, 'knowledge-map.md.v0.bak');

  // 1. Skip if state.json already exists (already migrated)
  if (await FileSystemUtils.fileExists(stateJsonPath)) {
    try {
      const existing = JSON.parse(await fs.readFile(stateJsonPath, 'utf-8'));
      return {
        migrated: false,
        topic: existing.topic || path.basename(topicDir),
        reason: 'already_migrated',
      };
    } catch {
      return {
        migrated: false,
        topic: path.basename(topicDir),
        reason: 'already_migrated',
      };
    }
  }

  // 2. Check state.yaml exists
  if (!(await FileSystemUtils.fileExists(stateYamlPath))) {
    return {
      migrated: false,
      topic: path.basename(topicDir),
      reason: 'no_state_yaml',
    };
  }

  // 3. Read and parse state.yaml
  let v0Data: unknown;
  try {
    const yamlContent = await fs.readFile(stateYamlPath, 'utf-8');
    v0Data = parseYaml(yamlContent);
  } catch (err) {
    return {
      migrated: false,
      topic: path.basename(topicDir),
      reason: 'error',
      error: `Failed to parse state.yaml: ${(err as Error).message}`,
    };
  }

  // 4. Check v0 format (has topic + concepts, no version field)
  if (!isV0State(v0Data)) {
    return {
      migrated: false,
      topic: path.basename(topicDir),
      reason: 'not_v0',
    };
  }

  const v0State: V0State = v0Data;

  // 7. Read and parse knowledge-map.md
  let parsedMap: ParsedKnowledgeMap;
  if (await FileSystemUtils.fileExists(knowledgeMapPath)) {
    try {
      const kmContent = await fs.readFile(knowledgeMapPath, 'utf-8');
      parsedMap = parseKnowledgeMap(kmContent);
    } catch (err) {
      return {
        migrated: false,
        topic: v0State.topic,
        reason: 'error',
        error: `Failed to parse knowledge-map.md: ${(err as Error).message}`,
      };
    }
  } else {
    // Without knowledge-map.md we can't build the hierarchy; skip
    return {
      migrated: false,
      topic: v0State.topic,
      reason: 'error',
      error: 'knowledge-map.md not found',
    };
  }

  // 8. Merge: build a lookup from v0 path -> V0Concept
  const conceptLookup = new Map<string, V0Concept>();
  for (const c of v0State.concepts) {
    conceptLookup.set(c.path, c);
  }

  // 9. Build StateV1 from parsed hierarchy + v0 state data
  const domains: Domain[] = parsedMap.domains.map((pd) => ({
    name: pd.name,
    slug: generateSlug(pd.name),
    concepts: pd.concepts.map((pc) => {
      const v0Path = `${pd.name}/${pc.name}`;
      const v0Concept = conceptLookup.get(v0Path);

      return {
        name: pc.name,
        slug: generateSlug(pc.name),
        status: mapStatus(v0Concept?.status),
        confidence: v0Concept?.confidence ?? 0,
        practice_count: v0Concept?.practice_count ?? 0,
        explain_count: v0Concept?.explain_count ?? 0,
        last_explained: v0Concept?.last_session ?? null,
        last_practiced: v0Concept?.last_practiced ?? null,
        details: pc.children,
      } satisfies Concept;
    }),
  }));

  const stateV1: StateV1 = {
    version: 1,
    topic: v0State.topic,
    slug: generateSlug(v0State.topic),
    created: v0State.created,
    domains,
  };

  // 10. Validate the generated state against the schema
  const validation = stateV1Schema.safeParse(stateV1);
  if (!validation.success) {
    return {
      migrated: false,
      topic: v0State.topic,
      reason: 'error',
      error: `Generated state.json failed validation: ${validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    };
  }

  // 11. Write state.json
  try {
    await FileSystemUtils.writeFile(stateJsonPath, JSON.stringify(stateV1, null, 2) + '\n');
  } catch (err) {
    return {
      migrated: false,
      topic: v0State.topic,
      reason: 'error',
      error: `Failed to write state.json: ${(err as Error).message}`,
    };
  }

  // 12. Create backup files, then remove originals
  //     After migration, state.json is the single source of truth,
  //     so the v0 files should not remain alongside it.
  try {
    await fs.copyFile(stateYamlPath, stateYamlBackup);
    await fs.copyFile(knowledgeMapPath, knowledgeMapBackup);
    await fs.rm(stateYamlPath, { force: true });
    await fs.rm(knowledgeMapPath, { force: true });
  } catch (err) {
    // Backup/cleanup failure is non-fatal — state.json was already written
    console.error(
      `Warning: Failed to create backup files or clean up originals in ${topicDir}: ${(err as Error).message}`,
    );
  }

  // 13. Regenerate knowledge-map.md from state.json (v1 format)
  try {
    const rendered = render(stateV1);
    await FileSystemUtils.writeFile(knowledgeMapPath, rendered);
  } catch (err) {
    // Render failure is non-fatal — migration itself succeeded
    console.error(
      `Warning: Failed to regenerate knowledge-map.md in ${topicDir}: ${(err as Error).message}`,
    );
  }

  return {
    migrated: true,
    topic: v0State.topic,
  };
}

/**
 * Migrate ALL topics under a base directory from v0 to v1.
 *
 * Scans `.learn/topics/` for topic subdirectories and runs
 * migrateV0ToV1 on each one. Returns a summary report.
 *
 * @param baseDir — Path to the topics directory (e.g. `.learn/topics`)
 * @returns MigrationReport with counts and per-topic results
 */
export async function migrateAll(baseDir: string): Promise<MigrationReport> {
  const results: MigrationResult[] = [];

  let entryNames: string[];
  try {
    entryNames = await fs.readdir(baseDir);
  } catch {
    // Directory doesn't exist — nothing to migrate
    return { migratedCount: 0, skippedCount: 0, results: [] };
  }

  // Check each entry to see if it's a directory
  const topicDirs: string[] = [];
  for (const name of entryNames) {
    const fullPath = path.join(baseDir, name);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) topicDirs.push(fullPath);
    } catch {
      // Skip entries we can't stat
    }
  }

  for (const dir of topicDirs) {
    const result = await migrateV0ToV1(dir);
    results.push(result);
  }

  const migratedCount = results.filter((r) => r.migrated).length;
  const skippedCount = results.filter((r) => !r.migrated).length;

  return { migratedCount, skippedCount, results };
}

// ---- Helpers -----------------------------------------------------------

/** Map v0 status string to v1 ConceptStatus; default to 'unexplored'. */
function mapStatus(status: unknown): Concept['status'] {
  if (status === 'in_progress' || status === 'needs_practice' || status === 'mastered') {
    return status;
  }
  return 'unexplored';
}
