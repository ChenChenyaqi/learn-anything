## ADDED Requirements

### Requirement: Node sidecar as the agent backend

The agent backend SHALL run as a Node child process launched by the Tauri Rust backend via the `externalBin` / sidecar mechanism. The sidecar SHALL import `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`, drive an `agentLoop` (via `createAgentSession` + `AgentSessionRuntime`), and own the agent lifecycle (sessions, tool execution, slash commands). The Rust backend SHALL own the sidecar's stdin/stdout handles and forward events to the frontend over `agent:event` (see `agent-tauri-commands`).

#### Scenario: Sidecar is launched by Tauri, not by the frontend

- **WHEN** the Tauri app boots and the first `agent_new_session` is invoked
- **THEN** the Rust backend spawns the bundled Node sidecar binary (or reuses the already-spawned one) and no `import 'node:child_process'` or `execa` call is made from the frontend

### Requirement: Sidecar receives BYOK config over stdin

The Rust backend SHALL send the user's API key, provider, `base_url`, model, working folder, and (for an existing session) `session_id` to the sidecar as the **first JSON frame on stdin** at session start. The API key SHALL NOT be passed through `argv` (which leakes via `ps`), environment variables, or any file. The sidecar SHALL inject the key into `AuthStorage.setRuntimeApiKey(provider, key)` so the key lives only in sidecar process memory and is never written to disk.

#### Scenario: Key never crosses argv

- **WHEN** the sidecar process is inspected via `ps -ef` or equivalent during a session
- **THEN** no argument on the sidecar's command line contains the API key

#### Scenario: Key is not persisted by the sidecar

- **WHEN** the sidecar exits and the host filesystem is inspected
- **THEN** no new file under `~/.pi/`, the OS keychain, or the working folder contains the API key written by the sidecar

### Requirement: AgentEvent adaptation from pi to the frontend contract

The sidecar SHALL adapt pi's native `AgentSessionEvent` stream into the five-variant `AgentEvent` JSONL contract on stdout: `text_delta { delta }`, `tool_call { id, name, args }`, `tool_result { id, name, status, result }`, `done`, `error { message }`. pi's real event structure differs from the naive top-level mapping: `text_delta` and `toolcall_end` are nested inside `message_update.assistantMessageEvent`; tool results arrive via the top-level `tool_execution_end` event (there is no pi `tool_result` event); and the `done`/`error` `AssistantMessageEvent` variants are swallowed by the agent loop — the agent layer surfaces `agent_end` (→ `done`) and `message_end` with `message.stopReason` (→ `error`). Each agent event JSONL line on stdout SHALL carry a `session_id` field and an `event` field. The Rust backend forwards the adapted event as `agent:event` (see `agent-tauri-commands`).

#### Scenario: pi message_update with text_delta becomes AgentEvent text_delta

- **WHEN** the pi session emits a `message_update` event whose nested `assistantMessageEvent.type === "text_delta"`
- **THEN** the sidecar writes `{"session_id":"<id>","event":{"type":"text_delta","delta":"<delta>"}}` to stdout

#### Scenario: pi message_update with toolcall_end becomes AgentEvent tool_call

- **WHEN** the pi session emits a `message_update` event whose nested `assistantMessageEvent.type === "toolcall_end"`
- **THEN** the sidecar writes `{"session_id":"<id>","event":{"type":"tool_call","id":"<toolCall.id>","name":"<toolCall.name>","args":<toolCall.arguments>}}` to stdout

#### Scenario: pi tool_execution_end becomes AgentEvent tool_result

- **WHEN** the pi session emits a `tool_execution_end` event carrying `{ toolCallId, toolName, result, isError }`
- **THEN** the sidecar derives `status` from `isError` (`"error"` when true, `"ok"` when false), stringifies `result.content` text blocks into `result`, and writes `{"session_id":"<id>","event":{"type":"tool_result","id":"<toolCallId>","name":"<toolName>","status":"<status>","result":<string|null>}}` to stdout

#### Scenario: pi agent_end becomes AgentEvent done

