## Context

Learn Anything ships today as a CLI (`packages/cli`) that scaffolds skill/command files into external AI tools, plus a static web dashboard (`packages/cli/site`) served by a Node dev-server (`serve.mjs`) that reads `.learn/topics/`. Crucially, **no AI capability lives in the CLI itself** — all learning behavior (Socratic teaching, quiz generation/grading, spaced-repetition review) is encoded in generated `SKILL.md` system prompts executed by whichever host AI tool the user runs.

We are now adding a standalone cross-platform **GUI** that contains its own built-in agent, so the user never leaves the app. The frontend stack is Vue 3 + Tauri v2 with a Rust backend. Phase 1 is intentionally a thin **capability-verification vertical slice**: one chat dialog that exercises the full foundation end-to-end, before any product-grade UI.

Constraints established during planning:

- The shipped binary MUST contain **no Node runtime** (keep the Tauri "small native binary" advantage; do not regress to Electron-class sizes).
- The GUI MUST consume the existing `.learn/` **v1** data contract, so folders created by the CLI interoperate.
- The agent layer MUST be abstracted now so a future **subscription server** (server-held keys) is a drop-in, not a rewrite.
- Phase 1 does **no v0→v1 migration**; v1 only.

Key data sources referenced by this design:

- v1 state schema: `packages/cli/src/scripts/utils.mts` (`StateV1`, `Domain`, `Concept`, status enum, validators).
- Render logic: `packages/cli/src/scripts/render.mts` (StateV1 → `knowledge-map.md`).
- learn-topic prompt: `packages/cli/src/core/templates/workflows/learn-topic.ts`.

## Goals / Non-Goals

**Goals:**

- Prove a Node-free Tauri v2 + Vue 3 binary boots cross-platform.
- Prove a user-supplied API key can be stored securely (OS keychain) and never persisted in plaintext.
- Prove a Rust LLM client (`rig`) can call providers (OpenAI-compatible + Anthropic) with the user's key, **with streaming and typed structured extraction**.
- Prove structured LLM output can be extracted directly into `StateV1` and written to `.learn/topics/<slug>/state.json` plus a rendered `knowledge-map.md` (v1).
- Establish the `ModelClient` trait seam (`LocalModelClient` implemented, `RemoteModelClient` stubbed) so the subscription path is structurally ready.
- Surface the whole flow through one chat dialog with a simple in-progress → done confirmation (no token streaming into the chat).

**Non-Goals:**

- Any product-grade frontend (dashboard, trees, search, full quiz UI, native-desktop polish, design system).
- The `learn-explain` / `learn-practice` / `learn-quiz` / `learn-review` / `learn-status` workflows.
- Built-in code editor and integrated terminal.
- The subscription server itself (only the client-side `RemoteModelClient` seam).
- Remote data sync, billing, auth, quotas.
- v0→v1 migration; the GUI assumes v1.

## Decisions

### D1 — Tauri v2 + OS webview (no Node/Chromium bundled)

The app compiles to a native Rust binary that drives the OS-provided webview (WebView2 / WKWebView / WebKitGTK). This yields a ~5–15 MB binary with no runtime tax.

- _Alternatives considered:_
  - **Electron** — rejected: ships Chromium + Node (~80–150 MB).
  - **Sidecar `serve.mjs` inside Tauri** — rejected: reintroduces a Node runtime dependency, defeating the size advantage and the "no Node" constraint.

### D2 — Rust LLM client via `rig`, not the Pi (Node) library

