// Shared wire-protocol types used by both the Node sidecar and the Vue
// frontend. These mirror the Rust serde types exactly (snake_case field
// names, `type`/`role` discriminators).
//
// The single source of truth lives here so the sidecar (which emits these
// frames) and the frontend (which consumes them) cannot silently drift.

/**
 * Agent event variants emitted on the `agent:event` channel.
 * Mirrors the Rust `AgentEvent` enum (serde `tag = "type"`).
 */
export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      status: string;
      result: string | null;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

/**
 * One block inside an assistant message. Mirrors the Rust `ChatBlock` enum
 * (serde `tag = "type"`). The frontend uses `status: "running"` transiently
 * for in-flight tool calls before a `tool_result` event arrives.
 */
export type ChatBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      args: unknown;
      status: string;
      result: string | null;
    };

/**
 * One row in the transcript. Mirrors the Rust `ChatRow` enum
 * (serde `tag = "role"`).
 */
export type ChatRow = { role: 'user'; text: string } | { role: 'assistant'; blocks: ChatBlock[] };

/** Session metadata returned by `agent_list_sessions`. */
export interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}
