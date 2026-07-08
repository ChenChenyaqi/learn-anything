use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdout};
use tokio::sync::{oneshot, Mutex};

use crate::config::{self, Provider};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentEvent {
    #[serde(rename = "text_delta")]
    TextDelta { delta: String },
    #[serde(rename = "tool_call")]
    ToolCall {
        id: String,
        name: String,
        args: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        id: String,
        name: String,
        status: String,
        result: Option<String>,
    },
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_call")]
    ToolCall {
        id: String,
        name: String,
        args: serde_json::Value,
        status: String,
        result: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "role")]
pub enum ChatRow {
    #[serde(rename = "user")]
    User { text: String },
    #[serde(rename = "assistant")]
    Assistant { blocks: Vec<ChatBlock> },
}

#[derive(Debug, Clone)]
pub struct ActiveSession {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NewSessionResult {
    pub session_id: String,
}

pub struct LoadSessionResult {
    pub rows: Vec<ChatRow>,
    pub found: bool,
}

type StdinWriter = Box<dyn tokio::io::AsyncWrite + Unpin + Send>;

pub struct SidecarState {
    pub stdin: Mutex<StdinWriter>,
    pub sessions: Mutex<HashMap<String, ActiveSession>>,
    pub last_session_id: Mutex<Option<String>>,
    pub boot_tx: Mutex<Option<oneshot::Sender<String>>>,
    pub ui_replies: Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>,
    pub pending_list: Mutex<HashMap<String, oneshot::Sender<Vec<SessionMeta>>>>,
    pub pending_load: Mutex<HashMap<String, oneshot::Sender<LoadSessionResult>>>,
    pub booted: Mutex<bool>,
    pub reply_counter: AtomicU64,
}

pub struct SidecarHandle {
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

#[derive(Debug)]
enum StdoutLine {
    AgentEvent {
        session_id: String,
        event: AgentEvent,
    },
    SessionId(String),
    UiRequest {
        request_id: String,
        kind: String,
        payload: serde_json::Value,
    },
    ListSessionsReply {
        request_id: String,
        sessions: Vec<SessionMeta>,
    },
    LoadSessionReply {
        request_id: String,
        session_id: String,
        rows: Vec<ChatRow>,
        found: bool,
    },
}

fn parse_stdout_line(line: &str) -> Result<StdoutLine, String> {
    let v: serde_json::Value =
        serde_json::from_str(line).map_err(|e| format!("invalid JSON: {e}"))?;

    if let Some(t) = v.get("type").and_then(|t| t.as_str()) {
        match t {
            "session_id" => {
                let id = v
                    .get("session_id")
                    .and_then(|s| s.as_str())
                    .ok_or("session_id line missing session_id")?
                    .to_string();
                Ok(StdoutLine::SessionId(id))
            }
            "ui_request" => {
                let request_id = v
                    .get("request_id")
                    .and_then(|s| s.as_str())
                    .ok_or("ui_request missing request_id")?
                    .to_string();
                let kind = v
                    .get("kind")
                    .and_then(|s| s.as_str())
                    .ok_or("ui_request missing kind")?
                    .to_string();
                let payload = v.get("payload").cloned().unwrap_or_default();
                Ok(StdoutLine::UiRequest {
                    request_id,
                    kind,
                    payload,
                })
            }
            "list_sessions_reply" => {
                let request_id = v
                    .get("requestId")
                    .and_then(|s| s.as_str())
                    .ok_or("list_sessions_reply missing requestId")?
                    .to_string();
                let sessions: Vec<SessionMeta> = serde_json::from_value(
                    v.get("sessions")
                        .cloned()
                        .unwrap_or(serde_json::Value::Array(vec![])),
                )
                .map_err(|e| format!("list_sessions_reply: {e}"))?;
                Ok(StdoutLine::ListSessionsReply {
                    request_id,
                    sessions,
                })
            }
            "load_session_reply" => {
                let request_id = v
                    .get("requestId")
                    .and_then(|s| s.as_str())
                    .ok_or("load_session_reply missing requestId")?
                    .to_string();
                let session_id = v
                    .get("session_id")
                    .and_then(|s| s.as_str())
                    .ok_or("load_session_reply missing session_id")?
                    .to_string();
                let rows: Vec<ChatRow> = serde_json::from_value(
                    v.get("rows")
                        .cloned()
                        .unwrap_or(serde_json::Value::Array(vec![])),
                )
                .map_err(|e| format!("load_session_reply rows: {e}"))?;
                let found = v.get("found").and_then(|b| b.as_bool()).unwrap_or(false);
                Ok(StdoutLine::LoadSessionReply {
                    request_id,
                    session_id,
                    rows,
                    found,
                })
            }
            _ => Err(format!("unknown stdout line type: {t}")),
        }
    } else if v.get("event").is_some() && v.get("session_id").is_some() {
        let session_id = v["session_id"]
            .as_str()
            .ok_or("agent event line missing session_id")?
            .to_string();
        let event: AgentEvent =
            serde_json::from_value(v["event"].clone()).map_err(|e| format!("agent event: {e}"))?;
        Ok(StdoutLine::AgentEvent { session_id, event })
    } else {
        Err("unrecognized stdout line".into())
    }
}

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

pub fn boot_sidecar(app: &AppHandle) -> Result<SidecarHandle, String> {
    let entry = sidecar_entry()?;

    let mut child = tokio::process::Command::new("node")
        .arg(&entry)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn Node sidecar: {e}"))?;

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
        ui_replies: Mutex::new(HashMap::new()),
        pending_list: Mutex::new(HashMap::new()),
        pending_load: Mutex::new(HashMap::new()),
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

fn next_request_id(counter: &AtomicU64) -> String {
    format!("req-{}", counter.fetch_add(1, Ordering::Relaxed))
}

async fn run_reader(app: AppHandle, state: Arc<SidecarState>, stdout: ChildStdout) {
    let mut reader = BufReader::new(stdout);
    let app_ref = app;
    let emit = |event: &str, payload: serde_json::Value| {
        let _ = app_ref.emit(event, payload);
    };
    pump_reader(&state, &mut reader, emit).await;
}

async fn pump_reader<R, F>(state: &Arc<SidecarState>, reader: &mut R, emit: F)
where
    R: tokio::io::AsyncBufRead + Unpin,
    F: Fn(&str, serde_json::Value),
{
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim_end_matches(['\r', '\n']);
                if trimmed.is_empty() {
                    continue;
                }
                match parse_stdout_line(trimmed) {
                    Ok(StdoutLine::AgentEvent { session_id, event }) => {
                        *state.last_session_id.lock().await = Some(session_id.clone());
                        emit(
                            "agent:event",
                            serde_json::json!({ "session_id": session_id, "event": event }),
                        );
                    }
                    Ok(StdoutLine::SessionId(id)) => {
                        *state.last_session_id.lock().await = Some(id.clone());
                        if let Some(tx) = state.boot_tx.lock().await.take() {
                            let _ = tx.send(id);
                        }
                    }
                    Ok(StdoutLine::UiRequest {
                        request_id,
                        kind,
                        payload,
                    }) => {
                        emit(
                            "agent:ui_request",
                            serde_json::json!({
                                "request_id": request_id,
                                "kind": kind,
                                "payload": payload,
                            }),
                        );
                    }
                    Ok(StdoutLine::ListSessionsReply {
                        request_id,
                        sessions,
                    }) => {
                        if let Some(tx) = state.pending_list.lock().await.remove(&request_id) {
                            let _ = tx.send(sessions);
                        }
                    }
                    Ok(StdoutLine::LoadSessionReply {
                        request_id,
                        session_id,
                        rows,
                        found,
                    }) => {
                        if let Some(tx) = state.pending_load.lock().await.remove(&request_id) {
                            let _ = tx.send(LoadSessionResult { rows, found });
                        }
                        let _ = session_id;
                    }
                    Err(e) => {
                        eprintln!("sidecar: unparseable stdout line: {e}");
                    }
                }
            }
            Err(e) => {
                eprintln!("sidecar: stdout read error: {e}");
                break;
            }
        }
    }

