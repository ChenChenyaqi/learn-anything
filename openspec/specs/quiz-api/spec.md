## ADDED Requirements

### Requirement: List quiz files for a topic

The server SHALL expose an API endpoint that returns all quiz deck files under a topic's `quizzes/` directory, grouped by concept slug.

#### Scenario: Topic has quiz files

- **WHEN** a GET request is made to `/api/quizzes?topic=javascript`
- **THEN** the response is JSON `{ groups: [{ concept_slug, concept_name, files: [{ filename, path }] }] }`
- **AND** files within each group are sorted by filename descending (newest first)
- **AND** groups are sorted alphabetically by concept name

#### Scenario: Topic has no quizzes directory

- **WHEN** a GET request is made to `/api/quizzes?topic=javascript`
- **AND** the `quizzes/` directory does not exist under the topic
- **THEN** the response is JSON `{ groups: [] }` with status 200

#### Scenario: Topic does not exist

- **WHEN** a GET request is made to `/api/quizzes?topic=nonexistent`
- **THEN** the response is JSON `{ error: "Topic not found" }` with status 404

### Requirement: Fetch quiz deck content

The server SHALL expose an API endpoint that returns the full content of a single quiz deck JSON file.

#### Scenario: Fetch a valid quiz deck

- **WHEN** a GET request is made to `/api/quizzes/javascript/closures/closures-quiz-2026-06-24-103000.json`
- **THEN** the response is the full `QuizDeck` JSON object with status 200
- **AND** the Content-Type header is `application/json; charset=utf-8`

#### Scenario: Quiz file not found

- **WHEN** a GET request is made to `/api/quizzes/javascript/closures/nonexistent.json`
- **THEN** the response is JSON `{ error: "Quiz not found" }` with status 404

#### Scenario: Path traversal attempt

- **WHEN** a GET request is made to `/api/quizzes/javascript/../../secret.json`
- **THEN** the response has status 403
