/**
 * Copy non-TS assets (SKILL.md files, etc.) from src/ to dist/ after tsc.
 *
 * tsc only compiles .ts files; markdown and other text assets need to be
 * copied separately so they're available at runtime via readFileSync.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const srcDir = join(root, 'src', 'skills');
const destDir = join(root, 'dist', 'skills');

if (existsSync(srcDir)) {
  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
  console.log(`copied ${srcDir} → ${destDir}`);
} else {
  console.log(`no skills dir at ${srcDir}, skipping`);
}
