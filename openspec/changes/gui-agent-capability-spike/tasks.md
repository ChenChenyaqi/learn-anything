## 1. Workspace & Scaffolding

- [x] 1.1 Create the Cargo workspace: add a root `Cargo.toml` (workspace) covering `packages/learn-agent` and `packages/gui/src-tauri`, without disturbing the existing pnpm CLI build
- [x] 1.2 Scaffold the `packages/learn-agent` Rust library crate (`lib.rs`, `Cargo.toml` with `serde`, `schemars`, `rig-core`, `tokio`, `anyhow`)
- [ ] 1.3 Scaffold `packages/gui/src-tauri` via Tauri v2 (Vue 3 + Vite preset), and replace the placeholder `packages/gui/package.json`/README with the real app config
- [ ] 1.4 Wire `packages/gui` into `pnpm-workspace.yaml`; add `src-tauri` as a dependency on the local `learn-agent` crate
- [ ] 1.5 Verify `pnpm tauri dev` opens a window showing a placeholder Vue page (no Node required at runtime)

## 2. learn-agent: v1 Data Types & Render

- [ ] 2.1 Define `StateV1`, `Domain`, `Concept` structs and the status enum in `learn-agent`, matching `packages/cli/src/scripts/utils.mts` (serde + schemars)
- [ ] 2.2 Port the v1 validators (confidence in [0,1], non-negative integer counts, `details` string array, valid status) as a `validate_state` function
- [ ] 2.3 Port the `render` logic from `packages/cli/src/scripts/render.mts` to a pure `fn render(state: &StateV1) -> String` (topic title, mastered/total header, per-domain sections, concept bullets with status icons + detail lines)
- [ ] 2.4 Add unit tests: validator accept/reject cases, and a render snapshot test using the repo's `.learn/topics/javascript/state.json` as fixture

## 3. learn-agent: ModelClient Abstraction

- [ ] 3.1 Define the `ModelClient` trait (async `stream` + async `extract::<T>`), documenting it as the BYOK/subscription seam
- [ ] 3.2 Implement `LocalModelClient` backed by `rig`: configurable provider (OpenAI-compatible + Anthropic), API key, optional `base_url`; streaming via `rig` streaming API; extraction via `rig` extractor
- [ ] 3.3 Implement `RemoteModelClient` as a stub returning a "not implemented" error for every operation (subscription placeholder)
- [ ] 3.4 Add a `FakeModelClient` test double that yields canned streaming deltas and a canned extracted value, to keep workflow tests offline
- [ ] 3.5 Add tests proving workflow code depends on the trait (compiles against any impl) and that swapping Local→Fake requires no workflow change

## 4. learn-agent: learn-topic Workflow

- [ ] 4.1 Condense the `learn-topic.ts` instructions (`packages/cli/src/core/templates/workflows/learn-topic.ts`) into an extraction prompt that returns a `StateV1` taxonomy
- [ ] 4.2 Implement `learn_topic(client: &dyn ModelClient, topic: &str)` that runs extraction and validates the result with `validate_state`; retry once on invalid output, then surface an error
- [ ] 4.3 Implement `write_state(dir, state)` writing `.learn/topics/<slug>/state.json` (`"version": 1`) and `render` to `.learn/topics/<slug>/knowledge-map.md`
- [ ] 4.4 Add a streaming variant that yields progress deltas while extraction runs, then the final rendered markdown
- [ ] 4.5 Add tests using `FakeModelClient`: valid extraction writes both files; invalid extraction (after retry) errors and writes nothing

## 5. src-tauri: Keychain & Config

- [ ] 5.1 Add the Tauri secure-storage plugin; implement `save_key`/`load_key` commands storing the API key in the OS keychain
- [ ] 5.2 Implement appData config (non-secret): provider, model id, optional base_url, last working-folder path
- [ ] 5.3 Implement a `test_key` command: one short completion against the configured provider, returning success/failure with the error reason; ensure the key is never logged

## 6. src-tauri: Project & File Commands

- [ ] 6.1 Implement `pick_project_dir` using a native Tauri file dialog, persisting the choice to appData
- [ ] 6.2 Implement `open_project` that validates the working folder's `state.json` is `"version": 1`; reject non-v1 with a "run `learn-anything init` in the CLI to upgrade" message (no migration)
- [ ] 6.3 Implement `create_project`/ensure `.learn/topics/` exists for a new working folder

## 7. src-tauri: learn-topic Tauri Command

- [ ] 7.1 Register a `chat_create_topic(topic)` Tauri command that loads the key + config, builds a `LocalModelClient`, and runs `learn_topic`
- [ ] 7.2 Emit `agent:delta` events as progress arrives, and an `agent:done` event carrying the rendered `knowledge-map.md` markdown on success
- [ ] 7.3 Emit an `agent:error` event (no files written) on failure; wire the working folder from appData into the write path

## 8. Frontend: Shell & Setup

- [ ] 8.1 Create the minimal Vue 3 page in `packages/gui/src`: a single-window app whose primary surface is one chat dialog
- [ ] 8.2 Implement the API-key setup screen (provider, optional base URL, model id, secret key) shown when no key is stored; wire it to `save_key`/`test_key`
- [ ] 8.3 Implement the folder-pick flow (`pick_project_dir`) and surface the non-v1 rejection message from `open_project`
- [ ] 8.4 Follow the system light/dark theme by default

## 9. Frontend: Chat Dialog & Streaming

- [ ] 9.1 Build the chat dialog UI: message input and a transcript area
- [ ] 9.2 Subscribe to `agent:delta`/`agent:done`/`agent:error` via `@tauri-apps/api/event`; render streamed deltas live and the final knowledge map (markdown) on `agent:done`
- [ ] 9.3 Trigger `chat_create_topic` from user input (e.g. "create a topic: JavaScript")

## 10. End-to-End Verification

- [ ] 10.1 Run `pnpm tauri dev`, set a key, pick the repo's `.learn` working folder, and create a new topic via the chat dialog
- [ ] 10.2 Confirm streamed output and the final knowledge map render in the dialog
- [ ] 10.3 Confirm `.learn/topics/<slug>/state.json` (`version: 1`) and `knowledge-map.md` are written and valid
- [ ] 10.4 Confirm a pre-v1 folder is rejected with the CLI-upgrade message and no files are modified
- [ ] 10.5 Confirm the running application requires no Node runtime on the host
