//! Wire protocol: stdout frame parsing (sidecar → Rust) and stdin frame
//! writing (Rust → sidecar). Both directions are typed so that field names
//! and shapes are checked at compile time.
//!
//! The outbound shapes mirror the Node sidecar's zod schemas:
//! - boot frame → `BootConfigSchema` (`main.ts`)
//! - command frames → `AgentRequestSchema` (`request-loop.ts`)

use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tokio::io::AsyncWriteExt;

use super::log::log;
use super::state::SidecarState;
use super::types::{AgentEvent, ChatRow, SessionMeta};

/* ------------------------------------------------------------------ */
/*  Outbound: Rust → sidecar                                          */
/* ------------------------------------------------------------------ */

/// The first frame sent at boot. Has no `kind` discriminator; the sidecar
/// recognises it by the `apiKey` field.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct BootFrame {
    pub api_key: String,
    pub provider: String,
    pub base_url: Option<String>,
    pub model: String,
    pub cwd: String,
    pub session_id: Option<String>,
}

/// Every post-boot message, discriminated by `kind` (snake_case tag values).
/// `rename_all_fields = "camelCase"` maps `session_id` → `sessionId`, etc.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub(super) enum CommandFrame {
    UserMessage {
        session_id: String,
        text: String,
    },
    SlashCommand {
        text: String,
    },
    Cancel {
        session_id: String,
    },
    ListSessions {
        cwd: String,
        request_id: String,
    },
    LoadSession {
        session_id: String,
        cwd: String,
        request_id: String,
    },
    SwitchSession {
        session_id: String,
        cwd: String,
        request_id: String,
    },
}

/// A frame that can be written to the sidecar stdin and rendered as a
/// human-readable log line.
pub(super) trait OutgoingFrame: Serialize {
    fn describe(&self) -> String;
}

fn mask_key(key: &str) -> String {
    let len = key.chars().count();
    if len <= 4 {
        "***".to_string()
    } else {
        format!("***{}", key.chars().skip(len - 4).collect::<String>())
    }
}

impl OutgoingFrame for BootFrame {
    fn describe(&self) -> String {
        format!(
            "→ node  boot (provider={}, model={}, cwd={}, apiKey={})",
            self.provider,
            self.model,
            self.cwd,
            mask_key(&self.api_key)
        )
    }
}

