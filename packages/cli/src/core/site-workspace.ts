import path from 'path';
import { writeFileSync, mkdirSync } from 'node:fs';

export interface SiteWorkspaceOptions {
  targetPath: string;
  /** CLI package version to use in the generated package.json dependency. */
  cliVersion: string;
}

/**
 * Generates a minimal site project that delegates to the pre-built
 * learn-anything-cli npm package.
 *
 * The generated project contains only:
 * - package.json (depends on learn-anything-cli)
 */
export async function generateSiteWorkspace(options: SiteWorkspaceOptions): Promise<{
  outputDir: string;
  fileCount: number;
}> {
  const { targetPath, cliVersion } = options;
  const siteDir = targetPath;

  mkdirSync(siteDir, { recursive: true });

  // package.json
  const packageJson = {
    name: 'learn-anything-site',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      server: 'learn-anything serve',
      build: 'learn-anything build',
    },
    dependencies: {
      'learn-anything-cli': `^${cliVersion}`,
    },
  };
  writeFileSync(
    path.join(siteDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8',
  );
  return { outputDir: siteDir, fileCount: 1 };
}
