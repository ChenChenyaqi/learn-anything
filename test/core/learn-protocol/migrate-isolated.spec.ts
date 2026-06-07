import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { migrateV0ToV1, migrateAll } from '../../../src/core/learn-protocol/migrate.js';

// ── Helpers ───────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'learn-migrate-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Write a v0 state.yaml into the given topic directory. */
async function writeV0StateYaml(topicDir: string, content: string): Promise<void> {
  await fs.writeFile(path.join(topicDir, 'state.yaml'), content, 'utf-8');
}

/** Write a v0 knowledge-map.md into the given topic directory. */
async function writeKnowledgeMap(topicDir: string, content: string): Promise<void> {
  await fs.writeFile(path.join(topicDir, 'knowledge-map.md'), content, 'utf-8');
}

/** Create a topic subdirectory under the temp dir. */
async function createTopicDir(name: string): Promise<string> {
  const dir = path.join(tmpDir, name);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ── migrateV0ToV1: end-to-end migration ──────────────────────────────

describe('migrateV0ToV1', () => {
  it('should migrate a simple v0 topic to v1 state.json', async () => {
    const topicDir = await createTopicDir('golang');

    await writeV0StateYaml(
      topicDir,
      `topic: Go
created: '2026-01-01'
concepts:
  - path: Basics/Variables
    status: mastered
    last_practiced: '2026-03-01'
    practice_count: 5
    confidence: 0.9
    last_session: '2026-02-28 10:00:00'
    explain_count: 3
  - path: Basics/Functions
    status: in_progress
    last_practiced: '2026-04-01'
    practice_count: 2
    confidence: 0.5
    last_session: null
    explain_count: 1
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# Go

## Basics
- Variables
- Functions
  - Multiple return values
  - Closures
`,
    );

    const result = await migrateV0ToV1(topicDir);

    expect(result.migrated).toBe(true);
    expect(result.topic).toBe('Go');

    // state.json should exist and be valid
    const stateJson = JSON.parse(await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8'));
    expect(stateJson.version).toBe(1);
    expect(stateJson.topic).toBe('Go');
    expect(stateJson.slug).toBe('go');
    expect(stateJson.domains).toHaveLength(1);
    expect(stateJson.domains[0].name).toBe('Basics');
    expect(stateJson.domains[0].concepts).toHaveLength(2);

    // Verify first concept migration
    const variables = stateJson.domains[0].concepts[0];
    expect(variables.name).toBe('Variables');
    expect(variables.status).toBe('mastered');
    expect(variables.confidence).toBe(0.9);
    expect(variables.practice_count).toBe(5);
    expect(variables.last_explained).toBe('2026-02-28 10:00:00');
    expect(variables.last_practiced).toBe('2026-03-01');
    expect(variables.details).toEqual([]);

    // Verify second concept with details
    const functions = stateJson.domains[0].concepts[1];
    expect(functions.name).toBe('Functions');
    expect(functions.status).toBe('in_progress');
    expect(functions.details).toEqual(['Multiple return values', 'Closures']);

    // v0 last_session → v1 last_explained
    expect(functions.last_explained).toBeNull();
    expect(functions.explain_count).toBe(1);
  });

  // ── Idempotency ──────────────────────────────────────────────────

  it('should be idempotent — second migration is a no-op', async () => {
    const topicDir = await createTopicDir('rust');

    await writeV0StateYaml(
      topicDir,
      `topic: Rust
created: '2026-02-01'
concepts:
  - path: Ownership/Ownership
    status: in_progress
    last_practiced: null
    practice_count: 0
    confidence: 0
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# Rust

## Ownership
- Ownership
`,
    );

    // First migration
    const result1 = await migrateV0ToV1(topicDir);
    expect(result1.migrated).toBe(true);

    // Read the generated state.json
    const stateAfterFirst = await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8');

    // Second migration — should skip
    const result2 = await migrateV0ToV1(topicDir);
    expect(result2.migrated).toBe(false);
    expect(result2.reason).toBe('already_migrated');

    // state.json should be unchanged
    const stateAfterSecond = await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8');
    expect(stateAfterSecond).toBe(stateAfterFirst);
  });

  // ── Backup file generation ───────────────────────────────────────

  it('should create .bak backup files and remove originals', async () => {
    const topicDir = await createTopicDir('typescript');

    await writeV0StateYaml(
      topicDir,
      `topic: TypeScript
created: '2026-01-15'
concepts:
  - path: Types/Interfaces
    status: unexplored
    last_practiced: null
    practice_count: 0
    confidence: 0
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# TypeScript

## Types
- Interfaces
`,
    );

    await migrateV0ToV1(topicDir);

    const files = await fs.readdir(topicDir);

    // Backups should exist
    expect(files).toContain('state.yaml.v0.bak');
    expect(files).toContain('knowledge-map.md.v0.bak');

    // Originals should be removed
    expect(files).not.toContain('state.yaml');

    // knowledge-map.md is regenerated from state.json after migration
    expect(files).toContain('knowledge-map.md');

    // state.json should exist
    expect(files).toContain('state.json');
  });

  it('backup content should match original v0 content', async () => {
    const topicDir = await createTopicDir('swift');

    const originalYaml = `topic: Swift
created: '2026-03-01'
concepts:
  - path: Basics/Optionals
    status: in_progress
    last_practiced: '2026-04-01'
    practice_count: 3
    confidence: 0.6
`;

    const originalKm = `# Swift

## Basics
- Optionals
  - Unwrapping
`;

    await writeV0StateYaml(topicDir, originalYaml);
    await writeKnowledgeMap(topicDir, originalKm);

    await migrateV0ToV1(topicDir);

    const backupYaml = await fs.readFile(path.join(topicDir, 'state.yaml.v0.bak'), 'utf-8');
    const backupKm = await fs.readFile(path.join(topicDir, 'knowledge-map.md.v0.bak'), 'utf-8');

    expect(backupYaml).toBe(originalYaml);
    expect(backupKm).toBe(originalKm);
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it('should return no_state_yaml when state.yaml is missing', async () => {
    const topicDir = await createTopicDir('empty-topic');
    await fs.mkdir(topicDir, { recursive: true });

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('no_state_yaml');
  });

  it('should return already_migrated when state.json already exists', async () => {
    const topicDir = await createTopicDir('done');

    await fs.writeFile(
      path.join(topicDir, 'state.json'),
      JSON.stringify({
        version: 1,
        topic: 'Done',
        slug: 'done',
        created: '2026-01-01',
        domains: [],
      }),
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('already_migrated');
    expect(result.topic).toBe('Done');
  });

  it('should return not_v0 when state.yaml has a version field (v1 data)', async () => {
    const topicDir = await createTopicDir('v1-yaml');

    await writeV0StateYaml(
      topicDir,
      `version: 1
topic: Some Topic
created: '2026-01-01'
domains: []
`,
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('not_v0');
  });

  it('should return error when knowledge-map.md is missing', async () => {
    const topicDir = await createTopicDir('no-km');

    await writeV0StateYaml(
      topicDir,
      `topic: No KM
created: '2026-01-01'
concepts:
  - path: A/B
    status: unexplored
    last_practiced: null
    practice_count: 0
    confidence: 0
`,
    );

    // No knowledge-map.md written

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('error');
    expect(result.error).toContain('knowledge-map.md not found');
  });

  it('should default to unexplored status for unknown status values', async () => {
    const topicDir = await createTopicDir('weird-status');

    await writeV0StateYaml(
      topicDir,
      `topic: Weird
created: '2026-01-01'
concepts:
  - path: Domain/Concept
    status: unknown_status
    last_practiced: null
    practice_count: 0
    confidence: 0
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# Weird

## Domain
- Concept
`,
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(true);

    const stateJson = JSON.parse(await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8'));
    expect(stateJson.domains[0].concepts[0].status).toBe('unexplored');
  });

  it('should default missing v0 concept fields to zero/null values', async () => {
    const topicDir = await createTopicDir('sparse-v0');

    // Minimal v0 concept — missing most optional fields
    await writeV0StateYaml(
      topicDir,
      `topic: Sparse
created: '2026-01-01'
concepts:
  - path: Domain/Concept
    status: in_progress
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# Sparse

## Domain
- Concept
`,
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(true);

    const stateJson = JSON.parse(await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8'));
    const concept = stateJson.domains[0].concepts[0];

    expect(concept.confidence).toBe(0);
    expect(concept.practice_count).toBe(0);
    expect(concept.explain_count).toBe(0);
    expect(concept.last_explained).toBeNull();
    expect(concept.last_practiced).toBeNull();
  });

  it('should map v0 last_session to v1 last_explained', async () => {
    const topicDir = await createTopicDir('session-mapping');

    await writeV0StateYaml(
      topicDir,
      `topic: SessionMap
created: '2026-01-01'
concepts:
  - path: Domain/Concept
    status: in_progress
    last_session: '2026-05-01 14:00:00'
    explain_count: 3
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# SessionMap

## Domain
- Concept
`,
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(true);

    const stateJson = JSON.parse(await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8'));
    const concept = stateJson.domains[0].concepts[0];

    expect(concept.last_explained).toBe('2026-05-01 14:00:00');
    expect(concept.explain_count).toBe(3);
  });
});

// ── migrateAll ────────────────────────────────────────────────────────

describe('migrateAll', () => {
  it('should return empty report when directory does not exist', async () => {
    const report = await migrateAll(path.join(tmpDir, 'nonexistent'));
    expect(report.migratedCount).toBe(0);
    expect(report.skippedCount).toBe(0);
    expect(report.results).toHaveLength(0);
  });

  it('should return empty report when directory is empty', async () => {
    const emptyDir = path.join(tmpDir, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });

    const report = await migrateAll(emptyDir);
    expect(report.migratedCount).toBe(0);
    expect(report.skippedCount).toBe(0);
    expect(report.results).toHaveLength(0);
  });

  it('should skip files (non-directories) in the base directory', async () => {
    const baseDir = path.join(tmpDir, 'topics');
    await fs.mkdir(baseDir, { recursive: true });
    await fs.writeFile(path.join(baseDir, 'readme.txt'), 'not a topic');

    const report = await migrateAll(baseDir);
    expect(report.migratedCount).toBe(0);
    expect(report.skippedCount).toBe(0);
    expect(report.results).toHaveLength(0);
  });

  it('should migrate multiple topics in one pass', async () => {
    const baseDir = path.join(tmpDir, 'topics');
    await fs.mkdir(baseDir, { recursive: true });

    // Topic 1
    const dir1 = path.join(baseDir, 'topic-a');
    await fs.mkdir(dir1, { recursive: true });
    await writeV0StateYaml(
      dir1,
      `topic: Topic A\ncreated: '2026-01-01'\nconcepts:\n  - path: D/C\n    status: unexplored\n`,
    );
    await writeKnowledgeMap(dir1, `# Topic A\n\n## D\n- C\n`);

    // Topic 2
    const dir2 = path.join(baseDir, 'topic-b');
    await fs.mkdir(dir2, { recursive: true });
    await writeV0StateYaml(
      dir2,
      `topic: Topic B\ncreated: '2026-02-01'\nconcepts:\n  - path: E/F\n    status: mastered\n`,
    );
    await writeKnowledgeMap(dir2, `# Topic B\n\n## E\n- F\n`);

    const report = await migrateAll(baseDir);

    expect(report.migratedCount).toBe(2);
    expect(report.skippedCount).toBe(0);
    expect(report.results).toHaveLength(2);
  });

  it('should produce a valid v1 state.json that passes schema validation', async () => {
    const topicDir = await createTopicDir('schema-valid');

    await writeV0StateYaml(
      topicDir,
      `topic: Schema Test
created: '2026-06-01'
concepts:
  - path: Domain/Concept A
    status: mastered
    last_practiced: '2026-06-02'
    practice_count: 10
    confidence: 1
    last_session: '2026-06-01 12:00:00'
    explain_count: 5
  - path: Domain/Concept B
    status: needs_practice
    last_practiced: null
    practice_count: 1
    confidence: 0.3
`,
    );

    await writeKnowledgeMap(
      topicDir,
      `# Schema Test

## Domain
- Concept A
  - Detail 1
  - Detail 2
- Concept B
`,
    );

    const result = await migrateV0ToV1(topicDir);
    expect(result.migrated).toBe(true);

    const stateJson = JSON.parse(await fs.readFile(path.join(topicDir, 'state.json'), 'utf-8'));

    // Verify v1 structure
    expect(stateJson.version).toBe(1);
    expect(stateJson.topic).toBe('Schema Test');
    expect(stateJson.slug).toBe('schema-test');
    expect(stateJson.created).toBe('2026-06-01');
    expect(stateJson.domains).toHaveLength(1);

    const domain = stateJson.domains[0];
    expect(domain.name).toBe('Domain');
    expect(domain.slug).toBe('domain');
    expect(domain.concepts).toHaveLength(2);

    expect(domain.concepts[0].details).toEqual(['Detail 1', 'Detail 2']);
    expect(domain.concepts[1].details).toEqual([]);
  });
});