impl OutgoingFrame for CommandFrame {
    fn describe(&self) -> String {
        match self {
            CommandFrame::UserMessage { session_id, text } => format!(
                "→ node  user_message (sid={session_id}, {} chars)",
                text.chars().count()
            ),
            CommandFrame::SlashCommand { text } => {
                format!("→ node  slash_command ({text})")
            }
            CommandFrame::Cancel { session_id } => format!("→ node  cancel (sid={session_id})"),
            CommandFrame::ListSessions { cwd, request_id } => {
                format!("→ node  list_sessions (req={request_id}, cwd={cwd})")
            }
            CommandFrame::LoadSession {
                session_id, request_id, ..
            } => format!("→ node  load_session (sid={session_id}, req={request_id})"),
            CommandFrame::SwitchSession {
                session_id, request_id, ..
            } => format!("→ node  switch_session (sid={session_id}, req={request_id})"),
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Inbound: sidecar → Rust                                           */
/* ------------------------------------------------------------------ */

#[derive(Debug)]
pub(super) enum StdoutLine {
    AgentEvent {
        session_id: String,
        event: AgentEvent,
    },
    SessionId(String),
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
    SwitchSessionReply {
        request_id: String,
        session_id: String,
        ok: bool,
    },
}

pub(super) fn parse_stdout_line(line: &str) -> Result<StdoutLine, String> {
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
            "switch_session_reply" => {
                let request_id = v
                    .get("requestId")
                    .and_then(|s| s.as_str())
                    .ok_or("switch_session_reply missing requestId")?
                    .to_string();
                let session_id = v
                    .get("session_id")
                    .and_then(|s| s.as_str())
                    .ok_or("switch_session_reply missing session_id")?
                    .to_string();
                let ok = v.get("ok").and_then(|b| b.as_bool()).unwrap_or(false);
                Ok(StdoutLine::SwitchSessionReply {
                    request_id,
                    session_id,
                    ok,
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

pub(super) fn next_request_id(counter: &AtomicU64) -> String {
    format!("req-{}", counter.fetch_add(1, Ordering::Relaxed))
}

pub(super) async fn write_frame<F: OutgoingFrame>(
    state: &SidecarState,
    frame: F,
) -> Result<(), String> {
    log(frame.describe());
    let mut stdin = state.stdin.lock().await;
    write_frame_to(&mut *stdin, &frame).await
}

async fn write_frame_to<W, S>(writer: &mut W, frame: &S) -> Result<(), String>
where
    W: tokio::io::AsyncWrite + Unpin,
    S: Serialize,
{
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

#[cfg(test)]
mod tests {
    use super::*;

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
    fn parse_switch_session_reply() {
        let line =
            r#"{"type":"switch_session_reply","requestId":"req-2","session_id":"s5","ok":true}"#;
        let parsed = parse_stdout_line(line).unwrap();
        match parsed {
            StdoutLine::SwitchSessionReply {
                request_id,
                session_id,
                ok,
            } => {
                assert_eq!(request_id, "req-2");
                assert_eq!(session_id, "s5");
                assert!(ok);
            }
            other => panic!("expected SwitchSessionReply, got {other:?}"),
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
    fn next_request_id_is_unique() {
        let counter = AtomicU64::new(0);
        let id0 = next_request_id(&counter);
        let id1 = next_request_id(&counter);
        assert_ne!(id0, id1);
        assert!(id0.starts_with("req-"));
        assert!(id1.starts_with("req-"));
    }

    #[tokio::test]
    async fn write_frame_to_produces_json_plus_newline() {
        use tokio::io::AsyncReadExt;
        let (mut rx, mut tx) = tokio::io::duplex(1024);
        let frame = CommandFrame::UserMessage {
            session_id: "s1".into(),
            text: "hello".into(),
        };
        write_frame_to(&mut tx, &frame).await.unwrap();
        tx.shutdown().await.unwrap();
        let mut buf = String::new();
        rx.read_to_string(&mut buf).await.unwrap();
        assert!(buf.contains(r#""kind":"user_message""#), "{buf}");
        assert!(buf.contains(r#""sessionId":"s1""#), "{buf}");
        assert!(buf.contains(r#""text":"hello""#), "{buf}");
        assert!(buf.ends_with('\n'), "must end with newline: {buf}");
    }

    #[tokio::test]
    async fn write_frame_to_switch_session_has_correct_shape() {
        use tokio::io::AsyncReadExt;
        let (mut rx, mut tx) = tokio::io::duplex(1024);
        let frame = CommandFrame::SwitchSession {
            session_id: "s5".into(),
            cwd: "/proj".into(),
            request_id: "req-0".into(),
        };
        write_frame_to(&mut tx, &frame).await.unwrap();
        tx.shutdown().await.unwrap();
        let mut buf = String::new();
        rx.read_to_string(&mut buf).await.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(buf.trim()).unwrap();
        assert_eq!(parsed["kind"], "switch_session");
        assert_eq!(parsed["sessionId"], "s5");
        assert_eq!(parsed["requestId"], "req-0");
    }

    #[test]
    fn command_frame_user_message_serializes_exact_wire_format() {
        let frame = CommandFrame::UserMessage {
            session_id: "s1".into(),
            text: "hi".into(),
        };
        assert_eq!(
            serde_json::to_string(&frame).unwrap(),
            r#"{"kind":"user_message","sessionId":"s1","text":"hi"}"#
        );
    }

    #[test]
    fn command_frame_slash_command_serializes_exact_wire_format() {
        let frame = CommandFrame::SlashCommand {
            text: "/new".into(),
        };
        assert_eq!(
            serde_json::to_string(&frame).unwrap(),
            r#"{"kind":"slash_command","text":"/new"}"#
        );
    }

    #[test]
    fn command_frame_cancel_serializes_exact_wire_format() {
        let frame = CommandFrame::Cancel {
            session_id: "s1".into(),
        };
        assert_eq!(
            serde_json::to_string(&frame).unwrap(),
            r#"{"kind":"cancel","sessionId":"s1"}"#
        );
    }

    #[test]
    fn command_frame_list_sessions_serializes_exact_wire_format() {
        let frame = CommandFrame::ListSessions {
            cwd: "/proj".into(),
            request_id: "req-0".into(),
        };
        assert_eq!(
            serde_json::to_string(&frame).unwrap(),
            r#"{"kind":"list_sessions","cwd":"/proj","requestId":"req-0"}"#
        );
    }

    #[test]
    fn command_frame_load_and_switch_serialize_exact_wire_format() {
        let load = CommandFrame::LoadSession {
            session_id: "s1".into(),
            cwd: "/proj".into(),
            request_id: "req-0".into(),
        };
        assert_eq!(
            serde_json::to_string(&load).unwrap(),
            r#"{"kind":"load_session","sessionId":"s1","cwd":"/proj","requestId":"req-0"}"#
        );
        let switch = CommandFrame::SwitchSession {
            session_id: "s5".into(),
            cwd: "/proj".into(),
            request_id: "req-1".into(),
        };
        assert_eq!(
            serde_json::to_string(&switch).unwrap(),
            r#"{"kind":"switch_session","sessionId":"s5","cwd":"/proj","requestId":"req-1"}"#
        );
    }

    #[test]
    fn boot_frame_serializes_exact_wire_format() {
        let frame = BootFrame {
            api_key: "sk-secret".into(),
            provider: "openai".into(),
            base_url: None,
            model: "gpt-4o".into(),
            cwd: "/proj".into(),
            session_id: None,
        };
        assert_eq!(
            serde_json::to_string(&frame).unwrap(),
            r#"{"apiKey":"sk-secret","provider":"openai","baseUrl":null,"model":"gpt-4o","cwd":"/proj","sessionId":null}"#
        );
    }

    #[test]
    fn boot_frame_with_optional_values_serializes_them() {
        let frame = BootFrame {
            api_key: "k".into(),
            provider: "anthropic".into(),
            base_url: Some("https://example.com".into()),
            model: "claude".into(),
            cwd: "/c".into(),
            session_id: Some("existing".into()),
        };
        let v: serde_json::Value = serde_json::to_value(&frame).unwrap();
        assert_eq!(v["baseUrl"], "https://example.com");
        assert_eq!(v["sessionId"], "existing");
    }
}
