/**
 * script-access.ts — runtime access to compiled standalone scripts.
 *
 * The scripts live in src/scripts/*.mts and compile to dist/scripts/*.mjs
 * via tsc. This module resolves them relative to its own compiled location
 * (dist/script-access.js → dist/scripts/*.mjs), so it works regardless of
 * which package imports it.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ScriptName = 'utils' | 'render' | 'init-sessions' | 'status' | 'validate-quiz';

export const ALL_SCRIPT_NAMES: readonly ScriptName[] = [
  'utils',
  'render',
  'init-sessions',
  'status',
  'validate-quiz',
] as const;

/**
 * Read the compiled content of a standalone script.
 *
 * @param name - script name without extension (e.g. `'render'`)
 * @returns the full `.mjs` source as a string
 */
export function readScript(name: ScriptName): string {
  return readFileSync(join(__dirname, 'scripts', `${name}.mjs`), 'utf8');
}

/**
 * Returns the absolute path to the directory containing the compiled
 * `.mjs` scripts.
 */
export function getScriptsDir(): string {
  return join(__dirname, 'scripts');
}
