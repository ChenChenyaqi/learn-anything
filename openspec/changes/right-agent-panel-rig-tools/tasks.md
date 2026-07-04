## 1. learn-agent: tool foundation

- [ ] 1.1 Add `glob = "3"` and `regex = "1"` and `tokio-util = { version = "2", features = ["rt"] }` to `packages/learn-agent/Cargo.toml`
- [ ] 1.2 Create `packages/learn-agent/src/tools.rs` and export from `lib.rs`
- [ ] 1.3 Implement a `Workspace` helper struct holding `working_folder: PathBuf` and a lazily-cached `canonical_root`, with `resolve_within(rel: &str) -> Result<PathBuf, ToolError>` that canonicalizes the target and enforces the prefix check per `agent-tools#working-folder-scope-enforcement`
- [ ] 1.4 Implement `ReadFile` (`Tool`) using `Workspace::resolve_within`; truncate at 200 KB with appended truncation marker + original byte size
- [ ] 1.5 Implement `WriteFile` (`Tool`); create missing parents via `fs::create_dir_all`; refuse to overwrite a directory; refuse when path equals a directory's path
- [ ] 1.6 Implement `EditFile` (`Tool`) with `replace_all` arg; error when `old == new`; error when not-found; error when multiple-occurrence-without-replace_all; include counts in messages
- [ ] 1.7 Implement `ListDir` (`Tool`); suffix directories with `/`; exclude hidden entries and the ignore list `["node_modules","target",".git"]`; sort alphabetically
- [ ] 1.8 Implement `Grep` (`Tool`) choosing ripgrep when discovered on PATH and falling back to a `regex`-based recursive walk; cap results at 100; format `path:line:matched_line`
- [ ] 1.9 Implement `Glob` (`Tool`) using the `glob` crate with `**` recursion; cap at 500; sort alphabetically
- [ ] 1.10 Implement `RunCommand` (`Tool`) using `tokio::process::Command` (no shell); `cwd = working_folder`; pipe stdout/stderr; 120 s timeout via `tokio::time::timeout` killing the child on drop; truncate each stream at 4 KB with marker; include exit code in the result text
- [ ] 1.11 Add `ToolError` type whose `Display` strings are model-actionable (named reason + resolved-vs-allowed prefix); ensure every tool returns `ToolResult { status:"error", ... }`-style failure (or the rig-equivalent result) so the model receives the error rather than the loop aborting
- [ ] 1.12 Unit tests in `tools.rs`: path-escape rejection (`..` outside root, symlink-into-outside rejected), ReadFile truncation, WriteFile parent-create, EditFile single/none/multiple/replace_all branches, ListDir ignore list, Grep no-match, Glob cap, RunCommand timeout + non-existent executable + 4KB stdout truncation

## 2. learn-agent: agent session and events

- [ ] 2.1 Create `packages/learn-agent/src/agent.rs` and export from `lib.rs`
- [ ] 2.2 Define `AgentEvent` enum (`TextDelta { delta }`, `ToolCall { id, name, args }`, `ToolResult { id, name, status, result }`, `Done`, `Error { message }`) with serde `tag = "type"` so it round-trips to the frontend discriminated union
- [ ] 2.3 Implement pure `system_prompt(working_folder: &Path, tools: &[&str]) -> String` per `agent-session#system-prompt-construction`; unit test that the output mentions the working-folder path and every tool name
- [ ] 2.4 Implement `AgentSessionBuilder` with `provider`, `api_key`, `base_url`, `model`, `working_folder`, `max_turn` (default 32), system prompt override
- [ ] 2.5 In `AgentSession::build`, construct the rig agent (provider-dispatch over `RigClient` from `model.rs`), call `.preamble(...).tool(ReadFile).tool(WriteFile).tool(EditFile).tool(ListDir).tool(Grep).tool(Glob).tool(RunCommand)`, and configure multi-turn depth
- [ ] 2.6 Implement `send(msg) -> BoxStream<AgentEvent>` driving `agent.stream_prompt(msg).await` and mapping `MultiTurnStreamItem`-> `AgentEvent` (assistant text deltas → `TextDelta`; tool results → `ToolResult`; assistant tool-call deltas are buffered until the call is fully formed → `ToolCall`); emit `Done` at clean end, `Error` on stream error
- [ ] 2.7 Add `CancellationToken` (hand-rolled `Arc<AtomicBool>` or `tokio_util::sync::CancellationToken`); wrap the stream poll in `select!` so cancellation yields `Error { message: "cancelled" }` and ends the run promptly
- [ ] 2.8 On `MaxDepthError` emit `Error` naming the depth limit (rather than silently truncating); unit test mapping a fake-stream error → `Error` event with the original message
- [ ] 2.9 Integration smoke test using a fake/mock provider (or `FakeModelClient`-equivalent for agent path) that yields a `ToolCall` -> `ToolResult` -> text sequence; assert the emitted `AgentEvent` order matches `agent-session#streaming-multi-turn-driver`

