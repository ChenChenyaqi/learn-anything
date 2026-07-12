//! GUI ↔ Node agent sidecar bridge.
//!
//! Spawns a long-lived Node process that owns the agent runtime and shuttles
//! newline-delimited JSON frames between it and the Tauri frontend. The
//! process boots lazily on the first [`commands::agent_new_session`] call
//! (see [`state::SidecarBoot`]).
//!
//! - [`types`] — wire/data models shared with the frontend.
//! - [`state`] — process handles, pending-reply registries, lazy boot.
//! - [`wire`] — stdout frame parsing and stdin frame writing.
//! - [`reader`] — the stdout pump that emits Tauri events and resolves replies.
//! - [`process`] — sidecar binary resolution and spawning.
//! - [`log`] — human-readable debug tracing of every frame.
//! - [`cwd`] — working-folder resolution.
//! - [`commands`] — the `#[tauri::command]` entry points.

mod commands;
mod cwd;
mod log;
mod process;
mod reader;
mod state;
mod types;
mod wire;

pub use commands::{
    agent_cancel, agent_list_sessions, agent_load_session, agent_new_session, agent_send,
    agent_switch_session,
};
pub use state::SidecarBoot;
