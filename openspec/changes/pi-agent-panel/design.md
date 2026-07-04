## Context

The desktop app uses Tauri v2 — a small Rust backend hosts a system WebView (macOS WebKit / Windows WebView2 / Linux WebKitGTK) rendering a Vue 3 frontend. Tauri was chosen over Electron specifically to bundle **no** Node/Chromium runtime; the native binary stays ~10-20 MB and reuses the OS webview.

The current agent is hand-rolled in Rust on `rig-core 0.39` and lives in `packages/learn-agent/` (an entire workspace crate: `agent.rs`, `tools/*` 9 files, `model.rs`, `state.rs`, `render.rs`, `workflow.rs`, `utils.rs`, `prompts/`, `mock/` — ~3,300 lines across 16 files). The crate also houses `ModelClient` (BYOK trait with `LocalModelClient`/`RemoteModelClient`/`FakeModelClient` impls), `StateV1` v1-data types + `validate_state`, `learn_topic` structured-extraction workflow, and 7 workspace-scoped `Tool` implementations. Phase 1 (`gui-agent-capability-spike`) shipped a non-streaming `chat_create_topic` that runs one `ModelClient::extract` call to produce a knowledge map. Phase 2 (`right-agent-panel-rig-tools`, only Tasks 1-2 done) attempted to grow that into a real streamed multi-turn agent with sessions, slash commands, and an `AgentChat.vue` right panel — all hand-rolled in Rust.