## 3. learn-agent: session JSONL storage

- [ ] 3.1 Create `packages/learn-agent/src/sessions.rs` and export from `lib.rs`
- [ ] 3.2 Define `ChatRow` (`User { text }` / `Assistant { blocks: Vec<Block> }`) and `Block` (`Text` / `ToolCall { id, name, args: serde_json::Value, status, result: Option<String> }`) with serde for JSONL round-trip
- [ ] 3.3 Define `SessionMeta { id, title, created_at, updated_at, message_count, tool_call_count }`
- [ ] 3.4 Implement `id_for(first_user_message, now: SystemTime) -> String` per `agent-sessions-storage#session-storage-location-and-id-format`; implement `slugify` (lowercase, non-alnum → `-`, collapse dashes, 24-char cap, fallback `session`); unit tests for clean + trivial-first-message cases
- [ ] 3.5 Implement `new(working_folder, first_user_message) -> Result<SessionHandle>` that ensures `.learn/sessions/` exists, opens the JSONL file in append + read mode, and writes nothing yet
- [ ] 3.6 Implement `append(handle, row)` writing one JSON object per line with trailing `\n`; abort mid-line is acceptable (load skips it)
- [ ] 3.7 Implement `load(id, working_folder) -> Result<Vec<ChatRow>>` reading the file line by line, skipping malformed trailing lines rather than erroring, returning rows in submission order
- [ ] 3.8 Implement `list(working_folder) -> Result<Vec<SessionMeta>>` scanning each `.learn/sessions/*.jsonl`; title = first 60 chars of first user row; counts derived by walking rows; sorted by `created_at` (file mtime or first-row timestamp) descending; return empty vector when `.learn/sessions/` does not exist
- [ ] 3.9 Unit tests: create-then-list returns one `SessionMeta`; load restores 3-user + 2-assistant order; malformed last line skipped; title truncation at 60 chars; counts correct for mixed blocks

## 4. src-tauri: remove legacy, wire new commands

- [ ] 4.1 Delete `chat_create_topic`, `TopicCreated`, the `EVENT_DONE`/`EVENT_ERROR` constants, and `run_create_topic`/`resolve_run_inputs` helpers from `packages/gui/src-tauri/src/agent.rs`
- [ ] 4.2 Move the BYOK input-resolution helpers (keychain read, `AppConfig`→provider/key/model/base_url/working-folder) into a reusable `fn resolve_agent_inputs(app) -> Result<AgentInputs, String>` reusing the existing pure-guard style; keep the unit-tested "missing key / missing model / missing working folder" guards intact
- [ ] 4.3 Add `AgentSessionHandle { session: learn_agent::AgentSession, jsonl: learn_agent::SessionHandle, cancel: CancellationToken, busy: AtomicBool }`
- [ ] 4.4 Add a `tauri::State` type `AgentState(Mutex<HashMap<String, AgentSessionHandle>>)`
- [ ] 4.5 Implement `agent_new_session(app, working_folder: Option<String>) -> Result<{ session_id: String }, String>`: resolve inputs, build `AgentSession`, create `SessionHandle` (writing the first user message is deferred to `agent_send`), insert into the table, return id
- [ ] 4.6 Implement `agent_send(app, session_id, text) -> Result<(), String>`: lookup handle, append user row to JSONL, spawn the run detached; in the task loop, emit `agent:event` events on `AppHandle` with `{ session_id, event }`, accumulate assistant blocks, append assistant row to JSONL on `Done`; clear `busy` on terminal events
- [ ] 4.7 Implement `agent_cancel(session_id) -> Result<(), String>`: trigger the `CancellationToken`; no-op when not busy; safe when the session id is missing
- [ ] 4.8 Implement `agent_list_sessions(working_folder: Option<String>) -> Vec<SessionMeta>`: resolve working folder from arg then `last_working_folder`; return `vec![]` when neither is set; otherwise call `learn_agent::sessions::list`
- [ ] 4.9 Implement `agent_load_session(session_id, working_folder: Option<String>) -> Result<Vec<ChatRow>, String>`: error when the id's JSONL file does not exist; on success re-attach nothing to the table (the frontend will call `agent_new_session`-style rehydration in a later iteration — for v1 it just displays the restored transcript; a subsequent `agent_send` operates against the active in-memory agent whose history was pre-loaded)
  - 4.9a Alternative chosen for v1: `agent_load_session` ALSO rehydrates the rig chat history by replaying the rows into the agent's history (so the agent can continue the conversation), then returns the rows. Choose this path if rig exposes `agent.chat.history_mut()`; otherwise document the limitation in `design.md` and ship v1 read-only restore (user must `/new` to continue)
