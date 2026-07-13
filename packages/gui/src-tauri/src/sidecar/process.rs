//! Sidecar binary resolution and process spawning.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;

use super::log::log;
use super::reader::run_reader;
use super::state::{SidecarHandle, SidecarState, StdinWriter};

fn sidecar_entry() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let path = PathBuf::from(manifest_dir).join("../sidecar/dist/sidecar.js");
        if !path.exists() {
            return Err(format!(
                "Sidecar entry not found at {}. Run `pnpm run build:sidecar` first.",
                path.display()
            ));
        }
        Ok(path)
    } else {
        Err("Production sidecar resolution not yet implemented".into())
    }
}

pub(super) fn boot_sidecar(app: &AppHandle) -> Result<SidecarHandle, String> {
    let entry = sidecar_entry()?;

    let mut child = tokio::process::Command::new("node")
        .arg(&entry)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .kill_on_drop(true)
        .env("SIDECAR_LOG", if cfg!(debug_assertions) { "1" } else { "0" })
        .spawn()
        .map_err(|e| format!("Failed to spawn Node sidecar: {e}"))?;

    log(format!(
        "spawn node pid={} entry={}",
        child.id().unwrap_or(0),
        entry.display()
    ));

    let stdin: StdinWriter = Box::new(
        child
            .stdin
            .take()
            .ok_or("failed to capture sidecar stdin")?,
    );
    let stdout = child
        .stdout
        .take()
        .ok_or("failed to capture sidecar stdout")?;

    let state = Arc::new(SidecarState {
        stdin: Mutex::new(stdin),
        sessions: Mutex::new(HashMap::new()),
        last_session_id: Mutex::new(None),
        boot_tx: Mutex::new(None),
        pending_list: Mutex::new(HashMap::new()),
        pending_load: Mutex::new(HashMap::new()),
        pending_switch: Mutex::new(HashMap::new()),
        booted: Mutex::new(false),
        reply_counter: AtomicU64::new(0),
    });

    let reader_state = state.clone();
    let reader_app = app.clone();
    tokio::spawn(async move {
        run_reader(reader_app, reader_state, stdout).await;
    });

    Ok(SidecarHandle {
        child: Mutex::new(child),
        state,
    })
}
