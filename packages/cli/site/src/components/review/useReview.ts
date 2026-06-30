import { computed } from 'vue';
import {
  listAllTopics,
  loadTopic,
  getDataVersion,
  type Concept,
  type ConceptStatus,
  type TopicSummary,
} from '@/composables/useTopicData';

export type ReviewReason = 'never_practiced' | 'needs_practice' | 'low_confidence' | 'stale';

export interface ReviewItem {
  topicSlug: string;
  topicName: string;
  domainName: string;
  conceptName: string;
  conceptSlug: string;
  reason: ReviewReason;
  confidence: number;
  practiceCount: number;
  explainCount: number;
  daysSinceActivity: number;
  priority: number;
}

const STATUS_WEIGHT: Record<ConceptStatus, number> = {
  needs_practice: 1.0,
  in_progress: 0.6,
  mastered: 0.2,
  unexplored: 0.1,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const NEVER = 365;

function daysSince(dateStr: string | null, now: number): number {
  if (!dateStr) return NEVER;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return NEVER;
  return Math.max(0, Math.floor((now - d) / ONE_DAY_MS));
}

export function computeReviewPriority(
  concept: Concept,
  topic: TopicSummary,
  domainName: string,
  now: number = Date.now(),
): ReviewItem | null {
  const { explain_count, practice_count, confidence, status, last_practiced, last_explained } =
    concept;

  if (explain_count === 0 && practice_count === 0) return null;

  const lastActivity = last_practiced ?? last_explained;
  const days = daysSince(lastActivity, now);

  let reason: ReviewReason;

  if (practice_count === 0 && explain_count > 0) {
    reason = 'never_practiced';
  } else if (status === 'needs_practice') {
    reason = 'needs_practice';
  } else if (confidence < 0.5) {
    reason = 'low_confidence';
  } else if (days > 7) {
    reason = 'stale';
  } else {
    return null;
  }

  const timeScore = Math.log2(days + 2);
  const confScore = 1 - confidence;
  const totalCount = practice_count + explain_count;
  const actScore = 1 / (1 + totalCount * 0.2);

  let priority = timeScore * confScore * actScore * STATUS_WEIGHT[status];

  if (reason === 'never_practiced') {
    priority += 100;
  }

  return {
    topicSlug: topic.slug,
    topicName: topic.name,
    domainName,
    conceptName: concept.name,
    conceptSlug: concept.slug,
    reason,
    confidence,
    practiceCount: practice_count,
    explainCount: explain_count,
    daysSinceActivity: days,
    priority,
  };
}

export function useReviewItems(topN: number = 8) {
  return computed<ReviewItem[]>(() => {
    void getDataVersion();
    const topics = listAllTopics();
    const items: ReviewItem[] = [];
    const now = Date.now();

    for (const topic of topics) {
      const state = loadTopic(topic.slug);
      if (!state) continue;
      for (const domain of state.domains) {
        for (const concept of domain.concepts) {
          const item = computeReviewPriority(concept, topic, domain.name, now);
          if (item) items.push(item);
        }
      }
    }

    items.sort((a, b) => b.priority - a.priority);
    return items.slice(0, topN);
  });
}
