## 1. Backend API (`serve.mjs`)

- [ ] 1.1 Add `GET /api/quizzes?topic=<slug>` endpoint that scans `.learn/topics/<slug>/quizzes/` directory and returns `{ groups: [{ concept_slug, concept_name, files: [{ filename, path }] }] }`
- [ ] 1.2 Add `GET /api/quizzes/<topic>/<filename>` endpoint that reads and returns a single quiz JSON file, with path traversal protection
- [ ] 1.3 Handle edge cases: missing `quizzes/` directory (return empty groups), missing topic (404), invalid paths (403)

## 2. i18n Keys

- [ ] 2.1 Add `quiz.*` and `sidebar.quizzes` i18n keys to `useI18n.ts` for both English and Chinese locales (Quizzes/测验, No quizzes yet/暂无测验, Start quiz/开始测验, Previous/上一题, Next/下一题, Submit/提交, Retry Quiz/重新测验, Quiz Complete/测验完成, Score/得分, Correct/正确, Incorrect/错误, Reference Answer/参考答案, Back to list/返回列表)

## 3. Data Layer (`useQuiz.ts` composable)

- [ ] 3.1 Define TypeScript types matching `QuizDeck`, `QuizQuestion`, `QuestionType`, `QuestionGradeable` for the frontend
- [ ] 3.2 Implement `fetchQuizList(topicSlug)` composable that calls `/api/quizzes?topic=<slug>` and returns reactive grouped quiz list
- [ ] 3.3 Implement `fetchQuizDeck(topicSlug, filename)` composable that calls `/api/quizzes/<topic>/<filename>` and returns the `QuizDeck`
- [ ] 3.4 Implement `useQuizSession(quizDeck)` composable: manages `currentIndex`, `answers` map (question ID → user answer), `isComplete` state, navigation methods (`goNext`, `goPrev`), `submitAll()` trigger
- [ ] 3.5 Implement `gradeQuestion(question, userAnswer)` function: `exact` → strict string/boolean comparison; `accepted` → case-insensitive match against `accepted_answers[]`; `ai_only` → returns null (ungradable)
- [ ] 3.6 Implement `computeResults(quizDeck, answers)` that grades all questions and returns `{ score, total, results[] }` excluding `ai_only` from scoring

## 4. Sidebar Quiz Tab & Tree

- [ ] 4.1 Extend `AppSidebar.vue` `tabMode` type to include `'quizzes'` and add the third tab button
- [ ] 4.2 Create `SidebarQuizTree.vue` component: fetches quiz list via `fetchQuizList`, renders concept groups with play icons (▶), handles empty state, emits `quiz-selected` event
- [ ] 4.3 Wire `SidebarQuizTree` into `AppSidebar.vue` template, emit events up to `App.vue`

## 5. Quiz Card Component (`QuizCard.vue`)

- [ ] 5.1 Create `QuizCard.vue` with props `question: QuizQuestion` and `modelValue: string | boolean | null`
- [ ] 5.2 Render multiple choice: radio inputs from `question.options[]`, bind to `modelValue`
- [ ] 5.3 Render true/false: two toggle-style buttons for True/False
- [ ] 5.4 Render fill-in-blank: single-line text input with placeholder
- [ ] 5.5 Render error correction: multi-line textarea with placeholder
- [ ] 5.6 Add keyboard shortcuts: A/B/C/D or 1-4 for multiple choice (emit on keydown)

## 6. Quiz Modal (`QuizModal.vue`)

- [ ] 6.1 Create `QuizModal.vue` with `open` prop and `close` event, `<Teleport to="body">`, backdrop with blur, body scroll lock, Escape-to-close (follow `SearchModal.vue` pattern)
- [ ] 6.2 Accept `quizDeck` prop; on open, initialize `useQuizSession` and show first question
- [ ] 6.3 Render header bar: "Back to list" button (left), question progress indicator "Question X / Y" (right)
- [ ] 6.4 Render `<QuizCard>` for current question with `v-model` bound to session answers
- [ ] 6.5 Render navigation footer: "Previous" button (disabled on first question), "Next" / "Submit" button (shows "Submit" on last question)
- [ ] 6.6 Implement `<Transition>` with CSS translateX/scale/rotateY animation for card slide (forwards: left-exit/right-enter; backwards: right-exit/left-enter), respect `prefers-reduced-motion`
- [ ] 6.7 Add Arrow Left/Right keyboard navigation for the modal

## 7. Quiz Results Component (`QuizResults.vue`)

- [ ] 7.1 Create `QuizResults.vue` with props `results: QuizResults` (computed from `useQuizSession`)
- [ ] 7.2 Render large score indicator: "X / Y" + percentage, styled with brand colors
- [ ] 7.3 Render per-question result rows: prompt text, user answer vs correct answer, ✓/✗ icon, explanation
- [ ] 7.4 For `ai_only` questions: show "Reference Answer" label with `question.answer`, no ✓/✗
- [ ] 7.5 Add "Retry Quiz" button (clears answers, resets to question 1) and close handler

## 8. Integration & Wiring

- [ ] 8.1 In `App.vue`, wire `quiz-selected` event from sidebar → open `QuizModal` with the selected quiz deck
- [ ] 8.2 Close modal on Escape or backdrop click, restore body scroll
- [ ] 8.3 Verify dark mode: all new components use CSS custom properties from design tokens
- [ ] 8.4 Test with sample quiz JSON files (create test fixtures) for all four question types
- [ ] 8.5 Verify keyboard navigation and reduced-motion behavior