- [ ] 4.10 Update `packages/gui/src-tauri/src/lib.rs`: remove `chat_create_topic` from the invoke handler list; register `agent_new_session`, `agent_send`, `agent_cancel`, `agent_list_sessions`, `agent_load_session`; `manage(AgentState::default())` on the builder
- [ ] 4.11 Delete `packages/gui/src-tauri/src/agent.rs` `EVENT_DONE`/`EVENT_ERROR` constants and any references; ensure a clean `cargo build` of the whole `src-tauri` crate with no warnings about unused code
- [ ] 4.12 Backend tests: `agent_new_session` when no working folder → error; `agent_list_sessions` with no working folder → empty; `agent_load_session` for a missing id → error; (command-level tests using a temp working folder + fake model client where feasible)

## 5. Frontend: types and libs

- [ ] 5.1 Update `packages/gui/src/lib/commands.ts`: remove `chatCreateTopic`/`TopicCreated`; define `AgentEvent`, `ChatBlock`, `ChatMessage`, `SessionMeta`, `ChatRow` discriminated unions (snake_case to match serde)
- [ ] 5.2 Add typed command wrappers `agentNewSession(workingFolder?: string): Promise<{ session_id: string }>`, `agentSend(sessionId: string, text: string): Promise<void>`, `agentCancel(sessionId: string): Promise<void>`, `agentListSessions(workingFolder?: string): Promise<SessionMeta[]>`, `agentLoadSession(sessionId: string, workingFolder?: string): Promise<ChatRow[]>`
- [ ] 5.3 Create `packages/gui/src/lib/slash-commands.ts` exporting `SlashCommand { name; description; run(ctx) }`, `commands` array containing `/new` and `/sessions`, and `matchInput(text: string)` returning `{ query, matches }` or `null`; `/new.run` raises confirm when `ctx.messages.length > 0`, otherwise calls `ctx.newSession()`; `/sessions.run` sets `ctx.sessionsOpen = true`
- [ ] 5.4 Create `packages/gui/src/lib/time.ts` exporting `relativeTime(unixSecs: number): string` (e.g. `just now`, `5m ago`, `3h ago`, `2d ago`, fallback to `YYYY-MM-DD`); include vitest for boundaries
- [ ] 5.5 Add `slashPill`, `toolCard` class strings to `packages/gui/src/lib/ui.ts`

## 6. Frontend: composable

- [ ] 6.1 Create `packages/gui/src/composables/useAgentSession.ts` exposing refs `sessionId`, `messages`, `busy`, `pendingConfirm`, `sessionsOpen`, `sessions`, `sessionsQuery`, plus methods `boot(workingFolder)`, `send(text)`, `cancel()`, `newSession()`, `restore(id)`
- [ ] 6.2 In `boot`: call `agentNewSession(workingFolder)`, store `sessionId`, subscribe to `agent:event`, filter by `payload.session_id === sessionId.value`, dispatch each event type to update state (accumulate `TextDelta` into pending assistant message, append `ToolCall`/`ToolResult` blocks, seal on `Done`, append error block + clear busy on `Error`)
- [ ] 6.3 `send`: detect leading `/` and route to `slash-commands` match; otherwise call `agentSend(sessionId, text)` and append a user `ChatMessage`
- [ ] 6.4 `cancel` calls `agentCancel(sessionId)`; UI reverts on the eventual `Error{message:"cancelled"}`
- [ ] 6.5 `newSession`: set busy false / pendingConfirm false, call `agentNewSession`, swap `sessionId`, reset `messages` to `[]`, refresh `sessions`
- [ ] 6.6 `restore(id)`: call `agentLoadSession`, map `ChatRow[]` into `ChatMessage[]` (assistant rows already carry blocks), set `messages`, switch `sessionId`, close `sessionsOpen`
- [ ] 6.7 `loadSessions`: call `agentListSessions`, populate `sessions`; exposed for the panel to refresh
- [ ] 6.8 `onUnmounted`: unlisten the event subscription
- [ ] 6.9 vitest for `slash-commands.matchInput` (empty input, leading slash filter, mid-string `/` not triggered, no-match)

## 7. Frontend: components

