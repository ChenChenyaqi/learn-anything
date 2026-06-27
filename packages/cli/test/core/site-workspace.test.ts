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

  it('should generate a minimal site project with package.json, build.mjs, .gitignore', async () => {
    const result = await generateSiteWorkspace({
      targetPath: TEST_WORKSPACE,
      cliVersion: '1.5.3',
    });

    const siteDir = TEST_WORKSPACE;

    // Verify files
    expect(existsSync(siteDir)).toBe(true);
    expect(existsSync(path.join(siteDir, 'package.json'))).toBe(true);
    expect(existsSync(path.join(siteDir, 'build.mjs'))).toBe(true);
    expect(existsSync(path.join(siteDir, '.gitignore'))).toBe(true);

    // Verify package.json contents
    const packageJson = JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf-8'));
    expect(packageJson.name).toBe('learn-anything-site');
    expect(packageJson.scripts.server).toBe('learn-anything serve');
    expect(packageJson.scripts.build).toBe('node build.mjs');
    expect(packageJson.dependencies['learn-anything-cli']).toBe('^1.5.3');

    // Verify build.mjs contents
    const buildScript = readFileSync(path.join(siteDir, 'build.mjs'), 'utf-8');
    expect(buildScript).toContain("require.resolve('learn-anything-cli/package.json')");
    expect(buildScript).toContain("cpSync(siteDist, 'dist'");

    // Verify .gitignore
    const gitignore = readFileSync(path.join(siteDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('dist');

    // Verify file count (3 files)
    expect(result.fileCount).toBe(3);
  });
});
