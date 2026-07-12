#!/usr/bin/env node
/**
 * init-sessions.mjs — standalone script
 * Reads state.json (v1) and creates domain subdirectories under sessions/.
 *
 * Usage: node init-sessions.mjs <topic-dir>
 *
 * This file is compiled from src/scripts/init-sessions.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StateV1 } from './utils.mjs';
import { validateStateV1 } from './utils.mjs';

/* ------------------------------------------------------------------ */
/*  Init Sessions                                                     */
/* ------------------------------------------------------------------ */

export function initSessions(topicDir: string, state: StateV1): number {
  const sessionsDir = join(topicDir, 'sessions');

  // Ensure the top-level sessions/ directory exists
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }

  let created = 0;
  for (const domain of state.domains) {
    const domainDir = join(sessionsDir, domain.slug);
    if (!existsSync(domainDir)) {
      mkdirSync(domainDir, { recursive: true });
      created++;
    }
  }

  return created;
}

/* ------------------------------------------------------------------ */
/*  CLI                                                               */
/* ------------------------------------------------------------------ */

function usage(): never {
  const script = process.argv[1]?.split('/').pop() || 'init-sessions.mjs';
  console.error(`Usage: node ${script} <topic-dir>`);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  const topicDir = resolve(args[0]);
  const statePath = join(topicDir, 'state.json');

  // 1. Read state.json
  let raw: string;
  try {
    raw = readFileSync(statePath, 'utf-8');
  } catch (error) {
    console.error(`Error: state.json not found at ${statePath}`, error);
    process.exit(1);
  }

  // 2. Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to parse state.json: ${msg}`);
    process.exit(1);
  }

  // 3. Validate v1 format
  const errors = validateStateV1(data);
  if (errors.length > 0) {
    console.error('Error: state.json validation failed:');
    for (const e of errors) {
      console.error(`  .${e.path}: ${e.message}`);
    }
    console.error('Fix the above issues in state.json and re-run init-sessions.mjs.');
    process.exit(1);
  }

  const state = data as unknown as StateV1;

  // 4. Create domain subdirectories
  const created = initSessions(topicDir, state);

  // Summary to stdout
  console.log(
    `Initialized ${state.domains.length} domain directories under sessions/ (${created} new) for "${state.topic}"`,
  );
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
