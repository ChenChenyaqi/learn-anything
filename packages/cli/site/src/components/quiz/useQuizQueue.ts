/* Multi-deck quiz queue: the cross-deck state machine that ties together
 * loading → playing → per-group results → aggregate summary. */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { fetchQuizDeck } from './quizApi';
import type { DeckResult, QueueItem, QuizDeck, QuizResults, QuizSummary } from './types';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useQuizQueue(
  topicSlug: string,
  items: QueueItem[],
  mode: 'sequential' | 'random',
): {
  queue: QueueItem[];
  currentIndex: Ref<number>;
  currentItem: ComputedRef<QueueItem>;
  currentDeck: Ref<QuizDeck | null>;
  completedResults: Ref<DeckResult[]>;
  phase: Ref<'loading' | 'quiz' | 'results' | 'summary' | 'error'>;
  summary: ComputedRef<QuizSummary | null>;
  totalGroups: number;
  isLastGroup: ComputedRef<boolean>;
  loadCurrent: () => Promise<void>;
  onGroupComplete: (results: QuizResults) => void;
  nextGroup: () => Promise<void>;
  retryGroup: () => void;
} {
  const queue = mode === 'sequential' ? [...items] : shuffle(items);
  const currentIndex = ref(0);
  const currentDeck = ref<QuizDeck | null>(null);
  const completedResults = ref<DeckResult[]>([]);
  const phase = ref<'loading' | 'quiz' | 'results' | 'summary' | 'error'>('loading');

  const totalGroups = queue.length;
  const currentItem = computed(() => queue[currentIndex.value]);
  const isLastGroup = computed(() => currentIndex.value >= totalGroups - 1);

  const summary = computed<QuizSummary | null>(() => {
    if (phase.value !== 'summary') return null;
    const deckResults = completedResults.value;
    let totalScore = 0;
    let totalQuestions = 0;
    for (const dr of deckResults) {
      totalScore += dr.results.score;
      totalQuestions += dr.results.total;
    }
    return {
      totalScore,
      totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
      deckResults,
    };
  });

  async function loadCurrent(): Promise<void> {
    phase.value = 'loading';
    try {
      currentDeck.value = await fetchQuizDeck(topicSlug, queue[currentIndex.value].path);
      phase.value = 'quiz';
    } catch {
      currentDeck.value = null;
      phase.value = 'error';
    }
  }

  function onGroupComplete(results: QuizResults): void {
    const item = queue[currentIndex.value];
    completedResults.value = [
      ...completedResults.value,
      {
        concept_name: item.concept_name,
        concept_slug: item.concept_slug,
        filename: item.filename,
        results,
      },
    ];
    phase.value = 'results';
  }

  async function nextGroup(): Promise<void> {
    currentIndex.value++;
    if (currentIndex.value >= totalGroups) {
      phase.value = 'summary';
    } else {
      await loadCurrent();
    }
  }

  function retryGroup(): void {
    phase.value = 'quiz';
  }

  return {
    queue,
    currentIndex,
    currentItem,
    currentDeck,
    completedResults,
    phase,
    summary,
    totalGroups,
    isLastGroup,
    loadCurrent,
    onGroupComplete,
    nextGroup,
    retryGroup,
  };
}
