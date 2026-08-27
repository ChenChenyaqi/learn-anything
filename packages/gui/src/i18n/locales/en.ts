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
    optional: '(optional)',
    fileNotFound: 'File not found.',
  },
  app: {
    starting: 'Starting…',
  },
  overview: {
    title: 'Your learning',
    newTopic: 'New topic',
    subtitle: '{topics} topics · {concepts} concepts · {mastered} mastered · overall {percentage}%',
    loadError: "Couldn't load topics:",
    emptyHint: 'No topics yet. Ask the agent to {cmd} something new.',
    pickHint: 'Pick a topic to open its workspace, or ask the agent to {cmd} something new.',
    statMastered: '{mastered}/{total} mastered · {percentage}%',
    statNotStarted: '{mastered}/{total} mastered · not started',
  },
  workspace: {
    knowledgeMap: 'knowledge map',
    overallSummary:
      '{mastered} mastered · {inProgress} in progress · {needsPractice} needs practice · {unexplored} unexplored',
    status: {
      mastered: 'mastered',
      inProgress: 'in progress',
      needsPractice: 'needs practice',
      unexplored: 'unexplored',
    },
    confidence: 'conf {value}',
    practiceCount: '{count}×practice',
    explainCount: '{count}×explain',
    loadError: "Couldn't load this topic:",
    backToTopics: 'Back to topics',
    topicNotFound: 'Topic not found.',
    tab: {
      learn: 'Learn',
      practice: 'Practice',
      review: 'Review',
    },
    playAllSequential: 'Play all sequentially',
    playAllShuffled: 'Play all shuffled',
    playSequential: 'Play sequentially',
    playShuffled: 'Play shuffled',
    noFiles: 'No files yet.',
  },
  header: {
    settings: 'Settings',
    chooseFolder: 'Choose folder',
    change: 'Change',
    noFolder: 'no folder selected',
  },
  main: {
    pickFolderHint: 'Pick a working folder to start creating topics.',
    openFolderError: "Couldn't open that folder:",
    chooseDifferentFolder: 'Choose a different folder',
  },
  setup: {
    subtitle: 'Set up your provider to get started.',
    provider: 'Provider',
    providerOpenai: 'OpenAI-compatible',
    providerAnthropic: 'Anthropic',
    modelId: 'Model id',
    modelPlaceholder: 'e.g. gpt-4o',
    baseUrl: 'Base URL',
    apiKey: 'API key',
    // Interpolated with the masked key preview when a key is already stored.
    keyKept: 'kept as {preview} — leave blank to keep',
    errorModelEmpty: 'Model id must not be empty.',
    errorKeyMissing: 'Enter an API key first.',
    language: 'Language',
    languageSystem: 'Follow system',
  },
  chat: {
    placeholder: 'Ask anything…',
    inputHint: 'Type {slash} for commands, or just ask.',
    stop: 'Stop',
    send: 'Send',
    result: 'result',
    sessions: 'Sessions',
    back: 'back',
    searchPlaceholder: 'Search sessions…',
    emptySessions: 'No sessions yet — back and type {cmd} to start.',
    msgCount: '{count} msgs',
    cmd: {
      new: 'Start a fresh session',
      sessions: 'Browse past sessions',
      'learn-topic': 'Initialize or load a learning topic',
      'learn-explain': 'Deep-dive into a concept',
      'learn-practice': 'Hands-on coding practice',
      'learn-quiz': 'Quick text Q&A quiz',
      'learn-review': 'Review learning progress',
      'learn-status': 'Visualize learning state',
    },
  },
  time: {
    justNow: 'just now',
    minAgo: '{n}m ago',
    hourAgo: '{n}h ago',
    dayAgo: '{n}d ago',
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
