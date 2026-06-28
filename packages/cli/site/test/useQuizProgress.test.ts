// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ref, computed, shallowRef } from 'vue';
import { useQuizProgress } from '@/components/quiz/useQuizProgress';
import type { ProgressSession, ProgressQueue } from '@/components/quiz/useQuizProgress';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                            */
/*  `useI18n` defaults to the 'en' locale whose templates are          */
/*    quiz.questionProgress = "Question {current} / {total}"           */
/*    quiz.groupProgress     = "Group {current} / {total}"             */
/*  so assertions are checked against those real strings.              */
/* ------------------------------------------------------------------ */

function makeSession(currentIndex = 0, total = 4): ProgressSession {
  return { currentIndex: ref(currentIndex), total };
}

function makeQueue(currentIndex = 0, totalGroups = 3, conceptName = 'Closures'): ProgressQueue {
  return {
    currentIndex: ref(currentIndex),
    totalGroups,
    currentItem: computed(() => ({ concept_name: conceptName })),
  };
}

/* ================================================================== */
/*  progressText                                                       */
/* ================================================================== */

describe('useQuizProgress — progressText', () => {
  it('formats "Question {current} / {total}" (1-indexed)', () => {
    const session = shallowRef<ProgressSession | null>(makeSession(1, 4));
    const { progressText } = useQuizProgress(session, shallowRef(null));
    expect(progressText.value).toBe('Question 2 / 4');
  });

  it('reflects the current index', () => {
    const session = shallowRef<ProgressSession | null>(makeSession(2, 5));
    const { progressText } = useQuizProgress(session, shallowRef(null));
    expect(progressText.value).toBe('Question 3 / 5');
  });

  it('starts at "Question 1 / …" on the first question', () => {
    const session = shallowRef<ProgressSession | null>(makeSession(0, 3));
    const { progressText } = useQuizProgress(session, shallowRef(null));
    expect(progressText.value).toBe('Question 1 / 3');
  });

  it('returns an empty string when there is no session', () => {
    const session = shallowRef<ProgressSession | null>(null);
    const { progressText } = useQuizProgress(session, shallowRef(null));
    expect(progressText.value).toBe('');
  });

  it('updates reactively when the index changes', () => {
    const idx = ref(0);
    const session = shallowRef<ProgressSession | null>({ currentIndex: idx, total: 4 });
    const { progressText } = useQuizProgress(session, shallowRef(null));
    expect(progressText.value).toBe('Question 1 / 4');

    idx.value = 3;
    expect(progressText.value).toBe('Question 4 / 4');
  });
});

/* ================================================================== */
/*  groupProgressText                                                  */
/* ================================================================== */

describe('useQuizProgress — groupProgressText', () => {
  it('formats "Group {current} / {total}" (1-indexed)', () => {
    const queue = shallowRef<ProgressQueue | null>(makeQueue(0, 3));
    const { groupProgressText } = useQuizProgress(shallowRef(null), queue);
    expect(groupProgressText.value).toBe('Group 1 / 3');
  });

  it('reflects the current group index', () => {
    const queue = shallowRef<ProgressQueue | null>(makeQueue(2, 5));
    const { groupProgressText } = useQuizProgress(shallowRef(null), queue);
    expect(groupProgressText.value).toBe('Group 3 / 5');
  });

  it('is empty when there is only a single group', () => {
    const queue = shallowRef<ProgressQueue | null>(makeQueue(0, 1));
    const { groupProgressText } = useQuizProgress(shallowRef(null), queue);
    expect(groupProgressText.value).toBe('');
  });

  it('is empty when there is no queue (single-deck mode)', () => {
    const { groupProgressText } = useQuizProgress(
      shallowRef(null),
      shallowRef<ProgressQueue | null>(null),
    );
    expect(groupProgressText.value).toBe('');
  });
});

/* ================================================================== */
/*  currentGroupLabel                                                  */
/* ================================================================== */

describe('useQuizProgress — currentGroupLabel', () => {
  it('returns the current group concept name', () => {
    const queue = shallowRef<ProgressQueue | null>(makeQueue(0, 3, 'Scope & Closures'));
    const { currentGroupLabel } = useQuizProgress(shallowRef(null), queue);
    expect(currentGroupLabel.value).toBe('Scope & Closures');
  });

  it('returns an empty string when there is no queue', () => {
    const { currentGroupLabel } = useQuizProgress(
      shallowRef(null),
      shallowRef<ProgressQueue | null>(null),
    );
    expect(currentGroupLabel.value).toBe('');
  });

  it('returns an empty string when the current item has no concept name', () => {
    const queue = shallowRef<ProgressQueue | null>({
      currentIndex: ref(0),
      totalGroups: 3,
      currentItem: computed(() => ({ concept_name: '' })),
    });
    const { currentGroupLabel } = useQuizProgress(shallowRef(null), queue);
    expect(currentGroupLabel.value).toBe('');
  });
});
