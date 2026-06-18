#!/usr/bin/env node
/* global console, process */
/**
 * bundle-site.mjs — Build script
 *
 * 1. Runs `vite build` in packages/cli/site/ to produce site/dist/
 * 2. Copies site/dist/ + serve.mjs + .gitignore → site-dist/
 *
 * site-dist/ is published to npm and copied to .learn/site/ at runtime.
 *
 * The `vite build` applies the resolve alias that swaps
 * useTopicData.ts → useApiData.ts (fetch-based data layer).
 *
 * Usage: node scripts/bundle-site.mjs
 */
import { cpSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = join(__dirname, '..');
const siteDir = join(packageDir, 'site');
const distDir = join(siteDir, 'dist');
const outputDir = join(packageDir, 'site-dist');

/* ------------------------------------------------------------------ */
/*  Main (only when run as script, not on import)                      */
/* ------------------------------------------------------------------ */

const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  console.log('[bundle-site] Building site with vite...');
  execSync('pnpm exec vite build', { cwd: siteDir, stdio: 'inherit' });

  // Clear output
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // Copy dist/ contents
  console.log('[bundle-site] Copying dist/ -> site-dist/');
  cpSync(distDir, outputDir, { recursive: true });

  // Copy serve.mjs
  const serveSrc = join(siteDir, 'serve.mjs');
  const serveDest = join(outputDir, 'serve.mjs');
  if (existsSync(serveSrc)) {
    cpSync(serveSrc, serveDest);
  }

  // Write .gitignore
  writeFileSync(join(outputDir, '.gitignore'), 'node_modules\ndist\n', 'utf-8');

  const count = readdirSync(outputDir, { recursive: true }).length;
  console.log(`[bundle-site] site-dist/ ready with ${count} files`);
}
