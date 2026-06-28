/* ================================================================== */
/*  useQuizProgress — quiz modal progress-text formatting              */
/*                                                                     */
/*  Owns the three progress strings shown in the QuizModal header:     */
/*   - progressText       "Question 2 / 4"                             */
/*   - groupProgressText  "Group 1 / 3"  (queue mode, > 1 group)       */
/*   - currentGroupLabel  current group's concept name                 */
/*                                                                     */
/*  Extracted from QuizModal.vue to remove the repeated                */
/*  `t(...).replace('{current}', …).replace('{total}', …)` pattern.    */
/* ================================================================== */

import { computed, type ComputedRef, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

/* ------------------------------------------------------------------ */
/*  Minimal structural input types                                     */
/*  (only the fields the progress logic reads — keeps the composable  */
/*   decoupled from the full session/queue contracts and easy to stub) */
/* ------------------------------------------------------------------ */

export interface ProgressSession {
  currentIndex: Ref<number>;
  total: number;
}

export interface ProgressQueue {
  currentIndex: Ref<number>;
  totalGroups: number;
  currentItem: ComputedRef<{ concept_name: string } | undefined | null>;
}

/* ------------------------------------------------------------------ */
/*  i18n interpolation helper                                          */
/* ------------------------------------------------------------------ */

/** Replace every `{token}` in `template` with the matching `vars` value. */
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/* ------------------------------------------------------------------ */
/*  Composable                                                         */
/* ------------------------------------------------------------------ */

export function useQuizProgress(
  session: Ref<ProgressSession | null>,
  queue: Ref<ProgressQueue | null>,
): {
  progressText: ComputedRef<string>;
  groupProgressText: ComputedRef<string>;
  currentGroupLabel: ComputedRef<string>;
} {
  const { t } = useI18n();

  const progressText = computed(() => {
    const s = session.value;
    if (!s) return '';
    return interpolate(t('quiz.questionProgress'), {
      current: s.currentIndex.value + 1,
      total: s.total,
    });
  });

  const groupProgressText = computed(() => {
    const q = queue.value;
    if (!q || q.totalGroups <= 1) return '';
    return interpolate(t('quiz.groupProgress'), {
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
