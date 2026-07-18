## ADDED Requirements

### Requirement: Quiz tab in topic sidebar

The sidebar on topic pages SHALL include a "Quizzes" tab alongside the existing "Topics" and "Exercises" tabs, visible only when the sidebar context is `topic`.

#### Scenario: User is on a topic page

- **WHEN** the sidebar context is `topic`
- **THEN** three tabs are displayed: Topics, Exercises, Quizzes
- **AND** the Quizzes tab label is "Quizzes" (English locale) or "测验" (Chinese locale)

#### Scenario: User is on the dashboard

- **WHEN** the sidebar context is `dashboard`
- **THEN** no tabs are displayed (quiz tab is not applicable)

#### Scenario: User switches to Quizzes tab

- **WHEN** user clicks the "Quizzes" tab
- **THEN** the Quizzes tab is visually active (brand color underline)
- **AND** the Topics and Exercises tabs become inactive
- **AND** the quiz tree component is rendered in the sidebar content area

### Requirement: Quiz file listing in sidebar

The Quizzes tab SHALL display all quiz JSON files for the current topic as a physical file tree mirroring the `quizzes/` directory structure, with directory-level and top-level batch play buttons.

#### Scenario: Topic has quiz files

- **WHEN** the Quizzes tab is active
- **AND** the topic has quiz files under `quizzes/`
- **THEN** quiz files are displayed as a recursive file tree mirroring the `quizzes/` directory structure
- **AND** each directory node shows the folder name (no icon) and is expandable
- **AND** each file entry shows the raw filename in monospace font
- **AND** clicking a file entry selects that quiz and opens the quiz modal
- **AND** each directory row has sequential/random batch buttons on the right
- **AND** the top-level header row has sequential/random buttons for all quizzes

#### Scenario: Topic has nested quiz directories

- **WHEN** the `quizzes/` directory contains nested subdirectories (e.g., `quizzes/js/es6/promise/`)
- **THEN** the tree renders all nesting levels recursively
- **AND** intermediate directory nodes are expandable

#### Scenario: Topic has no quiz files

- **WHEN** the Quizzes tab is active
- **AND** the topic has no quiz files
- **THEN** a message "No quizzes yet" (English) or "暂无测验" (Chinese) is displayed

#### Scenario: User clicks a quiz file entry

- **WHEN** user clicks a quiz file entry
- **THEN** the Quiz modal opens, loading that quiz deck
- **AND** the first question is displayed

#### Scenario: User clicks directory-level batch button

- **WHEN** user clicks the sequential or random button on a directory node
- **THEN** all quiz files under that directory (recursively) are queued
- **AND** the quiz session starts in the selected mode

#### Scenario: User clicks top-level batch button

- **WHEN** user clicks the sequential or random button in the header row
- **THEN** all quiz files for the current topic are queued
- **AND** the quiz session starts in the selected mode

### Requirement: i18n keys for quiz UI

The i18n composable SHALL support quiz-related translation keys in both English and Chinese locales.

#### Scenario: English locale

- **WHEN** the locale is `en`
- **THEN** `t('sidebar.quizzes')` returns "Quizzes"
- **AND** `t('quiz.empty')` returns "No quizzes yet"

#### Scenario: Chinese locale

- **WHEN** the locale is `zh-CN`
- **THEN** `t('sidebar.quizzes')` returns "测验"
- **AND** `t('quiz.empty')` returns "暂无测验"