The maintenance burden of owning a multi-turn agent loop, multi-provider dispatch, JSONL session storage, tool implementations, and a parallel TS↔Rust type mirror (StateV1, ChatRow, AgentEvent, SessionMeta) is the original motivation for this change. The [pi](https://github.com/earendil-works/pi) framework (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`) already provides all of this natively — `agentLoop` with automatic tool execution + TypeBox arg validation, `createAgentSession` / `AgentSessionRuntime` with `newSession`/`switchSession`/`fork`, `SessionManager` JSONL tree persistence under `~/.pi/agent/sessions/<cwd>/`, `pi.registerCommand` for slash commands, built-in `read`/`write`/`edit`/`bash`/`grep`/`find`/`ls` tools, `AbortSignal` cancellation, BYOK via `AuthStorage.setRuntimeApiKey` (key never persisted), and `pi.registerProvider` / `ModelRegistry` for `base_url` overrides.

Constraints inherited from the codebase / prior user choices:

- BYOK only — the API key lives in the OS keychain (macOS Keychain / Windows Credential Manager / Linux secret-service via the `keyring` v3 crate) and is NEVER written to plaintext config or files.
- The Rust backend owns the keychain: it reads the key on demand and is the only layer that talks to the OS credential store. The frontend only ever sees a masked preview (e.g. `sk-…7X2J`) via the `load_key` Tauri command.
- All file/shell operations the agent performs MUST stay inside `config.last_working_folder` (user choice from the retired spec).
- Tauri was chosen over Electron to bundle no Chromium — switching the whole GUI to Electron is on the table for evaluation but is explicitly out of scope for this change (see D1).
- The visual language is fixed: "Annotated Notebook" tokens in `packages/gui/src/styles/main.css` (vermilion red pen `--color-brand-2` / `--color-accent`, Inter + system mono, warm-white / graphite dark bg). The `ToolCallCard` uses `--color-accent` for its 2px left margin — no new palette.

## Goals / Non-Goals

**Goals:**

- Delete the entire Rust agent surface (`learn-agent` crate, Tauri `agent.rs`/`commands.rs`, `ChatDialog.vue`) so future agent features land in pi, not in bespoke Rust.
- Adopt pi as the agent backend without rewriting the GUI shell — keep Tauri + the system WebView, add a Node sidecar that runs pi.
- Preserve the frontend event contract that the retired `right-agent-panel-rig-tools` change already specified: the five-variant `AgentEvent` discriminated union over a single `agent:event` Tauri event. The sidecar is the adaptation layer, so frontend code is identical whether the backend was rig or pi.
- Ship opencode-style UX: `AgentChat.vue` streaming transcript, `SlashMenu.vue`, notebook-margin `ToolCallCard.vue`, `/new` (with inline confirm), `/sessions` (inline overlay), `/compact`/`/clear`/`/help`/`/model`, Stop button.
- Keep BYOK semantics intact: key flows keychain → Rust → sidecar stdin (never argv) → pi `setRuntimeApiKey` (never persisted).

**Non-Goals:**

- Migrating to Electron. The sidecar approach keeps Tauri's system-webview size win (saves ~2-3× the app bundle vs Electron + Chromium) at the cost of bundling ~40-70 MB of Node runtime + npm deps. Evaluated in D1; out of scope.
- Persisting sessions under `<working_folder>/.learn/sessions/`. pi's `SessionManager` defaults to `~/.pi/agent/sessions/<cwd>/` JSONL trees; we adopt its location rather than mirror the retired spec's path. The `.learn/topics/` tree is untouched.
- Re-implementing the strict `Workspace` canonicalize-then-prefix path-escape guard from the retired Rust tools. pi tools operate on the sidecar process `cwd` (= working folder) which bounds the blast radius without a bespoke security layer. A future change can add `pi.registerTool` wrappers if a stricter guard is needed.
- Auto-approval prompts for `bash`. v1 of this change runs pi's built-in tools always-on, matching the prior user choice. A future change can add a per-call hook.
- Token / cost accounting UI. pi exposes `usage` on the final message but we surface nothing in v1.
- Subscription / `RemoteModelClient` mode. The retired `ModelClient` trait had a stub; pi has the equivalent `AuthStorage` + `ModelRegistry` seam so a future subscription backend can be plugged in without touching workflows.
- Multi-session tabs in the UI (one active session at a time, same as the retired spec).
- Diff/patch tool. pi ships `edit` only (same scope as the retired Rust `EditFile`).

## Decisions

### D1. Node sidecar via Tauri `externalBin`, NOT Electron migration

Tauri launches the pi sidecar as a child process and talks to it over stdin/stdout JSONL. The Rust backend holds `ChildStdin`/`ChildStdout` in `tauri::State` and forwards `agent:event` events to the frontend.

**Why X over Y:**

- _Electron migration_ — agent-in-main-process, no IPC. But bundles Chromium (~+150 MB per platform), forces a full rewrite of the Tauri Rust backend (keychain, config, dialog), and loses the system-webview story. Net cost: 2-3× bundle size + rewrite.
- _Pure-Rust like pi (`pi-rs`?)_ — does not exist; pi is TS-only.
- _WASM (pi ported to wasm in the WebView)_ — pi's `agentLoop` needs a network runtime + fs tools neither Tauri's WebView nor a sandboxed WASM can cleanly provide.

The sidecar keeps the no-Chromium-bundle property (still ~60-100 MB total thanks to bundled Node, vs 200-300 MB+ for Electron), preserves the existing keychain/config/dialog Rust code unchanged, and writes no new Rust agent code.

**Trade-off:** cross-process IPC is lossy compared to in-process dispatch; the stdin/stdout JSONL protocol is the new seam we own. Mitigated by D4 (single `agent:event` channel + a `ui_request` round-trip channel) which keeps the seam tiny.

### D2. API key flows keychain → Rust → sidecar stdin (never argv, never a file)

On `agent_new_session` the Rust backend reads the key from the keychain (existing `keychain::read_key`), resolves provider/model/base_url from `AppConfig`, and writes a single JSON frame to the sidecar's stdin: `{ apiKey, provider, baseUrl, model, cwd, sessionId? }`. The sidecar calls `AuthStorage.setRuntimeApiKey(provider, apiKey)` immediately; pi then uses the key for outgoing LLM calls without persisting it.

**Why this channel:** `argv` is observable via `ps` and in `/proc/<pid>/cmdline` long after the process exits; env vars leak the same way and persist into child processes. A named pipe has the same protections as stdin with more setup. stdin is consumed once at boot and gone.

**Alternatives considered:**

- _`os keychain → sidecar direct_` — would require the sidecar to link to the OS keychain library (`keyring`crate equivalent in Node, e.g.`keytar`) and read the secret itself. Bypasses the Rust backend's single ownership of the credential store;="">increases the attack surface. Rejected.
- _`keychain → temp file unreadable to other users_` — files have a persistent backup risk (Time Machine, system snapshots) and don't belong in a keychain-first design. Rejected.

### D3. Single `agent:event` Tauri event carrying `{ session_id, event: AgentEvent }`

Same as the retired `right-agent-panel-rig-tools` D4. One channel is simpler to subscribe + filter by `session_id`; the discriminated `type` tag preserves TS exhaustiveness checks. Replacing `agent:done`/`agent:error` (the Phase-1 events) with a single `agent:event` matches the prior spec, so the frontend composable architecture is unchanged.

### D4. `ui_request` round-trip channel for frontend-side UI prompts

Some sidecar actions need to ask the user something mid-run (the canonical case is `/sessions`: list sessions and wait for a pick). pi's `ctx.ui.select` is a TUI primitive; in our WebView world the picker must render in the frontend. So the sidecar emits `ui_request { request_id, kind, payload }` on stdout, the Rust backend forwards it as a `agent:ui_request` Tauri event, the frontend replies via an `agent_reply_ui(request_id, value)` Tauri command, the Rust backend writes the reply back to stdin as a `ui_response { request_id, value }` frame.

**Why a generic channel:** future slash commands or tool hooks (`bash` pre-approval) reuse the same round-trip without protocol churn. The single round-trip seam is the only frontend→sidecar forward path beyond user messages and cancels.

**Alternatives considered:**

- _Per-request Tauri commands (e.g. `agent_select_session`, `agent_confirm_bash`)_ — multiplies the command surface and forces each sidecar-side producer to know its dedicated channel. Rejected in favor of one generic channel.
- _WebSocket / HTTP from sidecar → frontend_ — the sidecar is launched without a network port; introducing one would expand the attack surface and complicate bundling. Rejected.

### D5. Sessions owned by pi `SessionManager`; no `.learn/sessions/` path

The retired spec planned `<working_folder>/.learn/sessions/<id>.jsonl` and a Rust `sessions.rs` module with `new`/`load`/`list`/`append`. We adopt pi's defaults instead: `SessionManager.create(cwd)` persists JSONL tree under `~/.pi/agent/sessions/<cwd>/` with `id`/`parentId` in-place branching. `agent_list_sessions` becomes a thin proxy to `SessionManager.list(cwd)` over the sidecar channel; `agent_load_session` proxies to `SessionManager.load` + `runtime.switchSession`.

**Why:** pi's storage is more capable than what we'd hand-roll (tree branching, compaction metadata, cross-process safety) and we'd otherwise duplicate it. The cost is a less-discoverable session location, but the frontend never reads files directly — the path is an implementation detail. The `.learn/topics/` tree (the actual learning state) is untouched.

**Trade-off:** losing the "all learn-anything state in `.learn/`" locality. Mitigated by documenting `~/.pi/agent/sessions/` as the session location and keeping `.learn/topics/` for the learning contract.

### D6. `AgentEvent` adaptation lives in the sidecar, frontend contract unchanged

The sidecar adapts pi's `AgentSessionEvent` (`message_update`/`text_delta`, `toolcall_end`, tool results surfaced as `tool_result` `StreamedUserContent`, `done`, `error`) into the five-variant `AgentEvent` JSONL on stdout. The frontend's `useAgentSession` composable keeps the exact TS discriminated union from the retired spec.

**Why:** the frontend code in the retired `right-agent-panel-rig-tools` spec (Tasks 5-7, never completed) is reusable byte-for-byte. The adaptation cost moves entirely to one TypeScript function in the sidecar — much cheaper than rewriting the frontend.

### D7. Built-in pi tools, process `cwd` is the working folder

`createAgentSession({ cwd: workingFolder, tools: [ "read", "write", "edit", "bash", "grep", "find", "ls" ] })` (or default to built-ins). pi's tools then operate relative to that `cwd`. We do NOT re-implement the strict canonicalize-then-prefix path-escape guard from the retired Rust `Workspace` in v1 — pi's `cwd` scoping is the new path bound. A `pi.registerTool` wrapper that re-applies the strict guard can be added in a future change if a real escape vector turns up.

**Why:** Rust `tempfile`+`fs::canonicalize`+`OnceLock` was the single biggest chunk of bespoke Rust code we wanted to delete. Re-implementing it as TypeScript duplicates pi's value proposition. The `cwd`-bound model is what opencode and Claude Code both use; users have a working expectation of it.

### D8. Provider enum stays in `config.rs`, inlined

`Provider` (two variants, lowercase serde rename, default `OpenAi`) moves from `learn_agent::model::Provider` into `packages/gui/src-tauri/src/config.rs`. It keeps the same JSON shape so existing `~/.<app-data>/config.json` files keep loading. Frontend `Provider` type in `lib/commands.ts` is unchanged.

**Why:** a separate "tiny utility crate just for `Provider`" would be over-engineering. `Provider` is consumed in exactly one file post-change.

### D9. Aggressive Rust dependency pruning

`packages/gui/src-tauri/Cargo.toml` drops `learn-agent.workspace = true`, `futures.workspace = true`, and the `tokio` `time` feature (only `test_key`, which is being deleted, used `tokio::time::timeout`). `anyhow`, `serde`, `serde_json`, `url`, `keyring`, `tauri`, `tauri-plugin-dialog` stay — keychain, config, folder-pick + v1-topic scan remain Rust responsibilities. The `ChildStdin`/`ChildStdout` plumbing reuses `tokio::process::Command` from `tauri`'s transitive tokio; if a direct `tokio` dep is needed for the sidecar task it gets re-added with `features = ["process", "io-util", "rt"]` only.

**Why:** this is the "clean slate" the user requested — a tidy Tauri backend before the pi work begins. Dead `futures`/`time` deps would lie about the surface.

## Risks / Trade-offs

- **[Risk] `ps` exposes the sidecar's command line.** → Mitigation: BYOK key flows over stdin only (D2), never argv, never env. The Rust backend constructs the sidecar invocation with no secret arguments.
- **[Risk] Bundled Node runtime inflates the app bundle ~40-70 MB per platform.** → Mitigation: still ~2-3× smaller than Electron (which also bundles Chromium). Documented in the proposal Impact section. A future change can switch the bundler (e.g. `bun build --compile`, `pkg`, `n temporada`) to shrink Node itself.
- **[Risk] Cross-process IPC is slower than in-process calls.** → Mitigation: round-trip latency for one JSONL line is sub-millisecond on localhost stdio; not a UX concern for agent tokens (already streaming-limited by the LLM provider). The `ui_request` round-trip is at most one extra hop per user-facing prompt.
- **[Risk] Sidecar crashes mid-session lose the in-memory pi state.** → Mitigation: pi `SessionManager` persists to JSONL on disk; the Rust backend watches the sidecar's exit code and surfaces an `agent:event` `{ type: "error", message: "agent process exited" }` for the active session. The user can `/sessions` and restore.
- **[Risk] No strict path-escape guard (D7).** → Mitigation: pi's `cwd`-bound tools refuse absolute paths in the simple cases; for v1 we accept the broader blast radius (the agent could write anywhere the user can) since the working folder was user-selected and the user is BYOK-empowered. Future `pi.registerTool` wrappers can reintroduce the strict guard if needed.
- **[Risk] pi upgrades may break our adapted `AgentEvent` shape.** → Mitigation: pin `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` in `packages/gui/sidecar/package.json`; the adapter is one module with snapshot tests covering each `AgentSessionEvent` → `AgentEvent` mapping.
- **[Risk] The Rust `Provider` enum and the frontend `Provider` type drift.** → Mitigation: same two-variant lowercase shape; a TS compile test (the existing `pnpm -F learn-anything-gui build` covers it) catches any rename on either side.
- **[Trade-off] Adding `~/.pi/agent/sessions/` as a second state location alongside `.learn/topics/`.** → Cost: discoverability of learner data across two roots. Mitigated by the frontend never touching session files directly and `agent_list_sessions` hiding the path behind the sidecar.
- **[Trade-off] Losing the `tool_call_count` from `SessionMeta`.** → Cost: the retired spec's row metada `<n> msgs · <Xh ago> · <k> tool calls` shrinks to `<n> msgs · <Xh ago>` (user-confirmed simplification, since pi's `SessionMeta` does not expose tool-call counts for free).

