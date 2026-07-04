## Why

The right panel currently has no real agent. `chat_create_topic` (the only "agent" command) performs a single structured `extract` call and writes a topic to disk — there is no agentic loop, no tool use, no command execution, and no multi-turn conversation. Users want an opencode-style agent in the right panel: an entry point that can read/write files, run shell commands, and autonomously drive a multi-turn tool loop inside the working folder. The `rig-core` library already in the workspace fully supports this (custom `Tool` trait + streamed multi-turn agent loop) — we just never wired it up.

## What Changes

- Add a `tools` module to `learn-agent` implementing custom rig `Tool`s, all scope-locked to the working folder: `ReadFile`, `WriteFile`, `EditFile`, `ListDir`, `Grep`, `Glob`, `RunCommand`.
- Add an `agent` module to `learn-agent` exposing `AgentSession`: a rig agent with the toolset attached, a chat history, and a `send(msg)` streaming driver that emits a unified `AgentEvent` stream (`TextDelta`, `ToolCall`, `ToolResult`, `Done`, `Error`).
- Add a `sessions` module to `learn-agent` persisting chat history as JSONL under `<working_folder>/.learn/sessions/<id>.jsonl`, with `new`/`load`/`list`/`append` operations.
- **BREAKING**: Replace `chat_create_topic` (and the `agent:done` / `agent:error` events) with a session-based agent command set: `agent_new_session`, `agent_send`, `agent_cancel`, `agent_list_sessions`, `agent_load_session`. The structured topic-generation flow is removed in favor of the agent generating topic files via its own tool use.
- Frontend: replace `ChatDialog.vue` with `AgentChat.vue` — an opencode-style right panel with a streaming transcript, tool-call cards (notebook-margin style), inline slash-command menu (`/new`, `/sessions`), `/new` inline confirm, an inline Sessions overlay with client-side search, and a Stop button. Add supporting components `SlashMenu.vue`, `ToolCallCard.vue`, `SessionsPanel.vue`, the `useAgentSession` composable, and `slash-commands.ts` / `time.ts` libraries.

## Capabilities

### New Capabilities

- `agent-tools`: rig `Tool` implementations (read/write/edit/list/grep/glob/run-command) scoped to the working folder, including path-escape validation and command execution with timeout.
- `agent-session`: the multi-turn rig agent loop driver — `AgentSession` with chat history, streaming `AgentEvent` stream, and `multi_turn` depth bound to prevent `MaxDepthError`.
- `agent-sessions-storage`: JSONL session persistence under `.learn/sessions/` with new/load/list/append, plus session metadata (title, message/tool-call counts, timestamps).
- `agent-tauri-commands`: the Tauri command surface replacing `chat_create_topic` — `agent_new_session` / `agent_send` / `agent_cancel` / `agent_list_sessions` / `agent_load_session`, backed by in-memory session table with cancellation tokens.
- `agent-chat-ui`: the right-panel Vue UI — streaming transcript, notebook-margin tool-call cards, slash-command menu (`/new`, `/sessions` with inline confirm), inline Sessions overlay with search, Stop button.

### Modified Capabilities

<!-- None — `chat_create_topic` was never spec'd; no existing spec is being modified. -->

## Impact

- **Rust crates**:
  - `packages/learn-agent` — add `tools.rs`, `agent.rs`, `sessions.rs` modules; export new types from `lib.rs`; bump deps if needed (rig tooling is already in `rig-core 0.39`). Workspace deps (`tokio`, `futures`, `anyhow`, `serde`, `serde_json`) already cover needs; add `glob` crate for `Glob` tool.
  - `packages/gui/src-tauri/src` — rewrite `agent.rs` (remove `chat_create_topic` + `TopicCreated`); add session state holder (`Mutex<HashMap<SessionId, AgentSessionHandle>>` in `tauri::State`); update `lib.rs` command registration and `commands.ts` mirror.
- **Frontend (`packages/gui/src`)**:
  - new: `components/AgentChat.vue`, `components/SlashMenu.vue`, `components/ToolCallCard.vue`, `components/SessionsPanel.vue`, `composables/useAgentSession.ts`, `lib/slash-commands.ts`, `lib/time.ts`.
  - modified: `lib/commands.ts` (replace `chatCreateTopic`/`TopicCreated` with agent command wrappers + `AgentEvent`/`ChatMessage`/`SessionMeta` types), `lib/ui.ts` (`slashPill`, `toolCard` helpers), `App.vue` (import `AgentChat` instead of `ChatDialog`).
  - removed: `components/ChatDialog.vue` (replaced by `AgentChat.vue`).
- **Tauri events**: remove `agent:done` / `agent:error`; add `agent:event` carrying `{ session_id, event }`.
- **Filesystem layout**: new `<working_folder>/.learn/sessions/<id>.jsonl` path; existing `.learn/topics/` unchanged (agent may write there via `WriteFile`).
- **Tests**: unit tests in `learn-agent` for tool path-escape guards, tool execution, session JSONL round-trip; vitest for `slash-commands.matchInput` and `relativeTime`.
- **Dependencies**: add `glob` (Rust) to `learn-agent/Cargo.toml`; no new JS deps.
