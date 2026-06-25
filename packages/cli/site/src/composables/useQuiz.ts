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

export interface QueueItem {
  concept_slug: string;
  concept_name: string;
  filename: string;
  path: string;
}

export interface DeckResult {
  concept_name: string;
  concept_slug: string;
  filename: string;
  results: QuizResults;
}

export interface QuizSummary {
  totalScore: number;
  totalQuestions: number;
  percentage: number;
  deckResults: DeckResult[];
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
  const safeFilename = filename.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`/api/quizzes/${encodeURIComponent(topicSlug)}/${safeFilename}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/* ------------------------------------------------------------------ */
/*  Queue management                                                    */
/* ------------------------------------------------------------------ */

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
