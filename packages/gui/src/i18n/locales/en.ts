/* English messages — the source of truth for the message schema.
 *
 * Every locale file must keep the exact same key structure; `MessageSchema`
 * (derived from this object) is fed to `createI18n`'s generics so `t()` keys
 * are compile-time checked, and `zh-CN.ts` annotates itself against the same
 * type so a missing/extra key fails `vue-tsc`.
 *
 * Keys are organized by feature domain: `common.*` (cross-page strings),
 * `app.*`, `setup.*`, `header.*`, `main.*`, `overview.*`, `workspace.*`,
 * `quiz.*`, `chat.*`. Values use vue-i18n message syntax: `{name}` named
 * interpolation, `@` / `|` / `{` are special and must be escaped if a
 * translation ever needs them literally. */

const en = {
  common: {
    loading: 'Loading…',
    retry: 'Retry',
    back: 'Back',
    save: 'Save',
    saving: 'Saving…',
    fileNotFound: 'File not found.',
  },
  setup: {
    language: 'Language',
    languageSystem: 'Follow system',
  },
  quiz: {
    // footer navigation
    previous: 'Previous',
    next: 'Next',
    submit: 'Submit',

    // results
    retry: 'Retry Quiz',
    complete: 'Quiz Complete',
    correct: 'Correct',
    referenceAnswer: 'Reference Answer',
    backToList: 'Back to list',

    // header progress (named-interpolation templates)
    questionProgress: 'Question {current} / {total}',
    groupProgress: 'Group {current} / {total}',

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
    helpShortcuts: 'Keyboard shortcuts',
    hintChoice: 'Press A-D or 1-4 to select',
    hintMultiSelect: 'Multi-select: A-D or 1-4 to toggle',
    hintTrueFalse: 'Press 1 / 2 for True / False',
    hintNav: '← / → to switch questions',
    hintSubmit: 'Press {key} + Enter to submit',

    // batch / queue
    allQuizzes: 'All Quizzes',
    retryGroup: 'Retry this group',
    nextGroup: 'Next group',
    viewSummary: 'View all results',

    // summary
    allComplete: 'All Complete',

    // errors
    loadError: 'Failed to load quiz. Please try again.',
  },
};

/** The master shape every locale file must match (widened to `string`). */
export type MessageSchema = typeof en;

export default en;
