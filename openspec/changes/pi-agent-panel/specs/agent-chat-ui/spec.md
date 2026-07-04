## ADDED Requirements

### Requirement: AgentChat renders the right agent panel

A new `AgentChat.vue` component SHALL render the right agent panel. It SHALL compose the `useAgentSession` composable for all state (no per-component event wiring) and expose a header row, a transcript area, a slash-command popover, and a send/stop input row.

#### Scenario: Single mount site

- **WHEN** the parent view renders the right panel
- **THEN** it imports `AgentChat` from `components/AgentChat.vue` and passes the working-folder id from app config as a prop

### Requirement: Streaming transcript rendering

The transcript SHALL show user messages and assistant turns built block-by-block as events arrive. `TextDelta` events SHALL accumulate into the in-progress assistant message; `ToolCall` and `ToolResult` events SHALL append `ToolCallCard.vue` blocks to the in-progress assistant message. On `Done` the in-progress message SHALL be sealed; on `Error` an error block SHALL be appended and `busy` SHALL be cleared.

#### Scenario: Append text deltas to the in-progress assistant message

- **WHEN** a `TextDelta` event arrives during a run
- **THEN** the in-progress assistant message grows by the `delta` text without flushing to a new message

#### Scenario: Render a tool call then its result

- **WHEN** a `ToolCall` event arrives followed by a `ToolResult` event
- **THEN** a `ToolCallCard` is appended to the in-progress assistant message whose status updates from `running` to the result's `status`, and the args/result are rendered per the card's own spec

### Requirement: Notebook-margin tool-call card

`ToolCallCard.vue` SHALL render with a 2px left border in `--color-accent` and left padding of 12px, with the tool name in mono font. A running tool SHALL show a pulsing vermilion indicator dot; an `ok` result SHALL switch the indicator to `--color-mastered`; an `error` result SHALL switch to `--color-brand-1`. The card SHALL be collapsed while the tool is running and SHALL become expandable via a `<details>` element once `status !== "running"`. The expanded body SHALL show the args as pretty JSON on a `--color-code-bg` background and the result text (truncated to 12 visible lines with scroll beyond).

#### Scenario: Running tool card is collapsed and pulses

- **WHEN** a tool is in `running` state
- **THEN** the card displays its name and the pulsing vermilion indicator and is not clickable to expand

#### Scenario: Completed tool card is expandable

- **WHEN** a tool reaches `ok` or `error` state
- **THEN** the card becomes a clickable `<details>` and expanding it reveals the args JSON and result text

### Requirement: Slash-command menu trigger

The slash menu (`SlashMenu.vue`) SHALL appear only when the first character of the input textarea is `/`; typing `/` elsewhere SHALL NOT trigger it. While open, ↑ and ↓ SHALL move the highlight, Enter SHALL execute the highlighted command (or the only match), Esc SHALL close the menu, and these keys SHALL NOT propagate to the textarea. Selecting a command SHALL execute it and clear the input.

#### Scenario: Triggering on a leading slash

- **WHEN** the user types `/` as the first character of an otherwise empty textarea
- **THEN** the `SlashMenu` appears listing all commands

#### Scenario: Filter by continuing typing

- **WHEN** the user has typed `/se` at the start of the input
- **THEN** the menu shows only commands whose `name` starts with `se`

#### Scenario: Mid-string `/` does not trigger

- **WHEN** the user types `hello /world` (the `/` is not the first character)
- **THEN** the menu does not appear

### Requirement: /new command with inline confirm

The `/new` command SHALL start a fresh session. When the current session has no messages, it SHALL execute immediately. When the current session has at least one message, the command SHALL raise an inline confirmation prompt rendered above the textarea as a single-line chip: "Start a fresh session? Current chat will be saved to history." with `confirm` and `cancel` controls. `confirm` SHALL create the new session; `cancel` SHALL dismiss the prompt.

#### Scenario: Immediate new on an empty transcript

- **WHEN** the user runs `/new` while `messages.length === 0`
- **THEN** a new session is created without prompting

#### Scenario: Confirm guard on a non-empty transcript

