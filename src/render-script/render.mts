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

/** Escape underscores in text destined for Markdown output. */
const esc = (s: string): string => s.replace(/_/g, '\\_');

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
/*  Inline validation (mirrors src/core/learn-protocol/schema.ts)     */
/* ------------------------------------------------------------------ */

export interface ValidationError {
  path: string;
  message: string;
}

/** A checker returns an error message, or null if valid. */
type Checker = (v: unknown) => string | null;

// ── Checker factories ────────────────────────────────────────────────

const literal =
  (expected: unknown): Checker =>
  (v) =>
    v !== expected ? `Must be ${JSON.stringify(expected)}` : null;

const str =
  (min = 1): Checker =>
  (v) =>
    typeof v !== 'string' || v.length < min
      ? `Must be a non-empty string`
      : null;

const num =
  (opts?: { min?: number; max?: number; int?: boolean }): Checker =>
  (v) => {
    if (typeof v !== 'number') return 'Must be a number';
    if (opts?.min !== undefined && v < opts.min) return `Must be >= ${opts.min}`;
    if (opts?.max !== undefined && v > opts.max) return `Must be <= ${opts.max}`;
    if (opts?.int && !Number.isInteger(v)) return 'Must be an integer';
    return null;
  };

const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
const dateStr: Checker = (v) =>
  typeof v !== 'string' || !DATE_RE.test(v)
    ? 'Must match YYYY-MM-DD or YYYY-MM-DD HH:mm:ss'
    : null;

const nullable =
  (inner: Checker): Checker =>
  (v) =>
    v === null ? null : inner(v);

const arr =
  (itemChecker?: Checker): Checker =>
  (v) => {
    if (!Array.isArray(v)) return 'Must be an array';
    if (itemChecker)
      for (const item of v) {
        const err = itemChecker(item);
        if (err) return err;
      }
    return null;
  };

const oneOf =
  (...values: string[]): Checker =>
  (v) =>
    !values.includes(v as string) ? `Must be one of: ${values.join(', ')}` : null;

// ── Validation schemas ───────────────────────────────────────────────

const STATE_RULES: Record<string, Checker> = {
  version: literal(1),
  topic: str(),
  slug: str(),
  created: dateStr,
  domains: arr(),
};

const DOMAIN_RULES: Record<string, Checker> = {
  name: str(),
  slug: str(),
  concepts: arr(),
};

const CONCEPT_RULES: Record<string, Checker> = {
  name: str(),
  slug: str(),
  status: oneOf('unexplored', 'in_progress', 'needs_practice', 'mastered'),
  confidence: num({ min: 0, max: 1 }),
  practice_count: num({ min: 0, int: true }),
  explain_count: num({ min: 0, int: true }),
  last_explained: nullable(dateStr),
  last_practiced: nullable(dateStr),
  details: arr(str()),
};

// ── Core engine ──────────────────────────────────────────────────────

function checkFields(
  obj: unknown,
  rules: Record<string, Checker>,
  prefix: string,
  errors: ValidationError[],
): void {
  if (obj === null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const [key, checker] of Object.entries(rules)) {
    const msg = checker(record[key]);
    if (msg) errors.push({ path: prefix ? `${prefix}.${key}` : key, message: msg });
  }
}

export function validateStateV1(data: unknown): ValidationError[] {
  if (data === null || typeof data !== 'object' || Array.isArray(data))
    return [{ path: '', message: 'Expected a non-null object' }];

  const errors: ValidationError[] = [];
  checkFields(data, STATE_RULES, '', errors);

  if (Array.isArray((data as Record<string, unknown>).domains)) {
    const domains = (data as Record<string, unknown>).domains as Record<string, unknown>[];
    for (const [di, domain] of domains.entries()) {
      const dp = `domains[${di}]`;
      checkFields(domain, DOMAIN_RULES, dp, errors);
      if (Array.isArray(domain.concepts)) {
        const concepts = domain.concepts as Record<string, unknown>[];
        for (const [ci, concept] of concepts.entries())
          checkFields(concept, CONCEPT_RULES, `${dp}.concepts[${ci}]`, errors);
      }
    }
  }

  return errors;
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
