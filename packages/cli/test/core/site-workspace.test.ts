import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { generateSiteWorkspace } from '../../src/core/site-workspace.js';

const TEST_FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const TEST_WORKSPACE = path.join(TEST_FIXTURES, 'test-site-workspace');

describe('SiteWorkspaceGenerator', () => {
  beforeAll(() => {
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it('should generate a minimal site project with package.json', async () => {
    const result = await generateSiteWorkspace({
      targetPath: TEST_WORKSPACE,
      cliVersion: '1.5.3',
    });

    const siteDir = TEST_WORKSPACE;

    // Verify files
    expect(existsSync(siteDir)).toBe(true);
    expect(existsSync(path.join(siteDir, 'package.json'))).toBe(true);

    // Verify package.json contents
    const packageJson = JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf-8'));
    expect(packageJson.name).toBe('learn-anything-site');
    expect(packageJson.scripts.server).toBe('learn-anything serve');
    expect(packageJson.scripts.build).toBe('learn-anything build');

    // Verify file count (1 files)
    expect(result.fileCount).toBe(1);
  });
});