We evaluated `@earendil-works/pi-ai` (TypeScript). Source inspection showed it pulls hard Node-only dependencies (`@aws-sdk`, `@smithy/node-http-handler`, `http(s)-proxy-agent`, `engines.node>=22`) and its top-level `getModel`/`stream`/`complete` API lives in a side-effectful `compat` module — i.e. it is not browser/webview-runnable and would force bundling a Node runtime (regressing to D1's rejected path).

- _Decision:_ use [`rig-core`](https://crates.io/crates/rig-core) in Rust. It provides multi-provider clients (`openai`, `anthropic`, Gemini), configurable `api_key` and `base_url` (so OpenRouter / OpenAI-compatible proxies work), native streaming (`StreamingPrompt`), tool calling, and — critically — **typed extractors** (`client.extractor::<T>(model)`) that yield validated structures.
- _Alternatives considered:_
  - **`genai`** — lighter multi-provider chat crate, but lacks the extractor convenience we need for structured `StateV1` output.
  - **Plain `fetch` from the webview** — works for a single call but gives us no shared logic between the desktop and the future server, and no structured-output tooling.
- _Rationale:_ `rig` is pure Rust, async/tokio-native (drops straight into Tauri commands), and its extractor maps perfectly onto `learn-topic` (LLM → `StateV1`). The same `learn-agent` crate will run on the future server unchanged.

### D3 — `ModelClient` trait abstraction (Local now, Remote stub)

Define a Rust trait the workflow logic depends on, with two backends:

- `LocalModelClient`: wraps `rig`, bound to the user's key from the keychain. **Implemented in Phase 1.**
- `RemoteModelClient`: posts to the future subscription server which holds its own key and streams back. **Stub only** (trait impl returns `unimplemented!` / `Err(NotImplemented)`).
- _Why now:_ the BYOK path keeps the user's key local (never routed through our server), while the subscription path requires server-side key custody. Writing the workflow against the trait means subscription mode is a later backend swap, not a rewrite. The cost of the seam now is negligible.

### D4 — `learn-agent` as a standalone Rust library crate

All workflow logic, v1 types, render, and the `ModelClient` trait live in `packages/learn-agent`, depended on by both `packages/gui/src-tauri` (desktop) and the future `server` crate. This guarantees a single source of truth for learning logic across client and server, BYOK and subscription.

### D5 — `learn-topic` via `rig` extractor → `StateV1` (structured output)

Rather than asking the model for free text and parsing JSON by hand, the workflow uses `rig`'s extractor with a `StateV1`-shaped target (`serde::Deserialize` + `schemars::JsonSchema`). This yields validated, schema-conformant output directly and removes a whole class of parsing/repair bugs.

- _Source of the prompt:_ condensed from `packages/cli/src/core/templates/workflows/learn-topic.ts`, adapted for structured extraction (the model fills the taxonomy; deterministic rendering is done in Rust).

### D6 — Render ported to Rust (no Node script at runtime)

`knowledge-map.md` generation is reimplemented in Rust (mirroring `render.mts`), because shipping `render.mjs` would require Node on the user's machine. Render is pure (StateV1 → markdown string) and unit-testable.

### D7 — v1-only, no migration in the GUI

`open_project` validates `state.json.version == 1`. A non-v1 folder is rejected with a clear "run `learn-anything init` in the CLI to upgrade" message. No v0-handling code ships in the GUI.

- _Rationale:_ keeps the GUI's data layer minimal and correct; migration remains the CLI's responsibility.

### D8 — Completion events via Tauri (replacing the site's SSE)

The site uses `EventSource('/api/events')` over a Node server. In Tauri, the Rust command emits a completion event (`app.emit("agent:done", …)`) consumed by the webview via `listen(...)`. Unlike the site's token-by-token SSE, the GUI's `chat_create_topic` runs generation to completion (non-streaming) and emits a single `agent:done` carrying `{slug, topic, dir}` — locating metadata, not the rendered markdown. No HTTP/SSE plumbing is needed. (A streaming-progress echo was prototyped and dropped: it spent tokens on output the UX never displays.)

### D9 — OS keychain for the API key

Use Tauri's secure-storage plugin. The key is stored in the OS keychain; only the non-secret settings (provider, model id, chosen working dir) live in an `appData` config. The key is never written to plaintext files.

### D10 — Phase 1 surface = a single chat dialog

The frontend is the thinnest possible slice: key setup screen, one folder pick, and one chat view that shows an in-progress → done confirmation (no token streaming, no in-chat knowledge-map echo; the user reads `knowledge-map.md` from disk). Everything else is deferred. This keeps the spike focused on proving capabilities, not on UI.

## Risks / Trade-offs

- **[Risk] `rig` provider coverage/quality gaps** → Mitigation: Phase 1 only commits to OpenAI-compatible + Anthropic; `base_url` keeps proxies/region endpoints reachable. A fake/mock model in unit tests decouples CI from any live provider.
- **[Risk] Structured extraction occasionally returns schema-invalid output** → Mitigation: validate the extracted `StateV1` with the ported validators; surface a clear error + retry rather than writing a bad `state.json`.
- **[Risk] Tauri secure-storage availability varies by platform** → Mitigation: feature-detect; if keychain is unavailable, fail loudly at key-save with an explicit message (do not silently fall back to plaintext).
- **[Risk] The `RemoteModelClient` stub locks in a trait shape that later proves wrong** → Mitigation: keep the trait minimal (stream + extract) and document it as provisional; expect a (small) breaking change when the subscription server is built.
- **[Trade-off] No migration means pre-v1 CLI folders are rejected in the GUI** → accepted; documented to the user with a one-line CLI upgrade instruction.
- **[Trade-off] Reusing only the data contract (not site components) duplicates some rendering logic** → accepted; the GUI is intentionally a fresh implementation with its own future style.

## Migration Plan

Greenfield addition; no existing behavior changes.

- **Rollout:** add `packages/gui` and `packages/learn-agent`; neither is wired into `pnpm build`/`pnpm test` of the existing CLI flow unless desired. Existing `pnpm` scripts at the repo root are unaffected.
- **Rollback:** remove `packages/gui/`, `packages/learn-agent/`, and any workspace wiring. The CLI and site continue to work untouched.

## Open Questions

- **Provider default for "test key"**: should the key-test request target the cheapest model of the chosen provider, or a fixed probe model? (Lean: cheapest configured model, one short completion.)
- **Working-directory persistence granularity**: store a single "last opened" dir (simplest) vs. a recents list? Phase 1 lean: single last-opened dir; recents are a later UX concern.
- **Extractor failure policy**: on invalid structured output, retry automatically (and how many times) vs. immediately surface to the user? (Lean: one silent retry, then surface.)
