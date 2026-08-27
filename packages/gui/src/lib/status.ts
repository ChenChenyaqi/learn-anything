// Concept-status → visual mapping for the knowledge map + concept lists.
//
// Mirrors the design mockup's `.dot-*` / `.hm-sq.bg-*` palette:
//   mastered      → green  (--color-mastered)
//   in_progress   → amber  (--color-progress)
//   needs_practice→ red    (--color-accent)
//   unexplored    → gray   (--color-border)
//
// The colour classes (`bg-(--color-*)`) are written as FULL literals in
// `STATUS_BG` so Tailwind v4's source scanner (covers `**/*.ts` via main.css
// `@source`) generates them — runtime string interpolation of the var name
// would evade detection. The shared shape prefix is a separate literal composed
// at call time; every class fragment appears verbatim in source.

import type { ConceptStatus, Domain } from '@/lib/commands';

const STATUS_BG: Record<ConceptStatus, string> = {
  mastered: 'bg-(--color-mastered)',
  in_progress: 'bg-(--color-progress)',
  needs_practice: 'bg-(--color-accent)',
  unexplored: 'bg-(--color-border)',
};

const STATUS_LABEL_KEY: Record<ConceptStatus, string> = {
  mastered: 'workspace.status.mastered',
  in_progress: 'workspace.status.inProgress',
  needs_practice: 'workspace.status.needsPractice',
  unexplored: 'workspace.status.unexplored',
};

/** Shared base for a 7px status dot (mockup `.dot`). */
const DOT_SHAPE = 'inline-block w-[7px] h-[7px] rounded-full shrink-0';

/** Shared base for a 16px heatmap square (mockup `.hm-sq`). */
const SQUARE_SHAPE = 'inline-block w-4 h-4 rounded-[3px] shrink-0';

/** Tailwind class string for a 7px status dot coloured by mastery. */
export function statusDot(status: ConceptStatus): string {
  return `${DOT_SHAPE} ${STATUS_BG[status]}`;
}

/** Tailwind class string for a 16px heatmap square coloured by mastery. */
export function statusSquare(status: ConceptStatus): string {
  return `${SQUARE_SHAPE} ${STATUS_BG[status]}`;
}

/** Locale message key for a concept status; translate at render time via
 *  `t(statusLabelKey(status))`. Returning the key (not the copy) keeps this
 *  module locale-agnostic and lets callers resolve it reactively. */
export function statusLabelKey(status: ConceptStatus): string {
  return STATUS_LABEL_KEY[status];
}

/** Mastered count / total + percentage for one domain's concepts. */
export function domainMastery(domain: Domain): { mastered: number; total: number; pct: number } {
  const total = domain.concepts.length;
  const mastered = domain.concepts.filter((c) => c.status === 'mastered').length;
  const pct = total > 0 ? Math.round((mastered * 100) / total) : 0;
  return { mastered, total, pct };
}
