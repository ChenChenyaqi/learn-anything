## Context

The right panel of the desktop app (`packages/gui/src/components/ChatDialog.vue`) currently invokes a single Tauri command `chat_create_topic`, which calls `learn_topic` — a one-shot `ModelClient::extract` that produces a `StateV1` and writes `state.json` + `knowledge-map.md` to disk. There is no agentic loop, no tool calling, no file/editorial control, and no multi-turn conversation surfaced to the user.

`learn-agent/src/model.rs` already wraps `rig-core 0.39` (`LocalModelClient`) and exposes `stream` and `extract`. However its `text_only_stream` filter (line ~175) **discards** all `ToolCall` events — so even though rig supports tool use, the seam we built throws that capability away.

Users want an **opencode-style agent in the right panel**: type a natural-language instruction, and the agent autonomously reads/writes files, runs shell commands, and reports results across multiple turns — all scoped to the open working folder. rig-core has first-class support for this via the `Tool` trait + `agent(...).tool(...).build()` + `stream_prompt` (which yields `MultiTurnStreamItem` events: assistant text, tool-call deltas, and user-content tool results auto-replayed to the model).

Constraints inherited from the codebase:

- BYOK only (Phase 1); the API key lives in the OS keychain, provider/model/base_url in appData config (`config.rs`).
- All file operations MUST stay inside `config.last_working_folder` (user choice: "limit to working directory").
- Shell commands MUST run with `cwd = working_folder` and a timeout (user choice: "default on, run inside working folder").
- Sessions MUST be persisted as JSONL under `<working_folder>/.learn/sessions/<id>.jsonl` (user choice).
- Visual language is fixed: "Annotated Notebook" tokens in `packages/gui/src/styles/main.css` (vermilion red pen `--color-brand-2`, Inter + system mono, warm-white / graphite dark bg). No new palette.
- The new agent REPLACES `chat_create_topic` (user choice).

## Goals / Non-Goals

**Goals:**

- A real multi-turn agentic loop in the right panel, driven by `rig`, that can read/write/edit files, list directories, grep/glob, and run shell commands inside the working folder.
- A streaming UI showing text deltas, tool calls, and tool results in real time — with an opencode-style `/` slash-command menu (`/new`, `/sessions`) and a sessions-history overlay with search.
- Session history persisted to disk (JSONL) and restorable across app restarts.
- Cancellable in-flight agent runs.
- Path-escape protection so the agent cannot touch files outside the working folder.

**Non-Goals:**

- Subscription / `RemoteModelClient` mode (still stubbed).
- Multi-session tabs in the UI (one active session at a time).
- Persistent agent memory beyond the chat history (no RAG, no embeddings).
- Diff/patch tool — only `EditFile` (exact-replace) in v1.
- Left-sidebar sessions UI (sessions are reachable via the inline `/sessions` overlay only).
- Auto-approval prompt for `RunCommand` (Phase 1 runs always-on per user choice; a future change may gate this).
- Token / cost accounting UI.
- Streaming tool arguments live in v1 — `ToolCallDelta` deltas are not surfaced as args mid-stream; we render the call only once `ToolCall` is fully formed (cleaner, matches user choice "collapsed until ToolResult done").

## Decisions

### D1. rig multi-turn agent as the execution primitive

Use `client.agent(model).preamble(system_prompt).tool(ReadFile).tool(WriteFile)...build()` and drive it with `agent.stream_prompt(msg).await` which returns `Stream<MultiTurnStreamItem>`. rig automatically runs the "model → call tool → feed result back → model → ..." loop up to the agent's `max_depth`.

**Why X over Y:** Hand-rolling the tool loop (parse `ToolCallDelta`, dispatch, re-prompt) duplicates rig's built-in multi-turn machinery and is errors-prone. Alternatives considered:

- _OpenAI function-calling SDK directly_: abandons the `LocalModelClient` abstraction we already built and the provider-agnostic Anthropic support. rig abstracts both.
- _Two separate streams per turn_: would require us to own the prompt bookkeeping rig handles. Worse UX (gaps between turns).

