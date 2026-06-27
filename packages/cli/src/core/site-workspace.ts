import path from 'path';
import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';

export interface SiteWorkspaceOptions {
  targetPath: string;
  /** CLI package version to use in the generated package.json dependency. */
  cliVersion: string;
}

const BUILD_SCRIPT = `import { execSync } from 'node:child_process';

try {
  execSync('npx learn-anything build', { stdio: 'inherit' });
} catch {
  console.error('Build failed. Make sure learn-anything-cli is installed.');
  process.exit(1);
}
`;

/**
 * Generates a minimal site project that delegates to the pre-built
 * learn-anything-cli npm package.
 *
 * The generated project contains only:
 * - package.json (depends on learn-anything-cli)
 * - build.mjs (copies site-dist/ to dist/)
 * - .gitignore
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

  // build.mjs
  writeFileSync(path.join(siteDir, 'build.mjs'), BUILD_SCRIPT, 'utf-8');

  // .gitignore
  writeFileSync(path.join(siteDir, '.gitignore'), 'node_modules/\ndist/\n', 'utf-8');

  const fileCount = countFiles(siteDir);
  return { outputDir: siteDir, fileCount };
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { recursive: true })) {
    const fullPath = path.join(dir, entry as string);
    try {
      if (statSync(fullPath).isFile()) count++;
    } catch {
      // skip
    }
  }
  return count;
}
