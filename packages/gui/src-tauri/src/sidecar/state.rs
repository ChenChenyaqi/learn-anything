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
    /// The cwd this sidecar process was booted against. The agent's tools and
    /// session storage are pinned to the boot cwd, so `agent_new_session` compares
    /// against this to decide whether a folder switch requires a re-boot.
    pub cwd: Mutex<Option<String>>,
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

/// Tear down a booted sidecar: kill the child process and drop the cached
/// handle so the next `get_or_boot` re-spawns a fresh process. Used when the
/// working folder changes — the agent's cwd + session storage are pinned at
/// boot, so a folder switch requires re-booting with the new cwd.
///
/// The reader task spawned in `boot_sidecar` keeps its own `Arc<SidecarState>`
/// clone; killing the child closes stdout, the reader hits EOF and exits on its
/// own, releasing that last clone. Any pending reply channels on the old state
/// are dropped, surfacing as errors to whoever was waiting (callers must not be
/// mid-flight during a controlled re-boot).
pub(super) async fn teardown_sidecar(boot: &SidecarBoot) {
    let mut guard = boot.inner.lock().await;
    if let Some(Ok(handle)) = guard.take() {
        let mut child = handle.child.lock().await;
        let _ = child.kill().await;
    }
}

/// The cwd the currently-booted sidecar is bound to, or `None` if not booted
/// (or not yet recorded). Used by `agent_new_session` to decide whether a
/// folder switch requires a re-boot.
pub(super) async fn booted_cwd(boot: &SidecarBoot) -> Option<String> {
    let guard = boot.inner.lock().await;
    match guard.as_ref() {
        Some(Ok(handle)) => handle.state.cwd.lock().await.clone(),
        _ => None,
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
        cwd: Mutex::new(None),
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

    #[tokio::test]
    async fn booted_cwd_none_when_not_booted() {
        let boot = SidecarBoot::default();
        assert_eq!(booted_cwd(&boot).await, None);
    }

    #[tokio::test]
    async fn booted_cwd_returns_recorded_cwd() {
        let state = make_test_state();
        *state.cwd.lock().await = Some("/proj".into());
        let handle = SidecarHandle {
            child: Mutex::new(tokio::process::Command::new("true").spawn().unwrap()),
            state,
        };
        let boot = SidecarBoot {
            inner: Mutex::new(Some(Ok(handle))),
        };
        assert_eq!(booted_cwd(&boot).await.as_deref(), Some("/proj"));
    }

    #[tokio::test]
    async fn teardown_sidecar_clears_handle() {
        let state = make_test_state();
        let handle = SidecarHandle {
            child: Mutex::new(tokio::process::Command::new("true").spawn().unwrap()),
            state,
        };
        let boot = SidecarBoot {
            inner: Mutex::new(Some(Ok(handle))),
        };
        // Before teardown the sidecar is "booted".
        assert!(require_state(&boot).await.is_ok());
        teardown_sidecar(&boot).await;
        // After teardown the handle is gone — no booted cwd, and require errors.
        assert_eq!(booted_cwd(&boot).await, None);
        assert!(require_state(&boot).await.is_err());
    }
}
