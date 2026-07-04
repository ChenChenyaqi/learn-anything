## ADDED Requirements

### Requirement: Tauri command surface for agent sessions

The Rust backend SHALL expose exactly five Tauri commands that proxy to the agent sidecar: `agent_new_session(working_folder: Option<String>) -> { session_id: String }`, `agent_send(session_id: String, text: String) -> ()`, `agent_cancel(session_id: String) -> ()`, `agent_list_sessions(working_folder: Option<String>) -> Vec<SessionMeta>`, and `agent_load_session(session_id: String, working_folder: Option<String>) -> Vec<ChatRow>`. No other agent-facing commands SHALL exist on the Rust backend.

#### Scenario: All five commands are registered

- **WHEN** the Tauri builder assembles its invoke handler
- **THEN** exactly `agent_new_session`, `agent_send`, `agent_cancel`, `agent_list_sessions`, `agent_load_session` are registered alongside the unchanged `save_key`/`load_key`/`has_key`/`delete_key`/`get_config`/`set_config`/`pick_project_dir`/`open_project`/`create_project` commands

#### Scenario: Working folder resolves from argument then config

- **WHEN** any of the five commands is called with `working_folder: None`
- **THEN** the command reads `config.last_working_folder`; if that is also unset the command returns an empty list (`agent_list_sessions`) or a human-readable error (the others)

### Requirement: Removed Tauri commands and events

The `chat_create_topic` Tauri command, the `TopicCreated` struct, and the `agent:done` / `agent:error` events SHALL NOT exist in the source tree. The `test_key` Tauri command, the `TestKeyParams` struct, and any frontend callers of `testKey` SHALL NOT exist. The `commands.rs` module that hosted `test_key` SHALL NOT exist.

#### Scenario: Removed identifiers are gone

- **WHEN** the codebase is searched for `chat_create_topic`, `TopicCreated`, `test_key`, `TestKeyParams`, `EVENT_DONE`, `EVENT_ERROR`
- **THEN** zero source-tree matches exist outside the test fixtures (if any)

### Requirement: Single agent event channel

The Rust backend SHALL emit exactly one Tauri event, `agent:event`, with payload `{ session_id: String, event: AgentEvent }`. Events for a given `session_id` SHALL be emitted only while that session's run is in flight. The `agent:done` and `agent:error` events SHALL NOT be emitted.

#### Scenario: Event payload always carries a session id

- **WHEN** any `agent:event` payload is sampled during a run
- **THEN** its `session_id` matches the session that `agent_send` was called with, and its `event` is one of the five `AgentEvent` variants

### Requirement: AgentEvent payload contract

The `AgentEvent` payload SHALL be a JSON object with a `type` discriminator and per-variant fields, mirrored as a TypeScript discriminated union on the frontend. The variants SHALL be exactly `text_delta { delta }`, `tool_call { id, name, args }`, `tool_result { id, name, status, result }`, `done`, and `error { message }`. The `status` field of `tool_result` SHALL be either `"ok"` or `"error"`.

#### Scenario: Five variants cover every emitted event

- **WHEN** the agent sidecar emits an event over stdout
- **THEN** the Rust backend forwards it as `agent:event` with `event.type` ∈ {`text_delta`, `tool_call`, `tool_result`, `done`, `error`}

### Requirement: SessionMeta shape

`SessionMeta` returned by `agent_list_sessions` SHALL contain exactly `{ id: String, title: String, created_at: String, updated_at: String, message_count: u64 }`. The `tool_call_count` field that appeared in the retired `right-agent-panel-rig-tools` spec SHALL NOT be present (the frontend metadata was simplified to `<n> msgs · <Xh ago>`).

#### Scenario: Listing returns the simplified meta shape

- **WHEN** `agent_list_sessions` is called on a working folder with at least one persisted session
- **THEN** every returned `SessionMeta` has the five fields above and no `tool_call_count` field

