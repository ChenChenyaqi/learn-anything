/**
 * Pure render function — takes a StateV1 object and returns
 * a Markdown-formatted knowledge map string.
 *
 * This is the shared rendering logic used by:
 *   - migrate.ts (post-migration knowledge-map.md regeneration)
 *   - CLI scripts (deployed to skill directories as standalone .mjs)
 *
 * The standalone script version at packages/cli/src/scripts/render.mts
 * has its own copy of this logic for zero-dependency deployment.
 */

import type { StateV1, ConceptStatus } from './types.js';

/* Status display helpers */
const STATUS_ICON: Record<ConceptStatus, string> = {
  mastered: '🟢',
  in_progress: '🔵',
  needs_practice: '🟠',
  unexplored: '⚪',
};

const STATUS_LABEL: Record<ConceptStatus, string> = {
  mastered: 'mastered',
  in_progress: 'in progress',
  needs_practice: 'needs practice',
  unexplored: 'unexplored',
};

/** Escape underscores in text destined for Markdown output. */
const esc = (s: string): string => s.replace(/_/g, '\\_');

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
