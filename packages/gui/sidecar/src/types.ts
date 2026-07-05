import type { SessionInfo } from '@earendil-works/pi-coding-agent';

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      status: 'ok' | 'error';
      result: string | null;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface AgentEventJsonL {
  session_id: string;
  event: AgentEvent;
}

export interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export type ChatBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      args: unknown;
      status: 'ok' | 'error';
      result: string | null;
    };

export type ChatRow = { role: 'user'; text: string } | { role: 'assistant'; blocks: ChatBlock[] };

export type UiRequestKind = 'select_session';

export interface SelectSessionPayload {
  sessions: SessionMeta[];
}

export type StdoutLine =
  | AgentEventJsonL
  | { type: 'session_id'; session_id: string }
  | {
      type: 'ui_request';
      request_id: string;
      kind: UiRequestKind;
      payload: SelectSessionPayload;
    }
  | { type: 'list_sessions_reply'; requestId: string; sessions: SessionMeta[] }
  | {
      type: 'load_session_reply';
      requestId: string;
      session_id: string;
      rows: ChatRow[];
      found: boolean;
    };

export function toSessionMeta(info: SessionInfo): SessionMeta {
  return {
    id: info.id,
    title: info.name ?? info.firstMessage,
    created_at: info.created.toISOString(),
    updated_at: info.modified.toISOString(),
    message_count: info.messageCount,
  };
}
