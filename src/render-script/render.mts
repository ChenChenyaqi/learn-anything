#!/usr/bin/env node
/**
 * render.mjs — standalone zero-dependency script
 * Reads state.json (v1) and renders knowledge-map.md.
 *
 * Usage: node render.mjs <topic-dir>
 *
 * This file is compiled from src/render-script/render.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 * It MUST NOT import any project modules — only Node.js built-ins.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/*  Inline v1 types (same shape as src/core/learn-protocol/types.ts)  */
/* ------------------------------------------------------------------ */

type ConceptStatus = 'unexplored' | 'in_progress' | 'needs_practice' | 'mastered';

interface Concept {
  name: string;
  slug: string;
  status: ConceptStatus;
  confidence: number;
  practice_count: number;
  explain_count: number;
  last_explained: string | null;
  last_practiced: string | null;
  details: string[];
}

interface Domain {
  name: string;
  slug: string;
  concepts: Concept[];
}

interface StateV1 {
  version: 1;
  topic: string;
  slug: string;
  created: string;
  domains: Domain[];
}

/* ------------------------------------------------------------------ */
/*  Status display helpers                                            */
/* ------------------------------------------------------------------ */

const STATUS_ICON: Record<ConceptStatus, string> = {
  mastered: '✅',
  in_progress: '🔄',
  needs_practice: '⚠️',
  unexplored: '⬜',
};

const STATUS_LABEL: Record<ConceptStatus, string> = {
  mastered: 'mastered',
  in_progress: 'in progress',
  needs_practice: 'needs practice',
  unexplored: 'unexplored',
};

/* ------------------------------------------------------------------ */
/*  Render                                                            */
/* ------------------------------------------------------------------ */

export function render(state: StateV1): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${state.topic}`);
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
    lines.push(`## ${domain.name}`);
    lines.push('');
    for (const concept of domain.concepts) {
      const icon = STATUS_ICON[concept.status];
      const label = STATUS_LABEL[concept.status];
      lines.push(`- ${icon} **${concept.name}** (${label})`);
      for (const detail of concept.details) {
        lines.push(`  - ${detail}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function totalCount(state: StateV1): number {
  return state.domains.reduce((sum, d) => sum + d.concepts.length, 0);
}

export function masteredCount(state: StateV1): number {
  return state.domains.reduce(
    (sum, d) => sum + d.concepts.filter((c) => c.status === 'mastered').length,
    0,
  );
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
  if (
    data === null ||
    typeof data !== 'object' ||
    (data as Record<string, unknown>).version !== 1
  ) {
    console.error('Error: Unknown state.json format (missing version)');
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