## Migration Plan

The codebase is in a clean state because Phase 2 (`right-agent-panel-rig-tools`) only completed Tasks 1-2 (the Rust `tools/` and `agent.rs`) — nothing in the frontend has shipped beyond the Phase-1 `ChatDialog.vue`. So there is no end-user migration; this change removes never-used code plus the Phase-1 chat surface, and lands the new surface alongside.

1. **Step A — code deletion (single commit):** Delete the `learn-agent` crate, the Tauri `agent.rs`/`commands.rs` modules, `ChatDialog.vue`, the dead `chatCreateTopic`/`TopicCreated`/`testKey`/`TestKeyParams` TS exports; inline `Provider` into `config.rs`; prune `Cargo.toml` deps. Delete the two superseded `openspec/changes/*` directories. Verify `cargo check --workspace` and `pnpm -F learn-anything-gui build` are green.
2. **Step B — pi-agent-panel openspec change lands (this change).** Pairs with Step A as the design record for the move.
3. **Step C — sidecar skeleton (`packages/gui/sidecar/`):** `package.json` with pinned pi deps and a `build` script that produces a single Node entry; `src/main.ts` implementing the stdin BYOK frame, `createAgentSession`, `AgentSessionEvent` → `AgentEvent` mapping, slash command registration, `ui_request` round-trip.
4. **Step D — Rust sidecar lifecycle:** `src/sidecar.rs` in `src-tauri`, registers the sidecar via `tauri.conf.json` `externalBin`, owns stdin/stdout + the active session table, implements the five `agent_*` Tauri commands, emits `agent:event`, wires the `agent:ui_request` round trip.
5. **Step E — frontend surface:** `AgentChat.vue`, `SlashMenu.vue`, `ToolCallCard.vue`, `SessionsPanel.vue`, `useAgentSession.ts`, `lib/slash-commands.ts`, `lib/time.ts`, updated `lib/commands.ts` and `lib/ui.ts`. Mount `AgentChat` in `App.vue`.
6. **Step F — end-to-end verification:** manual smoke of `/new` + a real prompt that invokes `write` + `bash`, the Stop button, app-restart session restore via `/sessions`. Snapshot tests for the `AgentEvent` adapter, vitest for `slash-commands.matchInput` and `relativeTime`.

**Rollback:** every step is independently revertible. Step A rolls back by restoring one commit. Steps C-E are additive (new files) — reverting Step A makes them inert, and they have no impact on the shipped Phase-1 experience once the agent.rs/commands.rs deletion also restores `chat_create_topic` (which is exactly what rollback would do). The OpenSpec change (Step B) is documentation only; rollback is `git revert`.

## Open Questions

- Sidecar bundler choice (`esbuild` vs `bun build --compile` vs `pkg` vs `n temporada`). Pick a small-runtime option later; v1 uses stock Node + `esbuild` for the entry, with Node bundled via `externalBin` side-by-side. Smaller-runtimes are a follow-up change.
- Where exactly `~/.pi/agent/sessions/` lives on Windows (%APPDATA% vs %LOCALAPPDATA% vs %USERPROFILE%). pi's default decides; out of scope for design.
- Whether the `/compact` slash command needs a custom-instructions argument in the UI or just runs with defaults. v1 spec already accepts the optional argument inline; UI can ship the no-arg form first.
- OpenAI Realtime / Anthropic streaming-betas support in pi — not required for v1 text+tool streaming, but worth tracking for later.
