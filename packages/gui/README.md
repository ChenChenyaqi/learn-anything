# Learn Anything — GUI

Cross-platform desktop application built with **Tauri v2** (Rust backend) and **Vue 3 + Vite** (frontend using the OS webview — no bundled Node/Chromium).

This package is the Phase 1 **capability-verification spike**: a single-window shell that will host one chat dialog exercising the agent stack end-to-end.

## Prerequisites

- [Rust](https://www.rust-lang.org/) toolchain (stable)
- Node.js >= 20 and pnpm (frontend dev tooling only — not shipped in the binary)
- Tauri v2 [system dependencies](https://v2.tauri.app/start/prerequisites/)

## Development

From this package (or the repo root via the workspace):

```bash
pnpm install
pnpm tauri dev
```

`pnpm tauri dev` starts the Vite dev server and launches the native window.

## Build a production binary

```bash
pnpm tauri build
```

The agent logic lives in the shared `packages/learn-agent` Rust crate, on which the `src-tauri` binary depends.
