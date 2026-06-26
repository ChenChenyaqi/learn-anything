## ADDED Requirements

### Requirement: Quiz modal container

The system SHALL display quiz questions in a full-screen modal dialog with backdrop blur and body scroll lock.

#### Scenario: Modal opens with a quiz deck

- **WHEN** a quiz file is launched from the sidebar
- **THEN** a modal dialog appears, teleported to `<body>`
- **AND** the modal has a semi-transparent backdrop with blur
- **AND** body scroll is locked while the modal is open
- **AND** the first question is displayed as a card

#### Scenario: Modal is dismissed

- **WHEN** user presses Escape or clicks the backdrop
- **THEN** the modal closes
- **AND** body scroll is restored
- **AND** any current quiz session state is discarded

#### Scenario: Modal respects reduced motion

- **WHEN** the user's system has `prefers-reduced-motion: reduce`
- **THEN** card transition animations are disabled (instant cuts)

### Requirement: Type-aware question rendering

Each quiz card SHALL render the appropriate input controls based on the question type.

#### Scenario: Multiple choice question

- **WHEN** the current question has type `multiple_choice`
- **THEN** all options from `question.options[]` are rendered as radio buttons
- **AND** only one option can be selected at a time
- **AND** pressing A/B/C/D or 1-4 keys selects the corresponding option

#### Scenario: True/false question

- **WHEN** the current question has type `true_false`
- **THEN** two clearly labeled buttons are shown: "True" and "False"
- **AND** only one can be selected at a time

#### Scenario: Fill-in-the-blank question

- **WHEN** the current question has type `fill_in_blank`
- **THEN** a text input field is rendered for typed answers
- **AND** the input has a placeholder like "Type your answer..."

#### Scenario: Error correction question

- **WHEN** the current question has type `error_correction`
- **THEN** a larger textarea input is rendered for longer typed answers
- **AND** the textarea has a placeholder like "Identify and fix the error..."

### Requirement: Card navigation

The system SHALL support navigating between questions with animated card transitions.

#### Scenario: Navigate to next question

- **WHEN** user clicks "Next" button or presses Right Arrow / Enter
- **THEN** the current card animates out to the left
- **AND** the next question card animates in from the right
- **AND** the progress indicator updates (e.g., "Question 3 / 8")

#### Scenario: Navigate to previous question

- **WHEN** user clicks "Previous" button or presses Left Arrow
- **THEN** the current card animates out to the right
- **AND** the previous question card animates in from the left qu
- **AND** previously entered answers are preserved

#### Scenario: Last question submitted

- **WHEN** user clicks "Submit" on the final question
- **THEN** the quiz transitions to the results summary view

### Requirement: Answer persistence during session

Previously entered answers SHALL be preserved when navigating back to earlier questions.

#### Scenario: Return to a previously answered question

- **WHEN** user navigates from question 3 back to question 1
- **THEN** question 1 displays the user's previously selected/entered answer
- **AND** the user can modify the answer

### Requirement: Keyboard shortcuts

The system SHALL support keyboard navigation within the quiz modal.

#### Scenario: Keyboard navigation

- **WHEN** the quiz modal is open
- **THEN** Left Arrow navigates to the previous question
- **AND** Right Arrow navigates to the next question
- **AND** Enter submits the answer and advances (on the last question, shows results)
- **AND** Escape closes the modal
- **AND** A/B/C/D keys select multiple choice options (when applicable)

### Requirement: Transition animation

Card transitions SHALL use smooth CSS animations with a physical card-sliding metaphor.

#### Scenario: Forward navigation animation

- **WHEN** user advances to the next question
- **THEN** the outgoing card translates left with slight rotation (rotateY ~5deg) and scale down (0.97)
- **AND** the incoming card translates from the right
- **AND** the animation duration is 300ms with cubic-bezier(0.16, 1, 0.3, 1) easing

#### Scenario: Backward navigation animation

- **WHEN** user goes back to the previous question
- **THEN** the outgoing card translates right
- **AND** the incoming card translates from the left
