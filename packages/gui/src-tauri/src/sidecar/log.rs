//! Human-readable debug tracing of every frame crossing the stdin/stdout
//! boundary. Each line is printed to stderr with a timestamp.
//!
//! Outbound (Rust → sidecar) describe logic lives next to the frame types in
//! [`crate::sidecar::wire`]; this module owns the inbound (sidecar → Rust)
//! formatting.

use super::types::AgentEvent;
use super::wire::StdoutLine;

fn now_hms() -> String {
    chrono::Local::now().format("%H:%M:%S").to_string()
}

pub(super) fn log(msg: impl std::fmt::Display) {
    if !cfg!(debug_assertions) {
        return;
    }
    eprintln!("{} [rust] {msg}", now_hms());
}

fn describe_agent_event(event: &AgentEvent) -> String {
    match event {
        AgentEvent::TextDelta { delta } => {
            format!("text_delta, {} chars", delta.chars().count())
        }
        AgentEvent::ToolCall { id, name, .. } => format!("tool_call, id={id}, name={name}"),
        AgentEvent::ToolResult {
            id,
            name,
            status,
            result,
        } => match result {
            Some(r) => format!(
                "tool_result, id={id}, name={name}, {status}, {} chars",
                r.chars().count()
            ),
            None => format!("tool_result, id={id}, name={name}, {status}"),
        },
        AgentEvent::Done => "done".to_string(),
        AgentEvent::Error { message } => format!("error, {message}"),
    }
}

pub(super) fn describe_incoming(line: &StdoutLine) -> String {
    match line {
        StdoutLine::AgentEvent { session_id, event } => format!(
            "← node  agent_event (sid={session_id}, {})",
            describe_agent_event(event)
        ),
        StdoutLine::SessionId(id) => format!("← node  session_id ({id})"),
        StdoutLine::SwitchSessionReply {
            request_id,
            session_id,
            ok,
        } => format!("← node  switch_session_reply (req={request_id}, sid={session_id}, ok={ok})"),
        StdoutLine::ListSessionsReply {
            request_id,
            sessions,
        } => format!(
            "← node  list_sessions_reply (req={request_id}, {} sessions)",
            sessions.len()
        ),
        StdoutLine::LoadSessionReply {
            request_id,
            session_id,
            rows,
            found,
        } => format!(
            "← node  load_session_reply (req={request_id}, sid={session_id}, {} rows, found={found})",
            rows.len()
        ),
    }
}

pub(super) fn is_suppressed(line: &StdoutLine) -> bool {
    matches!(
        line,
        StdoutLine::AgentEvent {
            event: AgentEvent::TextDelta { .. }
                | AgentEvent::ToolCall { .. }
                | AgentEvent::ToolResult { .. },
            ..
        }
    )
}
