/* Hardcoded English copy for the quiz viewer.
 *
 * The GUI ships English-only (no i18n); this module is the single source of
 * truth for every quiz string, mirroring the CLI's `quiz.*` locale keys.
 * Templates with `{token}` placeholders are filled via `interpolate`. */

/** Replace every `{token}` in `template` with the matching `vars` value. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export const quizStrings = {
  // empty / start
  empty: 'No quizzes yet',
  start: 'Start quiz',

  // footer navigation
  previous: 'Previous',
  next: 'Next',
  submit: 'Submit',

  // results
  retry: 'Retry Quiz',
  complete: 'Quiz Complete',
  score: 'Score',
  correct: 'Correct',
  incorrect: 'Incorrect',
  referenceAnswer: 'Reference Answer',
  backToList: 'Back to list',

  // header progress (templates)
  questionProgress: 'Question {current} / {total}',

  // true/false
  true: 'True',
  false: 'False',

  // input placeholders
  typeAnswer: 'Type your answer…',
  fixError: 'Identify and fix the error…',

  // question type labels
  typeMultipleChoice: 'Multiple Choice',
  typeMultiSelect: 'Multi Select',
  typeTrueFalse: 'True / False',
  typeFillBlank: 'Fill in the Blank',
  typeErrorCorrection: 'Error Correction',

  // per-question review
  yourAnswer: 'Your answer',
  correctAnswer: 'Correct answer',
  manualEvaluation: 'Requires manual evaluation',

  // help / shortcuts popover
  helpTitle: 'Keyboard Shortcuts',
  hintChoice: 'Press A-D or 1-4 to select',
  hintMultiSelect: 'Multi-select: A-D or 1-4 to toggle',
  hintTrueFalse: 'Press 1 / 2 for True / False',
  hintNav: '← / → to switch questions',
  hintSubmit: 'Press {key} + Enter to submit', // template

  // batch / queue
  allQuizzes: 'All Quizzes',
  groupProgress: 'Group {current} / {total}', // template
  sequential: 'Practice in order',
  random: 'Practice shuffled',
  retryGroup: 'Retry this group',
  nextGroup: 'Next group',
  viewSummary: 'View all results',

  // summary
  allComplete: 'All Complete',
  totalScore: 'Total Score',

  // errors
  loadError: 'Failed to load quiz. Please try again.',
} as const;

export type QuizString = keyof typeof quizStrings;
