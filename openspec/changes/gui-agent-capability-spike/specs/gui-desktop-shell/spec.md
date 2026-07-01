## ADDED Requirements

### Requirement: Native cross-platform application launch

The system SHALL ship as a Tauri v2 native binary that launches on macOS, Windows, and Linux using the operating system's webview, with no bundled Node or Chromium runtime.

#### Scenario: Application starts without a Node runtime

- **WHEN** the user launches the installed application on a machine that has no Node.js installed
- **THEN** the application window opens and the Vue 3 page renders

#### Scenario: Cross-platform binary

- **WHEN** the project is built for macOS, Windows, and Linux
- **THEN** each target produces a standalone native binary that does not depend on an external Node process

### Requirement: Single-window chat application shell

The system SHALL present a single application window hosting a minimal Vue 3 page whose primary surface is one chat dialog. No dashboard, sidebar trees, search, or quiz UI SHALL be present in Phase 1.

#### Scenario: Initial window content

- **WHEN** the application launches
- **THEN** the window shows the chat dialog as the sole primary surface

### Requirement: System theme following

The system SHALL follow the operating system's light/dark theme by default.

#### Scenario: Theme matches the OS

- **WHEN** the operating system is in dark mode and the application launches
- **THEN** the application renders in a dark theme

### Requirement: Working-folder selection

The system SHALL let the user choose a working folder via a native Tauri file dialog and SHALL persist the chosen directory so it is remembered across launches. Phase 1 stores only the single last-chosen directory.

#### Scenario: User picks a working folder

- **WHEN** the user opens the folder picker and selects a directory
- **THEN** the selected directory becomes the active working folder and is persisted to application data

#### Scenario: Last folder is remembered

- **WHEN** the user relaunches the application after previously choosing a folder
- **THEN** the previously chosen folder is the active working folder without prompting

### Requirement: API-key setup screen

The system SHALL show an API-key setup screen when no API key is configured. The setup screen SHALL capture provider, optional base URL, model id, and the secret key, and SHALL delegate key storage to the keychain capability (never storing the key in plaintext).

#### Scenario: Setup shown when no key exists

- **WHEN** the application launches and no API key is stored
- **THEN** the setup screen is shown before the chat dialog is usable

#### Scenario: Key is not persisted in plaintext

- **WHEN** the user saves an API key on the setup screen
- **THEN** the key is stored via the OS keychain and is not written to any plaintext file

### Requirement: Streamed agent output rendering

The system SHALL render agent token deltas in the chat dialog in real time as they arrive, and SHALL display the generated knowledge map when the agent completes.

#### Scenario: Streaming text appears live

- **WHEN** the agent emits incremental token deltas during a request
- **THEN** those deltas are appended to the chat dialog as they arrive

#### Scenario: Final knowledge map is displayed

- **WHEN** the agent completes a topic-generation request
- **THEN** the chat dialog renders the generated knowledge map
