//! Process handles, pending-reply registries, and lazy sidecar boot.

use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::process::Child;
use tokio::sync::{oneshot, Mutex};

use super::process::boot_sidecar;
use super::types::{ActiveSession, LoadSessionResult, SessionMeta};

pub(super) type StdinWriter = Box<dyn tokio::io::AsyncWrite + Unpin + Send>;

pub(super) struct SidecarState {
    pub stdin: Mutex<StdinWriter>,
    pub sessions: Mutex<HashMap<String, ActiveSession>>,
    pub last_session_id: Mutex<Option<String>>,
    pub boot_tx: Mutex<Option<oneshot::Sender<String>>>,
    pub pending_list: Mutex<HashMap<String, oneshot::Sender<Vec<SessionMeta>>>>,
    pub pending_load: Mutex<HashMap<String, oneshot::Sender<LoadSessionResult>>>,
    pub pending_switch: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub booted: Mutex<bool>,
    pub reply_counter: AtomicU64,
}

pub(super) struct SidecarHandle {
    // Held so its `kill_on_drop` guard keeps the Node process alive; never read.
    #[allow(dead_code)]
    pub child: Mutex<Child>,
    pub state: Arc<SidecarState>,
}

/// Lazily-initialized sidecar state.
///
/// The sidecar process is NOT spawned in `setup` (which runs outside the Tokio
/// runtime). Instead, it boots on the first `agent_new_session` call — a Tauri
/// async command that already executes inside the runtime context.
pub struct SidecarBoot {
    inner: Mutex<Option<Result<SidecarHandle, String>>>,
}

impl Default for SidecarBoot {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

/// Boot the sidecar if it hasn't been booted yet, then return its state.
pub(super) async fn get_or_boot(
    boot: &SidecarBoot,
    app: &AppHandle,
) -> Result<Arc<SidecarState>, String> {
    let mut guard = boot.inner.lock().await;
    if guard.is_none() {
        *guard = Some(boot_sidecar(app));
    }
    match guard.as_ref().unwrap() {
        Ok(handle) => Ok(handle.state.clone()),
        Err(e) => Err(e.clone()),
    }
}

/// Return the sidecar state without booting. Errors if not yet booted.
pub(super) async fn require_state(boot: &SidecarBoot) -> Result<Arc<SidecarState>, String> {
    let guard = boot.inner.lock().await;
    match guard.as_ref() {
        Some(Ok(handle)) => Ok(handle.state.clone()),
        Some(Err(e)) => Err(e.clone()),
        None => Err("Sidecar not initialized. Start a new session first.".into()),
    }
}

#[cfg(test)]
pub(super) fn make_test_state() -> Arc<SidecarState> {
    Arc::new(SidecarState {
        stdin: Mutex::new(Box::new(tokio::io::sink())),
        sessions: Mutex::new(HashMap::new()),
        last_session_id: Mutex::new(None),
        boot_tx: Mutex::new(None),
        pending_list: Mutex::new(HashMap::new()),
        pending_load: Mutex::new(HashMap::new()),
        pending_switch: Mutex::new(HashMap::new()),
        booted: Mutex::new(false),
        reply_counter: AtomicU64::new(0),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn require_state_not_booted_returns_error() {
        let boot = SidecarBoot::default();
        let result = require_state(&boot).await;
        match result {
            Err(msg) => assert!(msg.contains("not initialized")),
            Ok(_) => panic!("expected error"),
        }
    }

    #[tokio::test]
    async fn require_state_with_failed_boot_returns_error() {
        let boot = SidecarBoot {
            inner: Mutex::new(Some(Err("Node not found".into()))),
        };
        let result = require_state(&boot).await;
        match result {
            Err(msg) => assert!(msg.contains("Node not found")),
            Ok(_) => panic!("expected error"),
        }
    }

    #[tokio::test]
    async fn require_state_with_ready_handle_succeeds() {
        let state = make_test_state();
        let handle = SidecarHandle {
            child: Mutex::new(tokio::process::Command::new("true").spawn().unwrap()),
            state,
        };
        let boot = SidecarBoot {
            inner: Mutex::new(Some(Ok(handle))),
        };
        let result = require_state(&boot).await;
        assert!(result.is_ok());
    }
}