    let last = state.last_session_id.lock().await.clone();
    if let Some(sid) = last {
        emit(
            "agent:event",
            serde_json::json!({
                "session_id": sid,
                "event": { "type": "error", "message": "agent process exited" },
            }),
        );
    }
}

async fn write_frame(state: &SidecarState, frame: serde_json::Value) -> Result<(), String> {
    let mut stdin = state.stdin.lock().await;
    write_frame_to(&mut *stdin, frame).await
}

async fn write_frame_to<W: tokio::io::AsyncWrite + Unpin>(
    writer: &mut W,
    frame: serde_json::Value,
) -> Result<(), String> {
    let line = serde_json::to_string(&frame).map_err(|e| e.to_string())?;
    writer
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("failed to write to sidecar stdin: {e}"))?;
    writer
        .write_all(b"\n")
        .await
        .map_err(|e| format!("failed to write newline to sidecar stdin: {e}"))?;
    Ok(())
}

fn resolve_cwd(app: &AppHandle, working_folder: Option<String>) -> Result<String, String> {
    let config = config::load_config(app).map_err(|e| e.to_string())?;
    resolve_cwd_from(working_folder, config.last_working_folder)
}

fn resolve_cwd_from(
    working_folder: Option<String>,
    last_working_folder: Option<String>,
) -> Result<String, String> {
    if let Some(cwd) = working_folder.filter(|s| !s.trim().is_empty()) {
        return Ok(cwd);
    }
    last_working_folder
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "No working folder set. Choose a project folder first.".into())
}

