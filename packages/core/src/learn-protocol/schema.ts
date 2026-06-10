import { z } from 'zod';

// ---- Helpers -----------------------------------------------------------

/** Datetime: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss. */
const dateTimeStr = () =>
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/,
      'Expected YYYY-MM-DD or YYYY-MM-DD HH:mm:ss',
    );
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
