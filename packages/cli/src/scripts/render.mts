#!/usr/bin/env node
/**
 * render.mjs — standalone script
 * Reads state.json (v1) and renders knowledge-map.md.
 *
 * Usage: node render.mjs <topic-dir>
 *
 * This file is compiled from src/scripts/render.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StateV1 } from './utils.mjs';
import { validateStateV1, totalCount, masteredCount, STATUS_ICON, STATUS_LABEL, esc } from './utils.mjs';

/* ------------------------------------------------------------------ */
/*  Render                                                            */
/* ------------------------------------------------------------------ */

export function render(state: StateV1): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${esc(state.topic)}`);
  lines.push('');

  // Progress header
  const allConcepts = state.domains.flatMap((d) => d.concepts);
  const total = allConcepts.length;
  const mastered = allConcepts.filter((c) => c.status === 'mastered').length;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  lines.push(`> ${mastered}/${total} mastered · ${pct}% complete`);
  lines.push('');

  // Domains → concepts → details
  for (const domain of state.domains) {
    lines.push(`## ${esc(domain.name)}`);
    lines.push('');
    for (const concept of domain.concepts) {
      const icon = STATUS_ICON[concept.status];
      const label = STATUS_LABEL[concept.status];
      lines.push(`- ${icon} **${esc(concept.name)}** (${label})`);
      for (const detail of concept.details) {
        lines.push(`  - ${esc(detail)}`);
      }
    }
    if (domain.concepts.length > 0) lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/* ------------------------------------------------------------------ */
/*  CLI                                                               */
/* ------------------------------------------------------------------ */

function usage(): never {
  const script = process.argv[1]?.split('/').pop() || 'render.mjs';
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
    console.error('Fix the above issues in state.json and re-run render.mjs.');
    process.exit(1);
  }

  const state = data as unknown as StateV1;

  // 4. Render
  const output = render(state);
  const outputPath = join(topicDir, 'knowledge-map.md');

  // 5. Write
  try {
    writeFileSync(outputPath, output, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: Cannot write knowledge-map.md: ${msg}`);
    process.exit(1);
  }

  // Summary to stdout
  console.log(
    `Rendered knowledge-map.md for "${state.topic}" (${masteredCount(state)}/${totalCount(state)} mastered)`,
  );
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
