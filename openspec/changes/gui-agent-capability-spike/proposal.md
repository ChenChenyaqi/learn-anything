## Why

Learn Anything currently runs as a CLI that scaffolds skill files for external AI tools (Claude Code, Cursor, etc.). The actual learning agent logic lives in those generated `SKILL.md` files, executed by whichever host tool the user happens to use — there is no first-class, self-contained application. We are starting a cross-platform **GUI** (Vue 3 + Tauri v2, Rust backend) that hosts its own built-in agent so the entire workflow — talking to the AI, viewing notes, taking quizzes, writing and running code — happens inside one app, with no dependency on any external AI tool.

Because this is a large surface, Phase 1 is deliberately a **capability-verification vertical slice**: a single chat dialog that proves the foundational stack works end-to-end before any product-grade UI is built. It validates that we can boot a Node-free native binary, securely hold a user-supplied API key, drive a Rust LLM client with streaming, produce validated structured output, and persist it to the existing `.learn/` (v1) format. Proving these now de-risks every later phase.

## What Changes

- **New Tauri v2 desktop shell** (`packages/gui`): a cross-platform native binary (no bundled Node/Chromium runtime — it uses the OS webview). Hosts a minimal Vue 3 single-page app with one chat window, a folder picker, and an API-key setup screen. Follows the system theme. **No design system, no native-desktop polish, no dashboard in this phase** — functional UI only.
- **New Rust agent library** (`packages/learn-agent`): a standalone crate that both the desktop binary and a future server will depend on. Holds the learning workflow logic, the v1 data types, and an LLM-client abstraction.
- **New `ModelClient` abstraction**: a Rust trait with two interchangeable backends — `LocalModelClient` (uses the [`rig`](https://crates.io/crates/rig-core) crate, multi-provider: OpenAI-compatible + Anthropic, configurable key and `base_url` for proxies/OpenRouter, streaming and structured extraction) and `RemoteModelClient` (a **stub** reserved for the future subscription proxy, where the server holds the key). The workflow logic is written only against the trait, so the subscription mode is a later drop-in.
- **Secure API-key storage** via the OS keychain (Tauri secure-storage plugin). The key is never written to plaintext config.
- **First built-in agent workflow — `learn-topic`**: the entry workflow that generates a knowledge map for a topic. Implemented as a `rig` _extractor_ that produces the `StateV1` structure directly (validated), then writes `.learn/topics/<slug>/state.json` and renders `knowledge-map.md`.
- **v1-only data handling, no migration**: the GUI reads/writes the v1 state schema exclusively. There is **no v0→v1 migration** in the GUI; a pre-v1 folder surfaces a clear "upgrade via CLI" message.
- **Streaming UX**: agent token deltas are emitted from Rust to the webview in real time and rendered in the chat dialog; on completion the generated knowledge map is displayed and the files are confirmed written.

### Out of scope for Phase 1 (future vision, explicitly deferred)

These define the long-term product but are **not** built now; they are listed so the Phase 1 seams accommodate them:

- Product-grade frontend: dashboard, sidebar topic/exercise trees, knowledge-map browser, search, full quiz-taking UI, native-desktop look-and-feel.
- The remaining agent workflows: `learn-explain`, `learn-practice`, `learn-quiz`, `learn-review`, `learn-status`.
- Built-in code editor and integrated terminal.
- The **subscription backend**: a server that proxies LLM calls with server-held keys (`RemoteModelClient`), plus per-user auth, quotas, and billing.
- Remote learning-data sync.
- Full i18n (English/Chinese) beyond the bare minimum.

## Capabilities

### New Capabilities

- `gui-desktop-shell`: The Tauri v2 native application shell — boots a cross-platform, Node-free binary; manages window lifecycle and system-theme; hosts the minimal Vue 3 page; provides the folder picker and API-key setup screen; renders the single chat dialog that displays streamed agent output and the generated knowledge map.
- `agent-keychain`: Secure storage and retrieval of the user's LLM API key through the OS keychain, with no plaintext persistence, plus a "test key" verification request.
- `agent-model-client`: The Rust `ModelClient` abstraction — a `LocalModelClient` backed by `rig` (OpenAI-compatible + Anthropic providers, configurable API key and `base_url`, streaming and typed structured extraction) and a `RemoteModelClient` stub that defines the subscription-proxy seam.
- `agent-learn-topic`: The built-in `learn-topic` workflow — runs the `rig` extractor to produce a validated `StateV1`, writes `.learn/topics/<slug>/state.json` (v1) and renders `knowledge-map.md`, with no v0 migration; exposes a Tauri command that streams progress to the frontend and returns the final map.

### Modified Capabilities

<!-- No existing spec-level requirements are changed. The CLI and site packages are untouched; the GUI is a greenfield addition and the v1 data schema it consumes is already fixed. -->

## Impact

- **New top-level structure**:
  - `packages/gui/` — Tauri v2 + Vue 3 + Vite application (currently a placeholder `package.json`/`README.md`).
  - `packages/gui/src/` — minimal Vue 3 frontend (chat dialog, key setup, folder pick).
  - `packages/gui/src-tauri/` — Rust backend: Tauri commands, keychain wiring, file I/O.
  - `packages/learn-agent/` — new Rust workspace library crate (workflow logic, `ModelClient`, v1 types, render).
  - Cargo workspace root wiring for `packages/learn-agent` and `packages/gui/src-tauri/`.
- **Existing code**: untouched. `packages/cli` and `packages/cli/site` continue to work unchanged; the GUI reuses only the **data contract** (the v1 `state.json` schema defined in `packages/cli/src/scripts/utils.mts` and the render output shape from `render.mts`), not their code.
- **New Rust dependencies** (in `learn-agent` / `src-tauri`): `rig-core` (LLM client, streaming, extractor), `serde`/`schemars` (v1 types + extraction schema), `notify` (future fs watching), Tauri plugins for secure storage and dialog. Frontend adds `@tauri-apps/api`.
- **No Node runtime dependency**: the shipped application contains no Node binary; the `cli/site` Node dev-server (`serve.mjs`) is **not** bundled — all backend file access is reimplemented as Rust Tauri commands.
- **Verification target**: `pnpm tauri dev` → set key → pick a folder → type "create a topic: JavaScript" → watch streamed output + final knowledge map → confirm `.learn/topics/javascript/{state.json,knowledge-map.md}` written as valid v1.
