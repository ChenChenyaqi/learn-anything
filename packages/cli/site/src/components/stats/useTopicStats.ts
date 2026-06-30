import type { ConceptStatus, StateV1 } from '@/composables/topicDataTypes';
import type { MasteryStats } from './useDashboardStats';

export interface DomainStat {
  name: string;
  slug: string;
  mastered: number;
  inProgress: number;
  needsPractice: number;
  unexplored: number;
  total: number;
  pct: number;
}

export interface TopicStats extends MasteryStats {
  perDomain: DomainStat[];
  totalPractice: number;
  totalExplain: number;
  /** Days since the most recent practice/explain in this topic, or `null`. */
  lastActivityDays: number | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDaysAgo(dateStr: string | null, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / ONE_DAY_MS));
}

function emptyCounts(): Record<ConceptStatus, number> {
  return { mastered: 0, in_progress: 0, needs_practice: 0, unexplored: 0 };
}

export function computeTopicStats(state: StateV1): TopicStats {
  const now = Date.now();
  const counts = emptyCounts();
  let totalConcepts = 0;
  let totalPractice = 0;
  let totalExplain = 0;
  let lastActivityDays: number | null = null;

  const perDomain: DomainStat[] = [];

  for (const domain of state.domains) {
    const dc = emptyCounts();
    for (const concept of domain.concepts) {
      counts[concept.status]++;
      dc[concept.status]++;
      totalConcepts++;
      totalPractice += concept.practice_count;
      totalExplain += concept.explain_count;

      for (const d of [
        toDaysAgo(concept.last_practiced, now),
        toDaysAgo(concept.last_explained, now),
      ]) {
        if (d !== null && (lastActivityDays === null || d < lastActivityDays)) {
          lastActivityDays = d;
        }
      }
    }

    const total = domain.concepts.length;
    perDomain.push({
      name: domain.name,
      slug: domain.slug,
      mastered: dc.mastered,
      inProgress: dc.in_progress,
      needsPractice: dc.needs_practice,
      unexplored: dc.unexplored,
      total,
      pct: total > 0 ? Math.round((dc.mastered / total) * 100) : 0,
    });
  }

  const mastered = counts.mastered;
  return {
    mastered,
    inProgress: counts.in_progress,
    needsPractice: counts.needs_practice,
    unexplored: counts.unexplored,
    totalConcepts,
    overallPct: totalConcepts > 0 ? Math.round((mastered / totalConcepts) * 100) : 0,
    perDomain,
    totalPractice,
    totalExplain,
    lastActivityDays,
  };
}
