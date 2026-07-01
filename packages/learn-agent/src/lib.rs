//! Shared learning-agent library for Learn Anything.
//!
//! Holds the learning-workflow logic, the v1 data types, the [`ModelClient`]
//! abstraction, and the knowledge-map rendering. It is depended on by both the
//! Tauri desktop binary (`packages/gui/src-tauri`) and the future subscription
//! server, giving a single source of truth for learning logic across
//! client/server and BYOK/subscription modes.
//!
//! Capabilities are filled in by later tasks:
//! - v1 data types & validators (`state` module)
//! - knowledge-map rendering (`render` module)
//! - [`ModelClient`] trait + `LocalModelClient` / `RemoteModelClient` (`model`)
//! - `learn-topic` workflow (`workflow`)

#![forbid(unsafe_code)]
