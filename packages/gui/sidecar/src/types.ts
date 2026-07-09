import type { SessionInfo } from '@earendil-works/pi-coding-agent';
import type { AgentEvent, ChatRow, SessionMeta } from '../../shared/protocol.ts';

export type { AgentEvent, ChatBlock, ChatRow, SessionMeta } from '../../shared/protocol.ts';

export interface AgentEventJsonL {
  session_id: string;
  event: AgentEvent;
}

export type StdoutLine =
  | AgentEventJsonL
  | { type: 'session_id'; session_id: string }
  | { type: 'list_sessions_reply'; requestId: string; sessions: SessionMeta[] }
  | {
      type: 'load_session_reply';
      requestId: string;
      session_id: string;
      rows: ChatRow[];
      found: boolean;
    }
  | {
      type: 'switch_session_reply';
      requestId: string;
      session_id: string;
      ok: boolean;
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
