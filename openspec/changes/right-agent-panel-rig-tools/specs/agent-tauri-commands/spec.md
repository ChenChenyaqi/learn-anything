## ADDED Requirements

### Requirement: Removal of chat_create_topic

The `chat_create_topic` Tauri command, the `TopicCreated` struct, and the `agent:done` / `agent:error` events SHALL be removed. Their replacement is the session-based agent command set described below.

#### Scenario: After migration no legacy commands remain

- **WHEN** `lib.rs` invokes its registered commands
- **THEN** the registered list contains no `chat_create_topic` and the `agent:done` / `agent:error` event names appear nowhere in the source

### Requirement: agent_new_session command

A Tauri command `agent_new_session(app, working_folder?: string) -> { session_id: string }` SHALL create an `AgentSession`, register it in an in-memory session table held in `tauri::State`, create (or reuse) the `.learn/sessions/` directory, and return the new session id. When `working_folder` is omitted, the resolved value SHALL come from appData config's `last_working_folder` and the command SHALL fail if no working folder is configured. If the session table already contains a session for which no run is in flight, creating a new session SHALL leave the old one intact and addressable by id.

#### Scenario: New session with an explicit working folder

- **WHEN** the frontend calls `agent_new_session` with a valid working folder
- **THEN** the command returns a `{ session_id }` whose value matches the JSONL file name created under `.learn/sessions/`

#### Scenario: New session when no working folder is set

- **WHEN** the frontend calls `agent_new_session` with no argument and no `last_working_folder` is configured
- **THEN** the command returns an `Err` describing that no working folder is configured

### Requirement: agent_send command and streaming events

A Tauri command `agent_send(app, session_id: string, text: string) -> ()` SHALL append the user row to the session JSONL, spawn the agent run detached, and return immediately. During the run the command SHALL emit `agent:event` events on `AppHandle` with payload `{ session_id, event }` where `event` is one of `TextDelta`, `ToolCall`, `ToolResult`, `Done`, `Error`. Events for a given `session_id` SHALL be emitted only while that session's run is in flight.

#### Scenario: Send triggers a text-only run

- **WHEN** `agent_send` is called with a normal prompt and the model responds with text and no tool calls
- **THEN** the command emits one or more `TextDelta` events followed by one `Done` event, all carrying the same `session_id`

#### Scenario: Send triggers a tool-using run

- **WHEN** the model calls a tool during the run
- **THEN** the command emits the sequence `ToolCall` → `ToolResult` (with the tool's status and result) → `TextDelta`/`Done`, and the session JSONL gains an assistant row whose `blocks` reflect the calls

### Requirement: agent_cancel command

A Tauri command `agent_cancel(session_id: string) -> ()` SHALL signal cancellation to the in-flight run for that session. When no run is in flight, it SHALL be a no-op. When a run is in flight, the next event the run emits SHALL be `Error { message: "cancelled" }` and no further events for that run SHALL be emitted.

#### Scenario: Cancel a running session

- **WHEN** `agent_cancel` is invoked during an in-flight run
- **THEN** the run emits `Error { message: "cancelled" }` and the session table marks the session as not busy

#### Scenario: Cancel when idle

- **WHEN** `agent_cancel` is invoked but no run is in flight for the session
- **THEN** the command returns `Ok(())` and no events are emitted

### Requirement: agent_list_sessions command

A Tauri command `agent_list_sessions(working_folder?: string) -> Vec<SessionMeta>` SHALL return the list of persisted sessions for the resolved working folder sorted by `created_at` descending. When `working_folder` is omitted, the value SHALL fall back to `last_working_folder`; when neither is set, the command SHALL return an empty vector (rather than erroring).

#### Scenario: List after multiple sessions

- **WHEN** the working folder contains three session JSONL files
- **THEN** the command returns three `SessionMeta` values ordered newest-first

#### Scenario: List with no working folder

- **WHEN** no working folder is configured and none is passed
- **THEN** the command returns an empty vector

### Requirement: agent_load_session command

A Tauri command `agent_load_session(session_id: string, working_folder?: string) -> Vec<ChatRow>` SHALL return the persisted chat rows for the given session id, in submission order, without re-executing any tools. Malformed trailing rows SHALL be skipped silently.

#### Scenario: Restore an existing session

- **WHEN** the frontend calls `agent_load_session` with an id present in the working folder's `.learn/sessions/`
- **THEN** the command returns the session's full chat row history in order

#### Scenario: Load a non-existent session id

- **WHEN** the requested id has no JSONL file in the resolved working folder
- **THEN** the command returns an `Err` stating the session was not found

### Requirement: Event payload discriminated union

The Tauri `agent:event` payload SHALL be a JSON object with a `type` discriminator and per-variant fields, mirrored as a TypeScript discriminated union on the frontend. The variants SHALL be `TextDelta { delta }`, `ToolCall { id, name, args }`, `ToolResult { id, name, status, result }`, `Done`, and `Error { message }`.

#### Scenario: Frontend exhaustiveness check

- **WHEN** a new variant is added to the union and the frontend switch is not yet updated
- **THEN** TypeScript reports the unhandled variant at compile time