- [ ] 7.1 Create `packages/gui/src/components/SlashMenu.vue` as a stateless popover (props `commands`, `query`, `index`; emits `select`, `close`, `move`); design per `agent-chat-ui#slash-command-menu-trigger` (rounded `--radius-card`, `--color-rule` border, `--color-bg-elv` background, mono name + pencil description, highlighted row with `--color-accent-soft` background and 2px `--color-accent` left bar, fade-in 80ms / 0 reduced-motion)
- [ ] 7.2 Create `packages/gui/src/components/ToolCallCard.vue` (`status: 'running'|'ok'|'error'`, `name`, `args`, `result`); 2px `--color-accent` left border, 12px left padding, mono name; running = pulsing vermilion indicator (CSS animation, gated by `prefers-reduced-motion`); `ok` = `--color-mastered`, `error` = `--color-brand-1`; collapsed while running, expandable via `<details>` otherwise; expanded body shows args pretty JSON on `--color-code-bg` and result truncated to 12 lines with scroll
- [ ] 7.3 Create `packages/gui/src/components/SessionsPanel.vue` with `← back` ghost button + `Sessions` label + search input + list of rows; row = `title` (ink medium) + metadata line `<message_count> msgs · <relative_time> · <tool_call_count> tool calls` (using `relativeTime` from `lib/time.ts`); empty-state string "No sessions yet — back and type `/new` to start."; emit `select(id)` and `back`; client-side search filters `title` case-insensitively; row hover background `--color-surface-hover`
- [ ] 7.4 Create `packages/gui/src/components/AgentChat.vue`: header row (label `Agent` + two `slashPill` ghost buttons `◇ new` and `▤ sessions` that invoke the corresponding slash commands), transcript area (or inline `SessionsPanel` when `sessionsOpen`), empty-state centered prompt when `messages.length === 0`, input row (textarea + toggling `Send`/`Stop` button), SlashMenu popover positioned above the textarea, inline confirm chip above the textarea when `pendingConfirm` is set
- [ ] 7.5 In AgentChat's `onMounted`: call `useAgentSession.boot(last_working_folder)`; in `onUnmounted`: cleanup
- [ ] 7.6 Implement keyboard handling in AgentChat per spec: leading `/` triggers `SlashMenu`; while menu is open intercept ↑↓Enter Esc; otherwise Enter sends, Shift+Enter newlines; `Send` disabled on empty input
- [ ] 7.7 Implement `/new` inline confirm rendering: a single-line chip with the prompt and `confirm`/`cancel` ghost buttons; clearing on either action
- [ ] 7.8 Render the streaming transcript: in-progress assistant message reused for `TextDelta` accumulation; `ToolCall`/`ToolResult` append/update `ToolCallCard` children; `Error` appends an error block and clears `busy`
- [ ] 7.9 Implement auto-scroll-to-bottom on new content (re-use the existing `nextTick` + `scrollTo` pattern from the deleted `ChatDialog.vue`)

## 8. Frontend: integration

- [ ] 8.1 Delete `packages/gui/src/components/ChatDialog.vue`
- [ ] 8.2 Update `packages/gui/src/App.vue` (and any other import site — search `ChatDialog`) to import `AgentChat.vue` instead and pass `config?.last_working_folder` so the panel can boot a session for that working folder
- [ ] 8.3 Verify `pnpm build` (`vue-tsc --noEmit` + vite build) passes with no errors
- [ ] 8.4 Run vitest: `pnpm test` green for `slash-commands` and `relativeTime`

## 9. End-to-end verification

- [ ] 9.1 Manual: open the workspace, type `/new`, ask "create a hello.txt containing 'hi' in the working folder, then run ls to confirm". Verify transcript shows the `WriteFile` and `RunCommand` cards and the file appears on disk
- [ ] 9.2 Manual: run `/sessions`, see the session listed with correct metadata; click it; restore the transcript in the panel; send a follow-up message and confirm the agent continues with history
- [ ] 9.3 Manual: trigger a long-running command (e.g. `sleep 60`) and click `Stop`; verify the in-flight run ends with an `Error("cancelled")` block and the Send button reverts
- [ ] 9.4 Manual: kill the app mid-run, relaunch, run `/sessions`, and confirm the partial session JSONL is scannable (malformed trailing line skipped, earlier rows restored)
- [ ] 9.5 `cargo test -p learn-agent` green; `cargo build -p learn-anything-gui` green
- [ ] 9.6 Run lint/typecheck: `pnpm build` (vue-tsc) and `cargo fmt --check` / `cargo clippy -p learn-agent -- -D warnings` (or whichever the project uses) green
