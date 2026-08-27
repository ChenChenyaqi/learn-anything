/* Quiz schema + frontend types (GUI self-contained copy — no cross-package import).
 *
 * Inlined from the CLI's learn-protocol types (`QuizDeck` / `QuizQuestion` /
 * `QuestionGradeable` / `QuestionType`) plus the site frontend-only types, so
 * the GUI does not depend on the CLI package. */

// ------------------------------------------------------------------
//  Persisted schema (quiz.json v1) — mirrors learn-protocol/types.ts
// ------------------------------------------------------------------

export type QuestionGradeable = 'exact' | 'accepted' | 'ai_only';

/** Supported quiz question types — text-answer only (coding is handled by /learn:practice). */
export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'true_false'
  | 'fill_in_blank'
  | 'error_correction';

/** A single question in a persisted quiz deck (quiz.json v1). */
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  gradeable: QuestionGradeable;
  prompt: string;
  explanation: string;
  /** multiple_choice / multi_select only. */
  options?: string[];
  /** Canonical/reference answer. multiple_choice: correct option text. multi_select: correct option texts (string[]). true_false: true|false. Otherwise: reference text. */
  answer: string | boolean | string[];
  /** fill_in_blank only: accepted alternative phrasings for best-effort auto-grading. */
  accepted_answers?: string[];
}

/** A persisted, reusable quiz deck for one concept (quiz.json v1). */
export interface QuizDeck {
  version: 1;
  topic: string;
  topic_slug: string;
  concept_slug: string;
  concept_name: string;
  created: string; // YYYY-MM-DD HH:mm:ss
  questions: QuizQuestion[];
}

// ------------------------------------------------------------------
//  Frontend-only types (session / grading / queue)
// ------------------------------------------------------------------

export type QuizAnswer = string | boolean | string[] | null;
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
