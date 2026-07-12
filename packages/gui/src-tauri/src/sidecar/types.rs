//! Wire/data models shared between the Rust host, the Node sidecar, and the
//! Tauri frontend.

use serde::{Deserialize, Serialize};

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
    #[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
