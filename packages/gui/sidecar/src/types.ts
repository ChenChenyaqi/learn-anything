import type { SessionInfo } from '@earendil-works/pi-coding-agent';
import type { AgentEvent, ChatRow, SessionMeta } from '../../shared/protocol.ts';

export type { AgentEvent, ChatBlock, ChatRow, SessionMeta } from '../../shared/protocol.ts';

export interface AgentEventJsonL {
  session_id: string;
  event: AgentEvent;
}

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
