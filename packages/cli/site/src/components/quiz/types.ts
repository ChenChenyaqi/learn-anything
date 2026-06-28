/* Quiz schema + frontend types.
 *
 * Re-exports the CLI's learn-protocol types (single source of truth:
 * packages/cli/src/core/learn-protocol/types.ts) and defines the
 * frontend-only types shared across the quiz data/session/grading layers. */

import type { QuizQuestion } from '../../../../src/core/learn-protocol/types';

export type { QuizDeck, QuizQuestion } from '../../../../src/core/learn-protocol/types';
export type { QuestionGradeable, QuestionType } from '../../../../src/core/learn-protocol/types';

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