/// Boot the sidecar if it hasn't been booted yet, then return its state.
async fn get_or_boot(boot: &SidecarBoot, app: &AppHandle) -> Result<Arc<SidecarState>, String> {
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
async fn require_state(boot: &SidecarBoot) -> Result<Arc<SidecarState>, String> {
    let guard = boot.inner.lock().await;
    match guard.as_ref() {
        Some(Ok(handle)) => Ok(handle.state.clone()),
        Some(Err(e)) => Err(e.clone()),
        None => Err("Sidecar not initialized. Start a new session first.".into()),
    }
}

#[tauri::command]
pub async fn agent_new_session(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    working_folder: Option<String>,
) -> Result<NewSessionResult, String> {
    let state = get_or_boot(&boot, &app).await?;

    let (tx, rx) = oneshot::channel();
    {
        let mut boot_tx = state.boot_tx.lock().await;
        if boot_tx.is_some() {
            return Err("A session creation is already in progress".into());
        }
        *boot_tx = Some(tx);
    }

    let mut booted = state.booted.lock().await;
    if !*booted {
        let config = config::load_config(&app).map_err(|e| e.to_string())?;
        let api_key = config
            .api_key
            .clone()
            .ok_or("No API key set. Add your key in Settings first.")?;
        let cwd = resolve_cwd(&app, working_folder)?;
        let provider = match config.provider {
            Provider::OpenAi => "openai",
            Provider::Anthropic => "anthropic",
        };
        let frame = serde_json::json!({
            "apiKey": api_key,
            "provider": provider,
            "baseUrl": config.base_url,
            "model": config.model,
            "cwd": cwd,
            "sessionId": null,
        });
        write_frame(&state, frame).await?;
        *booted = true;
    } else {
        drop(booted);
        let frame = serde_json::json!({ "kind": "slash_command", "text": "/new" });
        write_frame(&state, frame).await?;
    }

    let session_id = tokio::time::timeout(std::time::Duration::from_secs(30), rx)
        .await
        .map_err(|_| "Sidecar did not announce a session_id within 30s".to_string())?
        .map_err(|_| "Sidecar boot channel was dropped".to_string())?;

    state.sessions.lock().await.insert(
        session_id.clone(),
        ActiveSession {
            id: session_id.clone(),
        },
    );

    Ok(NewSessionResult { session_id })
}

#[tauri::command]
pub async fn agent_send(
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    let state = require_state(&boot).await?;
    {
        let sessions = state.sessions.lock().await;
        if !sessions.contains_key(&session_id) {
            return Err(format!("Session {session_id} is not active"));
        }
    }
    let frame = serde_json::json!({
        "kind": "user_message",
        "sessionId": session_id,
        "text": text,
    });
    write_frame(&state, frame).await
}

#[tauri::command]
pub async fn agent_cancel(
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
) -> Result<(), String> {
    let state = require_state(&boot).await?;
    let frame = serde_json::json!({
        "kind": "cancel",
        "sessionId": session_id,
    });
    write_frame(&state, frame).await
}

#[tauri::command]
pub async fn agent_list_sessions(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    working_folder: Option<String>,
) -> Result<Vec<SessionMeta>, String> {
    let state = require_state(&boot).await?;
    let cwd = match resolve_cwd(&app, working_folder) {
        Ok(cwd) => cwd,
        Err(_) => return Ok(vec![]),
    };

    let request_id = next_request_id(&state.reply_counter);
    let (tx, rx) = oneshot::channel();
    state
        .pending_list
        .lock()
        .await
        .insert(request_id.clone(), tx);

    let frame = serde_json::json!({ "kind": "list_sessions", "cwd": cwd, "requestId": request_id });
    write_frame(&state, frame).await?;

    let sessions = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Sidecar did not reply to list_sessions within 15s".to_string())?
        .map_err(|_| "Reply channel was dropped".to_string())?;

    Ok(sessions)
}

#[tauri::command]
pub async fn agent_load_session(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
    working_folder: Option<String>,
) -> Result<Vec<ChatRow>, String> {
    let state = require_state(&boot).await?;
    let cwd = resolve_cwd(&app, working_folder)?;

    let request_id = next_request_id(&state.reply_counter);
    let (tx, rx) = oneshot::channel();
    state
        .pending_load
        .lock()
        .await
        .insert(request_id.clone(), tx);

    let frame = serde_json::json!({
        "kind": "load_session",
        "sessionId": session_id,
        "cwd": cwd,
        "requestId": request_id,
    });
    write_frame(&state, frame).await?;

    let result = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Sidecar did not reply to load_session within 15s".to_string())?
        .map_err(|_| "Reply channel was dropped".to_string())?;

    if !result.found {
        return Err(format!("Session {session_id} was not found"));
    }

    Ok(result.rows)
}

#[tauri::command]
pub async fn agent_reply_ui(
    boot: tauri::State<'_, SidecarBoot>,
    request_id: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let state = require_state(&boot).await?;
    let frame = serde_json::json!({
        "kind": "ui_response",
        "requestId": request_id,
        "value": value,
    });
    write_frame(&state, frame).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_state() -> Arc<SidecarState> {
        Arc::new(SidecarState {
            stdin: Mutex::new(Box::new(tokio::io::sink())),
            sessions: Mutex::new(HashMap::new()),
            last_session_id: Mutex::new(None),
            boot_tx: Mutex::new(None),
            ui_replies: Mutex::new(HashMap::new()),
            pending_list: Mutex::new(HashMap::new()),
            pending_load: Mutex::new(HashMap::new()),
            booted: Mutex::new(false),
            reply_counter: AtomicU64::new(0),
        })
    }

    #[test]
    fn parse_agent_event_text_delta() {
        let line = r#"{"session_id":"abc","event":{"type":"text_delta","delta":"hello"}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::AgentEvent { session_id, event } => {
                assert_eq!(session_id, "abc");
                match event {
                    AgentEvent::TextDelta { delta } => assert_eq!(delta, "hello"),
                    other => panic!("expected TextDelta, got {other:?}"),
                }
            }
            other => panic!("expected AgentEvent, got {other:?}"),
        }
    }

    #[test]
    fn parse_agent_event_done() {
        let line = r#"{"session_id":"s1","event":{"type":"done"}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::AgentEvent { event, .. } => match event {
                AgentEvent::Done => {}
                other => panic!("expected Done, got {other:?}"),
            },
            other => panic!("expected AgentEvent, got {other:?}"),
        }
    }

    #[test]
    fn parse_agent_event_tool_call() {
        let line = r#"{"session_id":"s1","event":{"type":"tool_call","id":"t1","name":"bash","args":{"cmd":"ls"}}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::AgentEvent { event, .. } => match event {
                AgentEvent::ToolCall { id, name, args } => {
                    assert_eq!(id, "t1");
                    assert_eq!(name, "bash");
                    assert_eq!(args["cmd"], "ls");
                }
                other => panic!("expected ToolCall, got {other:?}"),
            },
            other => panic!("expected AgentEvent, got {other:?}"),
        }
    }

    #[test]
    fn parse_agent_event_tool_result() {
        let line = r#"{"session_id":"s1","event":{"type":"tool_result","id":"t1","name":"bash","status":"ok","result":"file.txt"}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::AgentEvent { event, .. } => match event {
                AgentEvent::ToolResult {
                    id, status, result, ..
                } => {
                    assert_eq!(id, "t1");
                    assert_eq!(status, "ok");
                    assert_eq!(result.as_deref(), Some("file.txt"));
                }
                other => panic!("expected ToolResult, got {other:?}"),
            },
            other => panic!("expected AgentEvent, got {other:?}"),
        }
    }

    #[test]
    fn parse_agent_event_error() {
        let line = r#"{"session_id":"s1","event":{"type":"error","message":"cancelled"}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::AgentEvent { event, .. } => match event {
                AgentEvent::Error { message } => assert_eq!(message, "cancelled"),
                other => panic!("expected Error, got {other:?}"),
            },
            other => panic!("expected AgentEvent, got {other:?}"),
        }
    }

    #[test]
    fn parse_session_id_announcement() {
        let line = r#"{"type":"session_id","session_id":"new-session"}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::SessionId(id) => assert_eq!(id, "new-session"),
            other => panic!("expected SessionId, got {other:?}"),
        }
    }

    #[test]
    fn parse_ui_request() {
        let line = r#"{"type":"ui_request","request_id":"r1","kind":"select_session","payload":{"sessions":[]}}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::UiRequest {
                request_id,
                kind,
                payload,
            } => {
                assert_eq!(request_id, "r1");
                assert_eq!(kind, "select_session");
                assert!(payload.get("sessions").is_some());
            }
            other => panic!("expected UiRequest, got {other:?}"),
        }
    }

    #[test]
    fn parse_list_sessions_reply_with_request_id() {
        let line = r#"{"type":"list_sessions_reply","requestId":"req-0","sessions":[{"id":"s1","title":"Test","created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z","message_count":5}]}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::ListSessionsReply {
                request_id,
                sessions,
            } => {
                assert_eq!(request_id, "req-0");
                assert_eq!(sessions.len(), 1);
                assert_eq!(sessions[0].id, "s1");
            }
            other => panic!("expected ListSessionsReply, got {other:?}"),
        }
    }

    #[test]
    fn parse_load_session_reply_with_request_id() {
        let line = r#"{"type":"load_session_reply","requestId":"req-1","session_id":"s1","rows":[{"role":"user","text":"hello"}],"found":true}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::LoadSessionReply {
                request_id,
                session_id,
                rows,
                found,
            } => {
                assert_eq!(request_id, "req-1");
                assert_eq!(session_id, "s1");
                assert!(found);
                assert_eq!(rows.len(), 1);
            }
            other => panic!("expected LoadSessionReply, got {other:?}"),
        }
    }

    #[test]
    fn parse_invalid_json_errors() {
        let result = parse_stdout_line("not json");
        assert!(result.is_err());
    }

    #[test]
    fn parse_unknown_type_errors() {
        let result = parse_stdout_line(r#"{"type":"unknown_thing"}"#);
        assert!(result.is_err());
    }

    #[test]
    fn parse_unrecognized_line_errors() {
        let result = parse_stdout_line(r#"{"foo":"bar"}"#);
        assert!(result.is_err());
    }

    #[test]
    fn agent_event_serializes_with_type_tag() {
        let event = AgentEvent::TextDelta { delta: "hi".into() };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "text_delta");
        assert_eq!(json["delta"], "hi");
    }

    #[test]
    fn chat_row_assistant_with_blocks_round_trips() {
        let row = ChatRow::Assistant {
            blocks: vec![
                ChatBlock::Text {
                    text: "thinking...".into(),
                },
                ChatBlock::ToolCall {
                    id: "t1".into(),
                    name: "bash".into(),
                    args: serde_json::json!({"cmd": "echo hi"}),
                    status: "ok".into(),
                    result: Some("hi".into()),
                },
            ],
        };
        let json = serde_json::to_string(&row).unwrap();
        let back: ChatRow = serde_json::from_str(&json).unwrap();
        match back {
            ChatRow::Assistant { blocks } => {
                assert_eq!(blocks.len(), 2);
                match &blocks[0] {
                    ChatBlock::Text { text } => assert_eq!(text, "thinking..."),
                    other => panic!("expected Text, got {other:?}"),
                }
                match &blocks[1] {
                    ChatBlock::ToolCall { name, status, .. } => {
                        assert_eq!(name, "bash");
                        assert_eq!(status, "ok");
                    }
                    other => panic!("expected ToolCall, got {other:?}"),
                }
            }
            other => panic!("expected Assistant, got {other:?}"),
        }
    }

    #[test]
    fn session_meta_round_trips() {
        let meta = SessionMeta {
            id: "s1".into(),
            title: "Test".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            updated_at: "2024-01-02T00:00:00Z".into(),
            message_count: 42,
        };
        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains(r#""message_count":42"#));
        assert!(!json.contains("tool_call_count"));
        let back: SessionMeta = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "s1");
        assert_eq!(back.message_count, 42);
    }

    #[test]
    fn resolve_cwd_from_arg_takes_priority() {
        let cwd = resolve_cwd_from(Some("/arg/path".into()), Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/arg/path");
    }

    #[test]
    fn resolve_cwd_from_config_fallback() {
        let cwd = resolve_cwd_from(None, Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/config/path");
    }

    #[test]
    fn resolve_cwd_from_neither_errors() {
        let cwd = resolve_cwd_from(None, None);
        assert!(cwd.is_err());
        assert!(cwd.unwrap_err().contains("No working folder"));
    }

    #[test]
    fn resolve_cwd_from_blank_arg_falls_through() {
        let cwd = resolve_cwd_from(Some("  ".into()), Some("/config/path".into()));
        assert_eq!(cwd.unwrap(), "/config/path");
    }

    #[test]
    fn resolve_cwd_from_blank_both_errors() {
        let cwd = resolve_cwd_from(Some("  ".into()), Some("".into()));
        assert!(cwd.is_err());
    }

    #[tokio::test]
    async fn write_frame_to_produces_json_plus_newline() {
        use tokio::io::AsyncReadExt;
        let (mut rx, mut tx) = tokio::io::duplex(1024);
        let frame = serde_json::json!({
            "kind": "user_message",
            "sessionId": "s1",
            "text": "hello",
        });
        write_frame_to(&mut tx, frame).await.unwrap();
        tx.shutdown().await.unwrap();
        let mut buf = String::new();
        rx.read_to_string(&mut buf).await.unwrap();
        assert!(buf.contains(r#""kind":"user_message""#), "{buf}");
        assert!(buf.contains(r#""sessionId":"s1""#), "{buf}");
        assert!(buf.contains(r#""text":"hello""#), "{buf}");
        assert!(buf.ends_with('\n'), "must end with newline: {buf}");
    }

    #[tokio::test]
    async fn write_frame_to_ui_response_has_correct_shape() {
        use tokio::io::AsyncReadExt;
        let (mut rx, mut tx) = tokio::io::duplex(1024);
        let frame = serde_json::json!({
            "kind": "ui_response",
            "requestId": "r1",
            "value": "choice-42",
        });
        write_frame_to(&mut tx, frame).await.unwrap();
        tx.shutdown().await.unwrap();
        let mut buf = String::new();
        rx.read_to_string(&mut buf).await.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(buf.trim()).unwrap();
        assert_eq!(parsed["kind"], "ui_response");
        assert_eq!(parsed["requestId"], "r1");
        assert_eq!(parsed["value"], "choice-42");
    }

    #[tokio::test]
    async fn pump_reader_forwards_agent_event_and_eof_error() {
        let state = make_test_state();
        let emitted = std::sync::Arc::new(std::sync::Mutex::new(
            Vec::<(String, serde_json::Value)>::new(),
        ));
        let emit = {
            let emitted = emitted.clone();
            move |event: &str, payload: serde_json::Value| {
                emitted.lock().unwrap().push((event.into(), payload));
            }
        };

        let input =
            b"{\"session_id\":\"s1\",\"event\":{\"type\":\"text_delta\",\"delta\":\"hi\"}}\n";
        let mut reader = BufReader::new(&input[..]);

        pump_reader(&state, &mut reader, emit).await;

        let events = emitted.lock().unwrap();
        assert!(
            events.iter().any(|(e, _)| e == "agent:event"),
            "must emit agent:event"
        );
        assert!(
            events.iter().any(|(e, p)| e == "agent:event"
                && p["event"]["type"] == "error"
                && p["event"]["message"] == "agent process exited"),
            "must emit EOF error event"
        );
        assert_eq!(events[0].1["session_id"], "s1");
        assert_eq!(events[0].1["event"]["delta"], "hi");
    }

    #[tokio::test]
    async fn pump_reader_resolves_boot_tx_on_session_id() {
        let state = make_test_state();
        let (tx, rx) = oneshot::channel();
        *state.boot_tx.lock().await = Some(tx);

        let input = b"{\"type\":\"session_id\",\"session_id\":\"new-id\"}\n";
        let mut reader = BufReader::new(&input[..]);
        let emit = |_: &str, _: serde_json::Value| {};

        pump_reader(&state, &mut reader, emit).await;

        let id = rx.await.unwrap();
        assert_eq!(id, "new-id");
    }

    #[tokio::test]
    async fn pump_reader_routes_list_reply_by_request_id() {
        let state = make_test_state();
        let (tx, rx) = oneshot::channel();
        state.pending_list.lock().await.insert("req-0".into(), tx);

        let input = b"{\"type\":\"list_sessions_reply\",\"requestId\":\"req-0\",\"sessions\":[]}\n";
        let mut reader = BufReader::new(&input[..]);
        let emit = |_: &str, _: serde_json::Value| {};

        pump_reader(&state, &mut reader, emit).await;

        let sessions = rx.await.unwrap();
        assert!(sessions.is_empty());
        assert!(state.pending_list.lock().await.is_empty());
    }

    #[tokio::test]
    async fn pump_reader_routes_load_reply_by_request_id() {
        let state = make_test_state();
        let (tx, rx) = oneshot::channel();
        state.pending_load.lock().await.insert("req-1".into(), tx);

        let input = b"{\"type\":\"load_session_reply\",\"requestId\":\"req-1\",\"session_id\":\"s1\",\"rows\":[],\"found\":true}\n";
        let mut reader = BufReader::new(&input[..]);
        let emit = |_: &str, _: serde_json::Value| {};

        pump_reader(&state, &mut reader, emit).await;

        let result = rx.await.unwrap();
        assert!(result.found);
        assert!(result.rows.is_empty());
    }

    #[tokio::test]
    async fn pump_reader_forwards_ui_request() {
        let state = make_test_state();
        let emitted = std::sync::Arc::new(std::sync::Mutex::new(
            Vec::<(String, serde_json::Value)>::new(),
        ));
        let emit = {
            let emitted = emitted.clone();
            move |event: &str, payload: serde_json::Value| {
                emitted.lock().unwrap().push((event.into(), payload));
            }
        };

        let input = b"{\"type\":\"ui_request\",\"request_id\":\"r1\",\"kind\":\"select_session\",\"payload\":{\"sessions\":[]}}\n";
        let mut reader = BufReader::new(&input[..]);

        pump_reader(&state, &mut reader, emit).await;

        let events = emitted.lock().unwrap();
        assert!(events.iter().any(|(e, _)| e == "agent:ui_request"));
        let ui_req = events
            .iter()
            .find(|(e, _)| e == "agent:ui_request")
            .unwrap();
        assert_eq!(ui_req.1["request_id"], "r1");
        assert_eq!(ui_req.1["kind"], "select_session");
    }

    #[tokio::test]
    async fn pump_reader_does_not_update_last_session_id_on_load_reply() {
        let state = make_test_state();
        *state.last_session_id.lock().await = Some("active-session".into());

        let (tx, _rx) = oneshot::channel::<LoadSessionResult>();
        state.pending_load.lock().await.insert("req-2".into(), tx);

        let input = b"{\"type\":\"load_session_reply\",\"requestId\":\"req-2\",\"session_id\":\"loaded-session\",\"rows\":[],\"found\":true}\n";
        let mut reader = BufReader::new(&input[..]);
        let emit = |_: &str, _: serde_json::Value| {};

        pump_reader(&state, &mut reader, emit).await;

        let last = state.last_session_id.lock().await.clone();
        assert_eq!(last.as_deref(), Some("active-session"));
    }

    #[test]
    fn next_request_id_is_unique() {
        let counter = AtomicU64::new(0);
        let id0 = next_request_id(&counter);
        let id1 = next_request_id(&counter);
        assert_ne!(id0, id1);
        assert!(id0.starts_with("req-"));
        assert!(id1.starts_with("req-"));
    }

    #[test]
    fn no_working_folder_error_message_is_actionable() {
        let err = resolve_cwd_from(None, None).unwrap_err();
        assert!(err.contains("working folder"));
        assert!(err.contains("project folder"));
    }

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