- **WHEN** the user runs `/new` while `messages.length > 0`
- **THEN** the inline confirm chip appears and no new session is created until the user confirms

### Requirement: /sessions inline overlay

The `/sessions` command SHALL open `SessionsPanel.vue` as an inline overlay that replaces the transcript area within the panel (no backdrop scrim). The panel SHALL provide a `← back` control that restores the transcript, a search input, and a list of `SessionMeta` rows. Selecting a row SHALL load that session's chat rows into the transcript and close the overlay.

#### Scenario: Open the sessions overlay

- **WHEN** the user runs `/sessions`
- **THEN** the transcript area is replaced by `SessionsPanel` with a `← back` control visible

#### Scenario: Restore a session from the overlay

- **WHEN** the user selects a row in `SessionsPanel`
- **THEN** the transcript is populated with that session's rows, the overlay closes, and the active session id switches to the selected row's id

### Requirement: SessionsPanel search

The sessions overlay SHALL include a search input that filters the listed sessions by case-insensitive substring match on the session `title`. When the query matches no sessions, the panel SHALL show an empty state message.

#### Scenario: Filter by title substring

- **WHEN** the user types `hello` into the search input and one session's title contains `Hello`
- **THEN** only that session row is shown

#### Scenario: No matches

- **WHEN** the search query matches no session titles
- **THEN** the panel shows an empty-state message and no rows

### Requirement: SessionsPanel row metadata

Each row SHALL display the session `title` (medium weight, ink color) on the first line and a metadata second line in pencil color at xs size of the form `<message_count> msgs · <relative_time>` (relative time formatted via the shared `relativeTime` helper). Tool-call counts are NOT shown — the metadata is intentionally simplified.

#### Scenario: Row for a three-message session

- **WHEN** a session row has `message_count = 3` and a recent timestamp
- **THEN** the metadata line reads `3 msgs · 2h ago`

### Requirement: Send/stop control

The input row SHALL show a single toggling primary button labeled `Send` when not busy and `Stop` when busy. `Send` SHALL be disabled when the input is empty or whitespace-only. `Stop` SHALL invoke `agentCancel`. Pressing Enter (without Shift) while not busy SHALL send; Shift+Enter SHALL insert a newline.

#### Scenario: Send a normal message

- **WHEN** the user types a non-slash sentence and presses Enter
- **THEN** the text is sent via `agentSend`, the input clears, and `busy` becomes true

#### Scenario: Stop a running request

- **WHEN** the user clicks `Stop` while busy
- **THEN** `agentCancel` is invoked and the button reverts to `Send` once cancellation resolves

### Requirement: Empty-state prompt

When `messages.length === 0` and no session is loading, the transcript area SHALL show a centered empty-state prompt mentioning the slash menu and inviting a plain question: "Type `/` for commands, or just ask."

#### Scenario: First-run empty state

- **WHEN** the panel mounts with an empty transcript
- **THEN** the empty-state prompt is visible

### Requirement: AgentEvent discriminated union

The frontend SHALL model `AgentEvent` as a TypeScript discriminated union with `type` tag in `snake_case`, mirroring the Rust serde convention, with exactly these variants: `text_delta { delta }`, `tool_call { id, name, args }`, `tool_result { id, name, status, result }`, `done`, and `error { message }`. No other event shapes SHALL be rendered.

#### Scenario: Unknown event variants are ignored

- **WHEN** the `agent:event` listener receives a payload whose `type` is not one of the five known variants
- **THEN** the composable ignores the event without throwing

### Requirement: Composable-driven state ownership

`useAgentSession` SHALL be the single source of truth for the right panel's agent state. It owns `sessionId`, `messages`, `busy`, `pendingConfirm`, `sessionsOpen`, `sessions`, `sessionsQuery`, and exposes methods `boot(workingFolder)`, `send(text)`, `cancel()`, `newSession()`, and `restore(id)`. No component SHALL subscribe to `agent:event` directly.

#### Scenario: All UI components read from the composable

- **WHEN** a child component needs the current transcript or busy state
- **THEN** it reads a ref produced by `useAgentSession` (passed in as a prop or via provide/inject), never via a direct `listen('agent:event', …)` call