### D2. Path-escape protection via canonicalize + prefix check

Each FS tool clones `working_folder: PathBuf` at construction. Before any read/write/list, it:

1. `canonicalize(working_folder)?` once (lazily cached in a `OnceCell`).
2. Joins the requested relative path, canonicalizes the target, and verifies `target.starts_with(canonical_working_folder)`.
3. On mismatch, returns an `Err` whose `Display` tells the model the resolved path was outside the workspace.

Symlinks that resolve outside are rejected by the same prefix test on the canonicalized target. Files that don't yet exist (new `WriteFile`) are canonicalized via their parent dir, then the filename appended.

**Alternatives considered:** _Sandbox via `sandbox-exec`/`firejail`_ — non-portable (Linux-only). _Chroot_ — needs root. _Pure prefix string match on non-canonicalized paths_ — defeated by `..`. Canonicalize is the right balance.

### D3. `RunCommand` execution model

Each call spawns `tokio::process::Command::new(cmd).args(args).current_dir(working_folder).stdout(piped).stderr(piped)`. The tool serializes std streams to the model as plain text, truncated to 4 KB each (with a `[truncated]` suffix); exit code is included; a 120 s wall-clock timeout via `tokio::time::timeout` kills the child via `child.kill()` on drop. The shell is **not** used (`/bin/sh -c`) — the model emits `{ command, args: Vec<String> }`, which avoids quoting bugs and shell injection at the cost of requiring the model to split args.

**Alternatives considered:** _`sh -c` single string_ — easier for the model but reintroduces quoting risk; abandoned. _No timeout_ — a hung build could lock the session forever; abandoned.

### D4. Event surface: one Tauri event `agent:event` with discriminated payload

Replace `agent:done`/`agent:error` with a single event:

```jsonc
{ "session_id": "1737000000-jsTools", "event": { "type": "TextDelta", "delta": "... " } }
```

Event variants (mirrored in TS as a discriminated union):

- `TextDelta { delta }` — assistant text chunk
- `ToolCall { id, name, args }` — emitted when rig signals a fully-formed tool call (rig buffers args itself)
- `ToolResult { id, name, status: "ok"|"error", result }` — emitted when the tool returns
- `Done` — run finished cleanly
- `Error { message }` — run failed (transport or rig error)

**Why:** One event channel is simpler to subscribe + filter; the discriminated `type` preserves TS exhaustiveness checks. Matches the session-id-filter pattern commonly used in Tauri apps.

### D5. Session state in `Mutex<HashMap<SessionId, AgentSessionHandle>>`

Stored in `tauri::State`. Each handle owns the rig `AgentSession`, a `CancellationToken` (from `tokio_util::sync::CancellationToken` — added as a small dep, or a hand-rolled `Arc<AtomicBool>`), the session id, and an instance for the writer to append JSONL rows.

`agent_send` clones the handle, spawns the streaming future detached and emits events on `AppHandle`. On `Done`/`Error`, the handle's `busy` flag is cleared. `agent_cancel` signals the token; the next stream poll detects cancellation by way of `select!` over the stream and the cancellation future, yielding `Error("cancelled")`.

**Why:** Decouples command lifetime from `agentSend` return (which would otherwise block the IPC for the full agent turn) and makes cancel + session lookup O(1).

**Alt:** Return the stream from `agent_send` directly via a Tauri channel — supported but harder to drive a detached loop with cancellation; rejected for v1 simplicity.

### D6. Session storage format and id

**Path:** `<working_folder>/.learn/sessions/<id>.jsonl`.
**Id:** `<unix_secs>-<short-slug>` where `short-slug = slugify(first_user_message).take(24)`. Slug is purely informational, must be FS-safe (alnum + `-`).
**Rows:** one JSON object per line, each row one of:

```jsonc
{ "role": "user", "text": "..." }
{ "role": "assistant", "blocks": [{ "type": "text", "text": "..." }, { "type": "tool_call", "id": "...", "name": "...", "args": {...}, "status": "ok", "result": "..." }] }
```

