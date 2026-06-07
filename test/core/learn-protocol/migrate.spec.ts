import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { migrateAll } from '../../../src/core/learn-protocol/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES = path.join(__dirname, 'fixtures');
const MOCK = path.join(FIXTURES, 'mock');
const EXPECTS = path.join(FIXTURES, 'expects');
const MIGRATES = path.join(FIXTURES, 'migrates');

describe('migrateAll (end-to-end)', () => {
  beforeAll(async () => {
    // Clean migrates/ and re-seed from mock/ for a deterministic starting state
    await fs.rm(MIGRATES, { recursive: true, force: true });
    await fs.cp(MOCK, MIGRATES, { recursive: true });
  });

  it('should migrate v0 topics and produce output matching expects', async () => {
    const report = await migrateAll(MIGRATES);

    // ── 1. Migration report ──────────────────────────────────
    expect(report.migratedCount).toBe(2);
    expect(report.skippedCount).toBe(1);

    const migratedTopics = report.results.filter((r) => r.migrated).map((r) => r.topic);
    expect(migratedTopics).toEqual(expect.arrayContaining(['JavaScript', 'Python 基础']));

    const skippedResult = report.results.find((r) => !r.migrated);
    expect(skippedResult?.reason).toBe('already_migrated');
    expect(skippedResult?.topic).toBe('Already Migrated');

    // ── 2. Directory structure ───────────────────────────────
    const expectDirs = (await fs.readdir(EXPECTS, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const migrateDirs = (await fs.readdir(MIGRATES, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    expect(migrateDirs).toEqual(expectDirs);

    // ── 3. File contents — compare each dir's .json files ────
    for (const dir of expectDirs) {
      const expectDir = path.join(EXPECTS, dir);
      const migrateDir = path.join(MIGRATES, dir);

      const expectFiles = (await fs.readdir(expectDir)).filter((f) => f.endsWith('.json')).sort();
      const migrateFiles = (await fs.readdir(migrateDir)).filter((f) => f.endsWith('.json')).sort();

      expect(migrateFiles).toEqual(expectFiles);

      for (const file of expectFiles) {
        const expectContent = JSON.parse(await fs.readFile(path.join(expectDir, file), 'utf-8'));
        const migrateContent = JSON.parse(await fs.readFile(path.join(migrateDir, file), 'utf-8'));
        expect(migrateContent).toEqual(expectContent);
      }

      // ── 4. Originals removed, backups exist for migrated topics ──
      const allFiles = await fs.readdir(migrateDir);
      if (dir === 'javascript' || dir === 'python') {
        // Originals must be gone
        expect(allFiles).not.toContain('state.yaml');

        // knowledge-map.md is regenerated from state.json after migration
        expect(allFiles).toContain('knowledge-map.md');

        // Backups must exist
        expect(allFiles).toContain('state.yaml.v0.bak');
        expect(allFiles).toContain('knowledge-map.md.v0.bak');
      } else if (dir === 'already-migrated') {
        // Skipped topics keep their original files untouched
        expect(allFiles).toContain('state.yaml');
      }
    }
  });
});
