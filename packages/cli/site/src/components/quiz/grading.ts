/* Quiz auto-grading (pure functions — no Vue, no I/O). Prime unit-test target. */

import type {
  QuizAnswer,
  QuizAnswers,
  QuizDeck,
  QuestionResult,
  QuizQuestion,
  QuizResults,
} from './types';

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