- **WHEN** the pi session emits an `agent_end` event (the agent loop's terminal event)
- **THEN** the sidecar writes `{"session_id":"<id>","event":{"type":"done"}}` to stdout and closes the run frame

#### Scenario: pi message_end with error stopReason becomes AgentEvent error

- **WHEN** the pi session emits a `message_end` event whose `message.role === "assistant"` and `message.stopReason === "error"` or `"aborted"`
- **THEN** the sidecar writes `{"session_id":"<id>","event":{"type":"error","message":"<errorMessage or 'cancelled' for aborted>"}}` to stdout

#### Scenario: pi events with no AgentEvent analogue are skipped

- **WHEN** the pi session emits an event that has no frontend analogue (e.g. `thinking_start`, `tool_execution_start`, `queue_update`, `compaction_start`, `entry_appended`, `auto_retry_start`)
- **THEN** the sidecar emits nothing for that event (the adapter returns `null` and no stdout line is written)

### Requirement: Slash commands intercepted in the sidecar dispatcher

pi's built-in slash commands (`/new`, `/compact`, `/model`, etc.) are TUI-only hardcodes and `pi.registerCommand` is only available inside the extension-load lifecycle — neither is reachable from an embedded/RPC session. The sidecar SHALL instead intercept `/`-prefixed user-message or `slash_command` frames in its own stdin request dispatcher (before calling `session.prompt`), and handle at minimum: `/new` (`runtime.newSession()` then emit a `session_id` announcement), `/sessions` (call `SessionManager.list(cwd)`, emit a `ui_request { kind: "select_session" }` event, await the matching `ui_response` on stdin, then `runtime.switchSession(path)` — note `switchSession` takes a file path resolved via `SessionManager.list`), `/compact` (invoke `session.compact(customInstructions?)`), `/clear` (alias `/new`), `/help` (emit a synthetic `text_delta` with usage text), and `/model` (`session.cycleModel()` or `session.setModel(model)`). A `/`-prefixed message that matches no known command SHALL still be passed to `session.prompt` (the LLM decides what to do).

#### Scenario: /new starts a fresh session

- **WHEN** the sidecar receives a `/new` user-message or slash-command frame on stdin
- **THEN** it calls `runtime.newSession()`, rebinds the session subscription to the new session, and emits a `session_id` announcement event so subsequent `agent:event`s carry the new id

#### Scenario: /sessions prompts the frontend for a selection

- **WHEN** the sidecar receives a `/sessions` frame
- **THEN** it calls `SessionManager.list(cwd)`, emits a `ui_request { kind: "select_session", payload: { sessions } }` event, waits for the matching `ui_response` on stdin, resolves the selected session's file path from the list, and invokes `runtime.switchSession(path)` on receipt

### Requirement: Built-in pi toolset, no custom Rust tools

The sidecar SHALL use pi's built-in `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls` tools. No custom Rust `Tool` trait implementations and no custom TypeScript `registerTool` shims for these seven primitives SHALL be written in the v1 of this change. The sidecar process `cwd` SHALL be set to the working folder so pi's tools operate inside it by default.

#### Scenario: Seven built-in tools are enabled

- **WHEN** a `createAgentSession` call is made in the sidecar
- **THEN** its `tools` option is either unset (defaults to pi's built-ins) or explicitly lists `[ "read", "write", "edit", "bash", "grep", "find", "ls" ]`

### Requirement: Sessions persisted by pi SessionManager

The sidecar SHALL use pi's `SessionManager` (persistent variant scoped to the working folder's `cwd`) for session creation, listing, loading, and branching. The frontend-specified `<working_folder>/.learn/sessions/<id>.jsonl` path from the retired `right-agent-panel-rig-tools` spec SHALL NOT be introduced; sessions live wherever pi's `SessionManager` defaults (`~/.pi/agent/sessions/<cwd>/` JSONL tree). The Rust backend and frontend SHALL NOT read or write session files directly.

#### Scenario: Sessions are listed through the sidecar

- **WHEN** the frontend calls `agent_list_sessions(working_folder)`
- **THEN** the Rust backend forwards the call to the sidecar, the sidecar calls `SessionManager.list(cwd)`, and the `SessionMeta` shape is derived (or mapped) from pi's session metadata into the five-field shape defined in `agent-tauri-commands`

#### Scenario: Sessions restore through the sidecar

- **WHEN** the frontend calls `agent_load_session(session_id, working_folder)`
- **THEN** the sidecar calls `SessionManager.load` (or `runtime.switchSession` + reads `session.messages`), maps the pi message tree into the `ChatRow[]` shape defined in `agent-tauri-commands`, and returns rows in submission order

### Requirement: base_url override via ModelRegistry provider override

When the BYOK config includes a non-empty `base_url` (for OpenRouter, Azure OpenAI, or self-hosted endpoints) the sidecar SHALL apply the override by calling `ModelRegistry.registerProvider(provider, { baseUrl })`, which rewrites the `baseUrl` on the built-in openai/anthropic models (the override-only branch at `model-registry.ts`). The API key is injected via `AuthStorage.setRuntimeApiKey(provider, apiKey)` and takes priority over any persisted credential. A NEW provider name is NOT introduced — the existing `provider` id ("openai"/"anthropic") keeps its model metadata (context window, cost, capabilities) and only the endpoint URL changes. The default providers (OpenAI, Anthropic) SHALL be used unmodified when `base_url` is absent.

#### Scenario: base_url override rewrites the existing provider's endpoint

- **WHEN** the BYOK stdin frame contains a non-empty `base_url`
- **THEN** the sidecar calls `ModelRegistry.registerProvider(provider, { baseUrl })` so the built-in models for that provider target the user's proxy, selects the model via `modelRegistry.find(provider, modelId)`, and passes it to `createAgentSession`

#### Scenario: No base_url uses the standard provider

- **WHEN** the BYOK stdin frame has `base_url: null` or empty
- **THEN** the sidecar uses the standard OpenAI or Anthropic provider endpoint with no registration side effects

### Requirement: UI interaction requests forward to the frontend

Slash commands or tool calls that need user-facing interaction beyond text deltas (e.g. `/sessions` selection, an inline confirm, a per-call command approval) SHALL emit a `ui_request` event on stdout carrying `{ request_id, kind, payload }`. The Rust backend SHALL forward the request to the frontend as a Tauri event, await the frontend's reply, and write the reply back to the sidecar's stdin as a `ui_response` frame keyed by `request_id`. The frontend SHALL expose a single `useAgentUi` (or equivalent) composable for dispatching these requests.

#### Scenario: /sessions issues a ui_request and is answered

- **WHEN** the user types `/sessions`
- **THEN** the sidecar emits `ui_request { kind: "select_session", payload: { sessions: [...] } }`, the Rust backend forwards it to the frontend, the frontend renders `SessionsPanel`, the user clicks a row, the frontend calls the matching `agent_*` command with the reply which the Rust backend writes as a `ui_response` frame to stdin, and the sidecar calls `runtime.switchSession`

### Requirement: Cancellation via pi session.abort

`agent_cancel(session_id)` (forwarded from the Rust backend) SHALL cause the sidecar to invoke `session.abort()` (or equivalent on `AgentSessionRuntime`). The sidecar SHALL then emit `error { message: "cancelled" }` on stdout for that `session_id` and clear the session's `busy` state. A cancel for an unknown or idle `session_id` SHALL be a no-op (the sidecar SHALL NOT emit any event).

#### Scenario: Abort signals the pi session

- **WHEN** the sidecar receives a cancel frame for a busy session
- **THEN** it calls `session.abort()` on that session and emits exactly one `error { message: "cancelled" }` event

#### Scenario: Cancel for an idle session is a no-op

- **WHEN** the sidecar receives a cancel frame for a session that is not currently streaming
- **THEN** no event is emitted for that session

### Requirement: Sidecar packaging and bundling

The sidecar SHALL ship as a single Node-runnable entry bundled by `pnpm build` (esbuild or equivalent) so the Tauri `externalBin` configuration targets one file per host platform. Node SHALL be bundled alongside the entry (or pinned as a runtime prerequisite documented in the build flow) so end users do not need a global Node install. The `tauri.conf.json` `externalBin` array SHALL list the sidecar entry for each target triple the app ships.

#### Scenario: Tauri bundle includes the sidecar binary

- **WHEN** `pnpm tauri build` runs for a target triple
- **THEN** the produced app bundle contains the sidecar Node-binary entry as a resource or `externalBin` target and the app can launch it without a global Node installed
