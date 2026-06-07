/**
 * utils.mts — shared types, validation, and helpers for scripts.
 *
 * This file is compiled from src/scripts/utils.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 * It MUST NOT import any project modules — only Node.js built-ins.
 */

/* ------------------------------------------------------------------ */
/*  Inline v1 types (same shape as src/core/learn-protocol/types.ts)  */
/* ------------------------------------------------------------------ */

export type ConceptStatus = 'unexplored' | 'in_progress' | 'needs_practice' | 'mastered';

export interface Concept {
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

export interface Domain {
  name: string;
  slug: string;
  concepts: Concept[];
}

export interface StateV1 {
  version: 1;
  topic: string;
  slug: string;
  created: string;
  domains: Domain[];
}

/* ------------------------------------------------------------------ */
/*  Status display helpers                                            */
/* ------------------------------------------------------------------ */

export const STATUS_ICON: Record<ConceptStatus, string> = {
  mastered: '🟢',
  in_progress: '🔵',
  needs_practice: '🟠',
  unexplored: '⚪',
};

export const STATUS_LABEL: Record<ConceptStatus, string> = {
  mastered: 'mastered',
  in_progress: 'in progress',
  needs_practice: 'needs practice',
  unexplored: 'unexplored',
};

/* ------------------------------------------------------------------ */
/*  Text helpers                                                      */
/* ------------------------------------------------------------------ */

/** Escape underscores in text destined for Markdown output. */
export const esc = (s: string): string => s.replace(/_/g, '\\_');

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