### Requirement: ChatRow shape for restored sessions

`agent_load_session` SHALL return `Vec<ChatRow>` where each `ChatRow` is either `{ role: "user", text: String }` or `{ role: "assistant", blocks: Vec<ChatBlock> }`, and each `ChatBlock` is either `{ type: "text", text: String }` or `{ type: "tool_call", id: String, name: String, args: serde_json::Value, status: String, result: Option<String> }`. Rows SHALL be in submission order. A malformed trailing JSONL line SHALL be skipped rather than aborting the load.

#### Scenario: Restore returns rows in order

- **WHEN** `agent_load_session` is called for a session that recorded a user message, an assistant text + tool_call, and a second user message
- **THEN** the returned `Vec<ChatRow>` has three rows in that exact order, and the assistant row's `blocks` contains the text and tool-call blocks

### Requirement: Sidecar subprocess lifecycle owned by the Rust backend

The Rust backend SHALL own the Node sidecar subprocess: it starts the process once at app boot (or lazily on the first `agent_new_session`), holds its `ChildStdin`/`ChildStdout` handles in `tauri::State`, forwards `agent:event` events from stdout to the frontend, and writes user messages + cancel signals to stdin. The frontend SHALL NOT spawn or address the sidecar directly.

#### Scenario: Sidecar stdout drives `agent:event`

- **WHEN** the sidecar writes a `AgentEvent` JSONL line to its stdout
- **THEN** the Rust backend parses it, pairs it with the active `session_id`, and emits an `agent:event` Tauri event carrying `{ session_id, event }`

#### Scenario: Sidecar stdin receives user messages

- **WHEN** `agent_send(session_id, text)` is invoked from the frontend
- **THEN** the Rust backend writes a JSON-encoded user-message frame to the sidecar's stdin (never to argv or a temp file), and returns immediately so the IPC is not blocked for the duration of the run

### Requirement: Cancellation forwards to the sidecar

`agent_cancel(session_id)` SHALL write a cancel frame to the sidecar's stdin. The sidecar SHALL invoke the pi `session.abort()` (or `AgentSessionRuntime` equivalent) on the matching session; the next event the frontend receives for that `session_id` SHALL be `error { message: "cancelled" }`, and `busy` SHALL be cleared.

#### Scenario: Cancel ends the run with a cancelled error

- **WHEN** the user clicks `Stop` while a run is in flight
- **THEN** the next `agent:event` for that session is `{ type: "error", message: "cancelled" }` and no further events arrive for that run

### Requirement: Backend-agnostic command contract

The five Tauri commands SHALL describe a backend-agnostic contract. They SHALL NOT name `rig`, `LocalModelClient`, `ModelClient`, `CancellationToken`, or any specific agent library in their doc strings or type signatures; the concrete backend (the pi Node sidecar) is realized in the `agent-pi-sidecar` capability. The command signatures reference only `session_id: String`, `working_folder: Option<String>`, `text: String`, `SessionMeta`, and `ChatRow`.

#### Scenario: Command signatures are decoupled from the agent backend

- **WHEN** the source of `packages/gui/src-tauri/src/` is searched for the identifiers `rig`, `LocalModelClient`, `ModelClient`, `CancellationToken`
- **THEN** zero matches exist

### Requirement: Inlined Provider enum in config

The `Provider` enum (variants `OpenAi`, `Anthropic`; serialized as lowercase `"openai"` / `"anthropic"`; default `OpenAi`) SHALL live in `packages/gui/src-tauri/src/config.rs` and SHALL NOT depend on any external crate. `AppConfig.provider` SHALL serialize and deserialize bit-identically to the pre-change shape so existing app-data config files continue to load.

#### Scenario: Config file from the rig era still loads

- **WHEN** an app-data `config.json` written before this change is loaded
- **THEN** it deserializes into `AppConfig` with the same `provider` / `model` / `base_url` / `last_working_folder` values
