## ADDED Requirements

### Requirement: Results display after quiz completion

After all questions are submitted, the system SHALL display a results summary screen replacing the question card view.

#### Scenario: Quiz completed

- **WHEN** the user submits the final question
- **THEN** the card view transitions to a results summary
- **AND** the results show a large score indicator (e.g., "7 / 8")
- **AND** the results show a percentage (e.g., "87.5%")

### Requirement: Per-question grading display

The results summary SHALL show each question's grading outcome with the user's answer, correct answer, and explanation.

#### Scenario: Exact-match question graded correctly

- **WHEN** a `multiple_choice` question's user answer matches `question.answer` exactly
- **THEN** the question row shows a green checkmark and "Correct"
- **AND** the explanation text from `question.explanation` is displayed

#### Scenario: Exact-match question graded incorrectly

- **WHEN** a `multiple_choice` question's user answer does not match `question.answer`
- **THEN** the question row shows a red X and "Incorrect"
- **AND** the correct answer is displayed
- **AND** the explanation text from `question.explanation` is displayed

#### Scenario: Accepted-match question graded correctly

- **WHEN** a `fill_in_blank` question's user answer matches any entry in `question.accepted_answers[]` (case-insensitive)
- **THEN** the question is marked as correct

#### Scenario: AI-only question

- **WHEN** a question has `gradeable: "ai_only"`
- **THEN** the question is not scored (does not count toward total)
- **AND** the reference answer from `question.answer` is displayed as "Reference Answer"
- **AND** the question row indicates it requires manual or AI evaluation

### Requirement: Ungraded question handling

Questions with `gradeable: "ai_only"` SHALL be excluded from the score calculation.

#### Scenario: Quiz with mixed gradeable types

- **WHEN** a quiz has 5 exact questions and 2 ai_only questions
- **AND** user got 4 of 5 exact questions correct
- **THEN** the score shows "4 / 5" (not "4 / 7")
- **AND** the percentage is 80%

### Requirement: Retry quiz

The results summary SHALL provide a way to retry the same quiz.

#### Scenario: User clicks retry

- **WHEN** user clicks "Retry Quiz" button on the results screen
- **THEN** all answers are cleared
- **AND** the modal returns to the first question

### Requirement: Back to quiz list

The results summary SHALL provide a way to dismiss the modal and return to the sidebar quiz list.

#### Scenario: User clicks close/back

- **WHEN** user closes the modal (Escape, backdrop click, or back button)
- **THEN** the modal closes
- **AND** the sidebar remains on the Quizzes tab
