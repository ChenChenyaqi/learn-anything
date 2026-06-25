/* ================================================================== */
/*  useQuiz — Quiz data layer, session management, and grading         */
/*                                                                     */
/*  Provides:                                                          */
/*  - Re-exports the CLI's QuizDeck / QuizQuestion types (single source */
/*    of truth: packages/cli/src/core/learn-protocol/types.ts)         */
/*  - fetchQuizList / fetchQuizDeck data access                        */
/*  - useQuizSession for in-modal state (navigation + answers)         */
/*  - gradeQuestion / computeResults for auto-grading                  */
/* ================================================================== */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { QuizDeck, QuizQuestion } from '../../../src/core/learn-protocol/types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/*  Quiz schema types re-exported from CLI learn-protocol (3.1)       */
/*  Frontend-only types defined below.                                */
/* ------------------------------------------------------------------ */

export type { QuizDeck, QuizQuestion } from '../../../src/core/learn-protocol/types';
export type { QuestionGradeable, QuestionType } from '../../../src/core/learn-protocol/types';

export interface QuizFile {
  filename: string;
  path: string;
}

export interface QuizGroup {
  concept_slug: string;
  concept_name: string;
  files: QuizFile[];
}

export interface QuizListResponse {
  groups: QuizGroup[];
}

export type QuizAnswer = string | boolean | null;
export type QuizAnswers = Record<string, QuizAnswer>;

export interface QuestionResult {
  question: QuizQuestion;
  userAnswer: QuizAnswer;
  /** `true` = correct, `false` = incorrect, `null` = ungradable (ai_only). */
  correct: boolean | null;
}

export interface QuizResults {
  score: number;
  total: number;
  percentage: number;
  results: QuestionResult[];
}

/* ------------------------------------------------------------------ */
/*  Data access (3.2, 3.3)                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch quiz file listings for a topic, grouped by concept.
 * Returns reactive state and auto-fetches on creation.
 */
export function fetchQuizList(topicSlug: string): {
  groups: Ref<QuizGroup[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
} {
  const groups = ref<QuizGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function reload(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(`/api/quizzes?topic=${encodeURIComponent(topicSlug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: QuizListResponse = await resp.json();
      groups.value = data.groups ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      groups.value = [];
    } finally {
      loading.value = false;
    }
  }

  reload();

  return { groups, loading, error, reload };
}

/**
 * Fetch a single quiz deck JSON file.
 * `filename` may include a concept-slug subdirectory, e.g. `closures/quiz-2026-06-24.json`.
 */
export async function fetchQuizDeck(topicSlug: string, filename: string): Promise<QuizDeck> {
  const resp = await fetch(`/api/quizzes/${encodeURIComponent(topicSlug)}/${filename}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/* ------------------------------------------------------------------ */
/*  Grading (3.5, 3.6)                                                */
/* ------------------------------------------------------------------ */

/**
 * Grade a single question against the user's answer.
 *
 * - `exact`    → strict string/boolean comparison against `question.answer`.
 * - `accepted` → case-insensitive match against `accepted_answers[]`
 *                (falls back to canonical `answer`).
 * - `ai_only`  → returns `null` (not auto-gradable).
 *
 * Returns `false` when the user hasn't answered.
 */
export function gradeQuestion(question: QuizQuestion, userAnswer: QuizAnswer): boolean | null {
  if (question.gradeable === 'ai_only') return null;

  if (userAnswer === null || userAnswer === undefined || userAnswer === '') return false;

  if (question.gradeable === 'exact') {
    return userAnswer === question.answer;
  }

  // accepted: case-insensitive match
  const normalized = String(userAnswer).trim().toLowerCase();
  const candidates = [
    String(question.answer).trim().toLowerCase(),
    ...(question.accepted_answers ?? []).map((a) => String(a).trim().toLowerCase()),
  ];
  return candidates.includes(normalized);
}

/**
 * Grade all questions in a deck and return aggregate results.
 * `ai_only` questions are excluded from `score` and `total`.
 */
export function computeResults(quizDeck: QuizDeck, answers: QuizAnswers): QuizResults {
  const results: QuestionResult[] = [];
  let score = 0;
  let total = 0;

  for (const question of quizDeck.questions) {
    const userAnswer = answers[question.id] ?? null;
    const correct = gradeQuestion(question, userAnswer);

    if (correct === null) {
      results.push({ question, userAnswer, correct: null });
    } else {
      total++;
      if (correct) score++;
      results.push({ question, userAnswer, correct });
    }
  }

  return {
    score,
    total,
    percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    results,
  };
}

/* ------------------------------------------------------------------ */
/*  Session management (3.4)                                          */
/* ------------------------------------------------------------------ */

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
