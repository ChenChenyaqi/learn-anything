## 1. Code deletion — clean slate before pi work

- [x] 1.1 Delete the entire `packages/learn-agent/` directory (Cargo.toml, src/, prompts/, mock/) from the workspace
- [x] 1.2 Remove `"packages/learn-agent"` from the root `Cargo.toml` `[workspace] members` array and `learn-agent = { path = "packages/learn-agent" }` from `[workspace.dependencies]`
- [x] 1.3 Delete `packages/gui/src-tauri/src/agent.rs` (chat_create_topic, TopicCreated, run_create_topic, resolve_run_inputs, all tests)
- [x] 1.4 Delete `packages/gui/src-tauri/src/commands.rs` (test_key, TestKeyParams, all tests)
- [x] 1.5 Update `packages/gui/src-tauri/src/lib.rs`: drop `mod agent;` / `mod commands;` and their `use` lines; remove `chat_create_topic` and `test_key` from `tauri::generate_handler!`
- [x] 1.6 Inline the `Provider` enum (variants `OpenAi`/`Anthropic`, `#[serde(rename_all="lowercase")]`, `#[default] OpenAi`) into `packages/gui/src-tauri/src/config.rs` and drop `use learn_agent::model::Provider;`; verify `AppConfig` still round-trips through JSON identically
- [x] 1.7 Update `packages/gui/src-tauri/Cargo.toml`
- [x] 1.8 Delete `packages/gui/src/components/ChatDialog.vue`
- [x] 1.9 Update `packages/gui/src/components/TopicList.vue`: remove `import ChatDialog` and the `<ChatDialog />` render slot
- [x] 1.10 Update `packages/gui/src/lib/commands.ts`: remove `TopicCreated` interface, `chatCreateTopic` export, `TestKeyParams` interface, `testKey` export, and the `agent workflow ──` section comment
- [x] 1.11 Scrub `useAppSession.ts` / `useSetupForm.ts` / `SetupScreen.vue` for any `testKey` / `chatCreateTopic` / `TopicCreated` callers; remove the call sites and leave the forms persisting key + config only (verification moves to the sidecar's session boot)
- [x] 1.12 Delete `openspec/changes/gui-agent-capability-spike/` (the entire directory)
- [x] 1.13 Delete `openspec/changes/right-agent-panel-rig-tools/` (the entire directory)
- [x] 1.14 Verify `cargo check --workspace` and `cargo check -p learn-anything-gui` are green with no warnings about unused code
- [x] 1.15 Verify `pnpm -F learn-anything-gui build` (vue-tsc + vite) is green with no unused-symbol errors
- [x] 1.16 Verify `pnpm -F learn-anything-gui test` is green
- [x] 1.17 Grep the source tree for `learn_agent|LocalModelClient|AgentSession|chat_create_topic|TopicCreated|test_key|TestKeyParams|agent:done|agent:error` and confirm zero matches outside `openspec/changes/archive/`

## 2. pi-agent-panel openspec change — land this proposal

- [x] 2.1 (done) `openspec new change pi-agent-panel` scaffolded the change directory
- [x] 2.2 (done) Wrote `proposal.md` per spec-driven template
- [x] 2.3 (done) Wrote `specs/agent-chat-ui/spec.md` (migrated + adapted from the retired `right-agent-panel-rig-tools/specs/agent-chat-ui`; SessionsPanel row metadata simplified to `<n> msgs · <Xh ago>` per user choice)
- [x] 2.4 (done) Wrote `specs/agent-tauri-commands/spec.md` (migrated + adapted; removed the "Removal of chat_create_topic" requirement since Step 1 already deleted it; backend-agnostic contract per `agent-pi-sidecar`; simplified `SessionMeta` to five fields)
- [x] 2.5 (done) Wrote `specs/agent-pi-sidecar/spec.md` (new capability covering sidecar lifecycle, BYOK-over-stdin, AgentEvent adaptation, slash commands via `pi.registerCommand`, built-in pi tools, pi SessionManager ownership, base_url via registerProvider, ui_request round-trip, cancellation via session.abort, sidecar bundling)
- [x] 2.6 (done) Wrote `design.md` with nine decisions (D1 sidecar-over-Electron, D2 BYOK-over-stdin, D3 single agent:event channel, D4 ui_request round-trip, D5 pi SessionManager owns sessions, D6 adapter in sidecar keeps frontend contract, D7 cwd-bound pi tools, D8 inlined Provider enum, D9 aggressive dep pruning) + risks + migration plan
- [x] 2.7 (this file) Write `tasks.md` and confirm `openspec status --change pi-agent-panel` reports `isComplete: true`
- [x] 2.8 Commit Step 1 (deletion) + Step 2 (this openspec change) as two logically separate commits per the user's "先删后改（分两步）" choice

## 3. Node sidecar skeleton (`packages/gui/sidecar/`)

- [x] 3.1 Create `packages/gui/sidecar/package.json` with pinned dependencies `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `typebox`, `zod`; dev deps `esbuild`, `typescript`, `@types/node`, `vitest`; scripts `build` (esbuild bundle to `dist/sidecar.js`), `dev`, `test`
- [x] 3.2 Create `packages/gui/sidecar/tsconfig.json` targeting `node18` with strict mode and `module: ESNext`
- [x] 3.3 Create `packages/gui/sidecar/src/main.ts` — entry point: read first stdin frame synchronously into a typed `BootConfig { apiKey, provider, baseUrl, model, cwd, sessionId? }`, inject the key via `AuthStorage.setRuntimeApiKey(provider, apiKey)`, construct `ModelRegistry` (+ `registerProvider` when `baseUrl` present), construct `SessionManager.create(cwd)`, then enter the request loop
- [x] 3.4 Implement the stdin request loop: parse one JSON frame per line into `AgentRequest { kind: "user_message"|"slash_command"|"cancel"|"ui_response"|"list_sessions"|"load_session", sessionId?, text?, requestId?, value?, cwd? }`, dispatch to the active `AgentSession`/`AgentSessionRuntime`/active `wait` map; a `/`-prefixed `user_message` or any `slash_command` frames are routed to the slash-command dispatcher before `session.prompt`; `list_sessions`/`load_session` are request/reply kinds (emit `list_sessions_reply`/`load_session_reply` on stdout); rejections on malformed frames MUST log to stderr (never stdout, which is reserved for `AgentEvent` JSONL). Use a manual `data`+buffer line splitter (NOT Node `readline` — per pi `docs/rpc.md` framing notes)
- [x] 3.5 Implement `src/agent-event-adapter.ts` exposing `mapPiEvent(sessionId, piEvent: AgentSessionEvent): AgentEventJsonL | null`. pi's real event structure: `message_update` with nested `assistantMessageEvent.type === "text_delta"` → `text_delta { delta }`; `message_update` with `assistantMessageEvent.type === "toolcall_end"` → `tool_call { id, name, args }` (take `assistantMessageEvent.toolCall.{id,name,arguments}`); `tool_execution_end` → `tool_result { id, name, status, result }` (derive `status` from `isError`, stringify `result.content` text blocks); `agent_end` → `done`; `message_end` with `message.role === "assistant"` and `stopReason === "error"|"aborted"` → `error { message }` (abort → message `"cancelled"`). Skip events with no `AgentEvent` analogue (`thinking_start`, `tool_execution_start`, `queue_update`, `compaction_*`, `entry_appended`, `auto_retry_*`, etc.). Unit-test every branch
- [x] 3.6 Implement `src/slash-commands.ts` with a `handleSlash(text, ctx)` dispatcher (NOT `pi.registerCommand` — pi built-in commands are TUI-only and `registerCommand` is extension-lifecycle-only; intercept in the sidecar's own dispatcher instead): `/new` (`runtime.newSession()` + rebind subscription + emit `session_id` announcement), `/sessions` (`SessionManager.list(cwd)` → emit `ui_request { kind: "select_session" }` → await matching `ui_response` → resolve file path from list → `runtime.switchSession(path)`), `/compact [args]` (`session.compact(args)`), `/clear` (alias `/new`), `/help` (emit synthetic `text_delta` with usage text + `done`), `/model [name]` (`session.cycleModel()` or `setModel`). Unmatched `/`-prefixed messages fall through to `session.prompt`
- [x] 3.7 Implement `src/stdout-writer.ts`: one helper `emitAgentEvent(sessionId, event: AgentEvent)` that writes a single JSONL line to stdout and flushes (never batches — preserve real-time streaming); one helper `emitUiRequest(requestId, kind, payload)` for the round-trip channel
- [x] 3.8 Implement `src/session-lifecycle.ts` wrapping `createAgentSession`, `session.subscribe(listener → adapter → stdout-writer)`, `session.prompt(text)`, `session.abort()`, `runtime.newSession()`, `runtime.switchSession(id)`
- [x] 3.9 Verify the sidecar boots with a fake stdin frame and emits at least one synthetic `text_delta` event end-to-end via a vitest test using a stub spawner
- [x] 3.10 Add a snapshot test that the adapter produces the exact JSONL shapes specified by `agent-pi-sidecar#agentevent-adaptation-from-pi-to-the-frontend-contract`

## 4. Tauri sidecar lifecycle (`packages/gui/sidecar/` + `packages/gui/src-tauri/`)

- [x] 4.1 Configure `packages/gui/src-tauri/tauri.conf.json` `externalBin` to target the bundled sidecar entry per target triple (placeholder for now; real binary wired in 4.x after the bundler produces `dist/sidecar.js` + a Node runtime)
- [x] 4.2 Create `packages/gui/src-tauri/src/sidecar.rs` exporting a `SidecarHandle` struct holding `tokio::process::Child`, `ChildStdin`, a reader task driving `ChildStdout` → `AgentEvent` → `agent:event`, and an active-session map (`Mutex<HashMap<SessionId, ActiveSession>>`)
- [x] 4.3 In `sidecar.rs` implement `boot_sidecar(app: &AppHandle) -> Result<SidecarHandle, String>` that spawns the bundled Node sidecar via `tokio::process::Command` (no argv carries the key), hands stdin to the writer half, spawns a `tokio::spawn` reader task that pumps stdout line-by-line into the `AgentEvent` channel
- [x] 4.4 Implement `agent_new_session(working_folder: Option<String>) -> { session_id: String Tauri command: read key from keychain, read config, resolve working_folder (arg then `config.last_working_folder`), write the first BYOK stdin frame `{ apiKey, provider, baseUrl, model, cwd, sessionId: null }`, await the sidecar's `session_id` announcement, store the active session, return the id
- [x] 4.5 Implement `agent_send(session_id, text) -> ()` Tauri command: validate the session is active, write a `{ kind: "user_message", sessionId, text }` stdin frame, return immediately (do NOT block on the agent turn)
- [x] 4.6 Implement `agent_cancel(session_id -> ()` Tauri command: write a `{ kind: "cancel", sessionId }` stdin frame; the next stdout event for that session is `error { message: "cancelled" }`
- [x] 4.7 Implement `agent_list_sessions(working_folder: Option<String>) -> Vec<SessionMeta>` Tauri command: write a `{ kind: "list_sessions", cwd }` stdin frame, await the matching `list_sessions_reply` on stdout, map pi `SessionMeta` to our five-field shape ({ id, title, created_at, updated_at, message_count })
- [x] 4.8 Implement `agent_load_session(session_id, working_folder: Option<String>) -> Vec<ChatRow>` Tauri command: write a `{ kind: "load_session", sessionId, cwd }` stdin frame, await the matching reply, return rows in submission order
- [x] 4.9 Implement the stdout reader task: parse one JSONL line at a time into either an `AgentEvent` (forwarded via `app.emit("agent:event", { session_id, event })`) or a `ui_request` (forwarded via `app.emit("agent:ui_request", { request_id, kind, payload })`); on sidecar EOF emit `agent:event { session_id: <last active>, event: { type: "error", message: "agent process exited" } }`
- [x] 4.10 Implement `agent_reply_ui(request_id, value)` Tauri command: write a `{ kind: "ui_response", requestId, value }` stdin frame so `/sessions` and future prompts round-trip
- [x] 4.11 Update `packages/gui/src-tauri/src/lib.rs`: `mod sidecar;`, register the six Tauri commands (`agent_new_session`, `agent_send`, `agent_cancel`, `agent_list_sessions`, `agent_load_session`, `agent_reply_ui`), call `boot_sidecar` once in `setup` via `tauri::Builder::default().setup(...)`, store `SidecarHandle` in `tauri::State`
- [x] 4.12 Update `packages/gui/src-tauri/Cargo.toml`: re-add `tokio = { workspace = true, features = ["process", "io-util", "rt"] }` and `futures.workspace = true` if the reader task needs them; otherwise confirm `tauri`'s transitive tokio suffices (run `cargo check`)
- [x] 4.13 Verify `cargo check -p learn-anything-gui` is green; verify a manual `pnpm tauri dev` boots the sidecar without errors (or with a clear error if Node is missing — generate a user-actionable message)
- [x] 4.14 Backend tests in `sidecar.rs` for: no-key error path, no-working-folder error path, sidecar-EOF surfacing `agent:event error`, ui_request round-trip returning the chosen `request_id`'s value

## 5. Frontend types and libs

- [x] 5.1 Update `packages/gui/src/lib/commands.ts`: add the `AgentEvent`, `ChatBlock`, `ChatMessage`, `SessionMeta` (five fields, no `tool_call_count`), `ChatRow` discriminated union types (snake_case, mirroring Rust serde); add the six command wrappers `agentNewSession`, `agentSend`, `agentCancel`, `agentListSessions`, `agentLoadSession`, `agentReplyUi`
- [x] 5.2 Create `packages/gui/src/lib/slash-commands.ts` exporting `SlashCommand { name; description; run(ctx) }`, an array containing `/new` and `/sessions`, and `matchInput(text)` returning `{ query, matches }` or `null`; `/new.run` raises confirm when `ctx.messages.length > 0`, else calls `ctx.newSession()`; `/sessions.run` sets `ctx.sessionsOpen = true`
- [x] 5.3 Create `packages/gui/src/lib/time.ts` exporting `relativeTime(unixSecs): string` with boundaries (`just now`, `5m ago`, `3h ago`, `2d ago`, fallback `YYYY-MM-DD`); add vitest cases
- [x] 5.4 Add `slashPill` and `toolCard` class strings to `packages/gui/src/lib/ui.ts`
- [x] 5.5 Vitest: `slash-commands.matchInput` covers empty input, leading slash filter, mid-string `/` not triggered, no-match, multi-match

## 6. Frontend composable

- [ ] 6.1 Create `packages/gui/src/composables/useAgentSession.ts` exposing refs `sessionId`, `messages`, `busy`, `pendingConfirm`, `sessionsOpen`, `sessions`, `sessionsQuery`, and methods `boot(workingFolder)`, `send(text)`, `cancel()`, `newSession()`, `restore(id)`, `loadSessions()`
- [ ] 6.2 In `boot`: call `agentNewSession(workingFolder)`, store `sessionId`, subscribe to `agent:event`, filter by `payload.session_id === sessionId.value`, dispatch each event type (accumulate `TextDelta` into the in-progress assistant message; append `ToolCall`/`ToolResult` blocks; seal on `Done`; append error + clear `busy` on `Error`)
- [ ] 6.3 In `boot`: also subscribe to `agent:ui_request` and expose a small `useAgentUi` (or inline handler) that, for `kind === "select_session"`, opens `SessionsPanel`, awaits the user's choice, and calls `agentReplyUi(request_id, choice)`; extensible for future kinds
- [ ] 6.4 `send`: detect leading `/` and route to `slash-commands` `matchInput`; otherwise call `agentSend(sessionId, text)` and append a user `ChatMessage`
- [ ] 6.5 `cancel`: call `agentCancel(sessionId)`; UI reverts on the eventual `Error { message: "cancelled" }`
- [ ] 6.6 `newSession`: set `busy=false` + `pendingConfirm=false`, call `agentNewSession`, swap `sessionId`, reset `messages` to `[]`, refresh `sessions`
- [ ] 6.7 `restore(id)`: call `agentLoadSession(id, workingFolder)`, map `ChatRow[]` into `ChatMessage[]`, set `messages`, switch `sessionId`, close `sessionsOpen`
- [ ] 6.8 `loadSessions`: call `agentListSessions(workingFolder)` and populate `sessions`; exposed for SessionsPanel refresh
- [ ] 6.9 `onUnmounted`: unlisten both `agent:event` and `agent:ui_request` subscriptions
- [ ] 6.10 Vitest: `useAgentSession` driven by a mocked `agent:event` stream produces the correct `messages` shape for a TextDelta → ToolCall → ToolResult → Done sequence

## 7. Frontend components

- [ ] 7.1 Create `packages/gui/src/components/SlashMenu.vue` as a stateless popover (props `commands`, `query`, `index`; emits `select`, `close`, `move`) per `agent-chat-ui#slash-command-menu-trigger` (rounded `--radius-card`, `--color-rule` border, `--color-bg-elv` background, mono name + pencil description, highlighted row with `--color-accent-soft` background + 2px `--color-accent` left bar, fade-in 80ms / 0 reduced-motion)
- [ ] 7.2 Create `packages/gui/src/components/ToolCallCard.vue` (props `status: 'running'|'ok'|'error'`, `name`, `args`, `result`); 2px `--color-accent` left border, 12px left padding, mono name; running = pulsing vermilion indicator (CSS animation gated by `prefers-reduced-motion`); `ok` = `--color-mastered`; `error` = `--color-brand-1`; collapsed while running; expandable via `<details>` once `status !== "running"`; expanded body shows args pretty-JSON on `--color-code-bg` + result truncated to 12 lines with scroll
- [ ] 7.3 Create `packages/gui/src/components/SessionsPanel.vue` with `← back` ghost button + `Sessions` label + search input + list rows; row = `title` (medium weight, ink) + metadata `<n> msgs · <Xh ago>` using `relativeTime` from `lib/time.ts`; empty state "No sessions yet — back and type `/new` to start."; emit `select(id)` and `back`; search filters `title` case-insensitively; row hover background `--color-surface-hover`
- [ ] 7.4 Create `packages/gui/src/components/AgentChat.vue`: header row (label `Agent` + two `slashPill` ghost buttons `◇ new` and `▤ sessions`), transcript area (or inline `SessionsPanel` when `sessionsOpen`), empty-state centered prompt when `messages.length === 0`, input row (textarea + toggling `Send`/`Stop` button), `SlashMenu` popover positioned above the textarea, inline confirm chip above the textarea when `pendingConfirm`
- [ ] 7.5 In `AgentChat.vue` `onMounted`: call `useAgentSession.boot(last_working_folder)`; in `onUnmounted`: cleanup (the composable's own `onUnmounted` unlisten covers subscriptions)
- [ ] 7.6 Implement keyboard handling: leading `/` triggers `SlashMenu`; while open intercept ↑↓Enter Esc (no textarea propagation); otherwise Enter sends, Shift+Enter newlines, `Send` disabled on empty
- [ ] 7.7 Implement `/new` inline confirm rendering: single-line chip "Start a fresh session? Current chat will be saved to history." with `confirm`/`cancel` ghost buttons; clear on either action
- [ ] 7.8 Render the streaming transcript: in-progress assistant message reused for `TextDelta` accumulation; `ToolCall`/`ToolResult` append/update `ToolCallCard` children; `Error` appends error block and clears `busy`
- [ ] 7.9 Implement auto-scroll-to-bottom on new content (reuse `nextTick` + `scrollTo` pattern from the deleted `ChatDialog.vue`)
- [ ] 7.10 Update `packages/gui/src/App.vue` (search for any remaining ChatDialog import): render `<AgentChat />` in the right-panel slot of the main view; pass `config?.last_working_folder` so the composable can boot for that working folder
- [ ] 7.11 Update `packages/gui/src/components/TopicList.vue`: the chat surface no longer belongs to TopicList (it mounts at App level now); leave the topics list only

## 8. End-to-end verification

- [ ] 8.1 Verify `pnpm -F learn-anything-gui build` (vue-tsc + vite) passes with no errors
- [ ] 8.2 Run vitest: `pnpm -F learn-anything-gui test` green for `slash-commands`, `relativeTime`, and the `useAgentSession` mock-stream test
- [ ] 8.3 Manual: open the workspace, type `/new`, ask "create a hello.txt containing 'hi' in the working folder, then run ls to confirm". Verify transcript shows the `write` and `bash` cards and the file appears on disk
- [ ] 8.4 Manual: run `/sessions`, see the session listed (with the simplified `<n> msgs · <Xh ago>` metadata); click it; restore the transcript in the panel; send a follow-up message and confirm the agent continues with history
- [ ] 8.5 Manual: trigger a long-running command (e.g. `sleep 60`) and click `Stop`; verify the in-flight run ends with an `error { message: "cancelled" }` block and the Send button reverts
- [ ] 8.6 Manual: kill the app mid-run, relaunch, run `/sessions`, and confirm sessions are restored (from pi's `~/.pi/agent/sessions/<cwd>/` JSONL tree)
- [ ] 8.7 `cargo check --workspace` and `cargo check -p learn-anything-gui` both clean (no warnings)
- [ ] 8.8 Confirm the source tree has no remaining references to `learn_agent`, `LocalModelClient`, `AgentSession` (the Rust one), `chat_create_topic`, `TopicCreated`, `agent:done`, `agent:error`, or `test_key` (other than historical entries inside `openspec/changes/archive/`)
