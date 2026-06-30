import { computed } from 'vue';
import {
  listAllTopics,
  loadTopic,
  scanDomainDirs,
  scanSessions,
  scanRootSessions,
  scanExercises,
  scanRootExercises,
  getDataVersion,
} from '@/composables/useTopicData';
import type { ConceptStatus } from '@/composables/topicDataTypes';

export interface MasteryStats {
  totalConcepts: number;
  mastered: number;
  inProgress: number;
  needsPractice: number;
  unexplored: number;
  overallPct: number;
}

export interface DashboardStats extends MasteryStats {
  topicCount: number;
  domainCount: number;
  totalPractice: number;
  totalExplain: number;
  noteCount: number;
  exerciseCount: number;
  /** Days since the most recent practice/explain, or `null` when there is none. */
  lastActivityDays: number | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toDaysAgo(dateStr: string | null, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / ONE_DAY_MS));
}

export function useDashboardStats() {
  return computed<DashboardStats>(() => {
    void getDataVersion();
    const topics = listAllTopics();
    const now = Date.now();

    const counts: Record<ConceptStatus, number> = {
      mastered: 0,
      in_progress: 0,
      needs_practice: 0,
      unexplored: 0,
    };

    let totalConcepts = 0;
    let totalPractice = 0;
    let totalExplain = 0;
    let domainCount = 0;
    let noteCount = 0;
    let exerciseCount = 0;
    let lastActivityDays: number | null = null;

    for (const topic of topics) {
      domainCount += topic.domainCount;

      for (const dir of scanDomainDirs(topic.slug)) {
        noteCount += scanSessions(topic.slug, dir).length;
      }
      noteCount += scanRootSessions(topic.slug).length;

      for (const group of scanExercises(topic.slug)) {
        exerciseCount += group.files.length;
      }
      exerciseCount += scanRootExercises(topic.slug).length;

      const state = loadTopic(topic.slug);
      if (!state) continue;
      for (const domain of state.domains) {
        for (const concept of domain.concepts) {
          totalConcepts++;
          counts[concept.status]++;
          totalPractice += concept.practice_count;
          totalExplain += concept.explain_count;

          const practiced = toDaysAgo(concept.last_practiced, now);
          const explained = toDaysAgo(concept.last_explained, now);
          for (const d of [practiced, explained]) {
            if (d !== null && (lastActivityDays === null || d < lastActivityDays)) {
              lastActivityDays = d;
            }
          }
        }
      }
    }

    const mastered = counts.mastered;
    const overallPct = totalConcepts > 0 ? Math.round((mastered / totalConcepts) * 100) : 0;

    return {
      topicCount: topics.length,
      domainCount,
      totalConcepts,
      mastered,
      inProgress: counts.in_progress,
      needsPractice: counts.needs_practice,
      unexplored: counts.unexplored,
      overallPct,
      totalPractice,
      totalExplain,
      noteCount,
      exerciseCount,
      lastActivityDays,
    };
  });
}
