#!/usr/bin/env node
/**
 * validate-quiz.mjs — standalone script
 * Validates a quiz.json deck file against the v1 schema.
 *
 * Usage: node validate-quiz.mjs <quiz.json-path>
 *
 * This file is compiled from src/scripts/validate-quiz.mts via tsc and
 * copied into the learn-anything-quiz skill's scripts/ directory by init/update.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateQuizDeck } from './utils.mjs';

/* ------------------------------------------------------------------ */
/*  CLI                                                               */
/* ------------------------------------------------------------------ */

function usage(): never {
  const script = process.argv[1]?.split('/').pop() || 'validate-quiz.mjs';
  console.error(`Usage: node ${script} <quiz.json-path>`);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  const deckPath = resolve(args[0]);

  // 1. Read the deck file
  let raw: string;
  try {
    raw = readFileSync(deckPath, 'utf-8');
  } catch (error) {
    console.error(`Error: quiz deck not found at ${deckPath}`, error);
    process.exit(1);
  }

  // 2. Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to parse ${deckPath}: ${msg}`);
    process.exit(1);
  }

  // 3. Validate v1 format
  const errors = validateQuizDeck(data);
  if (errors.length > 0) {
    console.error(`Error: quiz deck validation failed (${deckPath}):`);
    for (const e of errors) {
      console.error(`  .${e.path}: ${e.message}`);
    }
    console.error('Fix the above issues in the deck and re-run validate-quiz.mjs.');
    process.exit(1);
  }

  const deck = data as { concept_name?: string; questions?: unknown[] };
  const count = Array.isArray(deck.questions) ? deck.questions.length : 0;
  console.log(`✓ Valid quiz deck for "${deck.concept_name ?? '?'}" (${count} questions)`);
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
