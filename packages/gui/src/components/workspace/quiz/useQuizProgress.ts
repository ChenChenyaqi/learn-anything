/* useQuizProgress — quiz header progress-text formatting.
 *
 * Owns the three progress strings shown in the QuizViewer header:
 *   - progressText       "Question 2 / 4"
 *   - groupProgressText  "Group 1 / 3"  (queue mode, > 1 group)
 *   - currentGroupLabel  current group's concept name
 *
 * Uses the hardcoded English copy in strings.ts (no i18n). */

import { computed, type ComputedRef, type Ref } from 'vue';
import { quizStrings, interpolate } from './strings';

/* Minimal structural input types — only the fields the progress logic reads,
 * keeping the composable decoupled from the full session/queue contracts. */

export interface ProgressSession {
  currentIndex: Ref<number>;
  total: number;
}

export interface ProgressQueue {
  currentIndex: Ref<number>;
  totalGroups: number;
  currentItem: ComputedRef<{ concept_name: string } | undefined | null>;
}

export function useQuizProgress(
  session: Ref<ProgressSession | null>,
  queue: Ref<ProgressQueue | null>,
): {
  progressText: ComputedRef<string>;
  groupProgressText: ComputedRef<string>;
  currentGroupLabel: ComputedRef<string>;
} {
  const progressText = computed(() => {
    const s = session.value;
    if (!s) return '';
    return interpolate(quizStrings.questionProgress, {
      current: s.currentIndex.value + 1,
      total: s.total,
    });
  });

  const groupProgressText = computed(() => {
    const q = queue.value;
    if (!q || q.totalGroups <= 1) return '';
    return interpolate(quizStrings.groupProgress, {
      current: q.currentIndex.value + 1,
      total: q.totalGroups,
    });
  });

  const currentGroupLabel = computed(() => {
    const q = queue.value;
    if (!q) return '';
    return q.currentItem.value?.concept_name ?? '';
  });

  return { progressText, groupProgressText, currentGroupLabel };
}
