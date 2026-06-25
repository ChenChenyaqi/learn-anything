## Why

The `/learn:quiz` CLI workflow generates quiz decks as JSON files under `.learn/topics/<topic>/quizzes/`, enabling spaced-repetition and self-assessment. However, the web dashboard has no quiz interface—users can only practice quizzes through the CLI chat. Adding a card-based quiz UI in the dashboard lets users revisit and re-practice saved quiz decks at any time, directly in the browser.

## What Changes

- **New Quiz tab in sidebar**: A third tab "Quizzes" is added alongside the existing "Topics" / "Exercises" tabs, visible on topic pages only.
- **Quiz file listing**: The new tab shows all quiz JSON files under the current topic's `quizzes/` directory, grouped by concept. Each file entry has a play icon to launch the quiz.
- **Quiz practice modal**: A full-screen modal with card-based navigation for answering questions (multiple choice, true/false, fill-in-blank, error correction), animated card transitions, and auto-grading on submission.
- **Results summary screen**: After completing all questions, a results view shows score, per-question correct/incorrect marking, and reference answers for subjective questions.
- **New i18n keys**: English and Chinese labels for the quiz-related UI text.
- **New API endpoints** in `serve.mjs`: `GET /api/quizzes?topic=<slug>` and `GET /api/quizzes/<topic>/<filename>` to serve quiz file listings and content.

## Capabilities

### New Capabilities

- `quiz-sidebar-tab`: Sidebar tab navigation extended with a "Quizzes" section that lists available quiz decks grouped by concept for the current topic.
- `quiz-card-practice`: Modal-based card UI for answering quiz questions with type-aware form rendering, animated card transitions, and immediate auto-grading.
- `quiz-results-summary`: Post-quiz results view showing overall score, per-question correct/incorrect status, and reference answers for ungradable questions.
- `quiz-api`: Backend API endpoints to expose quiz file listings and content to the frontend.

### Modified Capabilities

<!-- No existing spec-level requirements are being changed. -->

## Impact

- **Affected source files** (site package):
  - `packages/cli/site/serve.mjs` — new `/api/quizzes` endpoints
  - `packages/cli/site/src/components/AppSidebar.vue` — add Quiz tab + sidebar tree
  - `packages/cli/site/src/composables/useI18n.ts` — new quiz i18n keys
- **New files** (site package):
  - `packages/cli/site/src/components/sidebar/SidebarQuizTree.vue`
  - `packages/cli/site/src/components/QuizModal.vue`
  - `packages/cli/site/src/components/QuizCard.vue`
  - `packages/cli/site/src/components/QuizResults.vue`
  - `packages/cli/site/src/composables/useQuiz.ts`
- **CLI package**: No changes — quiz JSON schema (`QuizDeck`, `QuizQuestion`) is already defined in `packages/cli/src/core/learn-protocol/types.ts`.
- **Dependencies**: No new external dependencies required.
