import { z } from 'zod';

// ---- Helpers -----------------------------------------------------------

/** Datetime: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss. */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/;

/**
 * Verify a regex-matched datetime has components that form a real calendar
 * moment (month 01-12, valid day-of-month incl. leap years, hh/mm/ss in range).
 * Mirrors the check in src/scripts/utils.mts.
 */
function isValidCalendarDate(s: string): boolean {
  const m = s.match(DATE_RE);
  if (!m) return false;
  const Y = +m[1];
  const M = +m[2];
  const D = +m[3];
  const H = m[4] !== undefined ? +m[4] : 0;
  const MI = m[5] !== undefined ? +m[5] : 0;
  const S = m[6] !== undefined ? +m[6] : 0;
  const d = new Date(Y, M - 1, D, H, MI, S, 0);
  return (
    d.getFullYear() === Y &&
    d.getMonth() === M - 1 &&
    d.getDate() === D &&
    d.getHours() === H &&
    d.getMinutes() === MI &&
    d.getSeconds() === S
  );
}

const dateTimeStr = () =>
  z
    .string()
    .regex(DATE_RE, 'Expected YYYY-MM-DD or YYYY-MM-DD HH:mm:ss')
    .refine(isValidCalendarDate, 'Invalid calendar date');
const nullableDateTimeStr = () => dateTimeStr().nullable();

// ---- Concept schema ----------------------------------------------------

const conceptSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(['unexplored', 'in_progress', 'needs_practice', 'mastered']),
  confidence: z.number().min(0).max(1),
  practice_count: z.number().int().min(0),
  explain_count: z.number().int().min(0),
  last_explained: nullableDateTimeStr(),
  last_practiced: nullableDateTimeStr(),
  details: z.array(z.string()),
});

// ---- Domain schema -----------------------------------------------------

const domainSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  concepts: z.array(conceptSchema),
});

// ---- Top-level StateV1 schema ------------------------------------------

export const stateV1Schema = z.object({
  version: z.literal(1),
  topic: z.string().min(1),
  slug: z.string().min(1),
  created: dateTimeStr(),
  domains: z.array(domainSchema),
});

export type StateV1Schema = z.infer<typeof stateV1Schema>;

// ---- Validation result type --------------------------------------------

export type ValidationResult =
  | { success: true; data: StateV1Schema }
  | { success: false; errors: z.ZodIssue[] };

// ---- Public API ---------------------------------------------------------

/** Validate an unknown value against the StateV1 schema. */
export function validateStateV1(value: unknown): ValidationResult {
  const result = stateV1Schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
