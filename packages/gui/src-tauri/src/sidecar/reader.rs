//! The stdout pump: reads newline-delimited JSON, emits Tauri events, and
//! resolves pending request channels.

use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::ChildStdout;

use super::log::{describe_incoming, is_suppressed, log};
use super::state::SidecarState;
use super::types::LoadSessionResult;
use super::wire::{parse_stdout_line, StdoutLine};

pub(super) async fn run_reader(app: AppHandle, state: Arc<SidecarState>, stdout: ChildStdout) {
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
                    Ok(line) => {
                        if !is_suppressed(&line) {
                            log(describe_incoming(&line));
                        }
                        match line {
                            StdoutLine::AgentEvent { session_id, event } => {
                                *state.last_session_id.lock().await = Some(session_id.clone());
                                emit(
                                    "agent:event",
                                    serde_json::json!({ "session_id": session_id, "event": event }),
                                );
                            }
                            StdoutLine::SessionId(id) => {
                                *state.last_session_id.lock().await = Some(id.clone());
                                if let Some(tx) = state.boot_tx.lock().await.take() {
                                    log(format!("boot_tx resolved → {id}"));
                                    let _ = tx.send(id);
                                }
                            }
                            StdoutLine::SwitchSessionReply {
                                request_id,
                                session_id,
                                ok,
                            } => {
                                if let Some(tx) =
                                    state.pending_switch.lock().await.remove(&request_id)
                                {
                                    log(format!(
                                        "pending_switch resolved (req={request_id}, ok={ok})"
                                    ));
                                    let _ = tx.send(ok);
                                }
                                let _ = session_id;
                            }
                            StdoutLine::ListSessionsReply {
                                request_id,
                                sessions,
                            } => {
                                if let Some(tx) =
                                    state.pending_list.lock().await.remove(&request_id)
                                {
                                    log(format!("pending_list resolved (req={request_id})"));
                                    let _ = tx.send(sessions);
                                }
                            }
                            StdoutLine::LoadSessionReply {
                                request_id,
                                session_id,
                                rows,
                                found,
                            } => {
                                if let Some(tx) =
                                    state.pending_load.lock().await.remove(&request_id)
                                {
                                    log(format!("pending_load resolved (req={request_id})"));
                                    let _ = tx.send(LoadSessionResult { rows, found });
                                }
                                let _ = session_id;
                            }
                        }
                    }
                    Err(e) => {
                        log(format!("unparseable stdout line: {e}"));
                    }
                }
            }
            Err(e) => {
                log(format!("stdout read error: {e}"));
                break;
            }
        }
    }

    let last = state.last_session_id.lock().await.clone();
    log(format!("stdout EOF (last={last:?})"));
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

#[cfg(test)]
mod tests {
    use super::super::state::make_test_state;
    use super::super::types::LoadSessionResult;
    use tokio::io::BufReader;
    use tokio::sync::oneshot;

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

        super::pump_reader(&state, &mut reader, emit).await;

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

        super::pump_reader(&state, &mut reader, emit).await;

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

        super::pump_reader(&state, &mut reader, emit).await;

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

        super::pump_reader(&state, &mut reader, emit).await;

        let result = rx.await.unwrap();
        assert!(result.found);
        assert!(result.rows.is_empty());
    }

    #[tokio::test]
    async fn pump_reader_routes_switch_reply_by_request_id() {
        let state = make_test_state();
        let (tx, rx) = oneshot::channel();
        state.pending_switch.lock().await.insert("req-3".into(), tx);

        let input =
            b"{\"type\":\"switch_session_reply\",\"requestId\":\"req-3\",\"session_id\":\"s5\",\"ok\":true}\n";
        let mut reader = BufReader::new(&input[..]);
        let emit = |_: &str, _: serde_json::Value| {};

        super::pump_reader(&state, &mut reader, emit).await;

        let ok = rx.await.unwrap();
        assert!(ok);
        assert!(state.pending_switch.lock().await.is_empty());
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

        super::pump_reader(&state, &mut reader, emit).await;

        let last = state.last_session_id.lock().await.clone();
        assert_eq!(last.as_deref(), Some("active-session"));
    }
}
