/* Reactive quiz session state for a single deck: current question index,
 * answer map, completion, navigation direction, and lazy graded results. */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { computeResults } from './grading';
import type { QuizAnswer, QuizAnswers, QuizDeck, QuizQuestion, QuizResults } from './types';

/**
 * Reactive quiz session state for use inside the quiz modal.
 *
 * Tracks the current question index, user answers, completion state,
 * and navigation direction (for animation). Answers are preserved
 * when navigating back and forth.
 */
export function useQuizSession(quizDeck: QuizDeck): {
  currentIndex: Ref<number>;
  answers: Ref<QuizAnswers>;
  isComplete: Ref<boolean>;
  direction: Ref<'forward' | 'backward'>;
  total: number;
  currentQuestion: ComputedRef<QuizQuestion>;
  isLast: ComputedRef<boolean>;
  isFirst: ComputedRef<boolean>;
  results: ComputedRef<QuizResults | null>;
  setAnswer: (questionId: string, answer: QuizAnswer) => void;
  getAnswer: (questionId: string) => QuizAnswer;
  goNext: () => void;
  goPrev: () => void;
  submitAll: () => void;
  reset: () => void;
} {
  const currentIndex = ref(0);
  const answers = ref<QuizAnswers>({});
  const isComplete = ref(false);
  const direction = ref<'forward' | 'backward'>('forward');

  const total = quizDeck.questions.length;
  const currentQuestion = computed(() => quizDeck.questions[currentIndex.value]);
  const isFirst = computed(() => currentIndex.value === 0);
  const isLast = computed(() => currentIndex.value === total - 1);
  const results = computed(() =>
    isComplete.value ? computeResults(quizDeck, answers.value) : null,
  );

  function setAnswer(questionId: string, answer: QuizAnswer): void {
    answers.value = { ...answers.value, [questionId]: answer };
  }

  function getAnswer(questionId: string): QuizAnswer {
    return answers.value[questionId] ?? null;
  }

  function goNext(): void {
    if (currentIndex.value < total - 1) {
      direction.value = 'forward';
      currentIndex.value++;
    }
  }

  function goPrev(): void {
    if (currentIndex.value > 0) {
      direction.value = 'backward';
      currentIndex.value--;
    }
  }

  function submitAll(): void {
    isComplete.value = true;
  }

  function reset(): void {
    currentIndex.value = 0;
    answers.value = {};
    isComplete.value = false;
    direction.value = 'forward';
  }

  return {
    currentIndex,
    answers,
    isComplete,
    direction,
    total,
    currentQuestion,
    isFirst,
    isLast,
    results,
    setAnswer,
    getAnswer,
    goNext,
    goPrev,
    submitAll,
    reset,
  };
}