`SessionMeta` (returned by `agent_list_sessions`): `{ id, title, created_at, updated_at, message_count, tool_call_count }`. `title` = first user message truncated to 60 chars; counts derived when listing by scanning the file (small in practice; if slow we'd add sidecar `meta.json` — non-goal for v1).

**Why JSONL:** append-only writes survive crashes mid-turn (no losing whole session); line-grained restore. **Alt:** single json file — requires rewrite on every append → racy + slow. Rejected.

### D7. Frontend: `useAgentSession` owns one session

Composable owns `sessionId`, `messages`, `busy`, `pendingBlocks`, `sessionsOpen`, `sessions`, `sessionsQuery`, `pendingConfirm`. On mount it calls `agentNewSession(workingFolder)` then subscribes to `agent:event` filtering by `session_id`. All UI components are driven solely from this composable's state; no per-component event wiring.

Slash handling lives in `slash-commands.ts` (pure registry + `matchInput`), invoked from `useAgentSession.send` (text starts with `/` → route there, else → `agentSend`). Keeping slash logic pure enables vitest unit tests without Tauri.

**Why:** centralizing event parsing in one composable avoids the fragmented `agent:done`/`agent:error` duplication seen in `ChatDialog.vue`. The slash registry is easily extended (`/clear`, `/cancel`, `/help` later) without touching the component.

### D8. Tool-call card is the signature UI element — notebook margin

`ToolCallCard.vue` renders with a 2px left border of `--color-accent` (the vermilion red pen), 12 px left padding, mono font for tool name + args + result. A running tool shows a pulsing vermilion dot; `ok` switches to `--color-mastered` green; `error` to `--color-brand-1` darker red. A collapsed card shows its header + first line of args; clicking (only after `status !== "running"`) expands `<details>` with full args JSON and result text (truncate 12 lines, scroll beyond).

**Why this signature:** The app's whole identity is the "annotated notebook." Opencode-style tool calls typically render as a grey `<pre>` block — boring and out of character. The vermilion margin reuses the brand color and gives a readable metaphor: the agent is "writing in the margin." This is the one aesthetic risk; the surrounding transcript is otherwise restrained ink-on-paper. (Matches the desktop-app brief: modern + minimal + distinct from generic.)

### D9. Slash menu placement

`SlashMenu.vue` is absolutely positioned directly above the textarea, anchored to its top-left, `max-h-60` with internal scroll, `--radius-card` rounded, 1px `--color-rule` border, `--color-bg-elv` background. Items are rows of `[4ch mono name] [pencil description]`; the highlighted row gets a `--color-accent-soft` background tint and a 2px left `--color-accent` bar. Fade-in 80 ms (0 under `prefers-reduced-motion`, which is already honored by the global CSS rule).

Triggered only when the _first character_ of the textarea is `/` (matches opencode). Typing `/` anywhere else does not open the menu. ↑↓/Enter/Esc are intercepted by the menu only while open; otherwise they pass through to the textarea (Enter sends, Shift+Enter newline — unchanged).

### D10. Sessions panel as inline overlay, not modal

`sessionsOpen` (`useAgentSession`) swaps `<transcript/>` for `<SessionsPanel/>` within the same `AgentChat` area; a `← back` ghost button restores the transcript. No backdrop scrim; the panel is the focal surface. Search is a `fieldControl` input at the top, filtering `sessions` by substring on `title` (case-insensitive). Empty state: "No sessions yet — back and type `/new` to start."

**Why over modal:** desktop-native feel, keeps the user in the panel context, no focus trap complications. Alt considered: centered modal — too heavy for browsing a short list.

### D11. `/new` inline confirm (not a toast/dialog)

When `messages.length > 0` and the user commits `/new` (Enter or click), the composable sets `pendingConfirm` instead of resetting. `AgentChat` renders a single-line chip just above the textarea: "Start a fresh session? Current chat will be saved to history." with `confirm`/`cancel` ghost buttons. `confirm` clears the confirm and calls `agentNewSession`. `cancel` clears confirm.

**Why:** opencode does immediate reset, but the user's project history is valuable here (we persist JSONL); a confirm prevents accidental transcript wipe without interruptive modal. Confirm is the second user choice.

### D12. Lazy system prompt construction

The agent's `preamble` is built from the working folder path + tool list + a short behavioral note ("use EditFile not WriteFile to modify existing files; prefer matching small strings; run lint/typecheck after Rust edits"). Lives as a `fn system_prompt(working_folder: &Path, tools: &[&str]) -> String` in `learn-agent::agent` so it's testable independently of rig.

## Risks / Trade-offs

- **[Risk] Model emits a path outside the working folder.** → Mitigation: D2 canonicalize prefix check rejects the call and returns an error string to the model, usually enough to course-correct in a later turn. We don't surface the path rejection in the host OS (no syscall), so worst case is wasted tokens.
- **[Risk] Long-running shell commands block the session.** → Mitigation: 120 s timeout + cancellation token (D3, D5).
- **[Risk] rig `MaxDepthError` aborts long tasks.** → Mitigation: set agent `max_turn` / depth to a generous bound (32). Beyond that the model gets a `Done` preceded by an explanatory text delta injected by us. Documented in the system prompt: "you have up to ~32 turns."
- **[Risk] Canonicalize fails on non-existent paths (WriteFile).** → Mitigation: canonicalize the _parent_ then append the filename; canonicalize the working folder eagerly at session start and store it.
- **[Risk] JSONL append races with `agent_list_sessions` scanning.** → Mitigation: per-session writer is single-threaded; list scans only complete lines (JSONL line boundary); race is benign — partial last line is skipped via `serde_json` error → ignored.
- **[Risk] App killed mid-turn leaves incomplete file.** → Mitigation: filesystem writes go through `tempfile::NamedTempFile::persist` pattern (the project already uses `tempfile` for `write_state`); shell commands' side effects are unavoidable.
- **[Trade-off] No auto-approval for `RunCommand`.** → Per user choice. Acceptable for v1; the worst the agent can do is inside the working folder (mostly). Documented; future change can add a per-call allowlist prompt.
- **[Trade-off] Single-session-at-a-time in UI.** → Keeps complexity bounded; matches the single workspace paradigm.
- **[Trade-off] JSONL list derive counts from full scan.** → Fine at v1 scale (expect tens of sessions per workspace); would add sidecar `meta.json` if it ever shows latency.
- **[Trade-off] We bump `learn-agent` deps with `glob` crate and `tokio-util` for `CancellationToken`.** → Minimal surface (glob is tiny; `tokio-util` `sync` feature only).

## Migration Plan

1. Land backend (`learn-agent` modules, then `src-tauri` rewrite) behind a feature flag-free commit. Tests cover tool guards + sessions round-trip.
2. Land frontend (`AgentChat`, `SlashMenu`, `ToolCallCard`, `SessionsPanel`, `useAgentSession`) — wire calls to the new commands. Remove `ChatDialog.vue`.
3. Replace Tauri command registration in `lib.rs`: drop `chat_create_topic`/`TopicCreated`; register the five new commands.
4. Update `commands.ts`: remove `chatCreateTopic`/`TopicCreated`; add new typed wrappers.
5. End-to-end smoke: open a folder, run `/new`, ask "create hello.txt with 'hi' and run ls to confirm". Verify transcript + tool cards + file on disk + session entry persists.
6. **Rollback:** if the agent surface is broken, revert the registration + frontend imports — existing topic files on disk remain readable. The breaking change is intentional; no migration shim for `chat_create_topic` callers (the only caller was the frontend we're replacing).

## Open Questions

- None blocking. Future scope (out of this change): auto-approval for `RunCommand`, left-sidebar sessions UI, `/clear`+`/cancel`+`/help` slash commands, `Diff` tool, multi-session tabs.
