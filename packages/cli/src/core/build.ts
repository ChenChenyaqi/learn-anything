import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'path';
import { siteDistPath } from './site-dist-path.js';

export interface BuildOptions {
  targetPath: string;
}

export function executeBuild(options: BuildOptions): void {
  const resolvedPath = path.resolve(options.targetPath);
  const distDir = path.join(resolvedPath, 'dist');

  if (!existsSync(siteDistPath)) {
    throw new Error('Site files not found. Please reinstall learn-anything-cli.');
  }

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(siteDistPath, distDir, { recursive: true });
}
